import type { RealtimeEvent, RealtimeEventType } from '@wag/shared-types';

type Listener<T = unknown> = (event: RealtimeEvent<T>) => void;

export class RealtimeClient {
  private socket: WebSocket | null = null;
  private listeners = new Map<string, Set<Listener>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelayMs = 2000;
  private url: string;
  private getToken: () => string | null;

  constructor(url: string, getToken: () => string | null) {
    this.url = url;
    this.getToken = getToken;
  }

  connect() {
    const token = this.getToken();
    const wsUrl = token ? `${this.url}?token=${token}` : this.url;

    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.emit('connection:open', {});
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as RealtimeEvent;
        const handlers = this.listeners.get(data.type) ?? new Set();
        handlers.forEach((fn) => fn(data));

        // Also fire wildcard listeners
        const wildcards = this.listeners.get('*') ?? new Set();
        wildcards.forEach((fn) => fn(data));
      } catch {
        // Ignore parse errors
      }
    };

    this.socket.onclose = () => {
      this.scheduleReconnect();
    };

    this.socket.onerror = () => {
      this.socket?.close();
    };
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    const delay = this.reconnectDelayMs * Math.pow(2, this.reconnectAttempts);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.close();
    this.socket = null;
  }

  on<T = unknown>(event: RealtimeEventType | '*', listener: Listener<T>) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as Listener);
    return () => this.off(event, listener as Listener);
  }

  off(event: string, listener: Listener) {
    this.listeners.get(event)?.delete(listener);
  }

  private emit(type: string, payload: unknown) {
    const handlers = this.listeners.get(type) ?? new Set();
    handlers.forEach((fn) =>
      fn({ type: type as RealtimeEventType, payload, timestamp: new Date().toISOString() })
    );
  }

  send(type: string, payload: unknown) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, payload }));
    }
  }
}
