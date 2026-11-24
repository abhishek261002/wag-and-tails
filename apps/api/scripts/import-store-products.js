// Loads the client's product sheet into the app store: one product per name, one size/variant per row.
// Safe to run again: products and variants are matched by SKU and updated in place, never duplicated.
//
//   node apps/api/scripts/import-store-products.js                 dry run: shows what would change
//   node apps/api/scripts/import-store-products.js --apply         writes the changes
//   add --hide-others   to also hide products that are not in the sheet (the demo products from the seed)
//   add --check-images  to test that every image link opens
//   add --file <path>   to use another sheet (default: scripts/data/store-products.csv)
//
// Sheet columns used: Status, Category, Product Name, Size / Variant, SKU, Regular Price (INR),
// Selling Price (INR), Image 1..7, Site Product ID.
// Every row is sold as listed, whatever its Status (the client asked for the sheet "as it is"); the Status column
// only describes the website.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const root = path.resolve(__dirname, '../../..');
const env = Object.fromEntries(
  fs.readFileSync(path.join(root, 'apps/api/.env'), 'utf8').split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = env.DATABASE_URL;

const { PrismaClient } = require('@prisma/client');
const { parse } = require('csv-parse/sync');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const HIDE_OTHERS = args.includes('--hide-others');
const CHECK_IMAGES = args.includes('--check-images');
const fileArg = args.indexOf('--file');
const FILE = fileArg >= 0 ? path.resolve(args[fileArg + 1]) : path.join(__dirname, 'data/store-products.csv');
const IN_STOCK_QTY = 100;

const money = (s) => {
  const n = Number(String(s || '').replace(/[₹,\s]/g, ''));
  if (!Number.isFinite(n) || n <= 0) throw new Error(`bad price "${s}"`);
  return Math.round(n * 100) / 100;
};
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 70);
// The same photo is often uploaded twice ("abc.jpg" and "abc-1.jpg"); treat those as one picture.
const photoKey = (u) => decodeURIComponent(u.split('/').pop()).replace(/\.[a-z0-9]+$/i, '').replace(/-\d+$/, '').toLowerCase();

function readSheet() {
  const rows = parse(fs.readFileSync(FILE, 'utf8'), { columns: true, bom: true, skip_empty_lines: true, trim: true, relax_column_count: true });
  const problems = [];
  const products = new Map(); // product name -> product
  const variantSkus = new Set();
  const catOrder = [];
  rows.forEach((r, i) => {
    const line = i + 2;
    const name = r['Product Name'];
    const sku = r['SKU'];
    const cat = r['Category'];
    if (!name || !sku || !cat) return problems.push(`line ${line}: missing name, SKU or category`);
    if (variantSkus.has(sku.toLowerCase())) return problems.push(`line ${line}: SKU ${sku} appears twice`);
    variantSkus.add(sku.toLowerCase());
    let mrp, price;
    try {
      mrp = money(r['Regular Price (INR)']);
      price = money(r['Selling Price (INR)']);
    } catch (e) {
      return problems.push(`line ${line}: ${e.message}`);
    }
    if (price > mrp) return problems.push(`line ${line}: selling price ${price} is above the regular price ${mrp}`);
    const images = [];
    for (let k = 1; k <= 7; k++) {
      const u = (r[`Image ${k}`] || '').trim();
      if (u && /^https:\/\/\S+$/.test(u) && !images.includes(u)) images.push(u);
    }
    if (!catOrder.includes(cat)) catOrder.push(cat);
    let p = products.get(name);
    if (!p) {
      p = { name, category: cat, siteId: r['Site Product ID'] || '', status: new Set(), variants: [] };
      products.set(name, p);
    }
    if (p.category !== cat) problems.push(`line ${line}: "${name}" is in two categories`);
    if ((r['Site Product ID'] || '') !== p.siteId) problems.push(`line ${line}: "${name}" has two website product IDs`);
    const status = r['Status'] || 'Live';
    p.status.add(status);
    p.variants.push({ sku, name: r['Size / Variant'] || 'Standard', mrp, price, images, inStock: true, line });
  });

  const out = [];
  const productSkus = new Set();
  for (const p of products.values()) {
    // A stable product code: the website product ID, or the shared part of the variant SKUs.
    const sku = p.siteId ? `WT-${p.siteId}` : p.variants[0].sku.replace(/[-_ ](XS|S|M|L|XL)$/i, '');
    if (productSkus.has(sku)) problems.push(`product code ${sku} is used by two products ("${p.name}")`);
    productSkus.add(sku);
    // Gallery: each variant's own main photo first (so colour variants are all shown), then the other photos.
    const gallery = [];
    const seen = new Set();
    const add = (u) => { const k = photoKey(u); if (!seen.has(k) && gallery.length < 10) { seen.add(k); gallery.push(u); } };
    p.variants.forEach((v) => v.images[0] && add(v.images[0]));
    p.variants.forEach((v) => v.images.forEach(add));
    const cheapest = p.variants.reduce((a, b) => (b.price < a.price ? b : a));
    const lower = p.name.toLowerCase();
    const tags = [];
    if (/\bdogs?\b|puppy/.test(lower)) tags.push('dog');
    if (/\bcats?\b|kitten/.test(lower)) tags.push('cat');
    out.push({ ...p, sku, gallery, mrp: cheapest.mrp, price: cheapest.price, tags });
  }
  return { products: out, categories: catOrder, problems, rows: rows.length };
}

