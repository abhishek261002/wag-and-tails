import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  async log(data: {
    userId: string;
    userEmail?: string;
    userRole: string;
    action: string;
    entity: string;
    entityId?: string;
    changes?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        userId: data.userId,
        userEmail: data.userEmail ?? null,
        userRole: data.userRole,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId ?? null,
        changes: data.changes
          ? (data.changes as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent ?? null,
      },
    });
  }
}
