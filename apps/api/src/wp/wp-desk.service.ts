import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service.js';
import { WpJobsService } from './wp-jobs.service.js';
import { isOverLimit, limitFor, loadDues, loadSettings } from '../commission/queries.js';

// What the staff desk (inside the WordPress panel) asks the backend for: partners who can take a booking,
// assigning or changing the partner (decisions 1A, 13A; flows 5.2), and the live map of today's jobs (5.6).

const ACTIVE = ['assigned', 'accepted', 'partner_on_the_way', 'arrived', 'in_progress'] as const;

function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(x)) * 10) / 10;
}

@Injectable()
export class WpDeskService {
  constructor(private prisma: PrismaService, private jobs: WpJobsService, private moduleRef: ModuleRef) {}

  private async bookingByRef(ref: string) {
    const b = await this.prisma.booking.findUnique({ where: { wpRef: ref }, include: { address: true } });
    if (!b) throw new NotFoundException('This booking has no app job yet. It appears within a minute of being confirmed.');
    return b;
  }

  /** Partners who could take this booking, best first: free at that time, online, closer, better rated. */
  async candidates(ref: string) {
    const b = await this.bookingByRef(ref);
    const city = b.address?.city ?? '';
    const partners = await this.prisma.partnerProfile.findMany({
      where: { status: 'approved', modes: { has: b.type }, petSpecies: { has: b.petSpecies }, city: { equals: city, mode: 'insensitive' } },
      include: { user: { include: { profile: true } } },
    });
    const ids = partners.map((p) => p.userId);
    const [settings, dues] = await Promise.all([loadSettings(this.prisma), loadDues(this.prisma, ids)]);
    const at = b.scheduledAt?.getTime() ?? Date.now();
    const clashes = ids.length
      ? await this.prisma.booking.findMany({
          where: { partnerId: { in: ids }, id: { not: b.id }, status: { in: [...ACTIVE] }, scheduledAt: { gte: new Date(at - 2 * 3600_000), lte: new Date(at + 2 * 3600_000) } },
          select: { partnerId: true, scheduledAt: true, wpRef: true },
        })
      : [];
    const list = partners.map((p) => {
      const busy = clashes.filter((c) => c.partnerId === p.userId);
      const blocked = p.employmentType !== 'team' && isOverLimit(dues.get(p.userId) ?? 0, limitFor(p.commissionLimitOverride, settings));
      return {
        id: p.userId,
        name: p.user?.profile ? `${p.user.profile.firstName} ${p.user.profile.lastName}`.trim() : 'Partner',
        phone: (p.user?.phone ?? '').replace(/^\+91/, ''),
        type: p.employmentType ?? '',
        online: p.isOnline,
        rating: Number(p.rating ?? 0),
        jobs: p.completedJobs,
        releases: p.releaseCount,
        distanceKm: b.address && p.currentLat != null && p.currentLng != null && b.address.lat !== 0 ? km(p.currentLat, p.currentLng, b.address.lat, b.address.lng) : null,
        busyWith: busy.map((c) => c.wpRef ?? 'app job'),
        blocked,
        current: b.partnerId === p.userId,
      };
    });
    list.sort((x, y) =>
      Number(x.blocked) - Number(y.blocked) || x.busyWith.length - y.busyWith.length || Number(y.online) - Number(x.online) ||
      (x.distanceKm ?? 999) - (y.distanceKm ?? 999) || y.rating - x.rating
    );
    return { ref, city, status: b.status, partnerId: b.partnerId, partners: list };
  }

