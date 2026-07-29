import { createHash } from 'node:crypto';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type { AuthenticatedCustomer } from '../auth/index.js';
import { createOpaqueId } from '../auth/crypto.js';
import {
  DeliveryMilestoneRecordedEventDataSchema,
  KitchenTaskCreatedEventDataSchema,
  OrderPlacedEventDataSchema,
  PaymentFailedEventDataSchema,
  PaymentIntentCreatedEventDataSchema,
  PaymentVerifiedEventDataSchema,
  QuoteCreatedEventDataSchema,
  type MaosEvent,
} from '../contracts/index.js';
import { appendEventToOutbox, withTenantTransaction } from '../database/index.js';
import { CommerceError } from './errors.js';
import type { PaymentProvider } from './provider.js';
import type {
  CheckoutBody,
  CreatePaymentIntentBody,
  CreateQuoteBody,
} from './schemas.js';

type RequestMetadata = {
  correlationId: string;
};

type ItemRow = QueryResultRow & {
  id: string;
  name: string;
  base_price_paise: number;
  version: number;
  allergen_facts: unknown;
  recipe_version_id: string;
  station_id: string;
  expected_duration_seconds: number;
  instructions: string;
  available_quantity: number | null;
  availability_status: string;
};

type ModifierRow = QueryResultRow & {
  item_id: string;
  group_id: string;
  minimum_selections: number;
  maximum_selections: number;
  option_id: string | null;
  option_name: string | null;
  price_paise: number | null;
};

type PricingPolicyRow = QueryResultRow & {
  tax_rate_bps: number;
  delivery_fee_paise: number;
  packaging_fee_paise: number;
  calculation_version: string;
};

type QuoteRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  outlet_id: string;
  customer_id: string;
  idempotency_key: string;
  request_fingerprint: string;
  status: string;
  fulfilment_type: string;
  fulfilment_snapshot: Record<string, unknown>;
  currency: 'INR';
  subtotal_paise: number;
  discount_paise: number;
  delivery_fee_paise: number;
  packaging_fee_paise: number;
  tax_paise: number;
  total_paise: number;
  calculation_version: string;
  expires_at: Date | string;
  consumed_at: Date | string | null;
  version: number;
  created_at: Date | string;
};

type QuoteLineRow = QueryResultRow & {
  id: string;
  quote_id: string;
  item_id: string;
  item_version: number;
  recipe_version_id: string;
  item_name_snapshot: string;
  quantity: number;
  unit_price_paise: number;
  modifier_total_paise: number;
  line_total_paise: number;
  modifiers_snapshot: Array<Record<string, unknown>>;
  allergen_snapshot: string[];
  station_id?: string;
  expected_duration_seconds?: number;
  instructions?: string;
};

type PaymentRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  outlet_id: string;
  quote_id: string;
  provider: string;
  provider_intent_reference: string;
  provider_payment_reference: string | null;
  provider_event_id: string | null;
  provider_client_payload: Record<string, unknown>;
  idempotency_key: string;
  request_fingerprint: string;
  status: string;
  amount_paise: number;
  currency: 'INR';
  verified_at: Date | string | null;
  version: number;
  created_at: Date | string;
  updated_at: Date | string;
};

const asIso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const fingerprint = (input: unknown): string =>
  createHash('sha256').update(JSON.stringify(input)).digest('hex');

const event = (input: {
  type: string;
  source: string;
  tenantId: string;
  outletId: string;
  subjectType: string;
  subjectId: string;
  correlationId: string;
  idempotencyKey: string;
  dataClass?: MaosEvent['data_class'];
  data: Record<string, unknown>;
}): MaosEvent => ({
  specversion: '1.0',
  type: input.type,
  source: input.source,
  id: createOpaqueId('evt'),
  time: new Date().toISOString(),
  subject: `tenant/${input.tenantId}/outlet/${input.outletId}/${input.subjectType}/${input.subjectId}`,
  datacontenttype: 'application/json',
  tenant_id: input.tenantId,
  outlet_id: input.outletId,
  correlation_id: input.correlationId,
  causation_id: null,
  idempotency_key: input.idempotencyKey,
  schema_version: '1.0',
  data_class: input.dataClass ?? 'operational',
  consent_ref: null,
  data: input.data,
});

