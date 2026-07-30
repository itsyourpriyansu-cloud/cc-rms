import { EventEmitter } from 'node:events';
import type { Pool, PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { TrackingEventHub } from '../src/tracking/index.js';

describe('tracking notification hub', () => {
  it('uses one PostgreSQL listener and routes only matching order events', async () => {
    const emitter = new EventEmitter();
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const release = vi.fn();
    const client = Object.assign(emitter, {
      query,
      release,
    }) as unknown as PoolClient;
    const pool = {
      connect: vi.fn().mockResolvedValue(client),
    } as unknown as Pool;
    const hub = new TrackingEventHub(pool);
    const alpha = vi.fn();
    const bravo = vi.fn();

    await hub.start();
    const unsubscribeAlpha = hub.subscribe(
      'ten_alpha01',
      'ord_alpha01',
      alpha,
    );
    hub.subscribe('ten_alpha01', 'ord_bravo01', bravo);
    emitter.emit('notification', {
      channel: 'rms_tracking_events',
      payload: JSON.stringify({
        tenantId: 'ten_alpha01',
        orderId: 'ord_alpha01',
        sequence: 42,
      }),
    });

    expect(query).toHaveBeenCalledWith('LISTEN rms_tracking_events');
    expect(alpha).toHaveBeenCalledWith(42);
    expect(bravo).not.toHaveBeenCalled();

    unsubscribeAlpha();
    emitter.emit('notification', {
      channel: 'rms_tracking_events',
      payload: '{"invalid":true}',
    });
    expect(alpha).toHaveBeenCalledOnce();

    await hub.stop();
    expect(query).toHaveBeenCalledWith('UNLISTEN rms_tracking_events');
    expect(release).toHaveBeenCalledOnce();
  });
});
