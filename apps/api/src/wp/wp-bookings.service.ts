import { ConflictException, Injectable, Logger, NotFoundException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { WpClientService, WpError } from './wp-client.service.js';
import { WpOutboxService } from './wp-outbox.service.js';
import { matchWpCity } from './wp-config-map.js';
import { dateToIst, toPluginPhone } from './wp-link.js';

// The customer app's side of the link (B3, B8, A1): slots, prices, reserving the slot before the job exists,
// points and website history, complaints, app walks.

const AGGRESSION_DEFAULT = 'Calm — loves people';

/** Plugin error → the error the app shows. */
export function appErrorFrom(e: unknown): never {
  if (e instanceof WpError) {
    const code = (e.data as any)?.code ?? e.code;
    if (e.status === 409 && (code === 'SLOT_TAKEN' || /booked|slot/i.test(e.message))) {
      throw new ConflictException({ code: 'SLOT_TAKEN', message: e.message || 'That time was just booked. Please choose another.' });
    }
    if (e.status === 409 && (e.code === 'wt_price' || /price changed/i.test(e.message))) {
      throw new ConflictException({ code: 'PRICE_CHANGED', message: e.message });
    }
    if (e.status === 409 && e.code === 'wt_points') throw new ConflictException({ code: 'NOT_ENOUGH_POINTS', message: e.message });
    if (e.status >= 400 && e.status < 500 && e.status !== 401) throw new UnprocessableEntityException({ code: 'WEBSITE_REFUSED', message: e.message });
  }
  throw new ServiceUnavailableException({ code: 'WEBSITE_UNAVAILABLE', message: 'Booking is briefly unavailable. Please try again in a minute.' });
}

@Injectable()
export class WpBookingsService {
  private readonly logger = new Logger(WpBookingsService.name);

  constructor(private prisma: PrismaService, private wp: WpClientService, private outbox: WpOutboxService) {}

  get enabled() {
    return this.wp.enabled;
  }

  /** The website city for an address (or an explicit choice where one GPS city covers several website cities). */
  async cityFor(cityName: string | null | undefined, explicitId?: string | null) {
    const cities = await this.prisma.wpCity.findMany({ where: { present: true, service: true } });
    if (explicitId) return cities.find((c) => c.id === explicitId) ?? null;
    return matchWpCity(cities, cityName);
  }

  async requireCity(cityName: string | null | undefined, explicitId?: string | null) {
    const c = await this.cityFor(cityName, explicitId);
    if (!c) {
      throw new UnprocessableEntityException({
        code: 'CITY_NOT_SERVED',
        message: `We do not offer home grooming in ${cityName || 'this city'} yet.`,
        cities: (await this.prisma.wpCity.findMany({ where: { present: true, service: true }, orderBy: { sortOrder: 'asc' } })).map((x) => ({ id: x.id, name: x.name })),
      });
    }
    return c;
  }

  /** Free slots from the plugin (ground rule 2: one calendar for website and app). */
  async slots(cityId: string, date: string, pkgWpId?: string | null, mins?: number | null, excludeRef?: string | null) {
    try {
      return await this.wp.get<{ slots: { start: string; label: string; free: boolean }[]; mins: number }>('slots', {
        city: cityId, date, pkg: pkgWpId ?? undefined, mins: mins ?? undefined, ref: excludeRef ?? undefined,
      });
    } catch (e) {
      return appErrorFrom(e);
    }
  }

  async quote(input: { cityId: string; pkgWpId: string; petType: 'Dog' | 'Cat'; coupon?: string; usePts?: boolean; phone?: string | null; extras?: { name: string; price: number }[] }) {
    try {
      const res = await this.wp.post<{ quote: any }>('quote', {
        city: input.cityId, pkg: input.pkgWpId, petType: input.petType, coupon: input.coupon ?? '', usePts: !!input.usePts,
        phone: toPluginPhone(input.phone) ?? '', extras: input.extras ?? [],
      });
      return res.quote;
    } catch (e) {
      return appErrorFrom(e);
    }
  }

  /**
   * Reserve the slot on the website first (B3). Returns the plugin booking; throws SLOT_TAKEN / PRICE_CHANGED /
   * WEBSITE_REFUSED for the app to show. Same jobId → same booking on a retry.
   */
  async reserve(input: {
    jobId: string; cityId: string; pkgWpId: string; petType: 'Dog' | 'Cat'; petName: string; breed: string; gender: 'Male' | 'Female';
    age: string; aggression?: string | null; name: string; email?: string | null; phone: string; address: string; pincode: string;
    lat?: number | null; lng?: number | null; scheduledAt: Date; coupon?: string | null; usePts?: boolean; notes?: string | null;
    extras: { name: string; price: number }[]; payOnline: boolean; expectTotal?: number | null;
  }) {
    const { date, start } = dateToIst(input.scheduledAt);
    const aggression = await this.validAggression(input.aggression);
    try {
      const res = await this.wp.post<{ booking: any }>('bookings', {
        jobId: input.jobId, city: input.cityId, pkg: input.pkgWpId, petType: input.petType, petName: input.petName, breed: input.breed,
        gender: input.gender, age: input.age, aggression, name: input.name, email: input.email ?? '', phone: toPluginPhone(input.phone),
        address: input.address, pincode: input.pincode, lat: input.lat ?? null, lng: input.lng ?? null, date, start,
        coupon: input.coupon ?? '', usePts: !!input.usePts, notes: input.notes ?? '', extras: input.extras,
        pay: input.payOnline ? 'online' : 'later', awaitPay: input.payOnline,
        ...(input.expectTotal != null ? { expectTotal: input.expectTotal } : {}),
      });
      return res.booking;
    } catch (e) {
      return appErrorFrom(e);
    }
  }

  private async validAggression(v?: string | null) {
    const cfg = await this.prisma.wpSyncState.findUnique({ where: { key: 'config' } });
    const list = ((cfg?.value as any)?.aggression as string[] | undefined) ?? [];
    if (v && list.includes(v)) return v;
    // The app stores a free-text temperament; match it to the closest plugin level by its first word.
    const word = String(v ?? '').toLowerCase().split(/\W+/)[0];
    return list.find((l) => word && l.toLowerCase().startsWith(word)) ?? list[0] ?? AGGRESSION_DEFAULT;
  }

  /** Online payment done: confirm the held slot now (falls back to the queue when the website is unreachable). */
  async paidNow(ref: string, bookingId: string, payId: string): Promise<'ok' | 'slot_taken' | 'queued'> {
    try {
      const res = await this.wp.post<{ booking: any }>(`bookings/${ref}/paid`, { payId });
      const rev = Number(res.booking?._rev);
      if (Number.isFinite(rev)) {
        await this.prisma.booking.updateMany({ where: { id: bookingId, OR: [{ wpRev: null }, { wpRev: { lt: rev } }] }, data: { wpRev: rev, wpStatus: res.booking.status } });
      }
      return 'ok';
    } catch (e) {
      if (e instanceof WpError && e.status === 409) return 'slot_taken';
      await this.outbox.enqueue('action', `action:${bookingId}:paid`, { path: `bookings/${ref}/paid`, body: { payId } }, bookingId);
      return 'queued';
    }
  }

  // ── B8: points and website history ───────────────────────────────────────────

  async customer(phone: string) {
    const p = toPluginPhone(phone);
    if (!p) throw new NotFoundException('No mobile number on your account');
    try {
      return await this.wp.get<{ customer: any; points: number; ledger: any[]; bookings: any[] }>('customer', { phone: p });
    } catch (e) {
      return appErrorFrom(e);
    }
  }

  /** Move points (redeemed in the app outside a grooming booking, or a goodwill credit). Same key = once. */
  async points(phone: string, pts: number, key: string, reason: string, ref?: string) {
    try {
      return await this.wp.post<{ ok: boolean; balance: number }>('points', { phone: toPluginPhone(phone), pts, key, reason, ref: ref ?? '' });
    } catch (e) {
      return appErrorFrom(e);
    }
  }

  // ── Complaints (A1) ───────────────────────────────────────────────────────────

  async complaints(phone: string) {
    try {
      return await this.wp.get('complaints', { phone: toPluginPhone(phone) ?? '' });
    } catch (e) {
      return appErrorFrom(e);
    }
  }

  async complain(phone: string, input: { booking?: string; category?: string; text?: string; photos?: string[] }) {
    try {
      return await this.wp.post('complaints', { phone: toPluginPhone(phone), booking: input.booking ?? '', category: input.category ?? 'Other', text: input.text ?? '', photos: (input.photos ?? []).slice(0, 3) });
    } catch (e) {
      return appErrorFrom(e);
    }
  }

  // ── Walks (11A): recorded in the plugin's walk list ───────────────────────────

  async walkChanged(bookingId: string, status: 'Booked' | 'Walker assigned' | 'Completed' | 'Cancelled') {
    if (!this.wp.enabled) return;
    const b = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { customer: { include: { profile: true } }, address: true, partner: { include: { user: { include: { profile: true } } } } },
    });
    if (!b || b.type !== 'walking') return;
    const city = await this.cityFor(b.address?.city);
    const when = b.scheduledAt ? dateToIst(b.scheduledAt) : null;
    const walker = b.partner?.user?.profile ? `${b.partner.user.profile.firstName} ${b.partner.user.profile.lastName}`.trim() : '';
    await this.outbox.enqueue('walk', `walk:${b.id}:${status}`, {
      path: 'walks',
      body: {
        jobId: b.id, status, city: city?.id ?? b.address?.city ?? '', name: b.customer?.profile ? `${b.customer.profile.firstName} ${b.customer.profile.lastName}`.trim() : 'App customer',
        phone: toPluginPhone(b.customer?.phone), email: b.customer?.email ?? '', pincode: b.address?.pincode ?? '', dog: `${b.petName} (${b.petBreed})`,
        time: when?.start ?? '', start: when?.date ?? '', address: b.addressLine, planName: `${b.durationMinutes ?? ''}-minute walk`,
        price: Number(b.total), walker, payMode: b.paymentMethod === 'cash_after_service' ? 'Cash' : 'Online',
      },
    }, b.id);
  }
}
