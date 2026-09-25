// One-off migration: replaces legacy plaintext partner Aadhaar numbers with an HMAC reference hash
// plus the last 4 digits, then nulls the plaintext column. Safe to re-run (only touches rows that
// still have a plaintext number).
//
//   node --env-file=.env scripts/backfill-aadhaar-hash.js          # dry run
//   node --env-file=.env scripts/backfill-aadhaar-hash.js --apply  # write changes
const { createHmac } = require('crypto');
const { PrismaClient } = require('@prisma/client');

const pepper = process.env.AADHAAR_HASH_PEPPER;
if (!pepper || pepper.length < 16) {
  console.error('AADHAAR_HASH_PEPPER must be set (16+ chars). Never change it after hashes exist.');
  process.exit(1);
}
const apply = process.argv.includes('--apply');

(async () => {
  const prisma = new PrismaClient();
  const rows = await prisma.partnerProfile.findMany({
    where: { aadhaarNumber: { not: null } },
    select: { userId: true, aadhaarNumber: true, aadhaarRefHash: true },
  });
  console.log(`${rows.length} partner(s) with a plaintext Aadhaar number${apply ? '' : ' (dry run)'}`);

  const seen = new Set((await prisma.partnerProfile.findMany({ where: { aadhaarRefHash: { not: null } }, select: { aadhaarRefHash: true } })).map((r) => r.aadhaarRefHash));
  let updated = 0;
  for (const r of rows) {
    const digits = String(r.aadhaarNumber).replace(/\D/g, '');
    const last4 = digits.slice(-4) || null;
    let refHash = null;
    if (digits.length === 12) {
      const h = createHmac('sha256', pepper).update(digits).digest('hex');
      if (seen.has(h)) console.log(`  ${r.userId}: duplicate Aadhaar of another partner, keeping last4 only`);
      else { refHash = h; seen.add(h); }
    }
    console.log(`  ${r.userId}: last4=${last4} hash=${refHash ? 'yes' : 'no'}`);
    if (apply) {
      await prisma.partnerProfile.update({
        where: { userId: r.userId },
        data: { aadhaarNumber: null, aadhaarLast4: last4, ...(refHash ? { aadhaarRefHash: refHash } : {}) },
      });
      updated++;
    }
  }
  console.log(apply ? `Done. ${updated} row(s) migrated.` : 'Dry run only. Re-run with --apply to write.');
  await prisma.$disconnect();
})();
