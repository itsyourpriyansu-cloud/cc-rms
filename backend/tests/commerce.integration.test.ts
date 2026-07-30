import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CommerceService,
  createPaymentProvider,
  readPaymentConfig,
  signPaymentWebhook,
} from '../src/commerce/index.js';
import { TrackingService } from '../src/tracking/index.js';

describe('persisted quote, payment and checkout flow', () => {
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
  const webhookSecret =
    'payment-webhook-secret-that-is-long-enough-for-integration';
  const provider = createPaymentProvider(
    readPaymentConfig({
      NODE_ENV: 'test',
      PAYMENT_PROVIDER: 'development',
      PAYMENT_WEBHOOK_SECRET: webhookSecret,
    }),
  );
  const service = new CommerceService(pool, provider);
  const trackingService = new TrackingService(pool);
  const authenticated = {
    tenantId: 'ten_alpha01',
    customerId: 'cus_alpha01',
    sessionId: 'ses_alpha_session01',
    profile: {
      id: 'cus_alpha01',
      phone: '9876543210',
      phoneE164: '+919876543210',
      firstName: 'Asha',
      dietaryPreference: 'vegetarian',
      spicePreference: 'medium',
      allergies: ['milk'],
      marketingConsent: false,
    },
  };
  const quoteInput = {
    outletId: 'out_alpha01',
    idempotencyKey: 'quote-checkout-flow-0001',
    fulfilment: {
      type: 'delivery' as const,
      address: {
        recipientName: 'Asha',
        phone: '9876543210',
        line1: '12 Test Road',
        city: 'Hyderabad',
        pincode: '500001',
        latitude: 17.4014,
        longitude: 78.4851,
      },
    },
    lines: [
      {
        itemId: 'itm_alpha01',
        quantity: 1,
        modifierOptionIds: ['mod_alpha01'],
      },
    ],
  };
  let quoteId = '';
  let quoteLineId = '';
  let paymentIntentId = '';
  let providerIntentReference = '';

  beforeAll(async () => {
    for (const migration of [
      '0001_maos_foundation.sql',
      '0002_customer_auth.sql',
      '0003_order_foundation.sql',
      '0004_checkout_api.sql',
      '0005_live_tracking.sql',
    ]) {
      await database.exec(
        await readFile(resolve(process.cwd(), 'migrations', migration), 'utf8'),
      );
    }
    await database.exec(`
      INSERT INTO tenants (id, legal_name, display_name, status)
      VALUES ('ten_alpha01', 'Alpha Kitchens Private Limited', 'Alpha Kitchens', 'active');

      INSERT INTO outlets (
        id, tenant_id, name, latitude, longitude, service_radius_km, status
      )
      VALUES ('out_alpha01', 'ten_alpha01', 'Alpha Central', 17.385044, 78.486671, 8, 'open');

      INSERT INTO customers (id, tenant_id, phone_e164, first_name)
      VALUES ('cus_alpha01', 'ten_alpha01', '+919876543210', 'Asha');

      INSERT INTO staff_users (
        id, tenant_id, phone_e164, display_name, status
      )
      VALUES (
        'usr_alpha01', 'ten_alpha01', '+919111111111', 'Kitchen Asha', 'active'
      );

      INSERT INTO user_outlet_roles (tenant_id, user_id, outlet_id, role)
      VALUES ('ten_alpha01', 'usr_alpha01', 'out_alpha01', 'kitchen');

      INSERT INTO brands (id, tenant_id, name, status)
      VALUES ('brd_alpha01', 'ten_alpha01', 'Mangamma', 'active');

      INSERT INTO menu_categories (id, tenant_id, brand_id, name, status)
      VALUES ('cat_alpha01', 'ten_alpha01', 'brd_alpha01', 'Home meals', 'active');

      INSERT INTO kitchen_stations (
        id, tenant_id, outlet_id, name, capacity_units, status
      )
      VALUES ('stn_alpha01', 'ten_alpha01', 'out_alpha01', 'Main line', 4, 'active');

      INSERT INTO menu_items (
        id, tenant_id, brand_id, category_id, name, dietary_type,
        allergen_facts, base_price_paise, status
      )
      VALUES (
        'itm_alpha01', 'ten_alpha01', 'brd_alpha01', 'cat_alpha01',
        'Home-style thali', 'vegetarian', '["milk"]', 30000, 'active'
      );

      INSERT INTO recipe_versions (
        id, tenant_id, item_id, station_id, version,
        expected_duration_seconds, instructions, status, published_at
      )
      VALUES (
        'rcp_alpha01', 'ten_alpha01', 'itm_alpha01', 'stn_alpha01',
        1, 900, 'Prepare fresh and serve hot', 'published', now()
      );

      INSERT INTO item_availability (
        tenant_id, outlet_id, item_id, status, available_quantity
      )
      VALUES ('ten_alpha01', 'out_alpha01', 'itm_alpha01', 'available', 20);

      INSERT INTO commerce_pricing_policies (
        id,
        tenant_id,
        outlet_id,
        name,
        tax_rate_bps,
        delivery_fee_paise,
        packaging_fee_paise,
        calculation_version,
        effective_from,
        status
      )
      VALUES (
        'prc_alpha01',
        'ten_alpha01',
        'out_alpha01',
        'Test food pricing',
        500,
        3000,
        1000,
        'test-food-tax-v1',
        now() - interval '1 day',
        'active'
      );

      INSERT INTO modifier_groups (
        id, tenant_id, name, minimum_selections, maximum_selections
      )
      VALUES ('mdg_alpha01', 'ten_alpha01', 'Protein add-on', 0, 1);

      INSERT INTO modifier_options (
        id, tenant_id, group_id, name, price_paise, status
      )
      VALUES (
        'mod_alpha01', 'ten_alpha01', 'mdg_alpha01',
        'Extra paneer', 5000, 'active'
      );

      INSERT INTO menu_item_modifier_groups (tenant_id, item_id, group_id)
      VALUES ('ten_alpha01', 'itm_alpha01', 'mdg_alpha01');
    `);
  });

  afterAll(async () => {
    await database.close();
  });

  it('calculates the quote from persisted menu facts and replays safely', async () => {
    const first = await service.createQuote(authenticated, quoteInput, {
      correlationId: 'cor_quote_flow_0001',
    });
    const replay = await service.createQuote(authenticated, quoteInput, {
      correlationId: 'cor_quote_flow_0002',
    });

    quoteId = first.id as string;
    quoteLineId = (first.lines as Array<{ lineId: string }>)[0]!.lineId;
    expect(first.pricing).toEqual({
      subtotalPaise: 35_000,
      discountPaise: 0,
      deliveryFeePaise: 3_000,
      packagingFeePaise: 1_000,
      taxPaise: 1_750,
      totalPaise: 40_750,
      calculationVersion: 'test-food-tax-v1',
    });
    expect(replay.id).toBe(quoteId);

    const counts = await database.query<{ quotes: number; events: number }>(`
      SELECT
        (SELECT count(*)::int FROM checkout_quotes) AS quotes,
        (SELECT count(*)::int FROM maos_events WHERE event_type = 'checkout.quote_created') AS events
    `);
    expect(counts.rows[0]).toEqual({ quotes: 1, events: 1 });

    await expect(
      database.exec(`
        UPDATE commerce_pricing_policies
        SET tax_rate_bps = 1800, version = 2
        WHERE id = 'prc_alpha01'
      `),
    ).rejects.toThrow(/Active pricing facts are immutable/);
  });

  it('rejects an idempotency key reused with different commercial input', async () => {
    await expect(
      service.createQuote(
        authenticated,
        {
          ...quoteInput,
          lines: [{ ...quoteInput.lines[0]!, quantity: 2 }],
        },
        { correlationId: 'cor_quote_conflict01' },
      ),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('creates one provider intent and verifies only a signed matching amount', async () => {
    const payment = await service.createPaymentIntent(
      authenticated,
      {
        quoteId,
        idempotencyKey: 'payment-checkout-flow-01',
      },
      { correlationId: 'cor_payment_flow01' },
    );
    const replay = await service.createPaymentIntent(
      authenticated,
      {
        quoteId,
        idempotencyKey: 'payment-checkout-flow-01',
      },
      { correlationId: 'cor_payment_flow02' },
    );
    paymentIntentId = payment.id as string;
    providerIntentReference = payment.providerIntentReference as string;
    expect(replay.id).toBe(paymentIntentId);

    const webhook = {
      eventId: 'provider-event-flow-0001',
      type: 'payment.verified' as const,
      tenantId: 'ten_alpha01',
      outletId: 'out_alpha01',
      providerIntentReference,
      providerPaymentReference: 'provider-payment-flow-0001',
      amountPaise: 40_750,
      currency: 'INR' as const,
      occurredAt: new Date().toISOString(),
    };
    await expect(
      service.applyPaymentWebhook(
        'development',
        { ...webhook, amountPaise: 1 },
        signPaymentWebhook(webhookSecret, webhook),
        { correlationId: 'cor_webhook_bad_01' },
      ),
    ).rejects.toMatchObject({ code: 'INVALID_PAYMENT_SIGNATURE' });

    await expect(
      service.applyPaymentWebhook(
        'development',
        webhook,
        signPaymentWebhook(webhookSecret, webhook),
        { correlationId: 'cor_webhook_good01' },
      ),
    ).resolves.toEqual({ accepted: true, duplicate: false });
    await expect(
      service.applyPaymentWebhook(
        'development',
        webhook,
        signPaymentWebhook(webhookSecret, webhook),
        { correlationId: 'cor_webhook_retry1' },
      ),
    ).resolves.toEqual({ accepted: true, duplicate: true });
  });

  it('commits the order, task, milestone and outbox exactly once', async () => {
    await expect(
      service.checkout(
        authenticated,
        {
          quoteId,
          paymentIntentId,
          idempotencyKey: 'checkout-missing-allergen-01',
          allergenAcknowledgements: {},
        },
        { correlationId: 'cor_checkout_allergen' },
      ),
    ).rejects.toMatchObject({
      code: 'ALLERGEN_ACKNOWLEDGEMENT_REQUIRED',
    });

    const checkoutInput = {
      quoteId,
      paymentIntentId,
      idempotencyKey: 'checkout-flow-idempotent-01',
      allergenAcknowledgements: {
        [quoteLineId]: ['milk'],
      },
    };
    const first = await service.checkout(authenticated, checkoutInput, {
      correlationId: 'cor_checkout_flow01',
    });
    const replay = await service.checkout(authenticated, checkoutInput, {
      correlationId: 'cor_checkout_flow02',
    });

    expect(first).toMatchObject({ status: 'placed', duplicate: false });
    expect(replay).toMatchObject({ id: first.id, duplicate: true });

    const counts = await database.query<{
      orders: number;
      tasks: number;
      milestones: number;
      events: number;
      outbox: number;
    }>(`
      SELECT
        (SELECT count(*)::int FROM orders) AS orders,
        (SELECT count(*)::int FROM kitchen_tasks) AS tasks,
        (SELECT count(*)::int FROM delivery_milestones) AS milestones,
        (SELECT count(*)::int FROM maos_events) AS events,
        (SELECT count(*)::int FROM outbox_events) AS outbox
    `);
    expect(counts.rows[0]).toEqual({
      orders: 1,
      tasks: 1,
      milestones: 1,
      events: 6,
      outbox: 6,
    });
  });

  it('projects kitchen work into customer milestones and live delivery tracking', async () => {
    const order = await database.query<{ id: string }>(
      'SELECT id FROM orders LIMIT 1',
    );
    const orderId = order.rows[0]!.id;
    const task = await database.query<{ id: string }>(
      'SELECT id FROM kitchen_tasks WHERE order_id = $1',
      [orderId],
    );
    const taskId = task.rows[0]!.id;
    const kitchenPrincipal = {
      tenantId: 'ten_alpha01',
      outletId: 'out_alpha01',
      actorId: 'usr_alpha01',
      role: 'kitchen' as const,
    };

    await trackingService.transitionKitchenTask(
      kitchenPrincipal,
      taskId,
      {
        outletId: 'out_alpha01',
        expectedVersion: 1,
        toStatus: 'ready_to_start',
      },
      { correlationId: 'cor_task_ready_0001' },
    );
    await trackingService.transitionKitchenTask(
      kitchenPrincipal,
      taskId,
      {
        outletId: 'out_alpha01',
        expectedVersion: 2,
        toStatus: 'in_progress',
      },
      { correlationId: 'cor_task_start_0001' },
    );
    await trackingService.transitionKitchenTask(
      kitchenPrincipal,
      taskId,
      {
        outletId: 'out_alpha01',
        expectedVersion: 3,
        toStatus: 'completed',
      },
      { correlationId: 'cor_task_done_00001' },
    );

    const readySnapshot = await trackingService.getCustomerSnapshot(
      authenticated,
      orderId,
      { correlationId: 'cor_snapshot_ready1' },
    );
    expect(readySnapshot).toMatchObject({
      status: 'ready',
      preparation: { totalTasks: 1, completedTasks: 1 },
      destination: {
        latitude: 17.4014,
        longitude: 78.4851,
      },
    });
    expect(readySnapshot.milestones.map((milestone) => milestone.type)).toEqual(
      expect.arrayContaining([
        'order_confirmed',
        'preparation_started',
        'quality_checked',
        'ready',
      ]),
    );

    const deliveryPrincipal = {
      tenantId: 'ten_alpha01',
      outletId: 'out_alpha01',
      actorId: 'partner_delivery01',
      role: 'delivery_partner' as const,
    };
    const assignedAt = new Date().toISOString();
    const assignment = await trackingService.assignDelivery(
      deliveryPrincipal,
      orderId,
      {
        outletId: 'out_alpha01',
        partnerName: 'Test Delivery',
        partnerAssignmentReference: 'partner-assignment-flow-1',
        riderDisplayName: 'Ravi K.',
        riderPhoneMasked: '******3210',
        vehicleLabelMasked: 'TS09 ** 2481',
        assignedAt,
      },
      { correlationId: 'cor_assign_rider01' },
    );
    await trackingService.updateDeliveryStatus(
      deliveryPrincipal,
      orderId,
      {
        outletId: 'out_alpha01',
        expectedVersion: assignment.version,
        toStatus: 'picked_up',
        occurredAt: new Date().toISOString(),
      },
      { correlationId: 'cor_pickup_rider01' },
    );
    const locationInput = {
      outletId: 'out_alpha01',
      providerEventId: 'provider-location-flow-0001',
      latitude: 17.392345,
      longitude: 78.486789,
      accuracyMetres: 24,
      headingDegrees: 18,
      speedKph: 22,
      recordedAt: new Date().toISOString(),
    };
    const firstLocation = await trackingService.recordDeliveryLocation(
      deliveryPrincipal,
      orderId,
      locationInput,
      { correlationId: 'cor_rider_location1' },
    );
    expect(firstLocation.duplicate).toBe(false);
    const duplicateLocation = await trackingService.recordDeliveryLocation(
      deliveryPrincipal,
      orderId,
      locationInput,
      { correlationId: 'cor_rider_location2' },
    );
    expect(duplicateLocation).toMatchObject({
      accepted: true,
      duplicate: true,
      visibility: 'exact',
    });
    const locationSignal = await database.query<{
      payload: { data: Record<string, unknown> };
    }>(
      `
        SELECT payload
        FROM outbox_events
        WHERE event_type = 'delivery.location_updated'
        ORDER BY sequence_id DESC
        LIMIT 1
      `,
    );
    expect(locationSignal.rows[0]?.payload.data).not.toHaveProperty('latitude');
    expect(locationSignal.rows[0]?.payload.data).not.toHaveProperty(
      'longitude',
    );

    const liveSnapshot = await trackingService.getCustomerSnapshot(
      authenticated,
      orderId,
      { correlationId: 'cor_snapshot_live01' },
    );
    expect(liveSnapshot).toMatchObject({
      status: 'picked_up',
      rider: {
        displayName: 'Ravi K.',
        phoneMasked: '******3210',
        locationSharingEnabled: true,
        position: {
          latitude: 17.392345,
          longitude: 78.486789,
          freshness: 'live',
        },
      },
    });
    const streamed = await trackingService.listCustomerEvents(
      authenticated,
      orderId,
      readySnapshot.latestSequence,
      { correlationId: 'cor_stream_events01' },
    );
    expect(streamed.events.map((trackedEvent) => trackedEvent.type)).toContain(
      'delivery.location_updated',
    );

    await trackingService.updateDeliveryStatus(
      deliveryPrincipal,
      orderId,
      {
        outletId: 'out_alpha01',
        expectedVersion: 2,
        toStatus: 'delivered',
        occurredAt: new Date().toISOString(),
      },
      { correlationId: 'cor_delivered_0001' },
    );
    const deliveredSnapshot = await trackingService.getCustomerSnapshot(
      authenticated,
      orderId,
      { correlationId: 'cor_snapshot_done01' },
    );
    expect(deliveredSnapshot).toMatchObject({
      status: 'delivered',
      rider: {
        status: 'delivered',
        locationSharingEnabled: false,
        position: null,
      },
    });
    const afterDeliveryEvents = await trackingService.listCustomerEvents(
      authenticated,
      orderId,
      readySnapshot.latestSequence,
      { correlationId: 'cor_stream_after_done01' },
    );
    expect(
      afterDeliveryEvents.events.map((trackedEvent) => trackedEvent.type),
    ).not.toContain('delivery.location_updated');
  });
});
