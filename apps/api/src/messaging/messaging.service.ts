import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class MessagingService {
  constructor(private prisma: PrismaService) {}

  async listConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: {
        participants: { some: { userId } },
      },
      include: {
        participants: { include: { user: { include: { profile: true } } } },
        messages: { orderBy: { sentAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getOrCreateConversation(bookingId: string, requesterId: string) {
    const existing = await this.prisma.conversation.findFirst({
      where: { bookingId },
      include: {
        participants: true,
        messages: { orderBy: { sentAt: 'desc' }, take: 50 },
      },
    });

    if (existing) return existing;

    // Get booking to find customer + partner
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
    });

    const participantIds = [booking.customerId];
    if (booking.partnerId) participantIds.push(booking.partnerId);

    return this.prisma.conversation.create({
      data: {
        bookingId,
        participants: {
          create: participantIds.map((uid) => ({ userId: uid })),
        },
      },
      include: {
        participants: true,
        messages: true,
      },
    });
  }

  async getMessages(conversationId: string, userId: string, before?: string) {
    // Verify user is a participant
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, userId },
    });
    if (!participant) throw new ForbiddenException('Access denied');

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
    attachmentUrl?: string
  ) {
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, userId: senderId },
    });
    if (!participant) throw new ForbiddenException('You are not part of this conversation');

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
        isRead: false,
        sentAt: new Date(),
      },
    });

    // Update conversation updated time
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

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
