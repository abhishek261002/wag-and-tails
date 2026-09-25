import { randomBytes } from 'crypto';
import { parse as parseCsvSync } from 'csv-parse/sync';
import ExcelJS from 'exceljs';

export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

// The columns of the product sheet, in template order.
export const COLUMNS = [
  'sku', 'name', 'category', 'mrp', 'retail_price', 'trade_price',
  'description', 'tags', 'allergy_warnings', 'image_urls', 'is_active',
] as const;
export type Column = (typeof COLUMNS)[number];

const ALIASES: Record<string, Column> = {
  sku: 'sku', 'product sku': 'sku', 'item code': 'sku', code: 'sku',
  name: 'name', 'product name': 'name', product: 'name', title: 'name',
  category: 'category', 'category name': 'category',
  mrp: 'mrp', 'max retail price': 'mrp', 'list price': 'mrp',
  'retail price': 'retail_price', retail_price: 'retail_price', price: 'retail_price', 'selling price': 'retail_price', 'sale price': 'retail_price',
  'trade price': 'trade_price', trade_price: 'trade_price', 'wholesale price': 'trade_price', 'b2b price': 'trade_price',
  description: 'description', details: 'description',
  tags: 'tags',
  'allergy warnings': 'allergy_warnings', allergy_warnings: 'allergy_warnings', allergens: 'allergy_warnings',
  'image urls': 'image_urls', image_urls: 'image_urls', images: 'image_urls', 'image url': 'image_urls',
  'is active': 'is_active', is_active: 'is_active', active: 'is_active', status: 'is_active',
};

export function normalizeHeader(h: string): Column | null {
  const key = h.replace(/^﻿/, '').trim().toLowerCase().replace(/[_\s]+/g, ' ');
  return ALIASES[key] ?? ALIASES[key.replace(/ /g, '_')] ?? null;
}

// ── File → matrix of strings ─────────────────────────────────────────────────

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString();
  const o = v as any;
  if (o.richText) return o.richText.map((r: any) => r.text).join('');
  if ('result' in o && o.result != null) return cellText(o.result); // formula
  if (o.text != null) return String(o.text); // hyperlink
  if (o.error) return `#${o.error}`;
  return '';
}

export async function readMatrix(buffer: Buffer, filename: string): Promise<string[][]> {
  const isXlsx = buffer.length > 3 && buffer[0] === 0x50 && buffer[1] === 0x4b; // "PK" zip signature
  const lower = filename.toLowerCase();
  if (lower.endsWith('.xls')) throw new Error('Old .xls files are not supported. Save the file as .xlsx or .csv.');
  if (isXlsx || lower.endsWith('.xlsx')) {
    if (!isXlsx) throw new Error('This file is not a valid .xlsx workbook.');
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buffer as any);
    } catch {
      throw new Error('Could not read the Excel file. Re-save it as .xlsx and try again.');
    }
    const ws = wb.worksheets.find((w) => w.state === 'visible' && w.actualRowCount > 0) ?? wb.worksheets[0];
    if (!ws) throw new Error('The workbook has no sheets.');
    if (ws.rowCount > MAX_IMPORT_ROWS + 1000) throw new Error(`The sheet has too many rows (max ${MAX_IMPORT_ROWS} products per upload).`);
    const out: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row, n) => {
      const cells: string[] = [];
      const width = Math.min(row.cellCount, 30);
      for (let c = 1; c <= width; c++) cells.push(cellText(row.getCell(c).value).trim());
      out[n - 1] = cells;
    });
    return out.map((r) => r ?? []);
  }
  try {
    const text = buffer.toString('utf8');
    return (parseCsvSync(text, { bom: true, relax_column_count: true, skip_empty_lines: true, trim: true, relax_quotes: true }) as string[][]);
  } catch {
    throw new Error('Could not read the CSV file. Check that it is a comma-separated file with a header row.');
  }
}