async function checkImages(products) {
  const urls = [...new Set(products.flatMap((p) => [...p.gallery, ...p.variants.map((v) => v.images[0]).filter(Boolean)]))];
  const bad = [];
  let i = 0;
  const worker = async () => {
    while (i < urls.length) {
      const u = urls[i++];
      try {
        const res = await fetch(u, { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0', Range: 'bytes=0-1023' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
        const type = res.headers.get('content-type') || '';
        if (!res.ok || !type.startsWith('image/')) bad.push(`${res.status} ${type || '?'} ${u}`);
        await res.body?.cancel().catch(() => {});
      } catch (e) {
        bad.push(`ERR ${e.cause?.code || e.name} ${u}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 12 }, worker));
  return { total: urls.length, bad };
}

async function main() {
  const sheet = readSheet();
  console.log(`Sheet: ${path.relative(process.cwd(), FILE)}: ${sheet.rows} rows, ${sheet.products.length} products, ${sheet.categories.length} categories`);
  if (sheet.problems.length) {
    console.log('Problems in the sheet (nothing was written):');
    sheet.problems.forEach((p) => console.log('  ' + p));
    process.exit(1);
  }
  if (CHECK_IMAGES) {
    const { total, bad } = await checkImages(sheet.products);
    console.log(`Images: ${total} links checked, ${bad.length} not opening`);
    bad.forEach((b) => console.log('  ' + b));
  }

  const prisma = new PrismaClient();
  try {
    const existingCats = await prisma.productCategory.findMany();
    const catBySlug = new Map(existingCats.map((c) => [c.slug, c]));
    const catByName = new Map(existingCats.map((c) => [c.name.toLowerCase(), c]));
    const existing = await prisma.product.findMany({ include: { variants: true } });
    const bySku = new Map(existing.filter((p) => p.sku).map((p) => [p.sku.toLowerCase(), p]));
    const variantOwner = new Map(existing.flatMap((p) => p.variants.map((v) => [v.sku.toLowerCase(), p.id])));

    let created = 0, updated = 0, variantsNew = 0, variantsUpd = 0, catsNew = 0;
    const sheetSkus = new Set(sheet.products.map((p) => p.sku.toLowerCase()));

    // Any variant SKU that already belongs to some other product would be stolen; refuse instead.
    for (const p of sheet.products) {
      const own = bySku.get(p.sku.toLowerCase());
      for (const v of p.variants) {
        const owner = variantOwner.get(v.sku.toLowerCase());
        if (owner && owner !== own?.id) throw new Error(`Variant SKU ${v.sku} already belongs to another product; fix that first.`);
      }
    }

    const run = async (tx) => {
      const catIds = new Map();
      for (const [i, name] of sheet.categories.entries()) {
        const slug = slugify(name);
        let c = catByName.get(name.toLowerCase()) || catBySlug.get(slug);
        if (!c) {
          catsNew++;
          c = APPLY ? await tx.productCategory.create({ data: { name, slug, displayOrder: i, isActive: true } }) : { id: `new:${slug}` };
        } else if (APPLY) {
          await tx.productCategory.update({ where: { id: c.id }, data: { isActive: true, displayOrder: i } });
        }
        catIds.set(name, c.id);
      }
      for (const p of sheet.products) {
        const data = {
          name: p.name, categoryId: catIds.get(p.category), imageUrls: p.gallery, tags: p.tags,
          mrp: p.mrp, retailPrice: p.price, tradePrice: p.price, isActive: true,
        };
        const own = bySku.get(p.sku.toLowerCase());
        let productId = own?.id;
        if (own) updated++;
        else created++;
        if (APPLY) {
          if (own) await tx.product.update({ where: { id: own.id }, data });
          else {
            const hash = crypto.createHash('sha1').update(p.sku).digest('hex').slice(0, 6);
            productId = (await tx.product.create({ data: { ...data, sku: p.sku, slug: `${slugify(p.name)}-${hash}` } })).id;
          }
        }
        for (const v of p.variants) {
          const vdata = { name: v.name, mrp: v.mrp, retailPrice: v.price, tradePrice: v.price, imageUrl: v.images[0] || null, stockQty: v.inStock ? IN_STOCK_QTY : 0 };
          const had = own?.variants.find((x) => x.sku.toLowerCase() === v.sku.toLowerCase());
          if (had) variantsUpd++;
          else variantsNew++;
          if (!APPLY) continue;
          if (had) await tx.productVariant.update({ where: { id: had.id }, data: vdata });
          else await tx.productVariant.create({ data: { ...vdata, sku: v.sku, productId } });
        }
      }
      let hidden = 0, catsHidden = 0;
      if (HIDE_OTHERS) {
        const others = existing.filter((p) => p.isActive && !(p.sku && sheetSkus.has(p.sku.toLowerCase())));
        hidden = others.length;
        if (APPLY && others.length) await tx.product.updateMany({ where: { id: { in: others.map((p) => p.id) } }, data: { isActive: false } });
        const keep = new Set(catIds.values());
        const emptyCats = existingCats.filter((c) => c.isActive && !keep.has(c.id));
        for (const c of emptyCats) {
          const stillUsed = existing.some((p) => p.categoryId === c.id && p.isActive && !others.includes(p));
          if (stillUsed) continue;
          catsHidden++;
          if (APPLY) await tx.productCategory.update({ where: { id: c.id }, data: { isActive: false } });
        }
      }
      return { hidden, catsHidden };
    };

    const res = APPLY ? await prisma.$transaction(run, { timeout: 120000, maxWait: 10000 }) : await run(prisma);
    console.log(`${APPLY ? 'Done' : 'Dry run (nothing written; add --apply)'}:`);
    console.log(`  categories new ${catsNew}, products new ${created}, products updated ${updated}, sizes new ${variantsNew}, sizes updated ${variantsUpd}`);
    if (HIDE_OTHERS) console.log(`  products hidden (not in the sheet) ${res.hidden}, empty categories hidden ${res.catsHidden}`);
    const oos = sheet.products.flatMap((p) => p.variants.filter((v) => !v.inStock).map((v) => `${v.sku}`));
    console.log(`  sizes out of stock: ${oos.length}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('Failed:', e.message);
  process.exit(1);
});
