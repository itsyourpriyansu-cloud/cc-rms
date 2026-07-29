import { z } from 'zod';
import {
  KitchenTaskIdSchema,
  OrderIdSchema,
  OutletIdSchema,
  PaymentIntentIdSchema,
  ProbabilitySchema,
  QuoteIdSchema,
} from './primitives.js';

export const QuoteCreatedEventDataSchema = z.object({
  quoteId: QuoteIdSchema,
  outletId: OutletIdSchema,
  expiresAt: z.iso.datetime({ offset: true }),
  totalPaise: z.number().int().nonnegative(),
  currency: z.literal('INR'),
  lineCount: z.number().int().positive(),
});

export const PaymentVerifiedEventDataSchema = z.object({
  paymentIntentId: PaymentIntentIdSchema,
  quoteId: QuoteIdSchema,
  amountPaise: z.number().int().nonnegative(),
  provider: z.string().trim().min(2).max(40),
  providerReference: z.string().trim().min(1).max(160),
});

export const OrderPlacedEventDataSchema = z.object({
  orderId: OrderIdSchema,
  quoteId: QuoteIdSchema,
  paymentIntentId: PaymentIntentIdSchema.nullable(),
  promisedAt: z.iso.datetime({ offset: true }),
  taskCount: z.number().int().positive(),
});

export const KitchenTaskCreatedEventDataSchema = z.object({
  orderId: OrderIdSchema,
  taskId: KitchenTaskIdSchema,
  stationId: z.string().trim().min(6).max(80),
  sequence: z.number().int().positive(),
  expectedDurationSeconds: z.number().int().positive(),
});

export const DeliveryMilestoneRecordedEventDataSchema = z.object({
  orderId: OrderIdSchema,
  milestoneType: z.string().trim().min(1).max(80),
  occurredAt: z.iso.datetime({ offset: true }),
  customerVisible: z.boolean(),
});

export const OrderRiskDetectedEventDataSchema = z.object({
  orderId: OrderIdSchema,
  riskProbability: ProbabilitySchema,
  promisedAt: z.iso.datetime({ offset: true }),
  predictedReadyAt: z.iso.datetime({ offset: true }),
  primaryConstraint: z.string().trim().min(1).max(120),
  algorithmVersion: z.string().trim().min(1).max(80),
});