  /** Assign (or change) the partner from the desk. The old partner is told; the new one gets "Job assigned to you". */
  async assign(ref: string, partnerId: string, by: string) {
    const b = await this.bookingByRef(ref);
    if (!['needs_partner', 'confirmed', 'assigned', 'accepted'].includes(b.status)) {
      throw new ConflictException(`A partner cannot be changed now (the job is ${b.status.replace(/_/g, ' ')}).`);
    }
    if (b.partnerId === partnerId) return { ok: true, unchanged: true };
    const p = await this.prisma.partnerProfile.findUnique({ where: { userId: partnerId } });
    if (!p || p.status !== 'approved') throw new BadRequestException('This partner is not approved');
    if (!p.modes.includes(b.type) || !(p.petSpecies as string[]).includes(b.petSpecies)) throw new BadRequestException(`This partner does not take ${b.petSpecies} ${b.type} jobs`);

    if (b.partnerId) {
      await this.jobs.unassign(b.id, b.partnerId, null, `changed by the desk (${by})`, b.customerId);
    }
    const startOtp = String(Math.floor(1000 + Math.random() * 9000));
    const res = await this.prisma.booking.updateMany({
      where: { id: b.id, partnerId: null, status: { in: ['needs_partner', 'confirmed'] } },
      data: {
        partnerId, status: 'assigned', startOtp, assignmentMode: 'any', requestedPartnerId: null, requestExpiresAt: null, requestOutcome: null,
        staffFlag: null, staffFlagNote: null, staffFlagAt: null, reconfirmBy: null, lateFlaggedAt: null,
      },
    });
    if (!res.count) throw new ConflictException('Someone took this job a moment ago. Refresh and try again.');
    await this.prisma.bookingStatusHistory.create({ data: { bookingId: b.id, status: 'assigned', changedBy: b.customerId, note: `Assigned by the desk (${by})` } });
    try {
      const { CommissionService } = await import('../commission/commission.service.js');
      await this.moduleRef.get(CommissionService, { strict: false }).applyClaimPricing(b.id, partnerId);
      const { MessagingService } = await import('../messaging/messaging.service.js');
      await this.moduleRef.get(MessagingService, { strict: false }).getOrCreateConversation(b.id, partnerId);
    } catch {
      /* pricing and chat are retried on the next change; the assignment stands */
    }
    await this.jobs.tellPartner(partnerId, b.id, 'job:assigned', 'Job assigned to you',
      `The desk gave you ${b.petName}'s grooming${b.scheduledAt ? ' on ' + b.scheduledAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : ''}. Open the app to see it.`);
    await this.jobs.jobChanged(b.id, { transition: true });
    return { ok: true };
  }

  /** Take the partner off a booking from the desk; it is offered to everyone again. */
  async unassign(ref: string, by: string) {
    const b = await this.bookingByRef(ref);
    if (!b.partnerId) return { ok: true, unchanged: true };
    const ok = await this.jobs.unassign(b.id, b.partnerId, null, `removed by the desk (${by})`, b.customerId);
    if (!ok) throw new ConflictException('The partner can no longer be removed (the job has started).');
    return { ok: true };
  }

  /** Today's live jobs and where the partners are (desk map). Optional city filter (plugin city id). */
  async live(cityId?: string) {
    const start = new Date(Date.now() - 12 * 3600_000);
    const end = new Date(Date.now() + 18 * 3600_000);
    const jobs = await this.prisma.booking.findMany({
      where: {
        status: { in: [...ACTIVE, 'needs_partner'] },
        scheduledAt: { gte: start, lte: end },
        ...(cityId ? { wpCityId: cityId } : {}),
      },
      include: { address: true, partner: { include: { user: { include: { profile: true } } } } },
      orderBy: { scheduledAt: 'asc' },
      take: 300,
    });
    return {
      at: new Date().toISOString(),
      jobs: jobs.map((j) => ({
        ref: j.wpRef, id: j.id, type: j.type, status: j.status, flag: j.staffFlag, scheduledAt: j.scheduledAt, pet: `${j.petName} (${j.petBreed})`,
        address: j.addressLine, lat: j.address?.lat ?? null, lng: j.address?.lng ?? null, city: j.address?.city ?? null,
        partner: j.partner
          ? {
              name: j.partner.user?.profile ? `${j.partner.user.profile.firstName} ${j.partner.user.profile.lastName}`.trim() : 'Partner',
              phone: (j.partner.user?.phone ?? '').replace(/^\+91/, ''),
              lat: j.partner.currentLat, lng: j.partner.currentLng, seenAt: j.partner.lastSeenAt ?? null,
            }
          : null,
      })),
    };
  }
}
