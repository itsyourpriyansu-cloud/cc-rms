import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';

const NotificationSchema = z.object({
  tenantId: z.string().min(6).max(80),
  orderId: z.string().min(6).max(80),
  sequence: z.number().int().nonnegative(),
});

type Subscriber = (sequence: number) => void;

export class TrackingEventHub {
  private client: PoolClient | null = null;
  private readonly subscribers = new Map<string, Set<Subscriber>>();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private stopping = false;

  constructor(private readonly pool: Pool) {}

  async start(): Promise<void> {
    if (this.client || this.stopping) return;
    const client = await this.pool.connect();
    this.client = client;
    client.on('notification', (message) => {
      if (message.channel !== 'rms_tracking_events' || !message.payload) return;
      let payload: unknown;
      try {
        payload = JSON.parse(message.payload);
      } catch {
        return;
      }
      const parsed = NotificationSchema.safeParse(payload);
      if (!parsed.success) return;
      const key = this.key(parsed.data.tenantId, parsed.data.orderId);
      for (const subscriber of this.subscribers.get(key) ?? []) {
        subscriber(parsed.data.sequence);
      }
    });
    client.on('error', () => {
      if (this.client !== client) return;
      this.client = null;
      client.release(true);
      this.scheduleReconnect();
    });
    try {
      await client.query('LISTEN rms_tracking_events');
    } catch (error) {
      if (this.client === client) this.client = null;
      client.release(true);
      throw error;
    }
  }

  subscribe(
    tenantId: string,
    orderId: string,
    subscriber: Subscriber,
  ): () => void {
    const key = this.key(tenantId, orderId);
    const current = this.subscribers.get(key) ?? new Set<Subscriber>();
    current.add(subscriber);
    this.subscribers.set(key, current);
    return () => {
      current.delete(subscriber);
      if (current.size === 0) this.subscribers.delete(key);
    };
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.client) {
      const client = this.client;
      this.client = null;
      try {
        await client.query('UNLISTEN rms_tracking_events');
      } finally {
        client.release();
      }
    }
    this.subscribers.clear();
  }

  private key(tenantId: string, orderId: string): string {
    return `${tenantId}:${orderId}`;
  }

  private scheduleReconnect(): void {
    if (this.stopping || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.start().catch(() => this.scheduleReconnect());
    }, 1_000);
  }
}
