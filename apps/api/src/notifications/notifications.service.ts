import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
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

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  async sendPush(userId: string, payload: PushPayload) {
    // Save in-app notification record
    await this.prisma.notification.create({
      data: {
        userId,
        type: 'system',
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
      },
    });

    // Get user's push tokens
    const tokens = await this.prisma.pushToken.findMany({ where: { userId } });
    if (tokens.length === 0) return;

    const provider = process.env['PUSH_PROVIDER'] ?? 'mock';
    if (provider === 'mock') {
      this.logger.log(`[MOCK PUSH] → ${userId}: ${payload.title} — ${payload.body}`);
      return;
    }

    // TODO: implement FCM/APNs push
  }

  async sendWalkRequest(partnerId: string, payload: WalkRequestPayload) {
    await this.sendPush(partnerId, {
      title: `Walk Request 🐕 ${payload.petName}`,
      body: `${payload.durationMinutes} min walk · ${payload.distanceKm.toFixed(1)}km away · ₹${payload.partnerPayout}`,
      data: {
        type: 'walk:request',
        bookingId: payload.bookingId,
        expiresAt: payload.expiresAt,
        pickupAddress: payload.pickupAddress,
      },
    });
  }

  async getUserNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }
}
