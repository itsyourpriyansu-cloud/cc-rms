import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Pool, PoolClient, QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { appendEventToOutbox, withTenantTransaction } from '../src/database/index.js';
import { readDatabaseConfig } from '../src/database/config.js';

const createMockDatabase = () => {
  const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [{ id: 'evt_demo01' }] });
  const release = vi.fn();
  const client = { query, release } as unknown as PoolClient;
  const connect = vi.fn().mockResolvedValue(client);
  const pool = { connect } as unknown as Pool;

  return { pool, query, release };
};

describe('tenant transaction boundary', () => {
  it('sets database-local tenant, actor and correlation context', async () => {
    const { pool, query, release } = createMockDatabase();

    const result = await withTenantTransaction(
      pool,
      {
        tenantId: 'ten_demo01',
        userId: 'usr_demo01',
        correlationId: 'cor_order_demo01',
      },
      async (client) => {
        await client.query('SELECT 42 AS answer');
        return 42;
      },
    );

    expect(result).toBe(42);
    expect(query.mock.calls[0]?.[0]).toBe('BEGIN');
    expect(query.mock.calls[1]?.[0]).toContain("set_config('app.tenant_id'");
    expect(query.mock.calls[1]?.[1]).toEqual([
      'ten_demo01',
      'usr_demo01',
      'cor_order_demo01',
    ]);
    expect(query.mock.calls.at(-1)?.[0]).toBe('COMMIT');
    expect(release).toHaveBeenCalledOnce();
  });

  it('rolls back and releases the connection when an operation fails', async () => {
    const { pool, query, release } = createMockDatabase();

    await expect(
      withTenantTransaction(
        pool,
        {
          tenantId: 'ten_demo01',
          correlationId: 'cor_order_demo01',
        },
        async () => {
          throw new Error('write failed');
        },
      ),
    ).rejects.toThrow('write failed');

    expect(query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
    expect(release).toHaveBeenCalledOnce();
  });

  it('rejects invalid tenant context before opening a connection', async () => {
    const { pool } = createMockDatabase();

    await expect(
      withTenantTransaction(
        pool,
        {
          tenantId: 'not-a-tenant',
          correlationId: 'cor_order_demo01',
        },
        async () => null,
      ),
    ).rejects.toThrow();

    expect(pool.connect).not.toHaveBeenCalled();
  });
});

describe('database configuration', () => {
  it('uses bounded defaults and an explicit PostgreSQL URL', () => {
    expect(
      readDatabaseConfig({
        DATABASE_URL: 'postgresql://app:secret@localhost:5432/rms',
      }),
    ).toEqual({
      databaseUrl: 'postgresql://app:secret@localhost:5432/rms',
      sslMode: 'disable',
      poolMax: 10,
      idleTimeoutMs: 30_000,
      connectionTimeoutMs: 5_000,
    });
  });

  it('rejects non-PostgreSQL connection strings', () => {
    expect(() =>
      readDatabaseConfig({ DATABASE_URL: 'https://database.example.com' }),
    ).toThrow(/PostgreSQL connection URL/);
  });
});

describe('transactional outbox', () => {
  const event = {
    specversion: '1.0',
    type: 'order.promise_at_risk',
    source: 'rms/order-core',
    id: 'evt_demo01',
    time: '2026-07-29T13:12:08.000Z',
    subject: 'tenant/ten_demo01/outlet/out_demo01/order/ord_demo01',
    datacontenttype: 'application/json',
    tenant_id: 'ten_demo01',
    outlet_id: 'out_demo01',
    correlation_id: 'cor_order_demo01',
    causation_id: null,
    idempotency_key: 'order:ord_demo01:risk:v1',
    schema_version: '1.0',
    data_class: 'operational',
    consent_ref: null,
    data: { riskProbability: 0.87 },
  };

  it('writes the immutable ledger and delivery queue atomically', async () => {
    const { query } = createMockDatabase();
    const client = { query } as unknown as PoolClient;

    await expect(appendEventToOutbox(client, event)).resolves.toEqual({
      inserted: true,
      eventId: 'evt_demo01',
    });

    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0]?.[0]).toContain('WITH ledger_entry AS');
    expect(query.mock.calls[0]?.[0]).toContain('INSERT INTO outbox_events');
  });

  it('validates an event before touching the database', async () => {
    const { query } = createMockDatabase();
    const client = { query } as unknown as PoolClient;

    await expect(
      appendEventToOutbox(client, { ...event, tenant_id: 'wrong' }),
    ).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });

  it('reports an idempotent duplicate without creating another event', async () => {
    const query = vi.fn().mockResolvedValue({
      rowCount: 0,
      rows: [],
    } satisfies Partial<QueryResult>);
    const client = { query } as unknown as PoolClient;

    await expect(appendEventToOutbox(client, event)).resolves.toEqual({
      inserted: false,
      eventId: 'evt_demo01',
    });
  });
});

describe('foundation migration', () => {
  it('enables and forces tenant row-level security on every tenant table', async () => {
    const migration = await readFile(
      resolve(process.cwd(), 'migrations/0001_maos_foundation.sql'),
      'utf8',
    );

    const tenantTables = [
      'outlets',
      'staff_users',
      'user_outlet_roles',
      'customers',
      'customer_consents',
      'orders',
      'order_lines',
      'order_status_events',
      'maos_events',
      'maos_decision_proposals',
      'maos_approvals',
      'maos_action_receipts',
      'outbox_events',
    ];

    expect(migration).toContain('ALTER TABLE tenants FORCE ROW LEVEL SECURITY');
    expect(migration).toContain("current_setting('app.tenant_id', true)");

    for (const table of tenantTables) {
      expect(migration).toContain(`'${table}'`);
    }
    expect(migration).toContain('ALTER TABLE %I FORCE ROW LEVEL SECURITY');
  });

  it('protects order transitions and append-only audit records', async () => {
    const migration = await readFile(
      resolve(process.cwd(), 'migrations/0001_maos_foundation.sql'),
      'utf8',
    );

    expect(migration).toContain('CREATE TRIGGER orders_enforce_transition');
    expect(migration).toContain('Illegal order transition');
    expect(migration).toContain('CREATE TRIGGER maos_events_are_immutable');
    expect(migration).toContain('CREATE TRIGGER maos_action_receipts_are_immutable');
  });
});
