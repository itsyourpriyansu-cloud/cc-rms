import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CustomerAuthService, type AuthConfig, type OtpProvider } from '../src/auth/index.js';

describe('PostgreSQL foundation migration', () => {
  const database = new PGlite();
  const client = {
    async query<T extends QueryResultRow = QueryResultRow>(
      text: string,
      values?: unknown[],
    ) {
      if (text.includes('pg_advisory_xact_lock')) {
        return { rows: [], rowCount: 1 };
      }
      const result = await database.query<T>(text, values);
      return {
        ...result,
        rowCount: result.rows.length || result.affectedRows || 0,
      };
    },
    release() {},
  } as unknown as PoolClient;
  const pool = {
    async connect() {
      return client;
    },
  } as unknown as Pool;

  beforeAll(async () => {
    const foundationMigration = await readFile(
      resolve(process.cwd(), 'migrations/0001_maos_foundation.sql'),
      'utf8',
    );
    const authMigration = await readFile(
      resolve(process.cwd(), 'migrations/0002_customer_auth.sql'),
      'utf8',
    );

    await database.exec(foundationMigration);
    await database.exec(authMigration);
    await database.exec(`
      INSERT INTO tenants (id, legal_name, display_name, status)
      VALUES
        ('ten_alpha01', 'Alpha Kitchens Private Limited', 'Alpha Kitchens', 'active'),
        ('ten_bravo01', 'Bravo Kitchens Private Limited', 'Bravo Kitchens', 'active');

      INSERT INTO outlets (
        id, tenant_id, name, latitude, longitude, service_radius_km, status
      )
      VALUES
        ('out_alpha01', 'ten_alpha01', 'Alpha Central', 17.385044, 78.486671, 8, 'open'),
        ('out_bravo01', 'ten_bravo01', 'Bravo Central', 19.076090, 72.877426, 8, 'open');

      INSERT INTO customers (
        id,
        tenant_id,
        phone_e164,
        first_name
      )
      VALUES (
        'cus_alpha01',
        'ten_alpha01',
        '+919876543210',
        'Asha'
      );

      CREATE ROLE rms_application NOSUPERUSER NOINHERIT;
      GRANT USAGE ON SCHEMA public TO rms_application;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rms_application;
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rms_application;
    `);
  });

  afterAll(async () => {
    await database.close();
  });

  it('executes the complete migration on a PostgreSQL-compatible engine', async () => {
    const result = await database.query<{ name: string }>(
      `
        SELECT table_name AS name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN (
            'orders',
            'maos_events',
            'outbox_events',
            'customer_otp_challenges',
            'customer_sessions'
          )
        ORDER BY table_name
      `,
    );

    expect(result.rows.map((row) => row.name)).toEqual([
      'customer_otp_challenges',
      'customer_sessions',
      'maos_events',
      'orders',
      'outbox_events',
    ]);
  });

  it('forces row-level security for OTP and session records', async () => {
    const result = await database.query<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      `
        SELECT relname, relrowsecurity, relforcerowsecurity
        FROM pg_class
        WHERE relname IN ('customer_otp_challenges', 'customer_sessions')
        ORDER BY relname
      `,
    );

    expect(result.rows).toEqual([
      {
        relname: 'customer_otp_challenges',
        relrowsecurity: true,
        relforcerowsecurity: true,
      },
      {
        relname: 'customer_sessions',
        relrowsecurity: true,
        relforcerowsecurity: true,
      },
    ]);
  });

  it('isolates outlet reads using database-enforced tenant context', async () => {
    await database.exec(`
      SET ROLE rms_application;
      SELECT set_config('app.tenant_id', 'ten_alpha01', false);
    `);

    const alphaResult = await database.query<{ id: string }>(
      'SELECT id FROM outlets ORDER BY id',
    );
    expect(alphaResult.rows).toEqual([{ id: 'out_alpha01' }]);

    await database.exec(`
      SELECT set_config('app.tenant_id', 'ten_bravo01', false);
    `);
    const bravoResult = await database.query<{ id: string }>(
      'SELECT id FROM outlets ORDER BY id',
    );
    expect(bravoResult.rows).toEqual([{ id: 'out_bravo01' }]);

    await database.exec('RESET ROLE');
  });

  it('blocks a cross-tenant insert even when application input is malicious', async () => {
    await database.exec(`
      SET ROLE rms_application;
      SELECT set_config('app.tenant_id', 'ten_alpha01', false);
    `);

    await expect(
      database.exec(`
        INSERT INTO outlets (
          id, tenant_id, name, latitude, longitude, service_radius_km, status
        )
        VALUES (
          'out_attack01',
          'ten_bravo01',
          'Cross-tenant outlet',
          17.385044,
          78.486671,
          8,
          'open'
        )
      `),
    ).rejects.toThrow(/row-level security policy/);

    await database.exec('RESET ROLE');
  });

  it('enforces legal order transitions and optimistic versions in PostgreSQL', async () => {
    await database.exec(`
      RESET ROLE;
      INSERT INTO orders (
        id,
        tenant_id,
        outlet_id,
        customer_id,
        source,
        status,
        subtotal_paise,
        discount_paise,
        delivery_fee_paise,
        tax_paise,
        total_paise
      )
      VALUES (
        'ord_alpha01',
        'ten_alpha01',
        'out_alpha01',
        'cus_alpha01',
        'customer_app',
        'pending_payment',
        30000,
        2000,
        3000,
        1500,
        32500
      );

      UPDATE orders
      SET status = 'placed', placed_at = now(), version = 2
      WHERE id = 'ord_alpha01';
    `);

    await expect(
      database.exec(`
        UPDATE orders
        SET status = 'delivered', version = 3
        WHERE id = 'ord_alpha01'
      `),
    ).rejects.toThrow(/Illegal order transition/);

    const result = await database.query<{ status: string; version: number }>(
      "SELECT status, version FROM orders WHERE id = 'ord_alpha01'",
    );
    expect(result.rows).toEqual([{ status: 'placed', version: 2 }]);
  });

  it('completes OTP, session, profile and revocation against the migrated schema', async () => {
    await database.exec('RESET ROLE');
    const authConfig: AuthConfig = {
      nodeEnv: 'test',
      pepper: 'integration-pepper-that-is-longer-than-thirty-two-characters',
      provider: 'development',
      developmentOtp: '123456',
      otpTtlSeconds: 300,
      otpCooldownSeconds: 60,
      otpMaxAttempts: 5,
      sessionTtlDays: 30,
      secureCookie: false,
    };
    const provider: OtpProvider = {
      async send() {
        return { providerReference: 'integration-message-1' };
      },
    };
    const service = new CustomerAuthService(pool, authConfig, provider);
    const metadata = {
      ip: '127.0.0.1',
      userAgent: 'integration-test',
      correlationId: 'cor_auth_integration01',
    };
    const request = {
      tenantId: 'ten_alpha01',
      outletId: 'out_alpha01',
      phone: '9123456789',
    };

    const challenge = await service.requestOtp(request, metadata);
    expect(challenge.developmentOtp).toBe('123456');

    const verification = await service.verifyOtp(
      {
        ...request,
        requestId: challenge.requestId,
        otp: '123456',
        firstName: 'Mira',
      },
      metadata,
    );
    expect(verification.customer).toMatchObject({
      phone: '9123456789',
      firstName: 'Mira',
    });

    const authenticated = await service.authenticate(verification.sessionToken);
    expect(authenticated.customerId).toBe(verification.customer.id);

    const updated = await service.updateProfile(authenticated, {
      dietaryPreference: 'vegetarian',
      spicePreference: 'mild',
      marketingConsent: true,
    });
    expect(updated).toMatchObject({
      dietaryPreference: 'vegetarian',
      spicePreference: 'mild',
      marketingConsent: true,
    });

    await service.revokeSession(authenticated);
    await expect(service.authenticate(verification.sessionToken)).rejects.toThrow(
      'Your session has expired',
    );
  });
});
