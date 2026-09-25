import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditLogService } from '../audit-log/audit-log.service.js';
import {
  COLUMNS, MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, readMatrix, toRawRows, validateRow,
  type ExistingProduct, type ImportMode, type Lookup, type PlanRow,
} from './catalog-rows.js';

export interface Actor { sub: string; role: string; email?: string }

const MODES: ImportMode[] = ['upsert', 'create_only', 'update_only'];
const PREVIEW_ROW_CAP = 300;

// A cell that starts with = + - @ can be executed as a formula when a spreadsheet opens an export.
const safeCell = (v: unknown): string | number | boolean => {
  if (typeof v !== 'string') return v as any;
  return /^[=+\-@\t\r]/.test(v) && !/^-?\d+(\.\d+)?$/.test(v) ? `'${v}` : v;
};

@Injectable()
export class CatalogImportService {
  private readonly logger = new Logger(CatalogImportService.name);

  constructor(private prisma: PrismaService, private audit: AuditLogService) {}

  // ── Template / export ────────────────────────────────────────────────────────

  async template(format: 'xlsx' | 'csv'): Promise<{ buffer: Buffer; filename: string; mime: string }> {
    const categories = await this.prisma.productCategory.findMany({ where: { isActive: true }, orderBy: { displayOrder: 'asc' }, select: { name: true } });
    const cat = categories[0]?.name ?? 'Treats';
    const examples = [
      ['TREAT-001', 'Chicken Jerky Strips 100g', cat, 399, 349, 299, 'Slow-baked chicken strips', 'dog, treat', 'chicken', '', 'yes'],
      ['', 'Sample product without a SKU (creates a new product)', cat, '', 199, '', '', '', '', '', 'yes'],
    ];
    return this.build(format, 'product-import-template', examples, categories.map((c) => c.name), true);
  }

  async export(format: 'xlsx' | 'csv'): Promise<{ buffer: Buffer; filename: string; mime: string }> {
    const products = await this.prisma.product.findMany({ include: { category: { select: { name: true } } }, orderBy: [{ categoryId: 'asc' }, { name: 'asc' }], take: 20000 });
    const rows = products.map((p) => [
      p.sku ?? '', p.name, p.category.name, Number(p.mrp), Number(p.retailPrice), Number(p.tradePrice),
      p.description ?? '', p.tags.join(', '), p.allergyWarnings.join(', '), p.imageUrls.join(', '), p.isActive ? 'yes' : 'no',
    ]);
    return this.build(format, 'products', rows, [], false);
  }

  private async build(format: 'xlsx' | 'csv', base: string, rows: unknown[][], categories: string[], withHelp: boolean) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Products');
    ws.addRow([...COLUMNS]);
    ws.getRow(1).font = { bold: true };
    ws.columns = COLUMNS.map((c) => ({ width: c === 'name' || c === 'description' ? 42 : 18 }));
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    for (const r of rows) ws.addRow(r.map(safeCell));
    if (format === 'csv') {
      const buffer = Buffer.from(await wb.csv.writeBuffer());
      return { buffer, filename: `${base}.csv`, mime: 'text/csv; charset=utf-8' };
    }
    if (withHelp) {
      const help = wb.addWorksheet('How to use');
      [
        ['Wag & Tails product upload'],
        [''],
        ['One row per product. Keep the header row exactly as it is on the "Products" sheet.'],
        ['sku: your own unique code. With a SKU the row updates that product if it exists, otherwise it is created.'],
        ['name, category, retail_price: required for new products. mrp and trade_price default to the retail price when blank.'],
        ['On updates, a blank cell leaves that field unchanged.'],
        ['tags, allergy_warnings, image_urls: separate several values with commas. image_urls must be https links.'],
        ['is_active: yes or no (defaults to yes for new products).'],
        [`Up to ${MAX_IMPORT_ROWS} products and ${MAX_IMPORT_BYTES / 1024 / 1024} MB per upload. You always see a preview before anything is saved.`],
        [''],
        ['Categories (spelling must match):'],
        ...categories.map((c) => [c]),
      ].forEach((r) => help.addRow(r));
      help.getColumn(1).width = 110;
      help.getRow(1).font = { bold: true, size: 14 };
    }
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    return { buffer, filename: `${base}.xlsx`, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  }

