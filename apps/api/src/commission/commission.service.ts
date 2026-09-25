import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AuditLogService } from '../audit-log/audit-log.service.js';
import { priceBooking } from './money.js';
import { isOverLimit, limitFor, loadActiveDiscounts, loadDues, loadSettings } from './queries.js';

export interface Actor {
  sub: string;
  role: string;
  email?: string;
}

const WARN_FRACTION = 0.8;
const round2 = (n: number) => Math.round(n * 100) / 100;

function assertPct(v: unknown, label: string, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new BadRequestException(`${label} must be between ${min} and ${max}`);
  return round2(n);
}

@Injectable()
export class CommissionService {
  private readonly logger = new Logger(CommissionService.name);

  constructor(
    private prisma: PrismaService,
    private payments: PaymentsService,
    private notifications: NotificationsService,
    private audit: AuditLogService
  ) {}

  private log(actor: Actor, action: string, entityId: string | undefined, changes: Record<string, unknown>) {
    return this.audit
      .log({ userId: actor.sub, userEmail: actor.email, userRole: actor.role, action, entity: 'commission', entityId, changes })
      .catch((e) => this.logger.error(`audit failed: ${e.message}`));
  }

  // ── Platform settings (admin) ────────────────────────────────────────────────

  getSettings() {
    return loadSettings(this.prisma);
  }

  async updateSettings(actor: Actor, patch: { defaultCommissionPct?: unknown; commissionLimit?: unknown; maxPartnerDiscountPct?: unknown }) {
    const data: Prisma.PlatformSettingsUpdateInput = { updatedBy: actor.sub };
    if (patch.defaultCommissionPct !== undefined) data.defaultCommissionPct = assertPct(patch.defaultCommissionPct, 'Default commission %', 0, 90);
    if (patch.commissionLimit !== undefined) data.commissionLimit = assertPct(patch.commissionLimit, 'Commission limit', 1, 10_000_000);
    if (patch.maxPartnerDiscountPct !== undefined) data.maxPartnerDiscountPct = assertPct(patch.maxPartnerDiscountPct, 'Max partner discount %', 0, 90);
    const before = await loadSettings(this.prisma);
    await this.prisma.platformSettings.update({ where: { id: 1 }, data });
    const after = await loadSettings(this.prisma);
    await this.log(actor, 'settings.update', '1', { before, after });
    return after;
  }

  // ── Per-partner commission (staff + admin) ───────────────────────────────────

  async setPartnerCommission(actor: Actor, partnerId: string, patch: { commissionPct?: unknown; commissionLimitOverride?: unknown }) {
    const partner = await this.prisma.partnerProfile.findUnique({ where: { userId: partnerId } });
    if (!partner) throw new NotFoundException('Partner not found');
    const data: Prisma.PartnerProfileUpdateInput = {};
    if (patch.commissionPct !== undefined) {
      data.commissionPct = patch.commissionPct === null ? null : assertPct(patch.commissionPct, 'Commission %', 0, 90);
    }
    if (patch.commissionLimitOverride !== undefined) {
      // The limit is a super-admin control; staff can only pick the split.
      if (actor.role !== 'admin') throw new ForbiddenException('Only the super admin can change a partner\'s commission limit');
      data.commissionLimitOverride = patch.commissionLimitOverride === null ? null : assertPct(patch.commissionLimitOverride, 'Commission limit', 1, 10_000_000);
    }
    if (!Object.keys(data).length) throw new BadRequestException('Nothing to update');
    await this.prisma.partnerProfile.update({ where: { userId: partnerId }, data });
    await this.log(actor, 'partner.commission.update', partnerId, {
      before: { commissionPct: partner.commissionPct, commissionLimitOverride: partner.commissionLimitOverride },
      patch,
    });
    return this.getPartnerOverview(partnerId);
  }

  // ── Dues status and gating ───────────────────────────────────────────────────

