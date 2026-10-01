// One-off repair: addresses saved before real geocoding existed were all stored with the placeholder point
// (12.9716, 77.5946 = central Bengaluru), so partners were navigated to the wrong place. This looks each one
// up with Ola Maps and stores its real coordinates.
//
//   node apps/api/scripts/regeocode-addresses.js            dry run: shows what would change
//   node apps/api/scripts/regeocode-addresses.js --apply    writes the changes
//
// Needs the API built (npm run build in apps/api, or `npm run dev` running) and OLA_MAPS_API_KEY in apps/api/.env.
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '../../..');
const env = Object.fromEntries(
  fs.readFileSync(path.join(root, 'apps/api/.env'), 'utf8').split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
);
process.env.SERVICE_CITIES = process.env.SERVICE_CITIES || env.SERVICE_CITIES || '';
if (!process.env.SERVICE_CITIES) delete process.env.SERVICE_CITIES;

const { PrismaClient } = require(path.join(root, 'node_modules/@prisma/client'));
const { OlaPlacesProvider } = require(path.join(root, 'apps/api/dist/apps/api/src/maps-location/places.provider.js'));
const { isValidCoordinate } = require(path.join(root, 'apps/api/dist/apps/api/src/maps-location/places.js'));

const apply = process.argv.includes('--apply');
const PLACEHOLDER = { lat: 12.9716, lng: 77.5946 };
const near = (a, b) => Math.abs(a - b) < 1e-6;

(async () => {
  if (!env.OLA_MAPS_API_KEY) throw new Error('OLA_MAPS_API_KEY is not set in apps/api/.env');
  const prisma = new PrismaClient();
  const places = new OlaPlacesProvider(env.OLA_MAPS_API_KEY);
  const rows = await prisma.address.findMany({ where: { isActive: true } });
  const todo = rows.filter((a) => (near(a.lat, PLACEHOLDER.lat) && near(a.lng, PLACEHOLDER.lng)) || !isValidCoordinate(a.lat, a.lng));
  console.log(`${rows.length} active addresses, ${todo.length} with a placeholder or invalid location${apply ? '' : ' (dry run)'}`);

  let fixed = 0, failed = 0;
  for (const a of todo) {
    const full = [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(', ');
    const areaOnly = [a.line2, a.city, a.state, a.pincode].filter(Boolean).join(', ');
    const cityOnly = [a.city, a.state, a.pincode].filter(Boolean).join(', ');
    let hit = null, how = '';
    for (const [label, q] of [['full address', full], ['area', areaOnly], ['city + pincode', cityOnly]]) {
      const p = await places.geocode(q).catch(() => null);
      if (p && isValidCoordinate(p.lat, p.lng) && !(near(p.lat, PLACEHOLDER.lat) && near(p.lng, PLACEHOLDER.lng))) { hit = p; how = label; break; }
    }
    if (!hit) { failed++; console.log(`  ! ${a.id.slice(0, 8)} "${full}" -> could not be located (left unchanged; the customer should re-pin it)`); continue; }
    // A result in a different city than the one on file means the text was junk; do not move the address silently.
    if (hit.serviceCity && a.city && hit.serviceCity.toLowerCase() !== a.city.trim().toLowerCase()) {
      failed++;
      console.log(`  ! ${a.id.slice(0, 8)} "${full}" -> lookup says ${hit.serviceCity} but the address says ${a.city}; left unchanged (the customer should re-pin it)`);
      continue;
    }
    console.log(`  ${a.id.slice(0, 8)} "${full}" -> ${hit.lat.toFixed(5)}, ${hit.lng.toFixed(5)}  [${how}]  ${hit.serviceCity ? 'city ' + hit.serviceCity : 'outside service area'}`);
    fixed++;
    if (apply) await prisma.address.update({ where: { id: a.id }, data: { lat: hit.lat, lng: hit.lng, ...(hit.serviceCity ? { city: hit.serviceCity } : {}) } });
  }
  console.log(`${apply ? 'Updated' : 'Would update'} ${fixed}, could not locate ${failed}.`);
  await prisma.$disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
