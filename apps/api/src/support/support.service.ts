import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';

const STAFF_ROLES = new Set(['staff', 'admin']);

@Injectable()
export class SupportService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeGateway
  ) {}

  async create(userId: string, subject: string, description: string) {
    return this.prisma.supportTicket.create({
      data: { userId, subject, description },
    });
  }

  async listByUser(userId: string) {
    return this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // `select` rather than `include: true` on the user relation — the latter
  // would also hand staff/admin the customer's passwordHash.
  private readonly userSummary = {
    select: {
      id: true, phone: true, email: true, role: true, isActive: true, createdAt: true,
      profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
    },
  } as const;

  async listAll(filters: { status?: string; escalated?: boolean } = {}) {
    return this.prisma.supportTicket.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.escalated !== undefined ? { escalated: filters.escalated } : {}),
      },
      include: { user: this.userSummary },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOne(ticketId: string, requesterId: string, requesterRole: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: { user: this.userSummary },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    this.assertAccess(ticket, requesterId, requesterRole);
    return ticket;
  }

  async updateStatus(ticketId: string, status: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status, ...(status === 'resolved' ? { resolvedAt: new Date() } : {}) },
    });
  }

  // Staff keep working an escalated ticket themselves — this just surfaces
  // it on the admin console for visibility/backup, it isn't a handoff.
  async escalate(ticketId: string, staffId: string, reason: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { escalated: true, escalatedAt: new Date(), escalatedReason: reason },
    });

    const conversation = await this.getOrCreateConversation(ticketId, staffId, 'staff');
    await this.postSystemMessage(conversation.id, ticketId, staffId, `Escalated to admin: ${reason}`);

    return updated;
  }

  private assertAccess(ticket: { userId: string }, requesterId: string, requesterRole: string) {
    if (STAFF_ROLES.has(requesterRole)) return;
    if (ticket.userId !== requesterId) throw new ForbiddenException('Access denied');
  }

  // Lazily created on first message, same pattern as MessagingService's
  // booking conversations — a ticket with no replies yet needs no thread.
  async getOrCreateConversation(ticketId: string, requesterId: string, requesterRole: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    this.assertAccess(ticket, requesterId, requesterRole);

    const existing = await this.prisma.conversation.findFirst({
      where: { ticketId },
      include: { participants: true, messages: { orderBy: { sentAt: 'desc' }, take: 50 } },
    });
    if (existing) return existing;

    return this.prisma.conversation.create({
      data: {
        ticketId,
        // Only the ticket's own owner is a formal participant — staff/admin
        // read and reply by role (see assertAccess), not by being listed
        // here, since the staff roster isn't fixed at ticket-creation time.
        participants: { create: [{ userId: ticket.userId }] },
      },
      include: { participants: true, messages: true },
    });
  }

  async getMessages(ticketId: string, requesterId: string, requesterRole: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    this.assertAccess(ticket, requesterId, requesterRole);

    const conversation = await this.prisma.conversation.findFirst({ where: { ticketId } });
    if (!conversation) return [];

    return this.prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { sentAt: 'desc' },
      take: 100,
    });
  }

  async sendMessage(
    ticketId: string,
    senderId: string,
    senderRole: string,
    content: string,
    attachmentUrl?: string,
    attachmentType?: string
  ) {
    const conversation = await this.getOrCreateConversation(ticketId, senderId, senderRole);

    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
      include: { profile: true },
    });
    const senderName = STAFF_ROLES.has(senderRole)
      ? `${sender?.profile ? `${sender.profile.firstName} ${sender.profile.lastName}` : 'Wag & Tails'} (Support)`
      : sender?.profile
        ? `${sender.profile.firstName} ${sender.profile.lastName}`
        : 'User';

    const message = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId,
        senderName,
        senderRole,
        content,
        attachmentUrl: attachmentUrl ?? null,
        attachmentType: attachmentType ?? null,
        isRead: false,
        sentAt: new Date(),
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });
    // A staff/admin reply is the natural signal that someone picked the
    // ticket up — no separate "assign" step exists in this v1.
    if (STAFF_ROLES.has(senderRole)) {
      await this.prisma.supportTicket.updateMany({
        where: { id: ticketId, status: 'open' },
        data: { status: 'in_progress' },
      });
    }

    this.realtime.emitToSupportTicket(ticketId, 'support:message_sent', {
      ticketId,
      conversationId: conversation.id,
      messageId: message.id,
      senderId,
      senderName,
      senderRole,
      content,
      attachmentUrl: message.attachmentUrl,
      attachmentType: message.attachmentType,
      sentAt: message.sentAt.toISOString(),
    });

    return message;
  }

  // Recorded against the escalating staff member (Message.senderId is a
  // required FK to User — there's no "system" account), but tagged with
  // senderRole 'system' so clients can style it as a status note rather
  // than a normal reply from that person.
  private async postSystemMessage(conversationId: string, ticketId: string, staffId: string, content: string) {
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: staffId,
        senderName: 'System',
        senderRole: 'system',
        content,
        isRead: false,
        sentAt: new Date(),
      },
    });

    this.realtime.emitToSupportTicket(ticketId, 'support:message_sent', {
      ticketId,
      conversationId,
      messageId: message.id,
      senderId: staffId,
      senderName: 'System',
      senderRole: 'system',
      content,
      sentAt: message.sentAt.toISOString(),
    });
  }
}
