import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, type PartnerStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { PartnersService } from '../partners/partners.service.js';
import { AadhaarService, type PanelActor } from '../partners/aadhaar.service.js';
import { CommissionService } from '../commission/commission.service.js';
import { PayoutsService } from '../payouts/payouts.service.js';
import { SupportService } from '../support/support.service.js';
import { AuditLogService } from '../audit-log/audit-log.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { loadDues } from '../commission/queries.js';
import { toAppPhone } from '../wp/wp-link.js';

// Everything the client and his staff do about the apps, from the website's plugin panel (decided 25 Nov 2026: one
// panel, admin web and staff web retired). The plugin checks the WordPress login and role, then calls these signed
// endpoints server to server; `by` and `role` name the person for the activity log.
//   role 'admin' = the client (WordPress administrator), role 'staff' = his booking staff.
// Staff can see everything and approve partners; changing money (offline payments, adjustments, payouts, platform
// settings, limits) is for the client only.

const SYSTEM_PHONE = 'system:website-panel';

export interface PanelCaller { by: string; role: 'admin' | 'staff' }

const round2 = (n: number) => Math.round(n * 100) / 100;
const name = (p?: { firstName: string; lastName: string } | null) => (p ? `${p.firstName} ${p.lastName}`.trim() : '');
const ABS = () => (process.env['PUBLIC_API_URL'] ?? process.env['API_URL'] ?? '').replace(/\/+$/, '').replace(/\/api\/v1$/, '');
const abs = (u: string | null | undefined) => (!u ? null : /^https?:\/\//.test(u) ? u : `${ABS()}${u}`);

@Injectable()
export class PanelService {
  private systemUserId: string | null = null;

  constructor(
    private prisma: PrismaService,
    private partners: PartnersService,
    private aadhaar: AadhaarService,
    private commission: CommissionService,
    private payouts: PayoutsService,
    private support: SupportService,
    private audit: AuditLogService,
    private notifications: NotificationsService,
  ) {}

  /** The panel acts as one built-in account (it can never log in: inactive, no password); the person's name is logged. */
  async actor(c: PanelCaller): Promise<PanelActor> {
    if (!this.systemUserId) {
      const u = await this.prisma.user.upsert({
        where: { phone: SYSTEM_PHONE },
        update: {},
        create: { phone: SYSTEM_PHONE, role: 'admin', isActive: false, profile: { create: { firstName: 'Website', lastName: 'panel' } } },
        select: { id: true },
      });
      this.systemUserId = u.id;
    }
    return { sub: this.systemUserId, role: c.role, email: `Website: ${c.by}`.slice(0, 120) };
  }

  private clientOnly(c: PanelCaller) {
    if (c.role !== 'admin') throw new ForbiddenException('Only the owner (website administrator) can change money.');
  }

  private async log(c: PanelCaller, action: string, entity: string, entityId: string, changes: Record<string, unknown> = {}) {
    const a = await this.actor(c);
    await this.audit.log({ userId: a.sub, userEmail: a.email, userRole: a.role, action, entity, entityId, changes }).catch(() => undefined);
  }

  // ── Dashboard ───────────────────────────────────────────────────────────────

  async overview() {
    const since = new Date(Date.now() - 10 * 60_000);
    const [pending, approved, online, openTickets, escalated, payoutsDue, insuranceNew, aadhaarMissing] = await Promise.all([
      this.prisma.partnerProfile.count({ where: { status: 'pending' } }),
      this.prisma.partnerProfile.count({ where: { status: 'approved' } }),
      this.prisma.partnerProfile.count({ where: { status: 'approved', isOnline: true, lastSeenAt: { gte: since } } }),
      this.prisma.supportTicket.count({ where: { status: { in: ['open', 'in_progress'] } } }),
      this.prisma.supportTicket.count({ where: { status: { in: ['open', 'in_progress'] }, escalated: true } }),
      this.prisma.payout.aggregate({ where: { status: { in: ['pending', 'requested'] } }, _sum: { netAmount: true }, _count: true }),
      this.prisma.petInsuranceRequest.count({ where: { status: 'new' } }),
      this.prisma.partnerProfile.count({ where: { status: { in: ['pending', 'approved'] }, aadhaarEnc: null } }),
    ]);
    const dues = await this.prisma.partnerLedgerEntry.aggregate({ _sum: { amount: true } });
    return {
      partners: { pending, approved, online, aadhaarMissing },
      tickets: { open: openTickets, escalated },
      payouts: { count: payoutsDue._count, amount: round2(Number(payoutsDue._sum.netAmount ?? 0)) },
      duesOwed: round2(Math.max(0, Number(dues._sum.amount ?? 0))),
      insuranceNew,
    };
  }

  // ── Partners ────────────────────────────────────────────────────────────────

  async listPartners(q: { status?: string; type?: string; city?: string; q?: string; page?: unknown }) {
    const page = Math.max(1, Number(q.page) || 1);
    const pageSize = 50;
    const statuses = ['pending', 'approved', 'suspended', 'rejected'];
    if (q.status && !statuses.includes(q.status)) throw new BadRequestException('Unknown status');
    const search = (q.q ?? '').trim();
    const where: Prisma.PartnerProfileWhereInput = {
      ...(q.status ? { status: q.status as PartnerStatus } : {}),
      ...(q.type === 'team' || q.type === 'freelancer' ? { employmentType: q.type } : q.type === 'unset' ? { employmentType: null } : {}),
      ...(q.city ? { city: { equals: q.city, mode: 'insensitive' } } : {}),
      ...(search
        ? {
            OR: [
              { user: { phone: { contains: search.replace(/\D/g, '') || search } } },
              { user: { profile: { firstName: { contains: search, mode: 'insensitive' } } } },
              { user: { profile: { lastName: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };
    const [rows, total, counts] = await Promise.all([
      this.prisma.partnerProfile.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { phone: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } } },
      }),
      this.prisma.partnerProfile.count({ where }),
      this.prisma.partnerProfile.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const dues = await loadDues(this.prisma, rows.map((r) => r.userId));
    const since = Date.now() - 10 * 60_000;
    return {
      total,
      page,
      pageSize,
      counts: Object.fromEntries(statuses.map((s) => [s, counts.find((c) => c.status === s)?._count._all ?? 0])),
      list: rows.map((p) => ({
        id: p.userId,
        name: name(p.user.profile),
        phone: p.user.phone,
        photo: abs(p.photoUrl ?? p.user.profile?.avatarUrl),
        city: p.city,
        status: p.status,
        type: p.employmentType,
        modes: p.modes,
        kyc: p.kycStatus,
        aadhaar: !!(p.aadhaarEnc && p.aadhaarFrontFile && p.aadhaarBackFile),
        online: p.isOnline && !!p.lastSeenAt && p.lastSeenAt.getTime() >= since,
        rating: Number(p.rating),
        reviews: p.reviewCount,
        jobs: p.completedJobs,
        releases: p.releaseCount,
        due: dues.get(p.userId) ?? 0,
        joinedAt: p.createdAt,
      })),
    };
  }

  async partner(id: string) {
    const p = await this.prisma.partnerProfile.findUnique({
      where: { userId: id },
      include: { user: { select: { phone: true, email: true, createdAt: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } } },
    });
    if (!p) throw new NotFoundException('Partner not found');
    const [tools, money, payouts, jobs, reviews] = await Promise.all([
      this.partners.listTools(id).catch(() => null),
      this.commission.getPartnerOverview(id),
      this.prisma.payout.findMany({ where: { partnerId: id }, orderBy: { createdAt: 'desc' }, take: 30 }),
      this.prisma.booking.findMany({
        where: { partnerId: id },
        orderBy: { scheduledAt: 'desc' },
        take: 15,
        select: { id: true, wpRef: true, status: true, scheduledAt: true, packageName: true, petName: true, total: true, channel: true },
      }),
      this.partners.getReviews(id).catch(() => ({ reviews: [], avg: 0, count: 0 })),
    ]);
    return {
      id: p.userId,
      name: name(p.user.profile),
      phone: p.user.phone,
      email: p.user.email,
      photo: abs(p.photoUrl ?? p.user.profile?.avatarUrl),
      status: p.status,
      type: p.employmentType,
      city: p.city,
      modes: p.modes,
      petSpecies: p.petSpecies,
      age: p.age,
      address: p.address,
      bio: p.bio,
      joinedAt: p.createdAt,
      approvedAt: p.approvedAt,
      suspendReason: p.suspendReason,
      rejectReason: p.rejectReason,
      bank: p.bankAccountNumber ? { account: `XXXX${p.bankAccountNumber.slice(-4)}`, ifsc: p.ifscCode } : null,
      vet: p.vetDoctorName ? { doctor: p.vetDoctorName, clinic: p.vetClinic, phone: p.vetPhone } : null,
      kyc: {
        status: p.kycStatus,
        provider: p.kycProvider,
        verifiedAt: p.kycVerifiedAt,
        name: p.kycName,
        dob: p.kycDob,
        gender: p.kycGender,
        address: p.kycAddress,
        nameMatch: p.kycNameMatch,
        masked: p.aadhaarLast4 ? `XXXX XXXX ${p.aadhaarLast4}` : null,
        numberSaved: !!p.aadhaarEnc,
        front: !!p.aadhaarFrontFile,
        back: !!p.aadhaarBackFile,
        savedAt: p.aadhaarDocsAt,
      },
      stats: { rating: Number(p.rating), reviews: p.reviewCount, jobs: p.completedJobs, releases: p.releaseCount, online: p.isOnline, lastSeenAt: p.lastSeenAt },
      tools: tools ? { ...tools, items: tools.items.map((t) => ({ ...t, url: abs(t.url) })) } : null,
      money,
      payouts: payouts.map((x) => ({ id: x.id, bookingId: x.bookingId, gross: Number(x.grossAmount), commission: Number(x.commissionAmount), net: Number(x.netAmount), status: x.status, createdAt: x.createdAt, paidAt: x.paidAt, batchId: x.batchId })),
      jobs: jobs.map((j) => ({ ...j, total: Number(j.total) })),
      reviews: { avg: reviews.avg, count: reviews.count, latest: reviews.reviews.slice(0, 5) },
    };
  }

  private readonly TYPES = ['team', 'freelancer'] as const;

  async approve(c: PanelCaller, id: string, body: { employmentType?: unknown; city?: unknown }) {
    const type = String(body.employmentType ?? '');
    if (!(this.TYPES as readonly string[]).includes(type)) throw new BadRequestException('Choose My team or Freelancer.');
    const city = String(body.city ?? '').trim();
    if (!city) throw new BadRequestException('Choose the city exactly as on the website.');
    const p = await this.prisma.partnerProfile.findUnique({ where: { userId: id }, select: { status: true, aadhaarEnc: true, aadhaarFrontFile: true, aadhaarBackFile: true, kycStatus: true } });
    if (!p) throw new NotFoundException('Partner not found');
    if (p.status === 'approved') throw new BadRequestException('Already approved.');
    if (!p.aadhaarEnc || !p.aadhaarFrontFile || !p.aadhaarBackFile) {
      throw new UnprocessableEntityException({ code: 'AADHAAR_REQUIRED', message: 'This partner has not added the Aadhaar number and both card photos yet. They are asked for them in the partner app.' });
    }
    const a = await this.actor(c);
    await this.partners.approve(id, a.sub, type);
    await this.prisma.partnerProfile.update({ where: { userId: id }, data: { city, rejectReason: null, rejectedAt: null, suspendReason: null } });
    await this.log(c, 'partner.approve', 'partner', id, { type, city });
    await this.notifications.sendPush(id, { title: 'You are approved', body: 'Welcome to Wag & Tails. Go online to start receiving jobs.' }, { type: 'partner_approved' }).catch(() => undefined);
    return this.partner(id);
  }

  async reject(c: PanelCaller, id: string, reason: unknown) {
    const r = String(reason ?? '').trim();
    if (r.length < 3) throw new BadRequestException('Give a short reason.');
    const p = await this.prisma.partnerProfile.findUnique({ where: { userId: id }, select: { status: true } });
    if (!p) throw new NotFoundException('Partner not found');
    if (p.status === 'approved') throw new BadRequestException('An approved partner is suspended, not rejected.');
    await this.prisma.partnerProfile.update({ where: { userId: id }, data: { status: 'rejected', rejectReason: r.slice(0, 500), rejectedAt: new Date(), isOnline: false } });
    await this.log(c, 'partner.reject', 'partner', id, { reason: r });
    await this.notifications.sendPush(id, { title: 'Application not approved', body: r.slice(0, 160) }, { type: 'partner_rejected' }).catch(() => undefined);
    return this.partner(id);
  }

  async suspend(c: PanelCaller, id: string, reason: unknown) {
    const r = String(reason ?? '').trim();
    if (r.length < 3) throw new BadRequestException('Give a short reason.');
    const cur = await this.prisma.partnerProfile.findUnique({ where: { userId: id }, select: { status: true } });
    if (!cur) throw new NotFoundException('Partner not found');
    if (cur.status !== 'approved') throw new BadRequestException('Only an active partner can be suspended.');
    await this.partners.suspend(id, r.slice(0, 500));
    await this.prisma.partnerProfile.update({ where: { userId: id }, data: { isOnline: false } });
    await this.log(c, 'partner.suspend', 'partner', id, { reason: r });
    return this.partner(id);
  }

  async reactivate(c: PanelCaller, id: string) {
    const p = await this.prisma.partnerProfile.findUnique({ where: { userId: id }, select: { status: true } });
    if (!p) throw new NotFoundException('Partner not found');
    if (p.status !== 'suspended') throw new BadRequestException('Only a suspended partner can be reactivated.');
    await this.prisma.partnerProfile.update({ where: { userId: id }, data: { status: 'approved', suspendReason: null } });
    await this.log(c, 'partner.reactivate', 'partner', id);
    return this.partner(id);
  }

  async setType(c: PanelCaller, id: string, type: unknown) {
    await this.partners.setEmploymentType(id, type);
    await this.log(c, 'partner.type', 'partner', id, { type });
    return this.partner(id);
  }

  async setCity(c: PanelCaller, id: string, city: unknown) {
    const v = String(city ?? '').trim();
    if (!v) throw new BadRequestException('Choose a city.');
    await this.prisma.partnerProfile.update({ where: { userId: id }, data: { city: v } });
    await this.log(c, 'partner.city', 'partner', id, { city: v });
    return this.partner(id);
  }

  // ── Aadhaar ─────────────────────────────────────────────────────────────────

  async revealAadhaar(c: PanelCaller, id: string) {
    return this.aadhaar.reveal(id, await this.actor(c));
  }

  async deleteAadhaar(c: PanelCaller, id: string, reason: unknown) {
    const r = String(reason ?? '').trim();
    if (r.length < 3) throw new BadRequestException('Give a short reason.');
    await this.aadhaar.wipe(id, await this.actor(c), r);
    return this.partner(id);
  }

  // ── Money ───────────────────────────────────────────────────────────────────

  async moneySettings() {
    return this.commission.getSettings();
  }

  async setMoneySettings(c: PanelCaller, body: Record<string, unknown>) {
    this.clientOnly(c);
    return this.commission.updateSettings(await this.actor(c), body);
  }

  async setCommission(c: PanelCaller, id: string, body: Record<string, unknown>) {
    // The percent is shared work (staff may set it, as before); the limit stays with the owner (checked by role).
    return this.commission.setPartnerCommission(await this.actor(c), id, body);
  }

  async addDiscount(c: PanelCaller, id: string, body: Record<string, unknown>) {
    return this.commission.createDiscount(await this.actor(c), id, body);
  }

  async updateDiscount(c: PanelCaller, discountId: string, body: Record<string, unknown>) {
    return this.commission.updateDiscount(await this.actor(c), discountId, body);
  }

  async duesOffline(c: PanelCaller, id: string, body: Record<string, unknown>) {
    this.clientOnly(c);
    return this.commission.recordOfflinePayment(await this.actor(c), id, body);
  }

  async duesAdjust(c: PanelCaller, id: string, body: Record<string, unknown>) {
    this.clientOnly(c);
    return this.commission.adjust(await this.actor(c), id, body);
  }

  async reconcile(c: PanelCaller) {
    this.clientOnly(c);
    const r = await this.commission.reconcile();
    await this.log(c, 'commission.reconcile', 'commission', '1', { result: r as unknown as Record<string, unknown> });
    return r;
  }

  /** Payouts, newest first, with the partner's name; `status` = pending | requested | approved | paid. */
  async listPayouts(q: { status?: string; partner?: string }) {
    const allowed = ['pending', 'requested', 'approved', 'processing', 'paid', 'failed'];
    if (q.status && !allowed.includes(q.status)) throw new BadRequestException('Unknown status');
    const rows = await this.prisma.payout.findMany({
      where: { ...(q.status ? { status: q.status as any } : {}), ...(q.partner ? { partnerId: q.partner } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: { partner: { select: { userId: true, city: true, employmentType: true, bankAccountNumber: true, ifscCode: true, user: { select: { phone: true, profile: { select: { firstName: true, lastName: true } } } } } } },
    });
    const batches = await this.prisma.payoutBatch.findMany({ orderBy: { createdAt: 'desc' }, take: 30 });
    return {
      list: rows.map((x) => ({
        id: x.id,
        partnerId: x.partnerId,
        partner: name(x.partner.user.profile),
        phone: x.partner.user.phone,
        city: x.partner.city,
        bank: x.partner.bankAccountNumber ? `XXXX${x.partner.bankAccountNumber.slice(-4)} · ${x.partner.ifscCode ?? ''}` : null,
        bookingId: x.bookingId,
        gross: Number(x.grossAmount),
        commission: Number(x.commissionAmount),
        net: Number(x.netAmount),
        status: x.status,
        batchId: x.batchId,
        createdAt: x.createdAt,
        paidAt: x.paidAt,
        notes: x.notes,
      })),
      batches: batches.map((b) => ({ id: b.id, total: Number(b.totalAmount), count: b.payoutCount, status: b.status, createdAt: b.createdAt, processedAt: b.processedAt })),
    };
  }

  async createBatch(c: PanelCaller, ids: unknown) {
    this.clientOnly(c);
    const list = Array.isArray(ids) ? ids.map(String).filter((x) => /^[0-9a-f-]{36}$/i.test(x)) : [];
    if (!list.length) throw new BadRequestException('Choose at least one payout.');
    const rows = await this.prisma.payout.findMany({ where: { id: { in: list } }, select: { id: true, status: true } });
    if (rows.length !== list.length || rows.some((r) => r.status !== 'pending' && r.status !== 'requested')) {
      throw new BadRequestException('Only payouts that are still due can be put in a batch.');
    }
    const a = await this.actor(c);
    const batch = await this.payouts.approveBatch(list, a.sub);
    await this.log(c, 'payout.batch', 'payout_batch', batch.id, { payouts: list.length });
    return batch;
  }

  async markBatchPaid(c: PanelCaller, batchId: string, reference: unknown) {
    this.clientOnly(c);
    const ref = String(reference ?? '').trim();
    if (ref.length < 3) throw new BadRequestException('Enter the bank or UPI reference of the transfer.');
    const b = await this.prisma.payoutBatch.findUnique({ where: { id: batchId } });
    if (!b) throw new NotFoundException('Batch not found');
    if (b.status === 'paid') throw new BadRequestException('Already marked as paid.');
    const res = await this.payouts.markPaid(batchId);
    await this.prisma.payout.updateMany({ where: { batchId }, data: { notes: `Paid: ${ref.slice(0, 120)}` } });
    await this.log(c, 'payout.paid', 'payout_batch', batchId, { reference: ref });
    const partners = await this.prisma.payout.findMany({ where: { batchId }, select: { partnerId: true, netAmount: true } });
    for (const p of partners) {
      await this.notifications.sendPush(p.partnerId, { title: 'Payout sent', body: `₹${Number(p.netAmount).toFixed(0)} has been paid to you.` }, { type: 'payout_paid' }).catch(() => undefined);
    }
    return res;
  }

  // ── Support tickets ─────────────────────────────────────────────────────────

  async listTickets(q: { status?: string; escalated?: string }) {
    const rows = await this.support.listAll({
      ...(q.status ? { status: q.status } : {}),
      ...(q.escalated === '1' ? { escalated: true } : {}),
    });
    return {
      list: rows.slice(0, 300).map((t) => ({
        id: t.id,
        subject: t.subject,
        description: t.description,
        status: t.status,
        priority: t.priority,
        escalated: t.escalated,
        escalatedReason: t.escalatedReason,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        from: { id: t.user.id, role: t.user.role, phone: t.user.phone, name: name(t.user.profile) },
      })),
    };
  }

  async ticket(c: PanelCaller, id: string) {
    const a = await this.actor(c);
    const t = await this.support.getOne(id, a.sub, 'staff');
    const messages = await this.support.getMessages(id, a.sub, 'staff');
    return {
      id: t.id, subject: t.subject, description: t.description, status: t.status, priority: t.priority, escalated: t.escalated,
      escalatedReason: t.escalatedReason, createdAt: t.createdAt,
      from: { id: t.user.id, role: t.user.role, phone: t.user.phone, name: name(t.user.profile) },
      messages: [...messages].reverse().map((m) => ({ id: m.id, from: m.senderName, role: m.senderRole, text: m.content, attachment: abs(m.attachmentUrl), at: m.sentAt })),
    };
  }

  async reply(c: PanelCaller, id: string, text: unknown) {
    const t = String(text ?? '').trim();
    if (!t) throw new BadRequestException('Write a reply.');
    const a = await this.actor(c);
    const msg = await this.support.sendMessage(id, a.sub, 'staff', t.slice(0, 4000));
    // Show the person's first name to the customer, not the built-in account.
    await this.prisma.message.update({ where: { id: (msg as any).id }, data: { senderName: `${c.by.split(' ')[0] || 'Wag & Tails'} (Wag & Tails)` } }).catch(() => undefined);
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id }, select: { userId: true } });
    if (ticket) await this.notifications.sendPush(ticket.userId, { title: 'Reply from Wag & Tails', body: t.slice(0, 120), data: { ticketId: id } }, { type: 'support_reply' }).catch(() => undefined);
    return this.ticket(c, id);
  }

  async ticketStatus(c: PanelCaller, id: string, status: unknown) {
    const s = String(status ?? '');
    if (!['open', 'in_progress', 'resolved', 'closed'].includes(s)) throw new BadRequestException('Unknown status');
    await this.support.updateStatus(id, s);
    await this.log(c, 'ticket.status', 'support_ticket', id, { status: s });
    return this.ticket(c, id);
  }

  async escalate(c: PanelCaller, id: string, reason: unknown) {
    const r = String(reason ?? '').trim();
    if (r.length < 3) throw new BadRequestException('Give a short reason.');
    await this.support.escalate(id, (await this.actor(c)).sub, r);
    await this.log(c, 'ticket.escalate', 'support_ticket', id, { reason: r });
    return this.ticket(c, id);
  }

  // ── Customers (the app side of a website customer) ──────────────────────────

  async customer(phone: string) {
    const p = toAppPhone(phone);
    if (!p) throw new BadRequestException('Enter a valid mobile number.');
    const u = await this.prisma.user.findUnique({
      where: { phone: p },
      select: {
        id: true, role: true, createdAt: true, isActive: true,
        profile: { select: { firstName: true, lastName: true } },
        pets: { where: { isActive: true }, select: { name: true, species: true, breed: true } },
      },
    });
    if (!u) return { app: false };
    const [bookings, last, orders, insurance, tickets] = await Promise.all([
      this.prisma.booking.count({ where: { customerId: u.id } }),
      this.prisma.booking.findFirst({ where: { customerId: u.id }, orderBy: { scheduledAt: 'desc' }, select: { wpRef: true, status: true, scheduledAt: true, packageName: true } }),
      this.prisma.storeOrder.count({ where: { userId: u.id } }),
      this.prisma.petInsuranceRequest.count({ where: { customerId: u.id } }),
      this.prisma.supportTicket.count({ where: { userId: u.id } }),
    ]);
    return {
      app: true,
      role: u.role,
      name: name(u.profile),
      since: u.createdAt,
      active: u.isActive,
      pets: u.pets,
      bookings,
      lastBooking: last,
      orders,
      insurance,
      tickets,
    };
  }

  // ── Activity log ────────────────────────────────────────────────────────────

  async activity(q: { page?: unknown; entityId?: string }) {
    const page = Math.max(1, Number(q.page) || 1);
    const rows = await this.prisma.auditLog.findMany({
      where: q.entityId ? { entityId: q.entityId } : {},
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * 100,
      take: 100,
      include: { user: { select: { profile: { select: { firstName: true, lastName: true } } } } },
    });
    return {
      page,
      list: rows.map((r) => ({
        at: r.createdAt,
        by: r.userEmail?.startsWith('Website: ') ? r.userEmail.slice(9) : name(r.user.profile) || r.userEmail || r.userRole,
        role: r.userRole,
        action: r.action,
        entity: r.entity,
        entityId: r.entityId,
        changes: r.changes,
      })),
    };
  }
}
