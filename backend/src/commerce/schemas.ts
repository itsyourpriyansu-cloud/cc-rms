import { z } from 'zod';
import {
  MenuItemIdSchema,
  OutletIdSchema,
  PaymentIntentIdSchema,
  QuoteIdSchema,
} from '../contracts/index.js';

const IdempotencyKeySchema = z.string().trim().min(16).max(160);

const DeliveryFulfilmentSchema = z.object({
  type: z.literal('delivery'),
  address: z.object({
    recipientName: z.string().trim().min(1).max(100),
    phone: z.string().regex(/^[6-9]\d{9}$/),
    line1: z.string().trim().min(3).max(160),
    line2: z.string().trim().max(160).optional(),
    landmark: z.string().trim().max(120).optional(),
    city: z.string().trim().min(2).max(80),
    pincode: z.string().regex(/^[1-9]\d{5}$/),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  }),
  deliveryInstructions: z.string().trim().max(300).optional(),
});

const PickupFulfilmentSchema = z.object({
  type: z.literal('pickup'),
});

export const CreateQuoteBodySchema = z
  .object({
    outletId: OutletIdSchema,
    idempotencyKey: IdempotencyKeySchema,
    fulfilment: z.discriminatedUnion('type', [
      DeliveryFulfilmentSchema,
      PickupFulfilmentSchema,
    ]),
    lines: z
      .array(
        z.object({
          itemId: MenuItemIdSchema,
          quantity: z.number().int().positive().max(20),
          modifierOptionIds: z
            .array(z.string().trim().min(6).max(80))
            .max(20)
            .refine((values) => new Set(values).size === values.length, {
              message: 'Modifier options must be unique',
            }),
        }),
      )
      .min(1)
      .max(50),
  })
  .refine(
    (quote) =>
      new Set(quote.lines.map((line) => line.itemId)).size === quote.lines.length,
    {
      path: ['lines'],
      message: 'Each menu item must appear once; increase its quantity instead',
    },
  );

export const CreatePaymentIntentBodySchema = z.object({
  quoteId: QuoteIdSchema,
  idempotencyKey: IdempotencyKeySchema,
});

export const CheckoutBodySchema = z.object({
  quoteId: QuoteIdSchema,
  paymentIntentId: PaymentIntentIdSchema,
  idempotencyKey: IdempotencyKeySchema,
  allergenAcknowledgements: z.record(
    z.string().trim().min(6).max(80),
    z.array(z.string().trim().min(1).max(80)).max(30),
  ),
});

export const PaymentWebhookBodySchema = z
  .object({
    eventId: z.string().trim().min(8).max(160),
    type: z.enum(['payment.verified', 'payment.failed']),
    tenantId: z.string().regex(/^ten_[A-Za-z0-9][A-Za-z0-9_-]{5,63}$/),
    outletId: OutletIdSchema,
    providerIntentReference: z.string().trim().min(1).max(160),
    providerPaymentReference: z.string().trim().min(1).max(160).optional(),
    amountPaise: z.number().int().nonnegative(),
    currency: z.literal('INR'),
    occurredAt: z.iso.datetime({ offset: true }),
    failureCode: z.string().trim().min(1).max(100).optional(),
  })
  .superRefine((event, context) => {
    if (event.type === 'payment.verified' && !event.providerPaymentReference) {
      context.addIssue({
        code: 'custom',
        path: ['providerPaymentReference'],
        message: 'Verified payments require a provider payment reference',
      });
    }
    if (event.type === 'payment.failed' && !event.failureCode) {
      context.addIssue({
        code: 'custom',
        path: ['failureCode'],
        message: 'Failed payments require a failure code',
      });
    }
  });

export type CreateQuoteBody = z.infer<typeof CreateQuoteBodySchema>;
export type CreatePaymentIntentBody = z.infer<
  typeof CreatePaymentIntentBodySchema
>;
export type CheckoutBody = z.infer<typeof CheckoutBodySchema>;
export type PaymentWebhookBody = z.infer<typeof PaymentWebhookBodySchema>;