  async getDuesStatus(partnerId: string) {
    const [partner, settings, dues] = await Promise.all([
      this.prisma.partnerProfile.findUnique({ where: { userId: partnerId }, select: { commissionPct: true, commissionLimitOverride: true } }),
      loadSettings(this.prisma),
      loadDues(this.prisma, [partnerId]),
    ]);
    if (!partner) throw new NotFoundException('Partner not found');
    const due = dues.get(partnerId) ?? 0;
    const limit = limitFor(partner.commissionLimitOverride, settings);
    const commissionPct = partner.commissionPct == null ? settings.defaultCommissionPct : Number(partner.commissionPct);
    return {
      due,
      limit,
      commissionPct,
      partnerPct: round2(100 - commissionPct),
      blocked: isOverLimit(due, limit),
      warning: !isOverLimit(due, limit) && limit > 0 && due >= limit * WARN_FRACTION,
      remaining: Math.max(0, round2(limit - due)),
    };
  }

  /** Throws 403 COMMISSION_LIMIT_EXCEEDED when the partner owes the company at or above their limit. */
  async assertCanTakeJobs(partnerId: string) {
    const s = await this.getDuesStatus(partnerId);
    if (s.blocked) {
      throw new ForbiddenException({
        code: 'COMMISSION_LIMIT_EXCEEDED',
        message: `You owe ₹${s.due} in commission (limit ₹${s.limit}). Pay it to start accepting jobs again.`,
        due: s.due,
        limit: s.limit,
      });
    }
  }

  async isBlocked(partnerId: string): Promise<boolean> {
    return (await this.getDuesStatus(partnerId)).blocked;
  }

  // ── Discounts (staff + admin) ────────────────────────────────────────────────

