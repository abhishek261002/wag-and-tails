import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) {}

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

  async listAll(filters: { status?: string } = {}) {
    return this.prisma.supportTicket.findMany({
      where: filters.status ? { status: filters.status } : {},
      include: { user: { include: { profile: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(ticketId: string, status: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status, ...(status === 'resolved' ? { resolvedAt: new Date() } : {}) },
    });
  }
}
