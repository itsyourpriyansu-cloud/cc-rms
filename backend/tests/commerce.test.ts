import { describe, expect, it } from 'vitest';
import {
  CheckoutQuoteSchema,
  DeliveryMilestoneRecordedEventDataSchema,
  KitchenTaskSchema,
  OrderPlacedEventDataSchema,
  OrderRiskDetectedEventDataSchema,
  PaymentVerifiedEventDataSchema,
  QuoteCreatedEventDataSchema,
  canTransitionKitchenTask,
  canTransitionPaymentIntent,
  canTransitionQuote,
} from '../src/contracts/index.js';

const validQuote = {
  id: 'qte_alpha01',
  tenantId: 'ten_alpha01',
  outletId: 'out_alpha01',
  customerId: 'cus_alpha01',
  idempotencyKey: 'quote-alpha-000001',
  status: 'active',
  fulfilmentType: 'delivery',
  fulfilmentSnapshot: {
    addressId: 'address-alpha-1',
    promisedAt: '2026-07-29T14:30:00+05:30',
  },
  lines: [
    {
      lineId: 'qln_alpha01',
      itemId: 'itm_alpha01',
      itemVersion: 1,
      recipeVersionId: 'rcp_alpha01',
      itemNameSnapshot: 'Home-style thali',
      quantity: 1,
      unitPricePaise: 30_000,
      modifierTotalPaise: 0,
      lineTotalPaise: 30_000,
      modifiers: [],
      allergenSnapshot: ['milk'],
    },
  ],
  currency: 'INR',
  subtotalPaise: 30_000,
  discountPaise: 2_000,
  deliveryFeePaise: 3_000,
  packagingFeePaise: 1_000,
  taxPaise: 1_500,
  totalPaise: 33_500,
  calculationVersion: 'pricing-2026-07-01',
  expiresAt: '2026-07-29T14:15:00+05:30',
  consumedAt: null,
  version: 1,
  createdAt: '2026-07-29T14:00:00+05:30',
} as const;

describe('commerce contracts', () => {
  it('accepts a balanced, expiring checkout quote', () => {
    expect(CheckoutQuoteSchema.parse(validQuote)).toMatchObject({
      id: 'qte_alpha01',
      totalPaise: 33_500,
    });
  });

  it('rejects quote totals that differ from the snapshotted lines or charges', () => {
    expect(
      CheckoutQuoteSchema.safeParse({
        ...validQuote,
        totalPaise: 32_500,
      }).success,
    ).toBe(false);

    expect(
      CheckoutQuoteSchema.safeParse({
        ...validQuote,
        subtotalPaise: 31_000,
        totalPaise: 34_500,
      }).success,
    ).toBe(false);
  });

  it('rejects expired-at-creation and consumed-without-timestamp quotes', () => {
    expect(
      CheckoutQuoteSchema.safeParse({
        ...validQuote,
        expiresAt: validQuote.createdAt,
      }).success,
    ).toBe(false);

    expect(
      CheckoutQuoteSchema.safeParse({
        ...validQuote,
        status: 'consumed',
      }).success,
    ).toBe(false);
  });

  it('exposes only the legal terminal-safe state transitions', () => {
    expect(canTransitionQuote('active', 'consumed')).toBe(true);
    expect(canTransitionQuote('consumed', 'active')).toBe(false);
    expect(canTransitionPaymentIntent('pending', 'verified')).toBe(true);
    expect(canTransitionPaymentIntent('verified', 'pending')).toBe(false);
    expect(canTransitionKitchenTask('ready_to_start', 'in_progress')).toBe(true);
    expect(canTransitionKitchenTask('completed', 'in_progress')).toBe(false);
  });

  it('requires operational timestamps on active and completed kitchen tasks', () => {
    const task = {
      id: 'tsk_alpha01',
      tenantId: 'ten_alpha01',
      outletId: 'out_alpha01',
      orderId: 'ord_alpha01',
      orderLineId: 'oln_alpha01',
      stationId: 'stn_alpha01',
      recipeVersionId: 'rcp_alpha01',
      sequence: 1,
      status: 'in_progress',
      itemNameSnapshot: 'Home-style thali',
      instructionsSnapshot: 'Serve hot',
      modifierSnapshot: [],
      allergenSnapshot: ['milk'],
      expectedDurationSeconds: 900,
      startedAt: null,
      completedAt: null,
      version: 1,
    };

    expect(KitchenTaskSchema.safeParse(task).success).toBe(false);
    expect(
      KitchenTaskSchema.safeParse({
        ...task,
        status: 'completed',
        startedAt: '2026-07-29T14:10:00+05:30',
      }).success,
    ).toBe(false);
  });

  it('validates the commerce event payloads used by the outbox', () => {
    expect(
      QuoteCreatedEventDataSchema.safeParse({
        quoteId: 'qte_alpha01',
        outletId: 'out_alpha01',
        expiresAt: '2026-07-29T14:15:00+05:30',
        totalPaise: 33_500,
        currency: 'INR',
        lineCount: 1,
      }).success,
    ).toBe(true);
    expect(
      PaymentVerifiedEventDataSchema.safeParse({
        paymentIntentId: 'pay_alpha01',
        quoteId: 'qte_alpha01',
        amountPaise: 33_500,
        provider: 'razorpay',
        providerReference: 'provider-payment-alpha-1',
      }).success,
    ).toBe(true);
    expect(
      OrderPlacedEventDataSchema.safeParse({
        orderId: 'ord_alpha01',
        quoteId: 'qte_alpha01',
        paymentIntentId: 'pay_alpha01',
        promisedAt: '2026-07-29T14:45:00+05:30',
        taskCount: 1,
      }).success,
    ).toBe(true);
    expect(
      DeliveryMilestoneRecordedEventDataSchema.safeParse({
        orderId: 'ord_alpha01',
        milestoneType: 'order_placed',
        occurredAt: '2026-07-29T14:05:00+05:30',
        customerVisible: true,
      }).success,
    ).toBe(true);
    expect(
      OrderRiskDetectedEventDataSchema.safeParse({
        orderId: 'ord_alpha01',
        riskProbability: 0.72,
        promisedAt: '2026-07-29T14:45:00+05:30',
        predictedReadyAt: '2026-07-29T14:50:00+05:30',
        primaryConstraint: 'tandoor_capacity',
        algorithmVersion: 'risk-v1',
      }).success,
    ).toBe(true);
  });
});
