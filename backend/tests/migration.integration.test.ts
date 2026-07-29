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
    const orderFoundationMigration = await readFile(
      resolve(process.cwd(), 'migrations/0003_order_foundation.sql'),
      'utf8',
    );

    await database.exec(foundationMigration);
    await database.exec(authMigration);
    await database.exec(orderFoundationMigration);
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

      INSERT INTO brands (id, tenant_id, name, status)
      VALUES ('brd_alpha01', 'ten_alpha01', 'Mangamma', 'active');

      INSERT INTO menu_categories (id, tenant_id, brand_id, name, status)
      VALUES ('cat_alpha01', 'ten_alpha01', 'brd_alpha01', 'Home meals', 'active');

      INSERT INTO kitchen_stations (
        id, tenant_id, outlet_id, name, capacity_units, status
      )
      VALUES ('stn_alpha01', 'ten_alpha01', 'out_alpha01', 'Main line', 4, 'active');

      INSERT INTO menu_items (
        id,
        tenant_id,
        brand_id,
        category_id,
        name,
        dietary_type,
        allergen_facts,
        base_price_paise,
        status
      )
      VALUES (
        'itm_alpha01',
        'ten_alpha01',
        'brd_alpha01',
        'cat_alpha01',
        'Home-style thali',
        'vegetarian',
        '["milk"]',
        30000,
        'active'
      );

      INSERT INTO inventory_items (
        id, tenant_id, name, unit, allergen_facts, status
      )
      VALUES ('inv_alpha01', 'ten_alpha01', 'Paneer', 'g', '["milk"]', 'active');

      INSERT INTO recipe_versions (
        id,
        tenant_id,
        item_id,
        station_id,
        version,
        expected_duration_seconds,
        instructions,
        status,
        published_at
      )
      VALUES (
        'rcp_alpha01',
        'ten_alpha01',
        'itm_alpha01',
        'stn_alpha01',
        1,
        900,
        'Prepare fresh and serve hot',
        'published',
        now()
      );

      INSERT INTO recipe_components (
        id, tenant_id, recipe_version_id, inventory_item_id, quantity, unit
      )
      VALUES ('rcc_alpha01', 'ten_alpha01', 'rcp_alpha01', 'inv_alpha01', 150, 'g');

      INSERT INTO item_availability (
        tenant_id, outlet_id, item_id, status
      )
      VALUES ('ten_alpha01', 'out_alpha01', 'itm_alpha01', 'available');

      INSERT INTO checkout_quotes (
        id,
        tenant_id,
        outlet_id,
        customer_id,
        idempotency_key,
        status,
        fulfilment_type,
        fulfilment_snapshot,
        subtotal_paise,
        discount_paise,
        delivery_fee_paise,
        packaging_fee_paise,
        tax_paise,
        total_paise,
        calculation_version,
        expires_at
      )
      VALUES (
        'qte_alpha01',
        'ten_alpha01',
        'out_alpha01',
        'cus_alpha01',
        'quote-alpha-000001',
        'active',
        'delivery',
        '{"address_id":"address-alpha-1"}',
        30000,
        2000,
        3000,
        1000,
        1500,
        33500,
        'pricing-v1',
        now() + interval '15 minutes'
      );

      INSERT INTO checkout_quotes (
        id,
        tenant_id,
        outlet_id,
        customer_id,
        idempotency_key,
        status,
        fulfilment_type,
        fulfilment_snapshot,
        subtotal_paise,
        discount_paise,
        delivery_fee_paise,
        packaging_fee_paise,
        tax_paise,
        total_paise,
        calculation_version,
        expires_at,
        created_at
      )
      VALUES (
        'qte_expired01',
        'ten_alpha01',
        'out_alpha01',
        'cus_alpha01',
        'quote-expired-0001',
        'expired',
        'delivery',
        '{"address_id":"address-alpha-1"}',
        30000,
        2000,
        3000,
        1000,
        1500,
        33500,
        'pricing-v1',
        now() - interval '15 minutes',
        now() - interval '30 minutes'
      );

      INSERT INTO checkout_quote_lines (
        id,
        tenant_id,
        quote_id,
        item_id,
        item_version,
        recipe_version_id,
        item_name_snapshot,
        quantity,
        unit_price_paise,
        line_total_paise,
        allergen_snapshot
      )
      VALUES (
        'qln_alpha01',
        'ten_alpha01',
        'qte_alpha01',
        'itm_alpha01',
        1,
        'rcp_alpha01',
        'Home-style thali',
        1,
        30000,
        30000,
        '["milk"]'
      );

      INSERT INTO checkout_quote_lines (
        id,
        tenant_id,
        quote_id,
        item_id,
        item_version,
        recipe_version_id,
        item_name_snapshot,
        quantity,
        unit_price_paise,
        line_total_paise,
        allergen_snapshot
      )
      VALUES (
        'qln_expired01',
        'ten_alpha01',
        'qte_expired01',
        'itm_alpha01',
        1,
        'rcp_alpha01',
        'Home-style thali',
        1,
        30000,
        30000,
        '["milk"]'
      );

      INSERT INTO payment_intents (
        id,
        tenant_id,
        outlet_id,
        quote_id,
        provider,
        provider_intent_reference,
        idempotency_key,
        status,
        amount_paise,
        verified_at
      )
      VALUES (
        'pay_alpha01',
        'ten_alpha01',
        'out_alpha01',
        'qte_alpha01',
        'razorpay',
        'provider-payment-alpha-1',
        'payment-alpha-0001',
        'verified',
        33500,
        now()
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
            'customer_sessions',
            'checkout_quotes',
            'payment_intents',
            'kitchen_tasks',
            'delivery_milestones',
            'order_risk_snapshots'
          )
        ORDER BY table_name
      `,
    );

    expect(result.rows.map((row) => row.name)).toEqual([
      'checkout_quotes',
      'customer_otp_challenges',
      'customer_sessions',
      'delivery_milestones',
      'kitchen_tasks',
      'maos_events',
      'order_risk_snapshots',
      'orders',
      'outbox_events',
      'payment_intents',
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

  it('forces row-level security for every commerce foundation table', async () => {
    const result = await database.query<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      `
        SELECT relname, relrowsecurity, relforcerowsecurity
        FROM pg_class
        WHERE relname IN (
          'menu_items',
          'checkout_quotes',
          'payment_intents',
          'kitchen_tasks',
          'delivery_milestones',
          'order_risk_snapshots'
        )
        ORDER BY relname
      `,
    );

    expect(result.rows).toHaveLength(6);
    expect(
      result.rows.every(
        (row) => row.relrowsecurity && row.relforcerowsecurity,
      ),
    ).toBe(true);
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

  it('isolates checkout facts using the same database tenant context', async () => {
    await database.exec(`
      SET ROLE rms_application;
      SELECT set_config('app.tenant_id', 'ten_alpha01', false);
    `);

    const alphaResult = await database.query<{ id: string }>(
      'SELECT id FROM checkout_quotes ORDER BY id',
    );
    expect(alphaResult.rows).toEqual([
      { id: 'qte_alpha01' },
      { id: 'qte_expired01' },
    ]);

    await database.exec(`
      SELECT set_config('app.tenant_id', 'ten_bravo01', false);
    `);
    const bravoResult = await database.query<{ id: string }>(
      'SELECT id FROM checkout_quotes',
    );
    expect(bravoResult.rows).toEqual([]);

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
        quote_id,
        payment_intent_id,
        checkout_idempotency_key,
        fulfilment_type,
        fulfilment_snapshot,
        calculation_version,
        subtotal_paise,
        discount_paise,
        delivery_fee_paise,
        packaging_fee_paise,
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
        'qte_alpha01',
        'pay_alpha01',
        'checkout-alpha-0001',
        'delivery',
        '{"address_id":"address-alpha-1"}',
        'pricing-v1',
        30000,
        2000,
        3000,
        1000,
        1500,
        33500
      );

      INSERT INTO order_lines (
        id,
        tenant_id,
        order_id,
        item_id,
        quote_line_id,
        item_version,
        recipe_version_id,
        item_name_snapshot,
        quantity,
        unit_price_paise,
        modifiers,
        allergen_acknowledgements,
        instructions_snapshot
      )
      VALUES (
        'oln_alpha01',
        'ten_alpha01',
        'ord_alpha01',
        'itm_alpha01',
        'qln_alpha01',
        1,
        'rcp_alpha01',
        'Home-style thali',
        1,
        30000,
        '[]',
        '["milk"]',
        'Prepare fresh and serve hot'
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

  it('rejects duplicate checkout idempotency and quote consumption', async () => {
    await expect(
      database.exec(`
        INSERT INTO orders (
          id,
          tenant_id,
          outlet_id,
          customer_id,
          source,
          status,
          quote_id,
          payment_intent_id,
          checkout_idempotency_key,
          fulfilment_type,
          calculation_version,
          subtotal_paise,
          discount_paise,
          delivery_fee_paise,
          packaging_fee_paise,
          tax_paise,
          total_paise
        )
        VALUES (
          'ord_alpha02',
          'ten_alpha01',
          'out_alpha01',
          'cus_alpha01',
          'customer_app',
          'pending_payment',
          'qte_alpha01',
          'pay_alpha01',
          'checkout-alpha-0001',
          'delivery',
          'pricing-v1',
          30000,
          2000,
          3000,
          1000,
          1500,
          33500
        )
      `),
    ).rejects.toThrow(/not active or has expired/);
  });

  it('cannot convert an expired quote into an order', async () => {
    await expect(
      database.exec(`
        INSERT INTO orders (
          id,
          tenant_id,
          outlet_id,
          customer_id,
          source,
          status,
          quote_id,
          checkout_idempotency_key,
          fulfilment_type,
          fulfilment_snapshot,
          calculation_version,
          subtotal_paise,
          discount_paise,
          delivery_fee_paise,
          packaging_fee_paise,
          tax_paise,
          total_paise
        )
        VALUES (
          'ord_expired01',
          'ten_alpha01',
          'out_alpha01',
          'cus_alpha01',
          'customer_app',
          'pending_payment',
          'qte_expired01',
          'checkout-expired-01',
          'delivery',
          '{"address_id":"address-alpha-1"}',
          'pricing-v1',
          30000,
          2000,
          3000,
          1000,
          1500,
          33500
        )
      `),
    ).rejects.toThrow(/not active or has expired/);
  });

  it('enforces task transitions and immutable customer tracking history', async () => {
    await database.exec(`
      INSERT INTO kitchen_tasks (
        id,
        tenant_id,
        outlet_id,
        order_id,
        order_line_id,
        station_id,
        recipe_version_id,
        sequence,
        status,
        item_name_snapshot,
        instructions_snapshot,
        expected_duration_seconds
      )
      VALUES (
        'tsk_alpha01',
        'ten_alpha01',
        'out_alpha01',
        'ord_alpha01',
        'oln_alpha01',
        'stn_alpha01',
        'rcp_alpha01',
        1,
        'queued',
        'Home-style thali',
        'Prepare fresh and serve hot',
        900
      );

      UPDATE kitchen_tasks
      SET status = 'ready_to_start', version = 2
      WHERE id = 'tsk_alpha01';

      INSERT INTO delivery_milestones (
        id,
        tenant_id,
        outlet_id,
        order_id,
        milestone_type,
        public_message,
        customer_visible,
        occurred_at,
        actor_type,
        actor_id,
        data,
        correlation_id
      )
      VALUES (
        'mil_alpha01',
        'ten_alpha01',
        'out_alpha01',
        'ord_alpha01',
        'order_placed',
        'Your order is placed',
        true,
        now(),
        'system',
        'order-service',
        '{}',
        'cor_order_alpha01'
      );

      INSERT INTO order_risk_snapshots (
        id,
        tenant_id,
        outlet_id,
        order_id,
        risk_probability,
        predicted_ready_at,
        promised_at,
        primary_constraint,
        evidence,
        algorithm_version
      )
      VALUES (
        'rsk_alpha01',
        'ten_alpha01',
        'out_alpha01',
        'ord_alpha01',
        0.72,
        now() + interval '30 minutes',
        now() + interval '25 minutes',
        'main_line_capacity',
        '[{"metric":"queue_depth","value":7,"source":"kitchen_tasks"}]',
        'risk-v1'
      );
    `);

    await expect(
      database.exec(`
        UPDATE kitchen_tasks
        SET status = 'completed',
            started_at = now(),
            completed_at = now(),
            version = 3
        WHERE id = 'tsk_alpha01'
      `),
    ).rejects.toThrow(/Illegal kitchen task transition/);

    await expect(
      database.exec(`
        UPDATE kitchen_tasks
        SET status = 'in_progress',
            started_at = now(),
            version = 4
        WHERE id = 'tsk_alpha01'
      `),
    ).rejects.toThrow(/version must increase by exactly one/);

    await expect(
      database.exec(`
        UPDATE delivery_milestones
        SET public_message = 'Changed after publication'
        WHERE id = 'mil_alpha01'
      `),
    ).rejects.toThrow(/append-only/);

    await expect(
      database.exec(`
        DELETE FROM order_risk_snapshots
        WHERE id = 'rsk_alpha01'
      `),
    ).rejects.toThrow(/append-only/);
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
