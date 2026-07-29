import { z } from 'zod';
import {
  CurrencySchema,
  CustomerIdSchema,
  IsoDateTimeSchema,
  KitchenTaskIdSchema,
  MenuItemIdSchema,
  MilestoneIdSchema,
  MoneyPaiseSchema,
  OrderIdSchema,
  OutletIdSchema,
  PaymentIntentIdSchema,
  ProbabilitySchema,
  QuoteIdSchema,
  RecipeVersionIdSchema,
  RiskSnapshotIdSchema,
  TenantIdSchema,
} from './primitives.js';

export const FulfilmentTypeSchema = z.enum(['delivery', 'pickup']);

export const QuoteStatusSchema = z.enum([
  'active',
  'consumed',
  'expired',
  'cancelled',
]);

export type QuoteStatus = z.infer<typeof QuoteStatusSchema>;

export const LEGAL_QUOTE_TRANSITIONS: Readonly<
  Record<QuoteStatus, readonly QuoteStatus[]>
> = {
  active: ['consumed', 'expired', 'cancelled'],
  consumed: [],
  expired: [],
  cancelled: [],
};

export const PaymentIntentStatusSchema = z.enum([
  'created',
  'pending',
  'verified',
  'failed',
  'cancelled',
]);

export type PaymentIntentStatus = z.infer<typeof PaymentIntentStatusSchema>;

export const LEGAL_PAYMENT_INTENT_TRANSITIONS: Readonly<
  Record<PaymentIntentStatus, readonly PaymentIntentStatus[]>
> = {
  created: ['pending', 'cancelled'],
  pending: ['verified', 'failed', 'cancelled'],
  verified: [],
  failed: [],
  cancelled: [],
};

export const KitchenTaskStatusSchema = z.enum([
  'queued',
  'ready_to_start',
  'in_progress',
  'completed',
  'cancelled',
]);

export type KitchenTaskStatus = z.infer<typeof KitchenTaskStatusSchema>;

export const LEGAL_KITCHEN_TASK_TRANSITIONS: Readonly<
  Record<KitchenTaskStatus, readonly KitchenTaskStatus[]>
