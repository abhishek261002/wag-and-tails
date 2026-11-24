import { BadRequestException, Body, Controller, Get, NotFoundException, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../common/decorators.js';
import { RolesGuard } from '../common/roles.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { WpBookingsService } from './wp-bookings.service.js';
import { WpConfigSyncService } from './wp-config-sync.service.js';
import { selfServiceCutoffHours } from '../bookings/bookings.service.js';

// Customer app (A1, B8): booking setup from the website, a price quote, points, website booking history, complaints.

@ApiTags('website')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller()
export class WpCustomerController {
  constructor(private prisma: PrismaService, private wp: WpBookingsService, private sync: WpConfigSyncService) {}

  private async phone(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
    if (!u?.phone) throw new NotFoundException('No mobile number on your account');
    return u.phone;
  }

  /** What the booking screens need from the website: cities, walking switch, points rules, cut-off. */
  @Get('config/booking')
  @Roles('customer', 'partner', 'staff', 'admin')
  async bookingConfig() {
    if (!this.wp.enabled) return { connected: false };
    const [cities, rewards, cfg] = await Promise.all([
      this.sync.cities(),
      this.sync.rewards(),
      this.prisma.wpSyncState.findUnique({ where: { key: 'config' } }),
    ]);
    const v = (cfg?.value ?? {}) as any;
    return {
      connected: true,
      cities: cities.filter((c) => c.service).map((c) => ({ id: c.id, name: c.name, walking: c.walking })),
      rewards,
      aggression: v.aggression ?? [],
      maxDaysAhead: Number(v.settings?.maxDaysAhead ?? 10),
      selfServiceCutoffHours: selfServiceCutoffHours(),
    };
  }

  /** The website's price for a grooming booking (city price, coupon, points), before booking. */
  @Post('grooming/quote')
  @Roles('customer')
  async quote(@CurrentUser() user: { sub: string }, @Body() body: { packageId?: string; addressId?: string; cityId?: string; couponCode?: string; usePoints?: boolean; addOnIds?: string[]; petId?: string }) {
    if (!this.wp.enabled) throw new BadRequestException('Quotes come from the website, which is not connected');
    const pkg = body?.packageId ? await this.prisma.groomingPackage.findUnique({ where: { id: body.packageId } }) : null;
    if (!pkg?.wpId) throw new NotFoundException('Package not found');
    const addr = body.addressId ? await this.prisma.address.findFirst({ where: { id: body.addressId, userId: user.sub } }) : null;
    const city = await this.wp.requireCity(addr?.city, body.cityId);
    const pet = body.petId ? await this.prisma.pet.findFirst({ where: { id: body.petId, customerId: user.sub } }) : null;
    const addOns = body.addOnIds?.length ? await this.prisma.addOn.findMany({ where: { id: { in: body.addOnIds }, isActive: true } }) : [];
    const q = await this.wp.quote({
      cityId: city.id, pkgWpId: pkg.wpId, petType: pet?.species === 'cat' ? 'Cat' : 'Dog', coupon: body.couponCode, usePts: !!body.usePoints,
      phone: await this.phone(user.sub), extras: addOns.map((a) => ({ name: a.name, price: Number(a.price) })),
    });
    return { ...q, cityId: city.id, cityName: city.name };
  }

  /** Points balance, history and the rules (B8, decision 10A). */
  @Get('me/rewards')
  @Roles('customer')
  async rewards(@CurrentUser() user: { sub: string }) {
    if (!this.wp.enabled) return { connected: false, points: 0, ledger: [] };
    const c = await this.wp.customer(await this.phone(user.sub));
    return { connected: true, points: c.points ?? 0, ledger: c.ledger ?? [], rules: await this.sync.rewards() };
  }

  /** Bookings made on the website or by phone with the same number (app bookings are in the normal list). */
  @Get('me/website-bookings')
  @Roles('customer')
  async websiteBookings(@CurrentUser() user: { sub: string }) {
    if (!this.wp.enabled) return { connected: false, bookings: [] };
    const c = await this.wp.customer(await this.phone(user.sub));
    const pkgs = await this.prisma.groomingPackage.findMany({ where: { wpId: { not: null } }, select: { wpId: true, name: true } });
    const name = new Map(pkgs.map((p) => [p.wpId!, p.name]));
    const linked = await this.prisma.booking.findMany({ where: { wpRef: { in: (c.bookings ?? []).map((b: any) => b.id) } }, select: { id: true, wpRef: true } });
    const jobOf = new Map(linked.map((l) => [l.wpRef!, l.id]));
    return {
      connected: true,
      bookings: (c.bookings ?? [])
        .filter((b: any) => b.source !== 'App' && b.status !== 'Pending payment')
        .map((b: any) => ({
          ref: b.id, status: b.status, date: b.date, slot: b.slot, package: b.pkgName || name.get(b.pkg) || 'Grooming',
          pet: [b.petName, b.breed].filter(Boolean).join(' · '), total: Number(b.total ?? 0), payMode: b.payMode || null,
          source: b.source || 'Website', groomer: b.job?.partner?.name ?? null, bookingId: jobOf.get(b.id) ?? null,
        })),
    };
  }

  @Get('me/complaints')
  @Roles('customer')
  async complaints(@CurrentUser() user: { sub: string }) {
    if (!this.wp.enabled) return { connected: false, complaints: [], bookings: [], cats: [] };
    return { connected: true, ...(await this.wp.complaints(await this.phone(user.sub)) as object) };
  }

  @Post('me/complaints')
  @Roles('customer')
  async complain(@CurrentUser() user: { sub: string }, @Body() body: { booking?: string; category?: string; text?: string; photos?: string[] }) {
    if (!this.wp.enabled) throw new BadRequestException('Complaints go to the website, which is not connected');
    // Photos uploaded to us are stored as /uploads/…; the website needs full links.
    const base = (process.env['PUBLIC_API_URL'] ?? process.env['API_URL'] ?? '').replace(/\/+$/, '');
    const photos = (body?.photos ?? [])
      .filter((u): u is string => typeof u === 'string')
      .map((u) => (/^\/uploads\/[\w.\-]+$/.test(u) && base ? base + u : u))
      .filter((u) => /^https?:\/\/\S+$/.test(u))
      .slice(0, 3);
    return this.wp.complain(await this.phone(user.sub), { ...body, photos });
  }
}