  listDiscounts(partnerId: string) {
    return this.prisma.partnerDiscount.findMany({ where: { partnerId }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  private parseWindow(startsAt: unknown, endsAt: unknown) {
    const s = new Date(String(startsAt));
    const e = new Date(String(endsAt));
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) throw new BadRequestException('Enter a valid start and end date');
    if (e <= s) throw new BadRequestException('The end must be after the start');
    return { startsAt: s, endsAt: e };
  }

  async createDiscount(actor: Actor, partnerId: string, input: { percent?: unknown; startsAt?: unknown; endsAt?: unknown; note?: unknown; activate?: unknown }) {
    const partner = await this.prisma.partnerProfile.findUnique({ where: { userId: partnerId } });
    if (!partner) throw new NotFoundException('Partner not found');
    const settings = await loadSettings(this.prisma);
    const percent = assertPct(input.percent, 'Discount %', 0.01, settings.maxPartnerDiscountPct);
    const window = this.parseWindow(input.startsAt, input.endsAt);
    if (window.endsAt <= new Date()) throw new BadRequestException('The end date is already in the past');
    const activate = input.activate !== false;

    const created = await this.prisma.$transaction(async (tx) => {
      if (activate) {
        await tx.partnerDiscount.updateMany({ where: { partnerId, status: 'active' }, data: { status: 'inactive' } });
      }
      return tx.partnerDiscount.create({
        data: {
          partnerId,
          percent,
          ...window,
          status: activate ? 'active' : 'inactive',
          note: typeof input.note === 'string' ? input.note.slice(0, 300) : null,
          createdBy: actor.sub,
          activatedBy: activate ? actor.sub : null,
        },
      });
    });
    await this.log(actor, 'partner.discount.create', partnerId, { discountId: created.id, percent, ...window, activate });
    return created;
  }

  async updateDiscount(actor: Actor, discountId: string, patch: { percent?: unknown; startsAt?: unknown; endsAt?: unknown; note?: unknown; status?: unknown }) {
    const d = await this.prisma.partnerDiscount.findUnique({ where: { id: discountId } });
    if (!d) throw new NotFoundException('Discount not found');
    const settings = await loadSettings(this.prisma);
    const data: Prisma.PartnerDiscountUpdateInput = {};
    if (patch.percent !== undefined) data.percent = assertPct(patch.percent, 'Discount %', 0.01, settings.maxPartnerDiscountPct);
    if (patch.startsAt !== undefined || patch.endsAt !== undefined) {
      const w = this.parseWindow(patch.startsAt ?? d.startsAt, patch.endsAt ?? d.endsAt);
      data.startsAt = w.startsAt;
      data.endsAt = w.endsAt;
    }
    if (patch.note !== undefined) data.note = typeof patch.note === 'string' ? patch.note.slice(0, 300) : null;
    let activating = false;
    if (patch.status !== undefined) {
      if (patch.status !== 'active' && patch.status !== 'inactive') throw new BadRequestException('status must be active or inactive');
      data.status = patch.status;
      activating = patch.status === 'active' && d.status !== 'active';
      if (activating) data.activatedBy = actor.sub;
    }
    if (!Object.keys(data).length) throw new BadRequestException('Nothing to update');

    const updated = await this.prisma.$transaction(async (tx) => {
      if (activating) {
        await tx.partnerDiscount.updateMany({ where: { partnerId: d.partnerId, status: 'active', id: { not: d.id } }, data: { status: 'inactive' } });
      }
      return tx.partnerDiscount.update({ where: { id: discountId }, data });
    });
    await this.log(actor, 'partner.discount.update', d.partnerId, { discountId, patch });
    return updated;
  }

  // ── Pricing when a partner claims a job ──────────────────────────────────────

  /**
   * Prices a job for the partner who just claimed it and snapshots the split on the booking. The discount
   * is re-validated here, on the server, at claim time (active, approved, inside its window). If an
   * online payment already covered the old price, the difference is refunded.
   */
  async applyClaimPricing(bookingId: string, partnerId: string) {
    const [booking, partner, settings] = await Promise.all([
      this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId } }),
      this.prisma.partnerProfile.findUniqueOrThrow({ where: { userId: partnerId }, select: { commissionPct: true } }),
      loadSettings(this.prisma),
    ]);
    const discounts = await loadActiveDiscounts(this.prisma, [partnerId]);
    const pct = discounts.get(partnerId) ?? null;
    const price = priceBooking({
      subtotal: Number(booking.subtotal),
      couponDiscount: Number(booking.discount),
      partnerDiscountPct: pct && pct <= settings.maxPartnerDiscountPct ? pct : null,
      commissionPct: partner.commissionPct == null ? settings.defaultCommissionPct : Number(partner.commissionPct),
    });

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        partnerDiscountPct: price.partnerDiscountPct,
        partnerDiscountAmount: price.partnerDiscountAmount,
        discountSource: price.discountSource,
        total: price.total,
        commissionPct: price.commissionPct,
        commissionAmount: price.commissionAmount,
        partnerShareAmount: price.partnerShareAmount,
      },
    });
    if (booking.paymentStatus === 'paid' && price.total < Number(booking.total)) {
      await this.payments.refundDiscountDifference(bookingId, price.total);
    }
    return price;
  }

  // ── Settlement when a job completes ──────────────────────────────────────────

  /**
   * Posts a completed job to the money books exactly once (settledAt is claimed atomically).
   *  - pay-after-service: the partner collected the customer's payment, so the company's cut becomes
   *    commission owed by the partner.
   *  - paid online: the company holds the money, so a payout of the partner's share is created, reduced
   *    by any commission the partner still owes.
   */
  async settle(bookingId: string) {
    const claimed = await this.prisma.booking.updateMany({
      where: { id: bookingId, status: 'completed', settledAt: null, partnerId: { not: null } },
      data: { settledAt: new Date() },
    });
    if (claimed.count === 0) return null;

    try {
      const booking = await this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
      const partnerId = booking.partnerId!;
      let { commissionPct, commissionAmount, partnerShareAmount } = booking;
      if (commissionAmount == null || partnerShareAmount == null || commissionPct == null) {
        const [partner, settings] = await Promise.all([
          this.prisma.partnerProfile.findUniqueOrThrow({ where: { userId: partnerId }, select: { commissionPct: true } }),
          loadSettings(this.prisma),
        ]);
        const p = priceBooking({
          subtotal: Number(booking.total),
          couponDiscount: 0,
          partnerDiscountPct: null,
          commissionPct: partner.commissionPct == null ? settings.defaultCommissionPct : Number(partner.commissionPct),
        });
        commissionPct = new Prisma.Decimal(p.commissionPct);
        commissionAmount = new Prisma.Decimal(p.commissionAmount);
        partnerShareAmount = new Prisma.Decimal(p.partnerShareAmount);
        await this.prisma.booking.update({ where: { id: bookingId }, data: { commissionPct, commissionAmount, partnerShareAmount } });
      }

      // Money the partner collected themselves (COD-style) is commission owed; only money the company holds
      // (paid online) becomes a payout.
      const paidOnline = booking.collectedAt == null && booking.paymentMethod !== 'cash_after_service' && booking.paymentStatus === 'paid';
      if (!paidOnline) {
        const dueBefore = (await loadDues(this.prisma, [partnerId])).get(partnerId) ?? 0;
        await this.prisma.$transaction([
          this.prisma.partnerLedgerEntry.create({
            data: { partnerId, bookingId, type: 'commission_due', amount: commissionAmount, note: `Commission on booking #${bookingId.slice(-8).toUpperCase()}` },
          }),
          // Legacy jobs completed before collection was tracked: mark the payment as collected.
          this.prisma.booking.update({ where: { id: bookingId }, data: { paymentStatus: 'paid', collectedAt: booking.collectedAt ?? new Date(), collectedMethod: booking.collectedMethod ?? 'cash', collectedAmount: booking.collectedAmount ?? booking.total } }),
        ]);
        await this.notifyThresholds(partnerId, dueBefore, dueBefore + Number(commissionAmount));
        return { mode: 'cash', commissionDue: Number(commissionAmount) };
      }

      // Online booking: partner is owed their share, less anything they still owe the company.
      const due = Math.max(0, (await loadDues(this.prisma, [partnerId])).get(partnerId) ?? 0);
      const share = Number(partnerShareAmount);
      const offset = Math.min(due, share);
      const net = round2(share - offset);
      await this.prisma.$transaction(async (tx) => {
        await tx.payout.create({
          data: {
            partnerId,
            bookingId,
            grossAmount: booking.total,
            commissionRate: Number(commissionPct),
            commissionAmount: commissionAmount!,
            netAmount: net,
            status: net === 0 ? 'paid' : 'pending',
            paidAt: net === 0 ? new Date() : null,
            notes: offset > 0 ? `₹${offset} of commission dues settled from this payout` : null,
          },
        });
        if (offset > 0) {
          await tx.partnerLedgerEntry.create({
            data: { partnerId, bookingId, type: 'payout_offset', amount: -offset, note: `Netted against payout for #${bookingId.slice(-8).toUpperCase()}` },
          });
        }
      });
      return { mode: 'online', net, offset };
    } catch (err) {
      // Release the claim so the reconcile job can retry; nothing was posted (or the unique keys keep it idempotent).
      this.logger.error(`settle(${bookingId}) failed: ${(err as Error).message}`);
      await this.prisma.booking.update({ where: { id: bookingId }, data: { settledAt: null } }).catch(() => {});
      throw err;
    }
  }

  /** Settles any completed job that missed its settlement (safe to run repeatedly). */
  async reconcile(limit = 200) {
    const pending = await this.prisma.booking.findMany({
      where: { status: 'completed', settledAt: null, partnerId: { not: null } },
      select: { id: true },
      take: limit,
    });
    let done = 0;
    for (const b of pending) {
      try {
        if (await this.settle(b.id)) done++;
      } catch {}
    }
    return { checked: pending.length, settled: done };
  }

  private async notifyThresholds(partnerId: string, before: number, after: number) {
    try {
      const s = await this.getDuesStatus(partnerId);
      if (before < s.limit && after >= s.limit) {
        await this.notifications.sendPush(partnerId, {
          title: 'Commission limit reached',
          body: `You owe ₹${after} in commission. Pay it to keep receiving jobs.`,
          data: { type: 'commission:blocked' },
        });
      } else if (before < s.limit * WARN_FRACTION && after >= s.limit * WARN_FRACTION) {
        await this.notifications.sendPush(partnerId, {
          title: 'Commission due is getting high',
          body: `You owe ₹${after} of your ₹${s.limit} limit. Pay soon to avoid interruption.`,
          data: { type: 'commission:warning' },
        });
      }
    } catch (err) {
      this.logger.warn(`threshold notification failed: ${(err as Error).message}`);
    }
  }

  // ── Paying dues ──────────────────────────────────────────────────────────────

  async createDuesOrder(partnerId: string, amount?: unknown) {
    const { due } = await this.getDuesStatus(partnerId);
    if (!(due > 0)) throw new BadRequestException('You have no commission due');
    const pay = amount === undefined || amount === null ? due : round2(Number(amount));
    if (!Number.isFinite(pay) || pay < 1 || pay > due) throw new BadRequestException(`Enter an amount between ₹1 and ₹${due}`);
    const { orderId } = await this.payments.createProviderOrder(pay, `dues_${partnerId.slice(0, 8)}`);
    const cp = await this.prisma.commissionPayment.create({ data: { partnerId, amount: pay, providerOrderId: orderId } });
    return { commissionPaymentId: cp.id, providerOrderId: orderId, amount: pay, keyId: this.payments.publicKey };
  }

  async confirmDuesPayment(partnerId: string, input: { commissionPaymentId?: string; providerPaymentId?: string; signature?: string }) {
    const cp = await this.prisma.commissionPayment.findFirst({ where: { id: String(input.commissionPaymentId ?? ''), partnerId } });
    if (!cp) throw new NotFoundException('Payment not found');
    if (cp.status === 'paid') return this.getDuesStatus(partnerId); // idempotent
    if (!input.providerPaymentId) throw new BadRequestException('Missing payment reference');
    const ok = await this.payments.verifyProviderPayment(input.providerPaymentId, cp.providerOrderId, input.signature ?? '');
    if (!ok) throw new BadRequestException('Payment could not be verified');

    const flipped = await this.prisma.commissionPayment.updateMany({
      where: { id: cp.id, status: 'pending' },
      data: { status: 'paid', paidAt: new Date(), providerPaymentId: input.providerPaymentId },
    });
    if (flipped.count === 0) return this.getDuesStatus(partnerId);
    await this.prisma.partnerLedgerEntry.create({
      data: { partnerId, type: 'commission_paid', amount: -Number(cp.amount), note: 'Paid online', createdBy: partnerId },
    });
    return this.getDuesStatus(partnerId);
  }

  /** Admin records money the partner paid the company outside the app (bank transfer, cash). */
  async recordOfflinePayment(actor: Actor, partnerId: string, input: { amount?: unknown; note?: unknown }) {
    const amt = round2(Number(input.amount));
    if (!Number.isFinite(amt) || amt <= 0 || amt > 10_000_000) throw new BadRequestException('Enter a valid amount');
    const exists = await this.prisma.partnerProfile.findUnique({ where: { userId: partnerId }, select: { userId: true } });
    if (!exists) throw new NotFoundException('Partner not found');
    const entry = await this.prisma.partnerLedgerEntry.create({
      data: {
        partnerId,
        type: 'commission_paid',
        amount: -amt,
        note: typeof input.note === 'string' && input.note.trim() ? input.note.slice(0, 300) : 'Recorded offline payment',
        createdBy: actor.sub,
      },
    });
    await this.log(actor, 'partner.dues.offline_payment', partnerId, { amount: amt, entryId: entry.id });
    return this.getPartnerOverview(partnerId);
  }

  /** Admin correction; positive raises dues, negative lowers them. A reason is required. */
  async adjust(actor: Actor, partnerId: string, input: { amount?: unknown; note?: unknown }) {
    const amt = round2(Number(input.amount));
    if (!Number.isFinite(amt) || amt === 0 || Math.abs(amt) > 10_000_000) throw new BadRequestException('Enter a non-zero amount');
    if (typeof input.note !== 'string' || input.note.trim().length < 3) throw new BadRequestException('Give a reason for the adjustment');
    const exists = await this.prisma.partnerProfile.findUnique({ where: { userId: partnerId }, select: { userId: true } });
    if (!exists) throw new NotFoundException('Partner not found');
    const entry = await this.prisma.partnerLedgerEntry.create({
      data: { partnerId, type: 'adjustment', amount: amt, note: input.note.slice(0, 300), createdBy: actor.sub },
    });
    await this.log(actor, 'partner.dues.adjustment', partnerId, { amount: amt, note: input.note, entryId: entry.id });
    return this.getPartnerOverview(partnerId);
  }

  // ── Read models ──────────────────────────────────────────────────────────────

  /** Everything the staff/admin partner page needs about money. */
  async getPartnerOverview(partnerId: string) {
    const partner = await this.prisma.partnerProfile.findUnique({
      where: { userId: partnerId },
      select: { commissionPct: true, commissionLimitOverride: true },
    });
    if (!partner) throw new NotFoundException('Partner not found');
    const [status, settings, discounts, ledger] = await Promise.all([
      this.getDuesStatus(partnerId),
      loadSettings(this.prisma),
      this.listDiscounts(partnerId),
      this.prisma.partnerLedgerEntry.findMany({ where: { partnerId }, orderBy: { createdAt: 'desc' }, take: 30 }),
    ]);
    const now = Date.now();
    const active = discounts.find((d) => d.status === 'active' && d.startsAt.getTime() <= now && d.endsAt.getTime() >= now) ?? null;
    return {
      commissionPct: partner.commissionPct == null ? null : Number(partner.commissionPct),
      commissionLimitOverride: partner.commissionLimitOverride == null ? null : Number(partner.commissionLimitOverride),
      effective: status,
      defaults: settings,
      activeDiscount: active,
      discounts,
      ledger: ledger.map((l) => ({ ...l, amount: Number(l.amount) })),
    };
  }

  /** Partner earnings screen: totals split by the ratio each job was actually done at, plus dues. */
  async getEarnings(partnerId: string) {
    const [jobs, payouts, dues] = await Promise.all([
      this.prisma.booking.findMany({
        where: { partnerId, status: 'completed' },
        orderBy: { completedAt: 'desc' },
        select: {
          id: true, type: true, petName: true, completedAt: true, total: true, paymentMethod: true,
          commissionPct: true, commissionAmount: true, partnerShareAmount: true,
          partnerDiscountAmount: true, discountSource: true,
        },
      }),
      this.prisma.payout.findMany({ where: { partnerId }, orderBy: { createdAt: 'desc' }, take: 20 }),
      this.getDuesStatus(partnerId),
    ]);
    let collected = 0, share = 0, company = 0, cash = 0, online = 0;
    for (const j of jobs) {
      const total = Number(j.total);
      const c = j.commissionAmount == null ? 0 : Number(j.commissionAmount);
      collected += total;
      company += c;
      share += j.partnerShareAmount == null ? total - c : Number(j.partnerShareAmount);
      if (j.paymentMethod === 'cash_after_service') cash += total; else online += total;
    }
    const paid = payouts.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.netAmount), 0);
    const pending = payouts.filter((p) => ['pending', 'requested', 'approved', 'processing'].includes(p.status)).reduce((s, p) => s + Number(p.netAmount), 0);
    return {
      // Existing fields the app already reads.
      total: round2(paid),
      pending: round2(pending),
      payouts,
      // Split of everything completed so far.
      completedJobs: jobs.length,
      totalCollected: round2(collected),
      yourShare: round2(share),
      companyShare: round2(company),
      collectedInCash: round2(cash),
      collectedOnline: round2(online),
      dues,
      recent: jobs.slice(0, 30).map((j) => ({
        bookingId: j.id,
        type: j.type,
        petName: j.petName,
        completedAt: j.completedAt,
        total: Number(j.total),
        paymentMethod: j.paymentMethod,
        commissionPct: j.commissionPct == null ? null : Number(j.commissionPct),
        commissionAmount: j.commissionAmount == null ? null : Number(j.commissionAmount),
        yourShare: j.partnerShareAmount == null ? null : Number(j.partnerShareAmount),
        discountAmount: Number(j.partnerDiscountAmount),
        discountSource: j.discountSource,
      })),
    };
  }
}