const quoteResponse = async (
  client: PoolClient,
  quote: QuoteRow,
): Promise<Record<string, unknown>> => {
  const lines = await client.query<QuoteLineRow>(
    `
      SELECT *
      FROM checkout_quote_lines
      WHERE tenant_id = $1 AND quote_id = $2
      ORDER BY created_at, id
    `,
    [quote.tenant_id, quote.id],
  );

  return {
    id: quote.id,
    outletId: quote.outlet_id,
    status: quote.status,
    fulfilmentType: quote.fulfilment_type,
    fulfilment: quote.fulfilment_snapshot,
    currency: quote.currency,
    lines: lines.rows.map((line) => ({
      lineId: line.id,
      itemId: line.item_id,
      itemVersion: line.item_version,
      recipeVersionId: line.recipe_version_id,
      itemName: line.item_name_snapshot,
      quantity: line.quantity,
      unitPricePaise: line.unit_price_paise,
      modifierTotalPaise: line.modifier_total_paise,
      lineTotalPaise: line.line_total_paise,
      modifiers: line.modifiers_snapshot,
      allergens: line.allergen_snapshot,
    })),
    pricing: {
      subtotalPaise: quote.subtotal_paise,
      discountPaise: quote.discount_paise,
      deliveryFeePaise: quote.delivery_fee_paise,
      packagingFeePaise: quote.packaging_fee_paise,
      taxPaise: quote.tax_paise,
      totalPaise: quote.total_paise,
      calculationVersion: quote.calculation_version,
    },
    expiresAt: asIso(quote.expires_at),
    version: quote.version,
  };
};

const paymentResponse = (payment: PaymentRow): Record<string, unknown> => ({
  id: payment.id,
  quoteId: payment.quote_id,
  provider: payment.provider,
  providerIntentReference: payment.provider_intent_reference,
  status: payment.status,
  amountPaise: payment.amount_paise,
  currency: payment.currency,
  clientPayload: payment.provider_client_payload,
  verifiedAt: payment.verified_at ? asIso(payment.verified_at) : null,
  version: payment.version,
});

const lockIdempotencyKey = async (
  client: PoolClient,
  scope: string,
  tenantId: string,
  customerId: string,
  key: string,
): Promise<void> => {
  await client.query(
    'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
    [`${scope}:${tenantId}:${customerId}:${key}`],
  );
};

export class CommerceService {
  constructor(
    private readonly pool: Pool,
    private readonly paymentProvider: PaymentProvider,
  ) {}

