import type { PrismaService } from '../prisma/prisma.service.js';

export interface EffectiveSettings {
  defaultCommissionPct: number;
  commissionLimit: number;
  maxPartnerDiscountPct: number;
}

export async function loadSettings(prisma: PrismaService): Promise<EffectiveSettings> {
  const s = await prisma.platformSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  return {
    defaultCommissionPct: Number(s.defaultCommissionPct),
    commissionLimit: Number(s.commissionLimit),
    maxPartnerDiscountPct: Number(s.maxPartnerDiscountPct),
  };
}

/** Outstanding commission per partner (sum of ledger amounts; negative means the partner is in credit). */
export async function loadDues(prisma: PrismaService, partnerIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>(partnerIds.map((id) => [id, 0]));
  if (!partnerIds.length) return map;
  const rows = await prisma.partnerLedgerEntry.groupBy({
    by: ['partnerId'],
    where: { partnerId: { in: partnerIds } },
    _sum: { amount: true },
  });
  for (const r of rows) map.set(r.partnerId, Math.round(Number(r._sum.amount ?? 0) * 100) / 100);
  return map;
}

/** Discount percent currently valid for each partner (active status, inside its window). */
export async function loadActiveDiscounts(prisma: PrismaService, partnerIds: string[], now = new Date()): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!partnerIds.length) return map;
  const rows = await prisma.partnerDiscount.findMany({
    where: { partnerId: { in: partnerIds }, status: 'active', startsAt: { lte: now }, endsAt: { gte: now } },
    orderBy: { createdAt: 'asc' },
  });
  for (const r of rows) map.set(r.partnerId, Number(r.percent)); // newest wins
  return map;
}

export const limitFor = (override: unknown, settings: EffectiveSettings) =>
  override == null ? settings.commissionLimit : Number(override);

export const isOverLimit = (due: number, limit: number) => limit > 0 && due >= limit;
