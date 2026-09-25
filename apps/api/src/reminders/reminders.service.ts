import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { tipFor } from './care-tips.js';

const DAY = 86_400_000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const isoDateIst = (d: Date) => new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
const daysBetween = (fromIso: string, toIso: string) => Math.round((Date.parse(toIso) - Date.parse(fromIso)) / DAY);
const month = (iso: string) => iso.slice(0, 7);

// Days since the last completed groom after which we suggest another. Cats shed less and are groomed less often.
const GROOM_AFTER_DAYS = { dog: 42, cat: 56 } as const;
const GROOM_REMIND_UNTIL_DAYS = 180;
const OVERDUE_REMIND_MONTHS_MAX = 3;
const WEEK_MS = 7 * DAY;

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private realtime: RealtimeGateway,
    private moduleRef: ModuleRef
  ) {}

  private enabled() {
    return (process.env['SCHEDULER_ENABLED'] ?? 'true') !== 'false';
  }

  // ── Schedules ────────────────────────────────────────────────────────────────

  @Cron('0 9 * * *', { timeZone: 'Asia/Kolkata' })
  async dailyCron() {
    if (!this.enabled()) return;
    try {
      this.logger.log(`daily run: ${JSON.stringify(await this.runDaily())}`);
    } catch (err) {
      this.logger.error(`daily run failed: ${(err as Error).message}`);
    }
  }

  @Cron('*/5 * * * *')
  async frequentCron() {
    if (!this.enabled()) return;
    try {
      const r = await this.runFrequent();
      if (Object.values(r).some((n) => n > 0)) this.logger.log(`frequent run: ${JSON.stringify(r)}`);
    } catch (err) {
      this.logger.error(`frequent run failed: ${(err as Error).message}`);
    }
  }

  // ── Dedupe: the unique key is claimed first, so overlapping or repeated runs send each reminder once ──

  private async claim(dedupeKey: string, kind: string, userId: string): Promise<boolean> {
    try {
      await this.prisma.reminderLog.create({ data: { dedupeKey, kind, userId } });
      return true;
    } catch (err) {
      if ((err as any)?.code === 'P2002') return false;
      throw err;
    }
  }

  // ── Daily: pet-health reminders, care tips, housekeeping ─────────────────────

  async runDaily(now = new Date()) {
    const today = isoDateIst(now);
    const [vaccination, unvaccinated, grooming, tips, cleaned] = [
      await this.vaccinationReminders(today),
      await this.unvaccinatedNudges(today),
      await this.groomingReminders(now, today),
      await this.careTips(now, today),
      await this.housekeeping(now),
    ];
    return { vaccination, unvaccinated, grooming, tips, cleaned };
  }

  private async vaccinationReminders(today: string): Promise<number> {
    const upper = new Date(Date.parse(today) + 30 * DAY);
    const lower = new Date(Date.parse(today) - 120 * DAY);
    const candidates = await this.prisma.petVaccination.findMany({
      where: { expiryDate: { gte: lower, lte: upper } },
      select: { id: true, petId: true },
    });
    if (!candidates.length) return 0;
    const candidateIds = new Set(candidates.map((c) => c.id));
    const petIds = [...new Set(candidates.map((c) => c.petId))];

    let sent = 0;
    for (let i = 0; i < petIds.length; i += 500) {
      const pets = await this.prisma.pet.findMany({
        where: { id: { in: petIds.slice(i, i + 500) } },
        select: { id: true, name: true, customerId: true, vaccinations: { where: { expiryDate: { not: null } }, orderBy: { administeredDate: 'desc' } } },
      });
      for (const pet of pets) {
        // Only the most recent shot of each vaccine counts: an old record that was re-done is not "due".
        const latest = new Map<string, (typeof pet.vaccinations)[number]>();
        for (const v of pet.vaccinations) {
          const key = v.vaccineName.trim().toLowerCase();
          if (!latest.has(key)) latest.set(key, v);
        }
        for (const v of latest.values()) {
          if (!candidateIds.has(v.id) || !v.expiryDate) continue;
          const daysLeft = daysBetween(today, v.expiryDate.toISOString().slice(0, 10));
          const stage = this.vaccineStage(daysLeft, today, v.id);
          if (!stage) continue;
          const on = v.expiryDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
          const text =
            stage.kind === '30d' ? `${pet.name}'s ${v.vaccineName} vaccine is due on ${on} (${daysLeft} days). A good time to book a vet visit.`
            : stage.kind === '7d' ? `${pet.name}'s ${v.vaccineName} vaccine is due in ${daysLeft} day${daysLeft === 1 ? '' : 's'} (${on}).`
            : stage.kind === 'due' ? `${pet.name}'s ${v.vaccineName} vaccine is due ${daysLeft === 0 ? 'today' : 'now'}. Please see your vet.`
            : `${pet.name}'s ${v.vaccineName} vaccine expired on ${on}. Protection may have lapsed, so please see your vet.`;
          if (!(await this.claim(stage.key, 'vaccination', pet.customerId))) continue;
          const n = await this.notifications.sendPush(
            pet.customerId,
            { title: stage.kind === 'overdue' ? `Vaccine overdue for ${pet.name}` : `Vaccine reminder for ${pet.name}`, body: text, data: { type: 'reminder.vaccination', petId: pet.id, vaccinationId: v.id } },
            { type: 'reminder.vaccination', optional: 'reminders' }
          );
          if (n) sent++;
        }
      }
    }
    return sent;
  }

  // Highest applicable stage only, so a reminder that was missed never triggers a burst of older ones.
  private vaccineStage(daysLeft: number, today: string, id: string): { kind: '30d' | '7d' | 'due' | 'overdue'; key: string } | null {
    if (daysLeft > 30) return null;
    if (daysLeft > 7) return { kind: '30d', key: `vax:${id}:30d` };
    if (daysLeft > 0) return { kind: '7d', key: `vax:${id}:7d` };
    if (daysLeft > -7) return { kind: 'due', key: `vax:${id}:due` };
    // Overdue: a monthly nudge for a few months, then leave it alone.
    if (daysLeft < -30 * OVERDUE_REMIND_MONTHS_MAX) return null;
    return { kind: 'overdue', key: `vax:${id}:overdue:${month(today)}` };
  }

  private async unvaccinatedNudges(today: string): Promise<number> {
    const pets = await this.prisma.pet.findMany({
      where: { vaccinationStatus: { in: ['not_vaccinated_yet', 'unknown'] } },
      select: { id: true, name: true, customerId: true, vaccinationStatus: true },
      take: 5000,
    });
    let sent = 0;
    for (const pet of pets) {
      // At most three nudges per pet in total, one a month.
      const kind = `vaccination_${pet.vaccinationStatus}`;
      const already = await this.prisma.reminderLog.count({ where: { userId: pet.customerId, kind, dedupeKey: { startsWith: `vaxnone:${pet.id}:` } } });
      if (already >= 3) continue;
      if (!(await this.claim(`vaxnone:${pet.id}:${month(today)}`, kind, pet.customerId))) continue;
      const n = await this.notifications.sendPush(
        pet.customerId,
        {
          title: `${pet.name}'s vaccinations`,
          body: pet.vaccinationStatus === 'not_vaccinated_yet'
            ? `${pet.name} has not been vaccinated yet. Talk to your vet about a schedule, and add the date here once it is done.`
            : `Add ${pet.name}'s last vaccination date so we can remind you before the next one is due.`,
          data: { type: 'reminder.vaccination', petId: pet.id },
        },
        { type: 'reminder.vaccination', optional: 'reminders' }
      );
      if (n) sent++;
    }
    return sent;
  }

  private async groomingReminders(now: Date, today: string): Promise<number> {
    // The latest completed grooming per pet.
    const last = await this.prisma.booking.groupBy({
      by: ['petId'],
      where: { type: 'grooming', status: 'completed', completedAt: { not: null } },
      _max: { completedAt: true },
    });
    if (!last.length) return 0;
    let sent = 0;
    for (let i = 0; i < last.length; i += 500) {
      const chunk = last.slice(i, i + 500);
      const pets = await this.prisma.pet.findMany({
        where: { id: { in: chunk.map((c) => c.petId) } },
        select: { id: true, name: true, species: true, customerId: true },
      });
      const busy = new Set(
        (await this.prisma.booking.findMany({
          where: { type: 'grooming', petId: { in: pets.map((p) => p.id) }, status: { in: ['pending_payment', 'confirmed', 'needs_partner', 'assigned', 'partner_on_the_way', 'arrived', 'in_progress'] } },
          select: { petId: true },
        })).map((b) => b.petId)
      );
      for (const pet of pets) {
        const at = chunk.find((c) => c.petId === pet.id)?._max.completedAt;
        if (!at || busy.has(pet.id)) continue;
        const days = Math.floor((now.getTime() - at.getTime()) / DAY);
        if (days < GROOM_AFTER_DAYS[pet.species] || days > GROOM_REMIND_UNTIL_DAYS) continue;
        if (!(await this.claim(`groom:${pet.id}:${month(today)}`, 'grooming', pet.customerId))) continue;
        const weeks = Math.round(days / 7);
        const n = await this.notifications.sendPush(
          pet.customerId,
          { title: `Time for ${pet.name}'s groom?`, body: `It has been about ${weeks} weeks since ${pet.name}'s last grooming. Book a session at home.`, data: { type: 'reminder.grooming', petId: pet.id } },
          { type: 'reminder.grooming', optional: 'reminders' }
        );
        if (n) sent++;
      }
    }
    return sent;
  }

  private async careTips(now: Date, today: string): Promise<number> {
    const week = Math.floor(now.getTime() / WEEK_MS);
    // One tip per customer per week, about their first pet.
    const pets = await this.prisma.pet.findMany({ orderBy: { createdAt: 'asc' }, distinct: ['customerId'], select: { id: true, species: true, customerId: true }, take: 20000 });
    let sent = 0;
    for (const pet of pets) {
      if (!(await this.claim(`tip:${pet.customerId}:${week}`, 'tip', pet.customerId))) continue;
      const salt = pet.id.charCodeAt(0) + pet.id.charCodeAt(1);
      const n = await this.notifications.sendPush(
        pet.customerId,
        { title: 'Pet care tip', body: tipFor(pet.species, week, salt), data: { type: 'tip.care', petId: pet.id } },
        { type: 'tip.care', optional: 'tips' }
      );
      if (n) sent++;
    }
    return sent;
  }

  private async housekeeping(now: Date): Promise<number> {
    let n = 0;
    n += (await this.prisma.notification.deleteMany({ where: { isRead: true, createdAt: { lt: new Date(now.getTime() - 90 * DAY) } } })).count;
    n += (await this.prisma.notification.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 365 * DAY) } } })).count;
    n += (await this.prisma.reminderLog.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 400 * DAY) } } })).count;
    try {
      const { KycService } = await import('../kyc/kyc.service.js');
      n += await this.moduleRef.get(KycService, { strict: false }).purgeStale();
      const { CommissionService } = await import('../commission/commission.service.js');
      await this.moduleRef.get(CommissionService, { strict: false }).reconcile();
    } catch (err) {
      this.logger.warn(`housekeeping step failed: ${(err as Error).message}`);
    }
    return n;
  }

  // ── Every few minutes: things that are time-critical ─────────────────────────

  async runFrequent(now = new Date()) {
    return {
      bookingReminders: await this.bookingReminders(now),
      directRequestsExpired: await this.expireDirectRequests(now),
      walksAnnounced: await this.announceScheduledWalks(now),
    };
  }

  // Customer and partner both hear about it when a booked visit is about to start.
  private async bookingReminders(now: Date): Promise<number> {
    const soon = await this.prisma.booking.findMany({
      where: {
        status: { in: ['assigned', 'accepted'] },
        partnerId: { not: null },
        scheduledAt: { gt: now, lte: new Date(now.getTime() + 65 * 60_000) },
      },
      select: { id: true, type: true, petName: true, scheduledAt: true, customerId: true, partnerId: true, addressLine: true },
    });
    let sent = 0;
    for (const b of soon) {
      const mins = Math.max(1, Math.round((b.scheduledAt!.getTime() - now.getTime()) / 60_000));
      const when = mins >= 55 ? 'in about an hour' : `in ${mins} minutes`;
      const what = b.type === 'grooming' ? 'grooming' : 'walk';
      if (await this.claim(`booking:${b.id}:soon:c`, 'booking_soon', b.customerId)) {
        await this.notifications.sendPush(b.customerId, { title: `${b.petName}'s ${what} is ${when}`, body: 'Your partner is on the schedule. Keep your phone handy and have the start code ready.', data: { type: 'booking.soon', bookingId: b.id, bookingType: b.type } }, { type: 'booking.soon' });
        sent++;
      }
      if (b.partnerId && (await this.claim(`booking:${b.id}:soon:p`, 'booking_soon', b.partnerId))) {
        await this.notifications.sendPush(b.partnerId, { title: `${what[0]!.toUpperCase()}${what.slice(1)} for ${b.petName} ${when}`, body: b.addressLine, data: { type: 'booking.soon', bookingId: b.id, bookingType: b.type } }, { type: 'booking.soon' });
        sent++;
      }
    }
    return sent;
  }

  // A chosen partner who did not answer in time: tell the customer so they can choose again.
  private async expireDirectRequests(now: Date): Promise<number> {
    const due = await this.prisma.booking.findMany({
      where: { assignmentMode: 'specific', requestOutcome: null, partnerId: null, requestExpiresAt: { lt: now }, status: { in: ['needs_partner', 'searching_partner'] } },
      select: { id: true, customerId: true, petName: true },
      take: 200,
    });
    let done = 0;
    for (const b of due) {
      const r = await this.prisma.booking.updateMany({ where: { id: b.id, requestOutcome: null, partnerId: null }, data: { requestOutcome: 'expired' } });
      if (r.count === 0) continue;
      done++;
      await this.notifications.sendPush(
        b.customerId,
        { title: 'No response yet', body: `Your chosen partner didn't answer in time for ${b.petName}'s booking. Pick another partner or let anyone accept.`, data: { type: 'booking.partner_no_response', bookingId: b.id } },
        { type: 'booking.dispatch' }
      );
      this.realtime.emitToBooking(b.id, 'booking:dispatch_changed', { bookingId: b.id, state: 'expired' });
    }
    return done;
  }

  // Walks booked for later have no search step of their own; start it when the time gets close.
  private async announceScheduledWalks(now: Date): Promise<number> {
    const walks = await this.prisma.booking.findMany({
      where: { type: 'walking', status: 'confirmed', partnerId: null, scheduledAt: { gte: new Date(now.getTime() - 30 * 60_000), lte: new Date(now.getTime() + 30 * 60_000) } },
      select: { id: true, customerId: true },
      take: 100,
    });
    let n = 0;
    for (const w of walks) {
      const r = await this.prisma.booking.updateMany({ where: { id: w.id, status: 'confirmed', partnerId: null }, data: { status: 'searching_partner' } });
      if (r.count === 0) continue;
      await this.prisma.bookingStatusHistory.create({ data: { bookingId: w.id, status: 'searching_partner', changedBy: w.customerId, note: 'Scheduled walk: finding a walker' } });
      try {
        const { WalkingService } = await import('../walking/walking.service.js');
        await this.moduleRef.get(WalkingService, { strict: false }).searchNearbyPartners(w.id);
        n++;
      } catch (err) {
        this.logger.error(`could not announce walk ${w.id}: ${(err as Error).message}`);
      }
    }
    return n;
  }
}
