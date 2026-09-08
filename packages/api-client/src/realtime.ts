import { io, Socket } from 'socket.io-client';
import type { RealtimeEventType } from '@wag/shared-types';

type Listener<T = unknown> = (payload: T) => void;

// The backend (RealtimeGateway) is a NestJS Socket.IO gateway on the
// `/realtime` namespace, authenticating via `handshake.auth.token`. This
// must speak actual Socket.IO — a plain `WebSocket` client (the previous
// implementation here) cannot complete the Socket.IO handshake at all, so
// no realtime event has ever been deliverable end-to-end until this.
export class RealtimeClient {
  private socket: Socket | null = null;
  private baseUrl: string;
  private getToken: () => string | null;

  constructor(baseUrl: string, getToken: () => string | null) {
    // baseUrl is the REST API base (e.g. http://localhost:3001/api/v1);
    // the socket server lives at the API's origin, not under /api/v1.
    this.baseUrl = baseUrl.replace(/\/api\/v1\/?$/, '');
    this.getToken = getToken;
  }

  connect() {
    if (this.socket?.connected) return;
    const token = this.getToken();
    this.socket = io(`${this.baseUrl}/realtime`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  joinBooking(bookingId: string) {
    this.socket?.emit('join:booking', { bookingId });
  }

  on<T = unknown>(event: RealtimeEventType | string, listener: Listener<T>) {
    const handler = listener as (...args: unknown[]) => void;
    this.socket?.on(event, handler);
    return () => this.off(event, handler);
  }

  off(event: string, listener: Listener) {
    this.socket?.off(event, listener as (...args: unknown[]) => void);
  }

  send(event: string, payload: unknown) {
    this.socket?.emit(event, payload);
  }
}
