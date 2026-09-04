import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async listByUser(userId: string) {
    return this.prisma.storeOrder.findMany({
      where: { userId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(orderId: string, requesterId: string, requesterRole: string) {
    const order = await this.prisma.storeOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (requesterRole === 'customer' && order.userId !== requesterId) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async listAll(filters: { status?: string; page?: number; pageSize?: number } = {}) {
    const { status, page = 1, pageSize = 20 } = filters;
    const skip = (page - 1) * pageSize;
    const where = status ? { status } : {};

    const [data, total] = await Promise.all([
      this.prisma.storeOrder.findMany({
        where,
        skip,
        take: pageSize,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.storeOrder.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async markPacked(orderId: string, staffId: string) {
    return this.prisma.storeOrder.update({
      where: { id: orderId },
      data: { status: 'packed', packedAt: new Date() },
    });
  }

  async updateStatus(orderId: string, status: string) {
    return this.prisma.storeOrder.update({
      where: { id: orderId },
      data: {
        status,
        ...(status === 'packed' ? { packedAt: new Date() } : {}),
        ...(status === 'out_for_delivery' ? { shippedAt: new Date() } : {}),
        ...(status === 'delivered' ? { deliveredAt: new Date() } : {}),
      },
    });
  }
}