  async createQuote(
    authenticated: AuthenticatedCustomer,
    input: CreateQuoteBody,
    metadata: RequestMetadata,
  ): Promise<Record<string, unknown>> {
    const requestFingerprint = fingerprint(input);

    return withTenantTransaction(
      this.pool,
      {
        tenantId: authenticated.tenantId,
        correlationId: metadata.correlationId,
      },
      async (client) => {
        await lockIdempotencyKey(
          client,
          'quote',
          authenticated.tenantId,
          authenticated.customerId,
          input.idempotencyKey,
        );
        const existing = await client.query<QuoteRow>(
          `
            SELECT *
            FROM checkout_quotes
            WHERE tenant_id = $1
              AND customer_id = $2
              AND idempotency_key = $3
          `,
          [
            authenticated.tenantId,
            authenticated.customerId,
            input.idempotencyKey,
          ],
        );
        const priorQuote = existing.rows[0];
        if (priorQuote) {
          if (priorQuote.request_fingerprint !== requestFingerprint) {
            throw new CommerceError(
              'IDEMPOTENCY_CONFLICT',
              409,
              'This request key was already used with different quote details',
            );
          }
          return quoteResponse(client, priorQuote);
        }

        const itemIds = input.lines.map((line) => line.itemId);
        const pricingPolicy = await client.query<PricingPolicyRow>(
          `
            SELECT
              tax_rate_bps,
              delivery_fee_paise,
              packaging_fee_paise,
              calculation_version
            FROM commerce_pricing_policies
            WHERE tenant_id = $1
              AND outlet_id = $2
              AND status = 'active'
              AND effective_from <= now()
              AND (effective_until IS NULL OR effective_until > now())
          `,
          [authenticated.tenantId, input.outletId],
        );
        const policy = pricingPolicy.rows[0];
        if (!policy) {
          throw new CommerceError(
            'PRICING_UNAVAILABLE',
            503,
            'Pricing is temporarily unavailable for this kitchen',
          );
        }

        const items = await client.query<ItemRow>(
          `
            SELECT
              item.id,
              item.name,
              item.base_price_paise,
              item.version,
              item.allergen_facts,
              recipe.id AS recipe_version_id,
              recipe.station_id,
              recipe.expected_duration_seconds,
              recipe.instructions,
              availability.available_quantity,
              availability.status AS availability_status
            FROM menu_items item
            JOIN brands brand
              ON brand.tenant_id = item.tenant_id
             AND brand.id = item.brand_id
             AND brand.status = 'active'
            JOIN menu_categories category
              ON category.tenant_id = item.tenant_id
             AND category.id = item.category_id
             AND category.status = 'active'
            JOIN recipe_versions recipe
              ON recipe.tenant_id = item.tenant_id
             AND recipe.item_id = item.id
             AND recipe.status = 'published'
            JOIN item_availability availability
              ON availability.tenant_id = item.tenant_id
             AND availability.outlet_id = $2
             AND availability.item_id = item.id
            WHERE item.tenant_id = $1
              AND item.id = ANY($3::text[])
              AND item.status = 'active'
          `,
          [authenticated.tenantId, input.outletId, itemIds],
        );

        const outlet = await client.query<{ id: string }>(
          `
            SELECT id
            FROM outlets
            WHERE tenant_id = $1 AND id = $2 AND status = 'open'
          `,
          [authenticated.tenantId, input.outletId],
        );
        if (!outlet.rows[0]) {
          throw new CommerceError(
            'OUTLET_UNAVAILABLE',
            409,
            'This kitchen is not accepting orders',
          );
        }

        const itemById = new Map(items.rows.map((item) => [item.id, item]));
        if (itemById.size !== itemIds.length) {
          throw new CommerceError(
            'MENU_CHANGED',
            409,
            'One or more dishes are no longer available',
          );
        }

        const modifiers = await client.query<ModifierRow>(
          `
            SELECT
              link.item_id,
              modifier_group.id AS group_id,
              modifier_group.minimum_selections,
              modifier_group.maximum_selections,
              modifier_option.id AS option_id,
              modifier_option.name AS option_name,
              modifier_option.price_paise
            FROM menu_item_modifier_groups link
            JOIN modifier_groups modifier_group
              ON modifier_group.tenant_id = link.tenant_id
             AND modifier_group.id = link.group_id
            LEFT JOIN modifier_options modifier_option
              ON modifier_option.tenant_id = modifier_group.tenant_id
             AND modifier_option.group_id = modifier_group.id
             AND modifier_option.status = 'active'
            WHERE link.tenant_id = $1
              AND link.item_id = ANY($2::text[])
            ORDER BY link.item_id, modifier_group.id, modifier_option.id
          `,
          [authenticated.tenantId, itemIds],
        );

        const quoteId = createOpaqueId('qte');
        const createdAt = new Date();
        const expiresAt = new Date(createdAt.getTime() + 10 * 60 * 1_000);
        const calculatedLines: Array<{
          id: string;
          item: ItemRow;
          quantity: number;
          modifiers: Array<{
            modifierId: string;
            nameSnapshot: string;
            pricePaise: number;
          }>;
          modifierTotalPaise: number;
          lineTotalPaise: number;
        }> = [];

        for (const requestedLine of input.lines) {
          const item = itemById.get(requestedLine.itemId)!;
          if (
            !['available', 'limited'].includes(item.availability_status) ||
            (item.available_quantity !== null &&
              item.available_quantity < requestedLine.quantity)
          ) {
            throw new CommerceError(
              'ITEM_UNAVAILABLE',
              409,
              `${item.name} is not available in the requested quantity`,
            );
          }

          const groupRows = modifiers.rows.filter(
            (row) => row.item_id === requestedLine.itemId,
          );
          const groupIds = [...new Set(groupRows.map((row) => row.group_id))];
          const selected = groupRows.filter(
            (row) =>
              row.option_id !== null &&
              requestedLine.modifierOptionIds.includes(row.option_id),
          );
          if (selected.length !== requestedLine.modifierOptionIds.length) {
            throw new CommerceError(
              'INVALID_MODIFIER',
              409,
              `A selected option is not available for ${item.name}`,
            );
          }

          for (const groupId of groupIds) {
            const definition = groupRows.find((row) => row.group_id === groupId)!;
            const selectionCount = selected.filter(
              (row) => row.group_id === groupId,
            ).length;
            if (
              selectionCount < definition.minimum_selections ||
              selectionCount > definition.maximum_selections
            ) {
              throw new CommerceError(
                'INVALID_MODIFIER_SELECTION',
                409,
                `Choose the required options for ${item.name}`,
              );
            }
          }

          const modifierSnapshots = selected.map((row) => ({
            modifierId: row.option_id!,
            nameSnapshot: row.option_name!,
            pricePaise: row.price_paise!,
          }));
          const modifierTotalPaise = modifierSnapshots.reduce(
            (total, modifier) => total + modifier.pricePaise,
            0,
          );
          calculatedLines.push({
            id: createOpaqueId('qln'),
            item,
            quantity: requestedLine.quantity,
            modifiers: modifierSnapshots,
            modifierTotalPaise,
            lineTotalPaise:
              requestedLine.quantity *
              (item.base_price_paise + modifierTotalPaise),
          });
        }

        const subtotalPaise = calculatedLines.reduce(
          (total, line) => total + line.lineTotalPaise,
          0,
        );
        const discountPaise = 0;
        const deliveryFeePaise =
          input.fulfilment.type === 'delivery' ? policy.delivery_fee_paise : 0;
        const packagingFeePaise = policy.packaging_fee_paise;
        const taxPaise = Math.round(
          ((subtotalPaise - discountPaise) * policy.tax_rate_bps) / 10_000,
        );
        const totalPaise =
          subtotalPaise -
          discountPaise +
          deliveryFeePaise +
          packagingFeePaise +
          taxPaise;

        const quoteInsert = await client.query<QuoteRow>(
          `
            INSERT INTO checkout_quotes (
              id,
              tenant_id,
              outlet_id,
              customer_id,
              idempotency_key,
              request_fingerprint,
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
              $1, $2, $3, $4, $5, $6, 'active', $7, $8::jsonb,
              $9, $10, $11, $12, $13, $14, $15, $16, $17
            )
            RETURNING *
          `,
          [
            quoteId,
            authenticated.tenantId,
            input.outletId,
            authenticated.customerId,
            input.idempotencyKey,
            requestFingerprint,
            input.fulfilment.type,
            JSON.stringify(input.fulfilment),
            subtotalPaise,
            discountPaise,
            deliveryFeePaise,
            packagingFeePaise,
            taxPaise,
            totalPaise,
            policy.calculation_version,
            expiresAt.toISOString(),
            createdAt.toISOString(),
          ],
        );

        for (const line of calculatedLines) {
          await client.query(
            `
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
                modifier_total_paise,
                line_total_paise,
                modifiers_snapshot,
                allergen_snapshot
              )
              VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb
              )
            `,
            [
              line.id,
              authenticated.tenantId,
              quoteId,
              line.item.id,
              line.item.version,
              line.item.recipe_version_id,
              line.item.name,
              line.quantity,
              line.item.base_price_paise,
              line.modifierTotalPaise,
              line.lineTotalPaise,
              JSON.stringify(line.modifiers),
              JSON.stringify(line.item.allergen_facts),
            ],
          );
        }

        await appendEventToOutbox(
          client,
          event({
            type: 'checkout.quote_created',
            source: 'rms/commerce',
            tenantId: authenticated.tenantId,
            outletId: input.outletId,
            subjectType: 'quote',
            subjectId: quoteId,
            correlationId: metadata.correlationId,
            idempotencyKey: `quote:${quoteId}:created`,
            data: QuoteCreatedEventDataSchema.parse({
              quoteId,
              outletId: input.outletId,
              expiresAt: expiresAt.toISOString(),
              totalPaise,
              currency: 'INR',
              lineCount: calculatedLines.length,
            }),
          }),
        );

        return quoteResponse(client, quoteInsert.rows[0]!);
      },
    );
  }

