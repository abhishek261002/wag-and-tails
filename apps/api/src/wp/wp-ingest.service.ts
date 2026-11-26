import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Cron } from '@nestjs/schedule';
import { randomBytes } from 'crypto';
import { Prisma, type Booking, type PaymentMethod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { WpClientService } from './wp-client.service.js';
import { WpJobsService } from './wp-jobs.service.js';
import { WpStoreService } from './wp-store.service.js';
import { appRules, channelForSource, dateToIst, dobFromAge, escalationDeadline, istToDate, toAppPhone, toPluginPhone } from './wp-link.js';

// B2: every booking made on the website or at the desk becomes a job partners can take, linked by its WT reference.
// Changes made on the desk (reschedule, new price, cancel, complete) flow back into the job.
// Triggered by the plugin's signed "booking changed" message; a poll of connector/changes catches anything missed.

const CURSOR_KEY = 'changes_cursor';

// Rough city centres, used only when a website booking has no map pin (distances shown to partners).
const CITY_CENTRES: Record<string, [number, number]> = {
  kanpur: [26.4499, 80.3319], lucknow: [26.8467, 80.9462], hyderabad: [17.385, 78.4867], 'north-mumbai': [19.2183, 72.9781],
  'south-mumbai': [18.9388, 72.8354], 'navi-mumbai': [19.033, 73.0297], pune: [18.5204, 73.8567], pcmc: [18.6298, 73.7997],
  indore: [22.7196, 75.8577], jaipur: [26.9124, 75.7873], delhi: [28.6139, 77.209],
};

export interface PluginBooking {
  id: string;
  _rev?: number;
  status?: string;
  city?: string;
  pkg?: string;
  pkgName?: string;
  petType?: string;
  petName?: string;
  breed?: string;
  gender?: string;
  age?: string;
  ageUnit?: string;
  aggression?: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  pincode?: string;
  lat?: number | null;
  lng?: number | null;
  date?: string;
  start?: string;
  slot?: string;
  subtotal?: number;
  discount?: number;
  ptsDiscount?: number;
  total?: number;
  pay?: string;
  payStatus?: string;
  payMode?: string;
  source?: string;
  notes?: string;
  customNote?: string;
  cancelReason?: string;
  closedBy?: string;
  job?: { id?: string; status?: string; partner?: { id?: string } | null } | null;
  [k: string]: unknown;
}

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** True when the website's address text is a different address from every form the app knows for the booking. */
export function addressChanged(known: string[], incoming: string): boolean {
  const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const inc = norm(incoming);
  if (!inc) return false;
  return !known.map(norm).filter(Boolean).some((k) => inc.startsWith(k.slice(0, 40)) || k.startsWith(inc.slice(0, 40)));
}

@Injectable()
export class WpIngestService {
  private readonly logger = new Logger(WpIngestService.name);
  private polling = false;

  constructor(
    private prisma: PrismaService,
    private wp: WpClientService,
    private jobs: WpJobsService,
    private store: WpStoreService,
    private realtime: RealtimeGateway,
    private notifications: NotificationsService,
    private moduleRef: ModuleRef
  ) {}

  /** A signed message from the plugin: { type, ref, op, fromApp }. */
  async handleEvent(ev: { type?: string; ref?: string; op?: string }) {
    if (ev.type === 'booking' && ev.ref) {
      if (ev.op === 'delete') return this.removed(ev.ref, 'Deleted on the website');
      const res = await this.wp.get<{ booking: PluginBooking }>(`bookings/${encodeURIComponent(ev.ref)}`);
      return this.reconcile(res.booking);
    }
    // A WooCommerce order made in the app changed (Processing, Completed, Cancelled, ...).
    if (ev.type === 'order' && ev.ref && /^\d+$/.test(ev.ref)) return this.store.applyOrder(Number(ev.ref));
    // A product changed: copy the catalogue again shortly.
    if (ev.type === 'catalog') {
      this.store.soon();
      return { queued: 'catalog' };
    }
    // An insurance lead changed on the website: the changes feed has it (the poll applies it).
    if (ev.type === 'insurance') return this.poll();
    if (ev.type === 'tomb' && ev.ref) return { ignored: 'tomb' }; // deletions arrive as op=delete; the poll handles tombs
    return { ignored: ev.type ?? 'unknown' };
  }

  /** Safety net: everything changed since the last poll (2-minute schedule, and on demand). */
  @Cron('*/2 * * * *')
  async scheduledPoll() {
    if (!this.wp.enabled || (process.env['SCHEDULER_ENABLED'] ?? 'true') === 'false') return;
    await this.poll().catch((e) => this.logger.warn(`Poll failed: ${(e as Error).message}`));
  }

  async poll(): Promise<{ seen: number; applied: number }> {
    if (this.polling || !this.wp.enabled) return { seen: 0, applied: 0 };
    this.polling = true;
    let seen = 0;
    let applied = 0;
    try {
      const st = await this.prisma.wpSyncState.findUnique({ where: { key: CURSOR_KEY } });
      // First run: start from now, minus a day, so old history is not turned into jobs.
      let cursor = (st?.value as { since?: string; afterId?: number } | undefined) ?? { since: this.mysqlTime(new Date(Date.now() - 86_400_000)), afterId: 0 };
      for (let page = 0; page < 20; page++) {
        const res = await this.wp.get<{ list: { rowId: number; type: string; ref: string; updatedAt: string; data: any }[]; more: boolean }>('changes', {
          since: cursor.since, afterId: cursor.afterId ?? 0, limit: 200,
        });
        for (const row of res.list) {
          seen++;
          try {
            if (row.type === 'booking') {
              const r = await this.reconcile({ ...row.data, _rev: row.data?._rev ?? (row as any).rev });
              if (r.action !== 'stale' && r.action !== 'skipped') applied++;
            } else if (row.type === 'insurance' && row.data?.appId) {
              if (await (await this.insurance())?.applyWebsiteLead(row.data)) applied++;
            } else if (row.type === 'tomb' && row.data?.of === 'booking' && row.data?.ref) {
              await this.removed(String(row.data.ref), 'Deleted on the website');
            }
          } catch (e) {
            this.logger.warn(`Could not apply ${row.type} ${row.ref}: ${(e as Error).message}`);
          }
          cursor = { since: row.updatedAt, afterId: row.rowId };
        }
        await this.prisma.wpSyncState.upsert({
          where: { key: CURSOR_KEY },
          create: { key: CURSOR_KEY, value: cursor as Prisma.InputJsonValue },
          update: { value: cursor as Prisma.InputJsonValue },
        });
        if (!res.more) break;
      }
    } finally {
      this.polling = false;
    }
    return { seen, applied };
  }

  private async insurance(): Promise<{ applyWebsiteLead(l: unknown): Promise<boolean> } | null> {
    try {
      // Lazy: InsuranceModule is not imported here (the WP module is global and must not import it).
      const { InsuranceService } = await import('../insurance/insurance.service.js');
      return this.moduleRef.get(InsuranceService, { strict: false }) as any;
    } catch {
      return null;
    }
  }

  private mysqlTime(d: Date) {
    // The plugin's updated_at is site-local time (Asia/Kolkata on the live site).
    const { date, start } = dateToIst(d);
    return `${date} ${start}:00`;
  }

  // ── Reconcile one plugin booking with its job ──────────────────────────────────

  async reconcile(rec: PluginBooking): Promise<{ action: string; bookingId?: string }> {
    if (!rec?.id) return { action: 'skipped' };
    const rev = Number(rec._rev ?? 0);
    let existing = await this.prisma.booking.findUnique({ where: { wpRef: rec.id } });
    if (!existing && rec.job?.id && /^[0-9a-f-]{36}$/i.test(rec.job.id)) {
      // An app booking whose creation answer has not been stored yet: link it now.
      existing = await this.prisma.booking.findUnique({ where: { id: rec.job.id } });
      if (existing && !existing.wpRef) existing = await this.prisma.booking.update({ where: { id: existing.id }, data: { wpRef: rec.id } });
    }
    if (existing) {
      if (existing.wpRev != null && rev && rev <= existing.wpRev) return { action: 'stale', bookingId: existing.id };
      return this.applyChanges(existing, rec, rev);
    }
    return this.createFromPlugin(rec, rev);
  }

  /** A new website / desk booking → a job for partners. */
  private async createFromPlugin(rec: PluginBooking, rev: number): Promise<{ action: string; bookingId?: string }> {
    if (!['Confirmed', 'Rescheduled'].includes(rec.status ?? '')) return { action: 'skipped' };
    if (rec.source === 'App') return { action: 'skipped' }; // app bookings are created by the app first
    const scheduledAt = istToDate(rec.date, rec.start);
    if (!scheduledAt || scheduledAt.getTime() < Date.now() - 6 * 3600_000) return { action: 'skipped' };
    const phone = toAppPhone(rec.phone);
    if (!phone) {
      this.logger.warn(`Booking ${rec.id} has no valid phone; not sent to partners`);
      return { action: 'skipped' };
    }

    const city = rec.city ? await this.prisma.wpCity.findUnique({ where: { id: rec.city } }) : null;
    const cityName = city?.name ?? rec.city ?? '';
    const customerId = await this.ensureCustomer(phone, rec.name ?? '', rec.email ?? '', cityName);
    const pet = await this.ensurePet(customerId, rec);
    const address = await this.ensureAddress(customerId, rec, cityName);
    const pkg = rec.pkg ? await this.prisma.groomingPackage.findUnique({ where: { wpId: rec.pkg } }) : null;
    const paid = rec.payStatus === 'Paid';
    const payLater = rec.pay !== 'online';
    const discount = num(rec.discount) + num(rec.ptsDiscount);
    const notes = [rec.notes, rec.customNote].filter((s) => typeof s === 'string' && s.trim()).join(' · ') || null;
    const now = new Date();

    try {
      const booking = await this.prisma.booking.create({
        data: {
          type: 'grooming',
          status: 'needs_partner',
          channel: channelForSource(rec.source),
          customerId,
          petId: pet.id,
          petName: pet.name,
          petSpecies: pet.species,
          petBreed: pet.breed,
          petSize: pet.size,
          petCareNotes: notes,
          petAggression: rec.aggression ?? null,
          packageId: pkg?.id ?? null,
          packageName: (rec.pkgName as string) || pkg?.name || 'Grooming',
          packagePrice: num(rec.subtotal) || num(rec.total),
          scheduledAt,
          addressId: address.id,
          addressLine: `${address.line1}, ${address.city}`,
          subtotal: num(rec.subtotal) || num(rec.total) + discount,
          discount,
          total: num(rec.total),
          couponCode: (rec['coupon'] as string) || null,
          paymentMethod: (payLater ? 'cash_after_service' : 'upi') as PaymentMethod,
          paymentStatus: paid ? 'paid' : 'pending',
          wpRef: rec.id,
          wpRev: rev || null,
          wpSource: rec.source ?? 'Website',
          wpCityId: rec.city ?? null,
          wpStatus: rec.status ?? null,
          trackToken: randomBytes(12).toString('base64url'),
          escalateAt: escalationDeadline(now, scheduledAt),
          statusHistory: { create: { status: 'needs_partner', changedBy: customerId, note: `From the ${rec.source ?? 'website'} (${rec.id})` } },
        },
      });
      await this.jobs.announce(booking.id);
      await this.jobs.jobChanged(booking.id, { transition: true });
      return { action: 'created', bookingId: booking.id };
    } catch (e) {
      if ((e as any)?.code === 'P2002') return { action: 'stale' }; // created by a concurrent event
      throw e;
    }
  }

  /** Desk or website changes to a booking that already has a job. */
  private async applyChanges(b: Booking, rec: PluginBooking, rev: number): Promise<{ action: string; bookingId: string }> {
    const changes: string[] = [];
    const data: Prisma.BookingUpdateInput = { wpRev: rev || b.wpRev, wpStatus: rec.status ?? b.wpStatus };
    const terminal = ['completed', 'cancelled', 'refunded', 'expired'].includes(b.status);

    // Cancelled on the desk / website
    if (rec.status === 'Cancelled' && !terminal) {
      // Conditional, so the website's answer and its change message arriving together cancel (and notify) once.
      const done = await this.prisma.booking.updateMany({
        where: { id: b.id, status: { notIn: ['completed', 'cancelled', 'refunded', 'expired'] } },
        data: {
          wpRev: (data.wpRev as number | null) ?? null, wpStatus: rec.status, status: 'cancelled', cancelledAt: new Date(),
          cancelReason: rec.cancelReason ?? 'Cancelled by the desk', staffFlag: null, staffFlagNote: null, reconfirmBy: null,
        },
      });
      if (!done.count) return { action: 'noted', bookingId: b.id };
      await this.prisma.bookingStatusHistory.create({ data: { bookingId: b.id, status: 'cancelled', changedBy: b.customerId, note: `Cancelled on the desk: ${rec.cancelReason ?? ''}` } });
      await this.tellParties(b, 'cancelled', 'Booking cancelled', `${b.petName}'s grooming was cancelled by the desk.`);
      return { action: 'cancelled', bookingId: b.id };
    }

    // Completed at the desk (decision 12A): close the job and record the money.
    if (rec.status === 'Completed' && !terminal) {
      const cash = rec.payMode === 'Cash';
      const money: Prisma.BookingUpdateInput = b.partnerId
        ? cash
          ? { paymentStatus: 'paid', collectedAt: b.collectedAt ?? new Date(), collectedMethod: b.collectedMethod ?? 'cash', collectedAmount: b.collectedAmount ?? num(rec.total) }
          : { paymentStatus: 'paid' }
        : { paymentStatus: 'paid' };
      const done = await this.prisma.booking.updateMany({
        where: { id: b.id, status: { notIn: ['completed', 'cancelled', 'refunded', 'expired'] } },
        data: {
          wpRev: (data.wpRev as number | null) ?? null, wpStatus: rec.status, ...(money as any), status: 'completed', completedAt: new Date(),
          total: num(rec.total) || b.total, startOtp: null, endOtp: null, staffFlag: null, staffFlagNote: null, reconfirmBy: null,
        },
      });
      if (!done.count) return { action: 'noted', bookingId: b.id };
      await this.prisma.bookingStatusHistory.create({ data: { bookingId: b.id, status: 'completed', changedBy: b.partnerId ?? b.customerId, note: `Completed at the desk by ${rec.closedBy ?? 'staff'} (${rec.payMode ?? ''})` } });
      if (b.partnerId) {
        try {
          const { CommissionService } = await import('../commission/commission.service.js');
          await this.moduleRef.get(CommissionService, { strict: false }).settle(b.id);
        } catch (e) {
          this.logger.error(`settle after desk completion failed: ${(e as Error).message}`);
        }
      }
      await this.tellParties(b, 'completed', 'Job closed by the desk', `${b.petName}'s grooming was marked complete by the desk.`);
      return { action: 'completed', bookingId: b.id };
    }

    if (terminal) {
      await this.prisma.booking.update({ where: { id: b.id }, data });
      return { action: 'noted', bookingId: b.id };
    }

    // Pending payment → Confirmed on the plugin for an app booking (or a website online payment finishing).
    // Date / time
    const when = istToDate(rec.date, rec.start);
    if (when && (!b.scheduledAt || when.getTime() !== b.scheduledAt.getTime())) {
      data.scheduledAt = when;
      changes.push('time');
    }
    // Price
    const total = num(rec.total);
    if (rec.total !== undefined && Math.abs(total - Number(b.total)) > 0.009 && !b.partnerDiscountAmount?.gt?.(0)) {
      const discount = num(rec.discount) + num(rec.ptsDiscount);
      data.total = total;
      data.subtotal = num(rec.subtotal) || total + discount;
      data.discount = discount;
      changes.push('price');
    }
    if (rec.payStatus === 'Paid' && b.paymentStatus !== 'paid') {
      data.paymentStatus = 'paid';
      changes.push('payment');
    }
    // Snapshot fields shown to the partner
    if ((rec.aggression ?? null) !== b.petAggression) { data.petAggression = rec.aggression ?? null; changes.push('pet'); }
    const notes = [rec.notes, rec.customNote].filter((s) => typeof s === 'string' && s.trim()).join(' · ') || null;
    if (notes !== b.petCareNotes && b.wpSource !== 'App') { data.petCareNotes = notes; changes.push('notes'); }
    if (rec.address && (await this.addressChangedOnDesk(b, String(rec.address)))) {
      const city = rec.city ? await this.prisma.wpCity.findUnique({ where: { id: rec.city } }) : null;
      const addr = await this.ensureAddress(b.customerId, rec, city?.name ?? rec.city ?? '');
      data.address = { connect: { id: addr.id } };
      data.addressLine = `${addr.line1}, ${addr.city}`;
      changes.push('address');
    }

    const timeChanged = changes.includes('time');
    if (timeChanged && b.partnerId && ['assigned', 'accepted'].includes(b.status)) {
      // The partner must confirm the new time within 2 hours, otherwise the job is offered again (B5).
      data.reconfirmBy = new Date(Date.now() + appRules().reconfirmHours * 3600_000);
      data.lateFlaggedAt = null;
    }
    if (timeChanged && b.status === 'needs_partner' && when) {
      data.escalateAt = escalationDeadline(new Date(), when);
      data.escalatedAt = null;
    }
    await this.prisma.booking.update({ where: { id: b.id }, data });

    if (changes.length) {
      await this.prisma.bookingStatusHistory.create({ data: { bookingId: b.id, status: b.status, changedBy: b.customerId, note: `Changed on the desk: ${changes.join(', ')}` } });
      this.realtime.emitToBooking(b.id, 'booking:updated', { bookingId: b.id, changes });
      if (b.partnerId) {
        const what = timeChanged ? `moved to ${rec.date} ${rec.slot ?? rec.start}${data.reconfirmBy ? '. Please confirm the new time.' : ''}` : changes.includes('price') ? `price is now ₹${total}` : 'details were updated';
        this.realtime.emitToUser(b.partnerId, 'job:updated', { bookingId: b.id, changes, reconfirmBy: data.reconfirmBy ?? null });
        await this.notifications.sendPush(b.partnerId, {
          title: timeChanged ? 'Job rescheduled' : 'Job updated',
          body: `${b.petName}'s grooming ${what}`,
          data: { type: 'job:updated', bookingId: b.id },
        }).catch(() => {});
      }
      if (b.status === 'needs_partner' && timeChanged) await this.jobs.announce(b.id);
      if (changes.includes('price') && b.partnerId) await this.repriceForPartner(b.id, b.partnerId);
    }
    return { action: changes.length ? 'updated' : 'noted', bookingId: b.id };
  }

  /** The desk changed the price of a job a partner already has: recompute the commission split. */
  private async repriceForPartner(bookingId: string, partnerId: string) {
    try {
      const { CommissionService } = await import('../commission/commission.service.js');
      await this.moduleRef.get(CommissionService, { strict: false }).applyClaimPricing(bookingId, partnerId);
    } catch (e) {
      this.logger.error(`reprice ${bookingId}: ${(e as Error).message}`);
    }
  }

  private async removed(ref: string, why: string) {
    const b = await this.prisma.booking.findUnique({ where: { wpRef: ref } });
    if (!b || ['completed', 'cancelled', 'refunded'].includes(b.status)) return { action: 'noted' };
    await this.prisma.booking.update({
      where: { id: b.id },
      data: { status: 'cancelled', cancelledAt: new Date(), cancelReason: why, wpStatus: 'Deleted', statusHistory: { create: { status: 'cancelled', changedBy: b.customerId, note: why } } },
    });
    await this.tellParties(b, 'cancelled', 'Booking cancelled', `${b.petName}'s grooming was removed by the desk.`);
    return { action: 'cancelled', bookingId: b.id };
  }

  private async tellParties(b: Booking, status: string, title: string, body: string) {
    this.realtime.emitToBooking(b.id, 'booking:status_changed', { bookingId: b.id, status, updatedAt: new Date().toISOString() });
    if (b.partnerId) {
      this.realtime.emitToUser(b.partnerId, 'job:removed', { bookingId: b.id, status });
      await this.notifications.sendPush(b.partnerId, { title, body, data: { type: `job:${status}`, bookingId: b.id } }).catch(() => {});
    }
    // App customers hear it from the app too; website customers get the plugin's WhatsApp.
    if (b.wpSource === 'App') {
      await this.notifications.sendPush(b.customerId, { title, body, data: { type: `booking:${status}`, bookingId: b.id } }).catch(() => {});
    }
  }

  // ── Customer, pet and address for a website booking ─────────────────────────────

  /** One identity (ground rule 4): the same mobile number is the same customer on the website and in the app. */
  async ensureCustomer(phone: string, name: string, email: string, city: string): Promise<string> {
    const found = await this.prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (found) return found.id;
    const [first, ...rest] = (name.trim() || 'Customer').split(/\s+/);
    const emailFree = email && /@/.test(email) ? !(await this.prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true } })) : false;
    try {
      const u = await this.prisma.user.create({
        data: {
          phone,
          email: emailFree ? email.toLowerCase() : null,
          role: 'customer',
          profile: { create: { firstName: first ?? 'Customer', lastName: rest.join(' ') } },
          customerProfile: { create: { city: city || null } },
        },
        select: { id: true },
      });
      return u.id;
    } catch (e) {
      if ((e as any)?.code === 'P2002') {
        const again = await this.prisma.user.findUnique({ where: { phone }, select: { id: true } });
        if (again) return again.id;
      }
      throw e;
    }
  }

  async ensurePet(customerId: string, rec: PluginBooking) {
    const species = rec.petType === 'Cat' ? 'cat' : 'dog';
    const breed = (rec.breed ?? '').trim() || (species === 'cat' ? 'Cat' : 'Dog');
    const named = typeof rec.petName === 'string' && rec.petName.trim() ? rec.petName.trim() : null;
    const pets = await this.prisma.pet.findMany({ where: { customerId, species, isActive: true } });
    const match = (named && pets.find((p) => p.name.toLowerCase() === named.toLowerCase())) || pets.find((p) => p.breed.toLowerCase() === breed.toLowerCase());
    if (match) {
      if (rec.aggression && match.temperament !== rec.aggression) {
        await this.prisma.pet.update({ where: { id: match.id }, data: { temperament: rec.aggression } });
      }
      return match;
    }
    return this.prisma.pet.create({
      data: {
        customerId, species, name: named ?? breed, breed,
        sex: rec.gender === 'Female' ? 'female' : 'male',
        dateOfBirth: dobFromAge(rec.age, rec.ageUnit),
        temperament: rec.aggression ?? null,
      },
    });
  }

  /**
   * Did the desk really change the address? The app sends the website "line1, line2, city", while the booking keeps a
   * shorter "line1, city" line, so comparing the website text with that short line always looked like a change: every
   * first website update of an app booking (a reschedule, say) logged a false "address changed", made a duplicate
   * "From website" address and told the partner the job was updated. Compare with the linked address as the app wrote it.
   */
  private async addressChangedOnDesk(b: Booking, incoming: string): Promise<boolean> {
    const linked = b.addressId ? await this.prisma.address.findUnique({ where: { id: b.addressId } }) : null;
    return addressChanged([b.addressLine, linked ? [linked.line1, linked.line2, linked.city].filter(Boolean).join(', ') : ''], incoming);
  }

  async ensureAddress(customerId: string, rec: PluginBooking, cityName: string) {
    const line1 = String(rec.address ?? '').replace(/\s+/g, ' ').trim().slice(0, 300) || 'Address on the booking';
    const lat = Number(rec.lat);
    const lng = Number(rec.lng);
    const hasPin = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0 && rec.lat != null && rec.lng != null;
    const existing = await this.prisma.address.findFirst({ where: { userId: customerId, line1, isActive: true } });
    if (existing) {
      if (hasPin && (existing.lat !== lat || existing.lng !== lng)) {
        return this.prisma.address.update({ where: { id: existing.id }, data: { lat, lng } });
      }
      return existing;
    }
    const centre = CITY_CENTRES[String(rec.city ?? '').toLowerCase()] ?? [0, 0];
    return this.prisma.address.create({
      data: {
        userId: customerId, label: 'From website', line1, city: cityName || String(rec.city ?? ''), state: '',
        pincode: String(rec.pincode ?? '').slice(0, 6), lat: hasPin ? lat : centre[0], lng: hasPin ? lng : centre[1],
      },
    });
  }

  /** Map-free check used by tests: the phone the plugin would use for this app phone. */
  pluginPhone(appPhone: string) {
    return toPluginPhone(appPhone);
  }
}
