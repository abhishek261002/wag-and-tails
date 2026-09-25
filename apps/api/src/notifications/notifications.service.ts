import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface SendOptions {
  /** Stored on the in-app notification, e.g. 'reminder.vaccination'. Defaults to 'system'. */
  type?: string;
  /** Optional categories the user can switch off; transactional messages leave this unset. */
  optional?: 'reminders' | 'tips';
}

export interface WalkRequestPayload {
  bookingId: string;
  petName: string;
  petBreed: string;
  durationMinutes: number;
  customerName: string;
  customerRating: number;
  pickupAddress: string;
  distanceKm: number;
  partnerPayout: number;
  expiresAt: string;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_TOKEN_RE = /^Expo(nent)?PushToken\[[^\]\s]+\]$/;
const BATCH = 100;

async function timedFetch(url: string, init: Record<string, unknown>): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal } as never);
  } finally {
    clearTimeout(timer);
  }
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  // ── Sending ──────────────────────────────────────────────────────────────────

  /**
   * Saves an in-app notification and pushes it to the user's devices. Delivery problems are logged and
   * never thrown: a failed push must not fail the booking, payment or job that triggered it.
   * Returns null when the user switched this optional category off.
   */
  async sendPush(userId: string, payload: PushPayload, opts: SendOptions = {}) {
    if (opts.optional) {
      const pref = await this.prisma.notificationPreference.findUnique({ where: { userId } });
      if (pref && pref[opts.optional] === false) return null;
    }

    const notification = await this.prisma.notification.create({
      data: { userId, type: opts.type ?? 'system', title: payload.title, body: payload.body, data: payload.data ?? {} },
    });

    try {
      await this.deliver(userId, { ...payload, data: { ...(payload.data ?? {}), notificationId: notification.id, type: opts.type ?? 'system' } });
    } catch (err) {
      this.logger.warn(`push delivery to ${userId} failed: ${(err as Error).message}`);
    }
    return notification;
  }

  private async deliver(userId: string, payload: PushPayload) {
    const tokens = await this.prisma.pushToken.findMany({ where: { userId } });
    if (tokens.length === 0) return;

    const provider = (process.env['PUSH_PROVIDER'] ?? 'mock').toLowerCase();
    if (provider !== 'expo') {
      this.logger.log(`[MOCK PUSH] → ${userId}: ${payload.title} — ${payload.body}`);
      return;
    }

    const valid = tokens.filter((t) => EXPO_TOKEN_RE.test(t.token));
    const stale = tokens.filter((t) => !EXPO_TOKEN_RE.test(t.token)).map((t) => t.id);
    if (stale.length) await this.prisma.pushToken.deleteMany({ where: { id: { in: stale } } });

    for (let i = 0; i < valid.length; i += BATCH) {
      const chunk = valid.slice(i, i + BATCH);
      const messages = chunk.map((t) => ({
        to: t.token,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        sound: 'default',
        channelId: 'default',
        priority: 'high',
        ttl: 60 * 60 * 24,
      }));
      const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' };
      if (process.env['EXPO_ACCESS_TOKEN']) headers['Authorization'] = `Bearer ${process.env['EXPO_ACCESS_TOKEN']}`;

      const res = await timedFetch(EXPO_PUSH_URL, { method: 'POST', headers, body: JSON.stringify(messages) });
      if (!res.ok) {
        this.logger.warn(`Expo push responded ${res.status}`);
        continue;
      }
      const json = (await res.json().catch(() => ({}))) as { data?: { status: string; message?: string; details?: { error?: string } }[] };
      const dead: string[] = [];
      json.data?.forEach((ticket, idx) => {
        if (ticket.status === 'error') {
          this.logger.warn(`push ticket error: ${ticket.details?.error ?? ticket.message}`);
          if (ticket.details?.error === 'DeviceNotRegistered') dead.push(chunk[idx]!.id);
        }
      });
      // The device uninstalled the app or revoked permission: stop pushing to that token.
      if (dead.length) await this.prisma.pushToken.deleteMany({ where: { id: { in: dead } } });
    }
  }

  async sendWalkRequest(partnerId: string, payload: WalkRequestPayload) {
    await this.sendPush(
      partnerId,
      {
        title: `Walk Request 🐕 ${payload.petName}`,
        body: `${payload.durationMinutes} min walk · ${payload.distanceKm.toFixed(1)}km away · ₹${payload.partnerPayout}`,
        data: { type: 'walk:request', bookingId: payload.bookingId, expiresAt: payload.expiresAt, pickupAddress: payload.pickupAddress },
      },
      { type: 'booking.walk_request' }
    );
  }

  // ── Devices ──────────────────────────────────────────────────────────────────

  async registerToken(userId: string, token: string, platform: string) {
    if (!EXPO_TOKEN_RE.test(token)) throw new BadRequestException('Invalid push token');
    if (!['ios', 'android', 'web'].includes(platform)) throw new BadRequestException('Invalid platform');
    // A device that signs in as someone else moves its token to the new account, so the previous user
    // stops receiving this device's notifications.
    await this.prisma.pushToken.upsert({
      where: { token },
      update: { userId, platform },
      create: { userId, token, platform },
    });
  }

  async removeToken(userId: string, token: string) {
    await this.prisma.pushToken.deleteMany({ where: { userId, token } });
  }

  // ── Inbox ────────────────────────────────────────────────────────────────────

  async getUserNotifications(userId: string, opts: { limit?: number; before?: string } = {}) {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const before = opts.before ? new Date(opts.before) : null;
    return this.prisma.notification.findMany({
      where: { userId, ...(before && !Number.isNaN(before.getTime()) ? { createdAt: { lt: before } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async unreadCount(userId: string) {
    return { count: await this.prisma.notification.count({ where: { userId, isRead: false } }) };
  }

  async markRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({ where: { id: notificationId, userId }, data: { isRead: true } });
  }

  async markAllRead(userId: string) {
    const r = await this.prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
    return { updated: r.count };
  }

  // ── Preferences ──────────────────────────────────────────────────────────────

  async getPreferences(userId: string) {
    const p = await this.prisma.notificationPreference.findUnique({ where: { userId } });
    return { reminders: p?.reminders ?? true, tips: p?.tips ?? true };
  }

  async updatePreferences(userId: string, patch: { reminders?: unknown; tips?: unknown }) {
    const data: { reminders?: boolean; tips?: boolean } = {};
    for (const k of ['reminders', 'tips'] as const) {
      if (patch[k] === undefined) continue;
      if (typeof patch[k] !== 'boolean') throw new BadRequestException(`${k} must be true or false`);
      data[k] = patch[k] as boolean;
    }
    await this.prisma.notificationPreference.upsert({ where: { userId }, update: data, create: { userId, ...data } });
    return this.getPreferences(userId);
  }
}