  // ── Preview (validate, apply nothing) ────────────────────────────────────────

  private async lookup(): Promise<Lookup> {
    const [cats, products] = await Promise.all([
      this.prisma.productCategory.findMany({ select: { id: true, name: true, slug: true } }),
      this.prisma.product.findMany({
        select: { id: true, sku: true, name: true, categoryId: true, description: true, mrp: true, retailPrice: true, tradePrice: true, tags: true, allergyWarnings: true, imageUrls: true, isActive: true, updatedAt: true },
      }),
    ]);
    const categories = new Map<string, string>();
    const categoryNames = new Map<string, string>();
    for (const c of cats) {
      categories.set(c.name.trim().toLowerCase(), c.id);
      categories.set(c.slug.toLowerCase(), c.id);
      categoryNames.set(c.id, c.name);
    }
    const bySku = new Map<string, ExistingProduct>();
    const byCatName = new Map<string, ExistingProduct>();
    for (const p of products) {
      const e: ExistingProduct = {
        id: p.id, sku: p.sku, name: p.name, categoryId: p.categoryId, description: p.description,
        mrp: Number(p.mrp), retailPrice: Number(p.retailPrice), tradePrice: Number(p.tradePrice),
        tags: p.tags, allergyWarnings: p.allergyWarnings, imageUrls: p.imageUrls, isActive: p.isActive, updatedAt: p.updatedAt.toISOString(),
      };
      if (p.sku) bySku.set(p.sku.toLowerCase(), e);
      byCatName.set(`${p.categoryId}|${p.name.trim().toLowerCase()}`, e);
    }
    return { categories, categoryNames, bySku, byCatName };
  }