  async createPaymentIntent(
    authenticated: AuthenticatedCustomer,
    input: CreatePaymentIntentBody,
    metadata: RequestMetadata,
  ): Promise<Record<string, unknown>> {
    const requestFingerprint = fingerprint(input);
    const preparation = await withTenantTransaction(
      this.pool,
      {
        tenantId: authenticated.tenantId,
        correlationId: metadata.correlationId,
      },
      async (client) => {
        await lockIdempotencyKey(
          client,
          'payment',
          authenticated.tenantId,
          authenticated.customerId,
          input.idempotencyKey,
        );
        const existing = await client.query<PaymentRow>(
          `
            SELECT *
            FROM payment_intents
            WHERE tenant_id = $1 AND idempotency_key = $2
          `,
          [authenticated.tenantId, input.idempotencyKey],
        );
        const prior = existing.rows[0];
        if (prior) {
          if (prior.request_fingerprint !== requestFingerprint) {
            throw new CommerceError(
              'IDEMPOTENCY_CONFLICT',
              409,
              'This request key was already used for another payment',
            );
          }
          return { existing: prior, quote: null };
        }

        const quote = await client.query<QuoteRow>(
          `
            SELECT *
            FROM checkout_quotes
            WHERE tenant_id = $1 AND customer_id = $2 AND id = $3
          `,
          [authenticated.tenantId, authenticated.customerId, input.quoteId],
        );
        const current = quote.rows[0];
        if (
          !current ||
          current.status !== 'active' ||
          new Date(current.expires_at) <= new Date()
        ) {
          throw new CommerceError(
            'QUOTE_UNAVAILABLE',
            409,
            'The quote has expired or is no longer available',
          );
        }
        return { existing: null, quote: current };
      },
    );

    if (preparation.existing) return paymentResponse(preparation.existing);
    const quote = preparation.quote!;
    const paymentIntentId = createOpaqueId('pay');
    const providerIntent = await this.paymentProvider.createIntent({
      paymentIntentId,
      tenantId: authenticated.tenantId,
      outletId: quote.outlet_id,
      quoteId: quote.id,
      amountPaise: quote.total_paise,
      currency: quote.currency,
      idempotencyKey: input.idempotencyKey,
    });

    return withTenantTransaction(
      this.pool,
      {
        tenantId: authenticated.tenantId,
        correlationId: metadata.correlationId,
      },
      async (client) => {
        await lockIdempotencyKey(
          client,
          'payment',
          authenticated.tenantId,
          authenticated.customerId,
          input.idempotencyKey,
        );
        const raced = await client.query<PaymentRow>(
          `
            SELECT *
            FROM payment_intents
            WHERE tenant_id = $1 AND idempotency_key = $2
          `,
          [authenticated.tenantId, input.idempotencyKey],
        );
        const prior = raced.rows[0];
        if (prior) {
          if (prior.request_fingerprint !== requestFingerprint) {
            throw new CommerceError(
              'IDEMPOTENCY_CONFLICT',
              409,
              'This request key was already used for another payment',
            );
          }
          return paymentResponse(prior);
        }

        const inserted = await client.query<PaymentRow>(
          `
            INSERT INTO payment_intents (
              id,
              tenant_id,
              outlet_id,
              quote_id,
              provider,
              provider_intent_reference,
              idempotency_key,
              request_fingerprint,
              status,
              amount_paise,
              currency,
              provider_client_payload
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, $11::jsonb
            )
            RETURNING *
          `,
          [
            paymentIntentId,
            authenticated.tenantId,
            quote.outlet_id,
            quote.id,
            this.paymentProvider.name,
            providerIntent.providerIntentReference,
            input.idempotencyKey,
            requestFingerprint,
            quote.total_paise,
            quote.currency,
            JSON.stringify(providerIntent.clientPayload),
          ],
        );

        await appendEventToOutbox(
          client,
          event({
            type: 'payment.intent_created',
            source: 'rms/commerce',
            tenantId: authenticated.tenantId,
            outletId: quote.outlet_id,
            subjectType: 'payment',
            subjectId: paymentIntentId,
            correlationId: metadata.correlationId,
            idempotencyKey: `payment:${paymentIntentId}:created`,
            dataClass: 'financial',
            data: PaymentIntentCreatedEventDataSchema.parse({
              paymentIntentId,
              quoteId: quote.id,
              amountPaise: quote.total_paise,
              provider: this.paymentProvider.name,
              providerIntentReference: providerIntent.providerIntentReference,
            }),
          }),
        );

        return paymentResponse(inserted.rows[0]!);
      },
    );
  }