> = {
  queued: ['ready_to_start', 'cancelled'],
  ready_to_start: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export const QuoteLineSchema = z.object({
  lineId: z.string().trim().min(6).max(80),
  itemId: MenuItemIdSchema,
  itemVersion: z.number().int().positive(),
  recipeVersionId: RecipeVersionIdSchema,
  itemNameSnapshot: z.string().trim().min(1).max(160),
  quantity: z.number().int().positive().max(100),
  unitPricePaise: MoneyPaiseSchema,
  modifierTotalPaise: MoneyPaiseSchema,
  lineTotalPaise: MoneyPaiseSchema,
  modifiers: z.array(
    z.object({
      modifierId: z.string().trim().min(2).max(80),
      nameSnapshot: z.string().trim().min(1).max(120),
      pricePaise: MoneyPaiseSchema,
    }),
  ),
  allergenSnapshot: z.array(z.string().trim().min(1).max(80)).max(30),
});

export const CheckoutQuoteSchema = z
  .object({
    id: QuoteIdSchema,
    tenantId: TenantIdSchema,
    outletId: OutletIdSchema,
    customerId: CustomerIdSchema,
    idempotencyKey: z.string().trim().min(16).max(160),
    status: QuoteStatusSchema,
    fulfilmentType: FulfilmentTypeSchema,
    fulfilmentSnapshot: z.record(z.string(), z.unknown()),
    lines: z.array(QuoteLineSchema).min(1).max(100),
    currency: CurrencySchema,
    subtotalPaise: MoneyPaiseSchema,
    discountPaise: MoneyPaiseSchema,
    deliveryFeePaise: MoneyPaiseSchema,
    packagingFeePaise: MoneyPaiseSchema,
    taxPaise: MoneyPaiseSchema,
    totalPaise: MoneyPaiseSchema,
    calculationVersion: z.string().trim().min(1).max(80),
    expiresAt: IsoDateTimeSchema,
    consumedAt: IsoDateTimeSchema.nullable(),
    version: z.number().int().positive(),
    createdAt: IsoDateTimeSchema,
  })
  .superRefine((quote, context) => {
    const expectedTotal =
      quote.subtotalPaise -
      quote.discountPaise +
      quote.deliveryFeePaise +
      quote.packagingFeePaise +
      quote.taxPaise;
    if (expectedTotal !== quote.totalPaise) {
      context.addIssue({
        code: 'custom',
        path: ['totalPaise'],
        message: 'Quote total does not match its monetary components',
      });
    }

    const expectedSubtotal = quote.lines.reduce(
      (total, line) => total + line.lineTotalPaise,
      0,
    );
    if (expectedSubtotal !== quote.subtotalPaise) {
      context.addIssue({
        code: 'custom',
        path: ['subtotalPaise'],
        message: 'Quote subtotal does not match its line totals',
      });
    }

    if (new Date(quote.expiresAt) <= new Date(quote.createdAt)) {
      context.addIssue({
        code: 'custom',
        path: ['expiresAt'],
        message: 'Quote expiry must be after creation',
      });
    }

    if (quote.status === 'consumed' && quote.consumedAt === null) {
      context.addIssue({
        code: 'custom',
        path: ['consumedAt'],
        message: 'A consumed quote must record consumedAt',
      });
    }
  });

export const PaymentIntentSchema = z.object({
  id: PaymentIntentIdSchema,
  tenantId: TenantIdSchema,
  outletId: OutletIdSchema,
  quoteId: QuoteIdSchema,
  provider: z.string().trim().min(2).max(40),
  providerIntentReference: z.string().trim().min(1).max(160).nullable(),
  idempotencyKey: z.string().trim().min(16).max(160),
  status: PaymentIntentStatusSchema,
  amountPaise: MoneyPaiseSchema,
  currency: CurrencySchema,
  verifiedAt: IsoDateTimeSchema.nullable(),
  version: z.number().int().positive(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const KitchenTaskSchema = z
  .object({
    id: KitchenTaskIdSchema,
    tenantId: TenantIdSchema,
    outletId: OutletIdSchema,
    orderId: OrderIdSchema,
    orderLineId: z.string().trim().min(6).max(80),
    stationId: z.string().trim().min(6).max(80),
    recipeVersionId: RecipeVersionIdSchema,
    sequence: z.number().int().positive().max(100),
    status: KitchenTaskStatusSchema,
    itemNameSnapshot: z.string().trim().min(1).max(160),
    instructionsSnapshot: z.string().trim().max(2_000),
    modifierSnapshot: z.array(z.record(z.string(), z.unknown())),
    allergenSnapshot: z.array(z.string().trim().min(1).max(80)).max(30),
    expectedDurationSeconds: z.number().int().positive().max(86_400),
    startedAt: IsoDateTimeSchema.nullable(),
    completedAt: IsoDateTimeSchema.nullable(),
    version: z.number().int().positive(),
  })
  .superRefine((task, context) => {
    if (task.status === 'in_progress' && task.startedAt === null) {
      context.addIssue({
        code: 'custom',
        path: ['startedAt'],
        message: 'An in-progress task must record startedAt',
      });
    }
    if (task.status === 'completed' && task.completedAt === null) {
      context.addIssue({
        code: 'custom',
        path: ['completedAt'],
        message: 'A completed task must record completedAt',
      });
    }
  });

export const DeliveryMilestoneTypeSchema = z.enum([
  'order_placed',
  'order_confirmed',
  'preparation_started',
  'quality_checked',
  'ready',
  'rider_assigned',
  'picked_up',
  'nearby',
  'delivered',
  'cancelled',
  'delay_explained',
]);

export const DeliveryMilestoneSchema = z.object({
  id: MilestoneIdSchema,
  tenantId: TenantIdSchema,
  outletId: OutletIdSchema,
  orderId: OrderIdSchema,
  type: DeliveryMilestoneTypeSchema,
  publicMessage: z.string().trim().min(1).max(280),
  occurredAt: IsoDateTimeSchema,
  actorType: z.enum(['customer', 'staff', 'system', 'partner']),
  actorId: z.string().trim().min(1).max(100),
  data: z.record(z.string(), z.unknown()),
});

export const OrderRiskSnapshotSchema = z.object({
  id: RiskSnapshotIdSchema,
  tenantId: TenantIdSchema,
  outletId: OutletIdSchema,
  orderId: OrderIdSchema,
  riskProbability: ProbabilitySchema,
  predictedReadyAt: IsoDateTimeSchema,
  promisedAt: IsoDateTimeSchema,
  primaryConstraint: z.string().trim().min(1).max(120),
  evidence: z.array(
    z.object({
      metric: z.string().trim().min(1).max(120),
      value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
      source: z.string().trim().min(1).max(120),
    }),
  ),
  algorithmVersion: z.string().trim().min(1).max(80),
  createdAt: IsoDateTimeSchema,
});

export const canTransitionQuote = (from: QuoteStatus, to: QuoteStatus): boolean =>
  LEGAL_QUOTE_TRANSITIONS[from].includes(to);

export const canTransitionPaymentIntent = (
  from: PaymentIntentStatus,
  to: PaymentIntentStatus,
): boolean => LEGAL_PAYMENT_INTENT_TRANSITIONS[from].includes(to);

export const canTransitionKitchenTask = (
  from: KitchenTaskStatus,
  to: KitchenTaskStatus,
): boolean => LEGAL_KITCHEN_TASK_TRANSITIONS[from].includes(to);

export type CheckoutQuote = z.infer<typeof CheckoutQuoteSchema>;
export type PaymentIntent = z.infer<typeof PaymentIntentSchema>;
export type KitchenTask = z.infer<typeof KitchenTaskSchema>;
export type DeliveryMilestone = z.infer<typeof DeliveryMilestoneSchema>;
export type OrderRiskSnapshot = z.infer<typeof OrderRiskSnapshotSchema>;
