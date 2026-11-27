import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';

@Injectable()
export class MessagingService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeGateway
  ) {}

  async listConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: {
        participants: { some: { userId } },
      },
      include: {
        // `select` here, not `include: true` — the latter would also hand
        // back every participant's passwordHash.
        participants: {
          include: {
            user: {
              select: {
                id: true, phone: true, email: true, role: true,
                profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
              },
            },
          },
        },
        messages: { orderBy: { sentAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getOrCreateConversation(bookingId: string, requesterId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, select: { customerId: true, partnerId: true } });
    if (!booking) throw new NotFoundException('Booking not found');
    // The chat belongs to the booking's customer and its current partner (staff may look in). Without this, any
    // signed-in user could open any booking's chat and read it.
    if (requesterId !== booking.customerId && requesterId !== booking.partnerId && !(await this.isStaff(requesterId))) {
      throw new ForbiddenException('Access denied');
    }
    const parties = [booking.customerId, ...(booking.partnerId ? [booking.partnerId] : [])];
    const include = { participants: true, messages: { orderBy: { sentAt: 'desc' as const }, take: 50 } };

    const existing = await this.prisma.conversation.findFirst({ where: { bookingId }, include });
    if (existing) {
      // The partner can change (released, reassigned on the desk): add the new one and drop the previous one.
      const missing = parties.filter((id) => !existing.participants.some((p) => p.userId === id));
      const others = existing.participants.map((p) => p.userId).filter((id) => !parties.includes(id));
      const stale = others.length
        ? (await this.prisma.user.findMany({ where: { id: { in: others }, role: 'partner' }, select: { id: true } })).map((u) => u.id)
        : [];
      if (!missing.length && !stale.length) return existing;
      if (stale.length) await this.prisma.conversationParticipant.deleteMany({ where: { conversationId: existing.id, userId: { in: stale } } });
      if (missing.length) await this.prisma.conversationParticipant.createMany({ data: missing.map((userId) => ({ conversationId: existing.id, userId })), skipDuplicates: true });
      return this.prisma.conversation.findUniqueOrThrow({ where: { id: existing.id }, include });
    }

    return this.prisma.conversation.create({
      data: { bookingId, participants: { create: parties.map((userId) => ({ userId })) } },
      include: { participants: true, messages: true },
    });
  }

  private async isStaff(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    return u?.role === 'staff' || u?.role === 'admin';
  }

  /** A partner who no longer has the booking may not keep reading or writing its chat. */
  private async assertStillOnBooking(conversationId: string, userId: string) {
    const c = await this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { bookingId: true } });
    if (!c?.bookingId) return;
    const b = await this.prisma.booking.findUnique({ where: { id: c.bookingId }, select: { customerId: true, partnerId: true } });
    if (!b || userId === b.customerId || userId === b.partnerId || (await this.isStaff(userId))) return;
    throw new ForbiddenException('You are no longer on this booking');
  }

  async getMessages(conversationId: string, userId: string, before?: string) {
    // Verify user is a participant
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, userId },
    });
    if (!participant) throw new ForbiddenException('Access denied');
    await this.assertStillOnBooking(conversationId, userId);

    return this.prisma.message.findMany({
      where: {
        conversationId,
        ...(before ? { sentAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { sentAt: 'desc' },
      take: 50,
    });
  }

  async sendMessage(
    conversationId: string,
    senderId: string,
    senderRole: string,
    content: string,
    attachmentUrl?: string,
    attachmentType?: string
  ) {
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, userId: senderId },
    });
    if (!participant) throw new ForbiddenException('You are not part of this conversation');
    await this.assertStillOnBooking(conversationId, senderId);

    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
      include: { profile: true },
    });

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        senderName: sender?.profile
          ? `${sender.profile.firstName} ${sender.profile.lastName}`
          : 'User',
        senderRole,
        content,
        attachmentUrl: attachmentUrl ?? null,
        attachmentType: attachmentType ?? null,
        isRead: false,
        sentAt: new Date(),
      },
    });

    // Update conversation updated time
    const conversation = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Booking-scoped room, not per-user: both participants (whoever is
    // connected and has joined this booking's room, per the same pattern
    // as partner:location_updated) get the message live instead of
    // relying on the 4s poll as the primary delivery path.
    if (conversation.bookingId) {
      this.realtime.emitToBooking(conversation.bookingId, 'message:sent', {
        conversationId,
        bookingId: conversation.bookingId,
        messageId: message.id,
        senderId,
        senderName: message.senderName,
        senderRole,
        content,
        attachmentUrl: message.attachmentUrl,
        attachmentType: message.attachmentType,
        sentAt: message.sentAt.toISOString(),
      });
    }

    return message;
  }

  async markRead(conversationId: string, userId: string) {
    // Mark all unread messages in conversation as read (not sent by this user)
    await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, isRead: false },
      data: { isRead: true },
    });
  }
}
