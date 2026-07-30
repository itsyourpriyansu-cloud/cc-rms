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

export const PaymentIntentCreatedEventDataSchema = z.object({
  paymentIntentId: PaymentIntentIdSchema,
  quoteId: QuoteIdSchema,
  amountPaise: z.number().int().nonnegative(),
  provider: z.string().trim().min(2).max(40),
  providerIntentReference: z.string().trim().min(1).max(160),
});

export const PaymentFailedEventDataSchema = z.object({
  paymentIntentId: PaymentIntentIdSchema,
  quoteId: QuoteIdSchema,
  amountPaise: z.number().int().nonnegative(),
  provider: z.string().trim().min(2).max(40),
  providerReference: z.string().trim().min(1).max(160),
  failureCode: z.string().trim().min(1).max(100),
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

export const KitchenTaskStatusChangedEventDataSchema = z.object({
  orderId: OrderIdSchema,
  taskId: KitchenTaskIdSchema,
  fromStatus: z.string().trim().min(1).max(80),
  toStatus: z.string().trim().min(1).max(80),
  version: z.number().int().positive(),
  occurredAt: z.iso.datetime({ offset: true }),
});

export const DeliveryAssignmentUpdatedEventDataSchema = z.object({
  orderId: OrderIdSchema,
  assignmentId: z.string().trim().min(6).max(80),
  status: z.enum(['assigned', 'picked_up', 'delivered', 'cancelled']),
  occurredAt: z.iso.datetime({ offset: true }),
});

export const DeliveryLocationUpdatedEventDataSchema = z.object({
  orderId: OrderIdSchema,
  assignmentId: z.string().trim().min(6).max(80),
  accuracyMetres: z.number().positive().max(10_000),
  recordedAt: z.iso.datetime({ offset: true }),
  visibility: z.enum(['exact', 'coarse']),
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
