import { describe, expect, it } from 'vitest';
import {
  ActionReceiptSchema,
  ConsentRecordSchema,
  DecisionProposalSchema,
  MaosEventSchema,
  OrderSchema,
  assertOrderTransition,
  canTransitionOrder,
} from '../src/contracts/index.js';

const now = '2026-07-29T13:12:08.000Z';
const hash = `sha256:${'a'.repeat(64)}`;

describe('MAOS event contract', () => {
  const validEvent = {
    specversion: '1.0',
    type: 'order.promise_at_risk',
    source: 'rms/order-core',
    id: 'evt_01JABCDEFG',
    time: now,
    subject: 'tenant/ten_demo01/outlet/out_demo01/order/ord_demo01',
    datacontenttype: 'application/json',
    tenant_id: 'ten_demo01',
    outlet_id: 'out_demo01',
    correlation_id: 'cor_demo_order_1',
    causation_id: null,
    idempotency_key: 'order:ord_demo01:risk:v1',
    schema_version: '1.0',
    data_class: 'operational',
    consent_ref: null,
    data: { riskProbability: 0.87 },
  };

  it('accepts a complete CloudEvents-compatible envelope', () => {
    expect(MaosEventSchema.parse(validEvent)).toEqual(validEvent);
  });

  it('rejects events without tenant context', () => {
    const { tenant_id: _tenantId, ...invalidEvent } = validEvent;
    expect(() => MaosEventSchema.parse(invalidEvent)).toThrow();
  });

  it('rejects unversioned or human-formatted event names', () => {
    expect(() =>
      MaosEventSchema.parse({ ...validEvent, type: 'Order At Risk' }),
    ).toThrow();
  });
});

describe('automation safety contracts', () => {
  const validProposal = {
    proposalId: 'prp_01JABCDEFG',
    objective: 'protect_delivery_promise',
    triggerEventIds: ['evt_01JABCDEFG'],
    recommendedAction: {
      tool: 'menu.pause_item',
      arguments: { itemId: 'item_27', durationMinutes: 38 },
    },
    evidence: [{ metric: 'available_portions', value: 6, source: 'inventory' }],
    confidence: 0.91,
    expectedImpact: { avoidedCancellations: 5 },
    riskClass: 'A2',
    approval: 'outlet_manager',
    expiresAt: '2026-07-29T13:18:00.000Z',
    rollbackPlan: 'Restore availability after a verified stock receipt',
    policyVersion: 'availability-2.1',
    modelId: 'availability-risk-7',
    promptVersion: null,
  };

  it('accepts an operational proposal with evidence and approval', () => {
    expect(DecisionProposalSchema.parse(validProposal)).toEqual(validProposal);
  });

  it('prevents high-risk automatic execution', () => {
    expect(() =>
      DecisionProposalSchema.parse({
        ...validProposal,
        riskClass: 'A3',
        approval: 'automatic',
      }),
    ).toThrow(/cannot execute automatically/);
  });

  it('requires two-person control for critical actions', () => {
    expect(() =>
      DecisionProposalSchema.parse({
        ...validProposal,
        riskClass: 'A4',
        approval: 'outlet_manager',
      }),
    ).toThrow(/two-person control/);
  });

  it('requires evidence before an action is marked verified', () => {
    expect(() =>
      ActionReceiptSchema.parse({
        actionId: 'act_01JABCDEFG',
        proposalId: validProposal.proposalId,
        actor: { type: 'system', id: 'maos' },
        tool: validProposal.recommendedAction.tool,
        beforeStateHash: hash,
        externalReference: null,
        status: 'verified',
        verification: null,
        afterStateHash: null,
        rollbackUntil: null,
        durationMs: 23,
        estimatedAiCostPaise: 0,
        recordedAt: now,
      }),
    ).toThrow(/verification evidence/);
  });
});

describe('canonical business entities', () => {
  it('requires a withdrawal timestamp for withdrawn consent', () => {
    expect(() =>
      ConsentRecordSchema.parse({
        tenantId: 'ten_demo01',
        customerId: 'cus_demo01',
        purpose: 'personalisation',
        status: 'withdrawn',
        noticeVersion: 'privacy-1.0',
        source: 'customer_app',
        recordedAt: now,
        withdrawnAt: null,
      }),
    ).toThrow(/record when it was withdrawn/);
  });

  it('rejects an order with an inconsistent total', () => {
    expect(() =>
      OrderSchema.parse({
        id: 'ord_demo01',
        tenantId: 'ten_demo01',
        outletId: 'out_demo01',
        customerId: 'cus_demo01',
        source: 'customer_app',
        status: 'placed',
        currency: 'INR',
        lines: [
          {
            lineId: 'line_demo01',
            itemId: 'item_27',
            itemNameSnapshot: 'Paneer Tikka',
            quantity: 1,
            unitPricePaise: 30000,
            modifiers: [],
            allergenAcknowledgements: [],
          },
        ],
        subtotalPaise: 30000,
        discountPaise: 2000,
        deliveryFeePaise: 3000,
        taxPaise: 1500,
        totalPaise: 99999,
        promisedAt: '2026-07-29T13:45:00.000Z',
        placedAt: now,
        version: 1,
        createdAt: now,
        updatedAt: now,
      }),
    ).toThrow(/monetary components/);
  });
});

describe('order state machine', () => {
  it('allows only explicit forward transitions', () => {
    expect(canTransitionOrder('confirmed', 'preparing')).toBe(true);
    expect(canTransitionOrder('delivered', 'preparing')).toBe(false);
    expect(() => assertOrderTransition('picked_up', 'cancelled')).toThrow(
      'Illegal order transition',
    );
  });
});