  async applyPaymentWebhook(
    providerName: string,
    body: unknown,
    signature: string | undefined,
    metadata: RequestMetadata,
  ): Promise<{ accepted: true; duplicate: boolean }> {
    if (providerName !== this.paymentProvider.name) {
      throw new CommerceError(
        'PAYMENT_PROVIDER_NOT_FOUND',
        404,
        'Payment provider is not configured',
      );
    }

    let verified;
    try {
      verified = this.paymentProvider.verifyWebhook(body, signature);
    } catch {
      throw new CommerceError(
        'INVALID_PAYMENT_SIGNATURE',
        401,
        'Payment signature could not be verified',
      );
    }

    return withTenantTransaction(
      this.pool,
      {
        tenantId: verified.tenantId,
        correlationId: metadata.correlationId,
      },
      async (client) => {
        const result = await client.query<PaymentRow>(
          `
            SELECT *
            FROM payment_intents
            WHERE tenant_id = $1
              AND outlet_id = $2
              AND provider = $3
              AND provider_intent_reference = $4
            FOR UPDATE
          `,
          [
            verified.tenantId,
            verified.outletId,
            providerName,
            verified.providerIntentReference,
          ],
        );
        const payment = result.rows[0];
        if (!payment) {
          throw new CommerceError(
            'PAYMENT_NOT_FOUND',
            404,
            'Payment intent was not found',
          );
        }
        if (payment.provider_event_id === verified.eventId) {
          return { accepted: true, duplicate: true };
        }
        if (
          payment.amount_paise !== verified.amountPaise ||
          payment.currency !== verified.currency
        ) {
          throw new CommerceError(
            'PAYMENT_AMOUNT_MISMATCH',
            409,
            'Provider payment does not match the quoted amount',
          );
        }
        if (payment.status === 'verified') {
          if (
            payment.provider_payment_reference ===
            verified.providerPaymentReference
          ) {
            return { accepted: true, duplicate: true };
          }
          throw new CommerceError(
            'PAYMENT_ALREADY_VERIFIED',
            409,
            'Payment was already verified with another provider reference',
          );
        }
        if (payment.status !== 'pending') {
          throw new CommerceError(
            'PAYMENT_TERMINAL',
            409,
            'Payment is already in a terminal state',
          );
        }

        const nextStatus =
          verified.type === 'payment.verified' ? 'verified' : 'failed';
        await client.query(
          `
            UPDATE payment_intents
            SET
              status = $5,
              provider_payment_reference = $6,
              provider_event_id = $7,
              failure_code = $8,
              verified_at = CASE
                WHEN $5 = 'verified' THEN $9::timestamptz
                ELSE NULL
              END,
              version = version + 1
            WHERE tenant_id = $1
              AND outlet_id = $2
              AND provider = $3
              AND id = $4
          `,
          [
            verified.tenantId,
            verified.outletId,
            providerName,
            payment.id,
            nextStatus,
            verified.providerPaymentReference ?? null,
            verified.eventId,
            verified.failureCode ?? null,
            verified.occurredAt,
          ],
        );

        await appendEventToOutbox(
          client,
          event({
            type: verified.type,
            source: 'rms/payment-adapter',
            tenantId: verified.tenantId,
            outletId: verified.outletId,
            subjectType: 'payment',
            subjectId: payment.id,
            correlationId: metadata.correlationId,
            idempotencyKey: `payment:${providerName}:${verified.eventId}`,
            dataClass: 'financial',
            data:
              verified.type === 'payment.verified'
                ? PaymentVerifiedEventDataSchema.parse({
                    paymentIntentId: payment.id,
                    quoteId: payment.quote_id,
                    amountPaise: payment.amount_paise,
                    provider: providerName,
                    providerReference: verified.providerPaymentReference!,
                  })
                : PaymentFailedEventDataSchema.parse({
                    paymentIntentId: payment.id,
                    quoteId: payment.quote_id,
                    amountPaise: payment.amount_paise,
                    provider: providerName,
                    providerReference: payment.provider_intent_reference,
                    failureCode: verified.failureCode!,
                  }),
          }),
        );

        return { accepted: true, duplicate: false };
      },
    );
  }