  async preview(actor: Actor, file: { buffer: Buffer; filename: string }, modeIn: unknown) {
    const mode = (modeIn ?? 'upsert') as ImportMode;
    if (!MODES.includes(mode)) throw new BadRequestException('mode must be upsert, create_only or update_only');
    if (file.buffer.length === 0) throw new BadRequestException('The file is empty.');
    if (file.buffer.length > MAX_IMPORT_BYTES) throw new PayloadTooLargeException(`The file is larger than ${MAX_IMPORT_BYTES / 1024 / 1024} MB.`);

    let matrix: string[][];
    try {
      matrix = await readMatrix(file.buffer, file.filename);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    const { rows, problems, unknownColumns } = toRawRows(matrix);
    if (problems.length) throw new BadRequestException(problems.join(' '));
    if (rows.length === 0) throw new BadRequestException('The file has a header row but no products.');

    const ctx = await this.lookup();
    const seenSkus = new Set<string>();
    const seenNew = new Set<string>();
    const plan: PlanRow[] = rows.map((r) => validateRow(r, mode, ctx, seenSkus, seenNew));

    const count = (a: PlanRow['action']) => plan.filter((p) => p.action === a).length;
    const summary = {
      total: plan.length,
      create: count('create'),
      update: count('update'),
      unchanged: count('unchanged'),
      errors: count('error'),
      warnings: plan.reduce((s, p) => s + p.warnings.length, 0),
      unknownColumns,
    };

    // Old previews are of no use once a week has passed.
    await this.prisma.catalogImport.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 7 * 86400_000) } } }).catch(() => {});
    const rec = await this.prisma.catalogImport.create({
      data: { createdBy: actor.sub, filename: file.filename.slice(0, 200), mode, summary: summary as any, plan: plan as any },
    });
    await this.audit.log({ userId: actor.sub, userEmail: actor.email, userRole: actor.role, action: 'catalog.import.preview', entity: 'catalog_import', entityId: rec.id, changes: { filename: file.filename, mode, ...summary } }).catch(() => {});

    // Errors first, then changes; the rest of the detail is one click away in the exported plan.
    const order = { error: 0, create: 1, update: 2, unchanged: 3, skipped: 4 } as const;
    const shown = [...plan].sort((a, b) => order[a.action] - order[b.action] || a.line - b.line).slice(0, PREVIEW_ROW_CAP);
    return { importId: rec.id, mode, summary, rows: shown.map(this.publicRow), truncated: plan.length > shown.length };
  }

  private publicRow = (p: PlanRow) => ({
    line: p.line, action: p.action, sku: p.sku, name: p.name, changes: p.changes, errors: p.errors, warnings: p.warnings,
    price: p.create ? p.create.retailPrice : undefined,
  });

  async get(id: string) {
    const rec = await this.prisma.catalogImport.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException('Import not found');
    return { importId: rec.id, status: rec.status, filename: rec.filename, mode: rec.mode, summary: rec.summary, createdAt: rec.createdAt, appliedAt: rec.appliedAt };
  }

  // ── Commit ───────────────────────────────────────────────────────────────────

  async commit(actor: Actor, id: string, opts: { skipInvalid?: unknown }) {
    const rec = await this.prisma.catalogImport.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException('Import not found');
    if (rec.createdBy !== actor.sub && actor.role !== 'admin') throw new NotFoundException('Import not found');
    const plan = rec.plan as unknown as PlanRow[];
    const errors = plan.filter((p) => p.action === 'error').length;
    if (errors > 0 && opts.skipInvalid !== true) {
      throw new ConflictException({ code: 'HAS_ERRORS', message: `${errors} row${errors === 1 ? ' has' : 's have'} errors. Fix the file and upload again, or import only the valid rows.`, errors });
    }
    const work = plan.filter((p) => p.action === 'create' || p.action === 'update');
    if (work.length === 0) throw new BadRequestException('There is nothing to import.');

    // One commit only: the first caller flips pending -> committing.
    const claimed = await this.prisma.catalogImport.updateMany({ where: { id, status: 'pending' }, data: { status: 'committing' } });
    if (claimed.count === 0) throw new ConflictException({ code: 'ALREADY_APPLIED', message: 'This import was already applied or is being applied.' });

    let created = 0;
    let updated = 0;
    try {
      await this.prisma.$transaction(
        async (tx) => {
          for (const p of work) {
            if (p.action === 'create') {
              const { slug, ...v } = p.create!;
              await tx.product.create({ data: { ...v, slug, sku: v.sku ?? null } });
              created++;
            } else {
              // Refuse to overwrite a product someone edited after the preview was made.
              const res = await tx.product.updateMany({
                where: { id: p.productId!, updatedAt: new Date(p.baseUpdatedAt!) },
                data: p.update as Prisma.ProductUpdateManyMutationInput,
              });
              if (res.count === 0) throw new ConflictException({ code: 'CATALOG_CHANGED', message: `"${p.name}" (row ${p.line}) was edited after the preview. Upload the file again.` });
              updated++;
            }
          }
        },
        { timeout: 120_000, maxWait: 10_000 }
      );
    } catch (err) {
      await this.prisma.catalogImport.updateMany({ where: { id, status: 'committing' }, data: { status: 'pending' } });
      if (err instanceof ConflictException) throw err;
      if ((err as any)?.code === 'P2002') {
        throw new ConflictException({ code: 'DUPLICATE', message: 'A product with the same SKU or link name was added in the meantime. Upload the file again.' });
      }
      this.logger.error(`catalog import ${id} failed: ${(err as Error).message}`);
      throw new BadRequestException('The import could not be saved and nothing was changed. Please try again.');
    }

    const result = { created, updated, skipped: plan.length - work.length };
    await this.prisma.catalogImport.update({ where: { id }, data: { status: 'committed', appliedAt: new Date(), summary: { ...(rec.summary as object), applied: result } as any } });
    await this.audit.log({ userId: actor.sub, userEmail: actor.email, userRole: actor.role, action: 'catalog.import.commit', entity: 'catalog_import', entityId: id, changes: { ...result, filename: rec.filename } }).catch(() => {});
    return result;
  }

  async discard(id: string) {
    await this.prisma.catalogImport.updateMany({ where: { id, status: 'pending' }, data: { status: 'discarded' } });
    return { discarded: true };
  }
}
