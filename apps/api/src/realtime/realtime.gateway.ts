import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

// Mirrors main.ts's HTTP CORS policy: in dev, reflect whatever origin the
// socket handshake actually came from (localhost port, LAN IP for a
// physical device, tunnel URL, ...) instead of trying to predict/pattern-
// match it ahead of time.
const isDev = process.env['NODE_ENV'] !== 'production';
const explicitOrigins = (process.env['CORS_ORIGINS'] ?? '').split(',');

@WebSocketGateway({
  cors: {
    origin: isDev ? true : explicitOrigins,
    credentials: true,
  },
  namespace: '/realtime',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private userSocketMap = new Map<string, Set<string>>(); // userId → socket IDs

  constructor(private jwtService: JwtService, private prisma: PrismaService) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        (client.handshake.auth['token'] as string) ||
        (client.handshake.query['token'] as string);

      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = this.jwtService.verify<{ sub: string; role: string }>(token);
      client.userId = payload.sub;
      client.userRole = payload.role;

      // Track connection
      if (!this.userSocketMap.has(payload.sub)) {
        this.userSocketMap.set(payload.sub, new Set());
      }
      this.userSocketMap.get(payload.sub)!.add(client.id);

      // Join role room
      await client.join(`role:${payload.role}`);
      await client.join(`user:${payload.sub}`);

      this.logger.log(`Client connected: ${client.id} (user: ${payload.sub}, role: ${payload.role})`);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      const sockets = this.userSocketMap.get(client.userId);
      sockets?.delete(client.id);
      if (sockets?.size === 0) {
        this.userSocketMap.delete(client.userId);
      }
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // A booking room carries the partner's live position, status changes (including the end code) and chat, so
  // only the customer and partner on that booking, and staff, may join it.
  @SubscribeMessage('join:booking')
  async handleJoinBooking(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { bookingId: string }
  ) {
    const id = String(data?.bookingId ?? '');
    if (!client.userId || !UUID_RE.test(id)) return { ok: false };
    if (!['staff', 'admin'].includes(client.userRole ?? '')) {
      const b = await this.prisma.booking.findUnique({ where: { id }, select: { customerId: true, partnerId: true } });
      if (!b || (b.customerId !== client.userId && b.partnerId !== client.userId)) {
        this.logger.warn(`denied join:booking ${id} for ${client.userId}`);
        return { ok: false };
      }
    }
    await client.join(`booking:${id}`);
    return { ok: true };
  }

  @SubscribeMessage('join:support')
  async handleJoinSupportTicket(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { ticketId: string }
  ) {
    const id = String(data?.ticketId ?? '');
    if (!client.userId || !UUID_RE.test(id)) return { ok: false };
    if (!['staff', 'admin'].includes(client.userRole ?? '')) {
      const t = await this.prisma.supportTicket.findUnique({ where: { id }, select: { userId: true } });
      if (!t || t.userId !== client.userId) return { ok: false };
    }
    await client.join(`support:${id}`);
    return { ok: true };
  }

  // Emit helpers called by services
  emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  emitToRole(role: string, event: string, data: unknown) {
    this.server.to(`role:${role}`).emit(event, data);
  }

  emitToBooking(bookingId: string, event: string, data: unknown) {
    this.server.to(`booking:${bookingId}`).emit(event, data);
  }

  emitToSupportTicket(ticketId: string, event: string, data: unknown) {
    this.server.to(`support:${ticketId}`).emit(event, data);
  }

  emitToAll(event: string, data: unknown) {
    this.server.emit(event, data);
  }
}