export interface RawRow {
  line: number; // 1-based line in the file (header = 1)
  cells: Partial<Record<Column, string>>;
}

export function toRawRows(matrix: string[][]): { rows: RawRow[]; problems: string[]; unknownColumns: string[] } {
  const problems: string[] = [];
  const unknownColumns: string[] = [];
  let headerIdx = matrix.findIndex((r) => r && r.some((c) => c && c.trim()));
  if (headerIdx < 0) return { rows: [], problems: ['The file is empty.'], unknownColumns };
  const header = matrix[headerIdx]!;
  const map: (Column | null)[] = header.map((h) => normalizeHeader(h ?? ''));
  header.forEach((h, i) => { if (h && !map[i]) unknownColumns.push(h); });
  const seen = new Set<string>();
  for (const c of map) {
    if (c && seen.has(c)) problems.push(`Column "${c}" appears more than once.`);
    if (c) seen.add(c);
  }
  if (!seen.has('sku') && !seen.has('name')) problems.push('The header row needs at least a "name" or "sku" column.');
  if (problems.length) return { rows: [], problems, unknownColumns };

  const rows: RawRow[] = [];
  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const r = matrix[i];
    if (!r || r.every((c) => !c || !c.trim())) continue;
    const cells: RawRow['cells'] = {};
    map.forEach((col, j) => { if (col) cells[col] = (r[j] ?? '').trim(); });
    rows.push({ line: i + 1, cells });
  }
  if (rows.length > MAX_IMPORT_ROWS) return { rows: [], problems: [`Too many rows: ${rows.length}. The limit is ${MAX_IMPORT_ROWS} per upload.`], unknownColumns };
  return { rows, problems, unknownColumns };
}

// ── Row validation ───────────────────────────────────────────────────────────

export interface ExistingProduct {
  id: string;
  sku: string | null;
  name: string;
  categoryId: string;
  description: string | null;
  mrp: number;
  retailPrice: number;
  tradePrice: number;
  tags: string[];
  allergyWarnings: string[];
  imageUrls: string[];
  isActive: boolean;
  updatedAt: string;
}

export interface ProductValues {
  sku?: string | null;
  name: string;
  categoryId: string;
  description: string | null;
  mrp: number;
  retailPrice: number;
  tradePrice: number;
  tags: string[];
  allergyWarnings: string[];
  imageUrls: string[];
  isActive: boolean;
}

export interface PlanRow {
  line: number;
  action: 'create' | 'update' | 'unchanged' | 'error' | 'skipped';
  sku: string | null;
  name: string;
  productId?: string;
  /** updatedAt of the product when previewed; the commit refuses to overwrite a product edited since. */
  baseUpdatedAt?: string;
  create?: ProductValues & { slug: string };
  update?: Partial<ProductValues>;
  changes?: { field: string; from: unknown; to: unknown }[];
  errors: string[];
  warnings: string[];
}

export interface Lookup {
  categories: Map<string, string>; // lowercase name/slug -> id
  categoryNames: Map<string, string>; // id -> name
  bySku: Map<string, ExistingProduct>; // lowercase sku
  byCatName: Map<string, ExistingProduct>; // `${categoryId}|${lowercase name}`
}

export type ImportMode = 'upsert' | 'create_only' | 'update_only';

const SKU_RE = /^[A-Za-z0-9][A-Za-z0-9._\-/]{0,63}$/;
const MAX_PRICE = 10_000_000;

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80) || 'product';

function parseMoney(raw: string, label: string, errors: string[]): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/[₹\s,]/g, '').replace(/^rs\.?/i, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    errors.push(`${label} "${raw}" is not a valid amount (use numbers like 499 or 499.50)`);
    return undefined;
  }
  const n = Number(cleaned);
  if (n > MAX_PRICE) {
    errors.push(`${label} is too large`);
    return undefined;
  }
  return n;
}

