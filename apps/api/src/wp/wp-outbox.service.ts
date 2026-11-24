import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { WpClientService, WpError } from './wp-client.service.js';

// Every write to the WordPress plugin goes through this queue (ground rule 7: if one side is down, the other keeps
// working). Rows are sent in order per booking, retried with backoff, and marked failed after MAX_ATTEMPTS so the
// admin sees them in /admin/wp/status. Writes are idempotent on the plugin side (job state, xref'd creates,
// keyed points), so a retry after a lost answer is safe.

const MAX_ATTEMPTS = 12;
const TICK_MS = 4_000;

export interface OutboxPayload { method?: 'POST'; path: string; body: Record<string, unknown> }

@Injectable()
export class WpOutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WpOutboxService.name);
  private timer: NodeJS.Timeout | null = null;
  private busy = false;

  constructor(private prisma: PrismaService, private wp: WpClientService, private moduleRef: ModuleRef) {}

  onModuleInit() {
    if (!this.wp.enabled || (process.env['SCHEDULER_ENABLED'] ?? 'true') === 'false') return;
    this.timer = setInterval(() => void this.drain(), TICK_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Queue a write. The same dedupeKey replaces a pending row (only the newest matters) and re-opens a finished one
   * (the same step happened again, e.g. a job offered again after a release).
   */
  async enqueue(kind: string, dedupeKey: string, payload: OutboxPayload, bookingId?: string | null): Promise<void> {
    if (!this.wp.enabled) return;
    const data = {
      kind, bookingId: bookingId ?? null, payload: payload as unknown as Prisma.InputJsonValue,
      attempts: 0, nextAttemptAt: new Date(), lastError: null, doneAt: null, failedAt: null, createdAt: new Date(),
    };
    await this.prisma.wpOutbox.upsert({ where: { dedupeKey }, create: { dedupeKey, ...data }, update: data });
    // Send right away instead of waiting for the next tick.
    setImmediate(() => void this.drain());
  }

  /** Sends due rows. Safe to call often: one drain at a time per process, and rows are leased before sending. */
  async drain(): Promise<number> {
    if (this.busy || !this.wp.enabled) return 0;
    this.busy = true;
    let sent = 0;
    try {
      for (let round = 0; round < 10; round++) {
        const due = await this.prisma.wpOutbox.findMany({
          where: { doneAt: null, failedAt: null },
          orderBy: { createdAt: 'asc' },
          take: 50,
        });
        if (due.length === 0) break;
        const now = Date.now();
        const blocked = new Set<string>(); // a booking whose earlier write is still waiting: keep its order
        let progressed = false;
        for (const row of due) {
          const key = row.bookingId ?? row.id;
          if (blocked.has(key)) continue;
          if (row.nextAttemptAt.getTime() > now) { blocked.add(key); continue; }
          // Lease the row so a second API instance does not send it at the same time.
          const lease = await this.prisma.wpOutbox.updateMany({
            where: { id: row.id, doneAt: null, failedAt: null, nextAttemptAt: row.nextAttemptAt },
            data: { nextAttemptAt: new Date(now + 90_000) },
          });
          if (lease.count === 0) { blocked.add(key); continue; }
          const ok = await this.send(row.id, row.attempts, row.payload as unknown as OutboxPayload, row.bookingId);
          progressed = true;
          if (ok) sent++;
          else blocked.add(key);
        }
        if (!progressed) break;
      }
    } catch (e) {
      this.logger.error(`Outbox drain failed: ${(e as Error).message}`);
    } finally {
      this.busy = false;
    }
    return sent;
  }

  private async send(id: string, attempts: number, p: OutboxPayload, bookingId: string | null): Promise<boolean> {
    // What this send is carrying. While it is on its way (a slow website can take many seconds) a newer change for the
    // same step may replace the row (see enqueue). The finished send then must not mark the row done, or the newer
    // change would be thrown away unsent: it is only marked done if the row still holds exactly this payload.
    const sent = p as unknown as Prisma.InputJsonValue;
    try {
      const res: any = await this.wp.post(p.path, p.body);
      await this.prisma.wpOutbox.updateMany({ where: { id, payload: { equals: sent } }, data: { doneAt: new Date(), attempts: attempts + 1, lastError: null } });
      // The answer is the booking as it now stands on the website, including any desk change made while this write
      // waited. Reconcile it in full (not just its revision), so a desk change is never skipped as "already seen";
      // the echo message of this write then carries no newer revision and is ignored.
      if (res?.booking?.id) await this.afterWrite(res.booking);
      return true;
    } catch (e) {
      const err = e as WpError;
      const status = err.status ?? 0;
      const permanent = status >= 400 && status < 500 && status !== 409 && status !== 429 && status !== 401;
      const next = attempts + 1;
      const failed = permanent || next >= MAX_ATTEMPTS;
      const backoff = Math.min(3600, 10 * 2 ** Math.min(next, 9)) * 1000;
      await this.prisma.wpOutbox.updateMany({
        where: { id, payload: { equals: sent } }, // a replaced row keeps its fresh state and goes out as it is
        data: {
          attempts: next,
          lastError: `${status || 'network'}: ${err.message}`.slice(0, 500),
          nextAttemptAt: new Date(Date.now() + (status === 409 ? 2_000 : backoff)),
          failedAt: failed ? new Date() : null,
        },
      });
      if (failed) this.logger.error(`Website write failed for good (${p.path}): ${err.message}`);
      return false;
    }
  }

  private async afterWrite(booking: Record<string, unknown>) {
    try {
      const { WpIngestService } = await import('./wp-ingest.service.js');
      await this.moduleRef.get(WpIngestService, { strict: false }).reconcile(booking as any);
    } catch (e) {
      this.logger.warn(`Could not apply the website's answer for ${String(booking['id'])}: ${(e as Error).message}`);
    }
  }

  async summary() {
    const [pending, failed] = await Promise.all([
      this.prisma.wpOutbox.count({ where: { doneAt: null, failedAt: null } }),
      this.prisma.wpOutbox.findMany({ where: { failedAt: { not: null }, doneAt: null }, orderBy: { failedAt: 'desc' }, take: 20, select: { id: true, kind: true, bookingId: true, lastError: true, failedAt: true, payload: true } }),
    ]);
    return { pending, failed };
  }

  /** Admin: send a failed write again. */
  async retry(id: string) {
    await this.prisma.wpOutbox.update({ where: { id }, data: { failedAt: null, attempts: 0, nextAttemptAt: new Date() } });
    await this.drain();
    return this.prisma.wpOutbox.findUnique({ where: { id } });
  }
}