  async checkout(
    authenticated: AuthenticatedCustomer,
    input: CheckoutBody,
    metadata: RequestMetadata,
  ): Promise<Record<string, unknown>> {
    return withTenantTransaction(
      this.pool,
      {
        tenantId: authenticated.tenantId,
        correlationId: metadata.correlationId,
      },
      async (client) => {
        await lockIdempotencyKey(
          client,
          'checkout',
          authenticated.tenantId,
          authenticated.customerId,
          input.idempotencyKey,
        );
        const existing = await client.query<{
          id: string;
          quote_id: string;
          payment_intent_id: string;
          status: string;
          promised_at: Date | string;
        }>(
          `
            SELECT id, quote_id, payment_intent_id, status, promised_at
            FROM orders
            WHERE tenant_id = $1
              AND customer_id = $2
              AND checkout_idempotency_key = $3
          `,
          [
            authenticated.tenantId,
            authenticated.customerId,
            input.idempotencyKey,
          ],
        );
        const priorOrder = existing.rows[0];
        if (priorOrder) {
          if (
            priorOrder.quote_id !== input.quoteId ||
            priorOrder.payment_intent_id !== input.paymentIntentId
          ) {
            throw new CommerceError(
              'IDEMPOTENCY_CONFLICT',
              409,
              'This request key was already used for another checkout',
            );
          }
          return {
            id: priorOrder.id,
            quoteId: priorOrder.quote_id,
            paymentIntentId: priorOrder.payment_intent_id,
            status: priorOrder.status,
            promisedAt: asIso(priorOrder.promised_at),
            duplicate: true,
          };
        }

        const quoteResult = await client.query<QuoteRow>(
          `
            SELECT *
            FROM checkout_quotes
            WHERE tenant_id = $1 AND customer_id = $2 AND id = $3
            FOR UPDATE
          `,
          [authenticated.tenantId, authenticated.customerId, input.quoteId],
        );
        const quote = quoteResult.rows[0];
        if (
          !quote ||
          quote.status !== 'active' ||
          new Date(quote.expires_at) <= new Date()
        ) {
          throw new CommerceError(
            'QUOTE_UNAVAILABLE',
            409,
            'The quote has expired or was already used',
          );
        }

        const paymentResult = await client.query<PaymentRow>(
          `
            SELECT *
            FROM payment_intents
            WHERE tenant_id = $1 AND id = $2 AND quote_id = $3
            FOR SHARE
          `,
          [authenticated.tenantId, input.paymentIntentId, input.quoteId],
        );
        const payment = paymentResult.rows[0];
        if (
          !payment ||
          payment.status !== 'verified' ||
          payment.amount_paise !== quote.total_paise
        ) {
          throw new CommerceError(
            'PAYMENT_NOT_VERIFIED',
            409,
            'Payment has not been verified for this exact quote',
          );
        }

        const quoteLines = await client.query<QuoteLineRow>(
          `
            SELECT
              quote_line.*,
              recipe.station_id,
              recipe.expected_duration_seconds,
              recipe.instructions
            FROM checkout_quote_lines quote_line
            JOIN recipe_versions recipe
              ON recipe.tenant_id = quote_line.tenant_id
             AND recipe.id = quote_line.recipe_version_id
            WHERE quote_line.tenant_id = $1
              AND quote_line.quote_id = $2
            ORDER BY quote_line.created_at, quote_line.id
          `,
          [authenticated.tenantId, quote.id],
        );
        if (quoteLines.rows.length === 0) {
          throw new CommerceError(
            'EMPTY_QUOTE',
            409,
            'The quote does not contain any dishes',
          );
        }

        const maximumPreparationSeconds = Math.max(
          ...quoteLines.rows.map((line) => line.expected_duration_seconds!),
        );
        const promisedAt = new Date(
          Date.now() + (maximumPreparationSeconds + 15 * 60) * 1_000,
        );
        const orderId = createOpaqueId('ord');
        const placedAt = new Date();

        await client.query(
          `
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
              total_paise,
              promised_at,
              placed_at
            )
            VALUES (
              $1, $2, $3, $4, 'customer_app', 'placed', $5, $6, $7, $8,
              $9::jsonb, $10, $11, $12, $13, $14, $15, $16, $17, $18
            )
          `,
          [
            orderId,
            authenticated.tenantId,
            quote.outlet_id,
            authenticated.customerId,
            quote.id,
            payment.id,
            input.idempotencyKey,
            quote.fulfilment_type,
            JSON.stringify(quote.fulfilment_snapshot),
            quote.calculation_version,
            quote.subtotal_paise,
            quote.discount_paise,
            quote.delivery_fee_paise,
            quote.packaging_fee_paise,
            quote.tax_paise,
            quote.total_paise,
            promisedAt.toISOString(),
            placedAt.toISOString(),
          ],
        );

        const taskEvents: Array<{
          taskId: string;
          stationId: string;
          sequence: number;
          expectedDurationSeconds: number;
        }> = [];
        for (const [index, quoteLine] of quoteLines.rows.entries()) {
          const acknowledgedAllergens =
            input.allergenAcknowledgements[quoteLine.id] ?? [];
          if (
            quoteLine.allergen_snapshot.some(
              (allergen) => !acknowledgedAllergens.includes(allergen),
            )
          ) {
            throw new CommerceError(
              'ALLERGEN_ACKNOWLEDGEMENT_REQUIRED',
              409,
              `Review the allergen information for ${quoteLine.item_name_snapshot}`,
            );
          }

          const orderLineId = createOpaqueId('oln');
          const taskId = createOpaqueId('tsk');
          await client.query(
            `
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
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13
              )
            `,
            [
              orderLineId,
              authenticated.tenantId,
              orderId,
              quoteLine.item_id,
              quoteLine.id,
              quoteLine.item_version,
              quoteLine.recipe_version_id,
              quoteLine.item_name_snapshot,
              quoteLine.quantity,
              quoteLine.unit_price_paise,
              JSON.stringify(quoteLine.modifiers_snapshot),
              JSON.stringify(acknowledgedAllergens),
              quoteLine.instructions ?? '',
            ],
          );
          await client.query(
            `
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
                modifier_snapshot,
                allergen_snapshot,
                expected_duration_seconds
              )
              VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, 'queued', $9, $10,
                $11::jsonb, $12::jsonb, $13
              )
            `,
            [
              taskId,
              authenticated.tenantId,
              quote.outlet_id,
              orderId,
              orderLineId,
              quoteLine.station_id!,
              quoteLine.recipe_version_id,
              index + 1,
              quoteLine.item_name_snapshot,
              quoteLine.instructions ?? '',
              JSON.stringify(quoteLine.modifiers_snapshot),
              JSON.stringify(quoteLine.allergen_snapshot),
              quoteLine.expected_duration_seconds!,
            ],
          );
          taskEvents.push({
            taskId,
            stationId: quoteLine.station_id!,
            sequence: index + 1,
            expectedDurationSeconds: quoteLine.expected_duration_seconds!,
          });
        }

        const milestoneId = createOpaqueId('mil');
        await client.query(
          `
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
              $1, $2, $3, $4, 'order_placed', 'Your order is confirmed',
              true, $5, 'customer', $6, '{}'::jsonb, $7
            )
          `,
          [
            milestoneId,
            authenticated.tenantId,
            quote.outlet_id,
            orderId,
            placedAt.toISOString(),
            authenticated.customerId,
            metadata.correlationId,
          ],
        );

        await appendEventToOutbox(
          client,
          event({
            type: 'order.placed',
            source: 'rms/order-core',
            tenantId: authenticated.tenantId,
            outletId: quote.outlet_id,
            subjectType: 'order',
            subjectId: orderId,
            correlationId: metadata.correlationId,
            idempotencyKey: `order:${orderId}:placed`,
            data: OrderPlacedEventDataSchema.parse({
              orderId,
              quoteId: quote.id,
              paymentIntentId: payment.id,
              promisedAt: promisedAt.toISOString(),
              taskCount: taskEvents.length,
            }),
          }),
        );
        for (const task of taskEvents) {
          await appendEventToOutbox(
            client,
            event({
              type: 'kitchen.task_created',
              source: 'rms/order-core',
              tenantId: authenticated.tenantId,
              outletId: quote.outlet_id,
              subjectType: 'order',
              subjectId: orderId,
              correlationId: metadata.correlationId,
              idempotencyKey: `task:${task.taskId}:created`,
              data: KitchenTaskCreatedEventDataSchema.parse({
                orderId,
                taskId: task.taskId,
                stationId: task.stationId,
                sequence: task.sequence,
                expectedDurationSeconds: task.expectedDurationSeconds,
              }),
            }),
          );
        }
        await appendEventToOutbox(
          client,
          event({
            type: 'delivery.milestone_recorded',
            source: 'rms/order-core',
            tenantId: authenticated.tenantId,
            outletId: quote.outlet_id,
            subjectType: 'order',
            subjectId: orderId,
            correlationId: metadata.correlationId,
            idempotencyKey: `milestone:${milestoneId}`,
            data: DeliveryMilestoneRecordedEventDataSchema.parse({
              orderId,
              milestoneType: 'order_placed',
              occurredAt: placedAt.toISOString(),
              customerVisible: true,
            }),
          }),
        );

        return {
          id: orderId,
          quoteId: quote.id,
          paymentIntentId: payment.id,
          status: 'placed',
          promisedAt: promisedAt.toISOString(),
          milestone: {
            type: 'order_placed',
            message: 'Your order is confirmed',
            occurredAt: placedAt.toISOString(),
          },
          duplicate: false,
        };
      },
    );
  }
}