function parseList(raw: string | undefined, label: string, max: number, errors: string[], each?: (v: string) => string | null): string[] | undefined {
  if (raw === undefined || raw === '') return undefined;
  const items = [...new Set(raw.split(/[,;|]/).map((s) => s.trim()).filter(Boolean))];
  if (items.length > max) errors.push(`${label}: at most ${max} items`);
  for (const it of items) {
    const bad = each?.(it);
    if (bad) errors.push(`${label}: ${bad}`);
    if (it.length > 200) errors.push(`${label}: an item is too long`);
  }
  return items;
}

const TRUE = new Set(['yes', 'y', 'true', '1', 'active', 'on']);
const FALSE = new Set(['no', 'n', 'false', '0', 'inactive', 'off']);

export function validateRow(raw: RawRow, mode: ImportMode, ctx: Lookup, seenSkus: Set<string>, seenNew: Set<string>): PlanRow {
  const c = raw.cells;
  const errors: string[] = [];
  const warnings: string[] = [];
  const sku = (c.sku ?? '').trim();
  const nameIn = (c.name ?? '').trim();
  const out: PlanRow = { line: raw.line, action: 'error', sku: sku || null, name: nameIn, errors, warnings };

  if (sku && !SKU_RE.test(sku)) errors.push('SKU may only contain letters, digits and . _ - / (max 64 characters)');
  if (sku) {
    if (seenSkus.has(sku.toLowerCase())) errors.push(`SKU "${sku}" appears more than once in this file`);
    seenSkus.add(sku.toLowerCase());
  }
  if (nameIn.length > 200) errors.push('Name is too long (max 200 characters)');

  // Who is this row about?
  let existing: ExistingProduct | undefined = sku ? ctx.bySku.get(sku.toLowerCase()) : undefined;
  let categoryId: string | undefined;
  if (c.category) {
    categoryId = ctx.categories.get(c.category.trim().toLowerCase());
    if (!categoryId) errors.push(`Unknown category "${c.category}". Existing: ${[...ctx.categoryNames.values()].join(', ')}`);
  }
  // Products added by hand have no SKU. Match them by exact category + name so an exported sheet can be
  // edited and uploaded back, and so a SKU can be assigned to them.
  let matchedByName = false;
  if (!existing && nameIn && categoryId) {
    const byName = ctx.byCatName.get(`${categoryId}|${nameIn.toLowerCase()}`);
    if (byName && (!sku || !byName.sku) && mode !== 'create_only') {
      existing = byName;
      matchedByName = true;
      warnings.push(sku ? `Matched the existing product "${byName.name}" by name; SKU "${sku}" will be assigned to it` : 'Matched by name (no SKU). Add a SKU to make updates exact.');
    } else if (byName && mode === 'create_only') {
      errors.push(`A product named "${nameIn}" already exists in this category`);
    }
  }

  const isUpdate = !!existing;
  if (isUpdate && mode === 'create_only' && !matchedByName) errors.push(`SKU "${sku}" already exists (this upload only creates new products)`);
  if (!isUpdate && mode === 'update_only') errors.push(sku ? `SKU "${sku}" was not found (this upload only updates existing products)` : 'Update-only uploads need a SKU on every row');

  const mrp = parseMoney(c.mrp ?? '', 'MRP', errors);
  const retail = parseMoney(c.retail_price ?? '', 'Retail price', errors);
  const trade = parseMoney(c.trade_price ?? '', 'Trade price', errors);
  const tags = parseList(c.tags, 'Tags', 20, errors);
  const allergy = parseList(c.allergy_warnings, 'Allergy warnings', 20, errors);
  const images = parseList(c.image_urls, 'Image URLs', 10, errors, (u) => (/^https:\/\/\S+$/.test(u) || /^\/uploads\/[\w.\-]+$/.test(u) ? null : `"${u}" must be an https link or an uploaded file path`));
  const desc = c.description;
  if (desc && desc.length > 5000) errors.push('Description is too long (max 5000 characters)');
  let active: boolean | undefined;
  if (c.is_active) {
    const v = c.is_active.toLowerCase();
    if (TRUE.has(v)) active = true;
    else if (FALSE.has(v)) active = false;
    else errors.push(`Active "${c.is_active}" should be yes or no`);
  }

  if (!isUpdate) {
    // CREATE: name, category and a price are required; the rest default.
    if (!nameIn) errors.push('Name is required for a new product');
    if (!categoryId && !c.category) errors.push('Category is required for a new product');
    if (retail === undefined && !(c.retail_price ?? '')) errors.push('Retail price is required for a new product');
    if (errors.length) return out;
    const r = retail!;
    const m = mrp ?? r;
    const t = trade ?? r;
    if (mrp === undefined) warnings.push('MRP missing: set equal to the retail price');
    if (trade === undefined) warnings.push('Trade price missing: set equal to the retail price (no trade discount)');
    if (r > m) errors.push(`Retail price ₹${r} is higher than MRP ₹${m}`);
    if (t > r) warnings.push(`Trade price ₹${t} is higher than the retail price ₹${r}`);
    const dupKey = `${categoryId}|${nameIn.toLowerCase()}`;
    if (seenNew.has(dupKey)) errors.push(`"${nameIn}" appears more than once in this category in the file`);
    seenNew.add(dupKey);
    if (errors.length) return out;
    out.action = 'create';
    out.create = {
      sku: sku || null,
      name: nameIn,
      categoryId: categoryId!,
      description: desc || null,
      mrp: m,
      retailPrice: r,
      tradePrice: t,
      tags: tags ?? [],
      allergyWarnings: allergy ?? [],
      imageUrls: images ?? [],
      isActive: active ?? true,
      slug: `${slugify(nameIn)}-${randomBytes(3).toString('hex')}`,
    };
    return out;
  }

  // UPDATE: blank cells leave the product unchanged.
  existing = existing!;
  out.productId = existing.id;
  out.baseUpdatedAt = existing.updatedAt;
  out.name = nameIn || existing.name;
  const next: Partial<ProductValues> = {};
  if (nameIn) next.name = nameIn;
  if (matchedByName && sku && !existing.sku) next.sku = sku;
  if (categoryId) next.categoryId = categoryId;
  if (c.description !== undefined && c.description !== '') next.description = c.description;
  if (mrp !== undefined) next.mrp = mrp;
  if (retail !== undefined) next.retailPrice = retail;
  if (trade !== undefined) next.tradePrice = trade;
  if (tags) next.tags = tags;
  if (allergy) next.allergyWarnings = allergy;
  if (images) next.imageUrls = images;
  if (active !== undefined) next.isActive = active;

  const mergedRetail = next.retailPrice ?? existing.retailPrice;
  const mergedMrp = next.mrp ?? existing.mrp;
  const mergedTrade = next.tradePrice ?? existing.tradePrice;
  if (mergedRetail > mergedMrp) errors.push(`Retail price ₹${mergedRetail} would be higher than MRP ₹${mergedMrp}`);
  if (mergedTrade > mergedRetail) warnings.push(`Trade price ₹${mergedTrade} is higher than the retail price ₹${mergedRetail}`);
  if (errors.length) return out;

  const changes: NonNullable<PlanRow['changes']> = [];
  const update: Partial<ProductValues> = {};
  for (const [k, v] of Object.entries(next) as [keyof ProductValues, any][]) {
    const before = (existing as any)[k];
    const same = Array.isArray(v) ? JSON.stringify(v) === JSON.stringify(before) : typeof v === 'number' ? Number(before) === v : before === v;
    if (!same) {
      (update as any)[k] = v;
      changes.push({ field: k, from: before, to: v });
    }
  }
  out.changes = changes;
  if (changes.length === 0) {
    out.action = 'unchanged';
    return out;
  }
  out.action = 'update';
  out.update = update;
  return out;
}
