import { z } from 'zod';
import {
  CurrencySchema,
  CustomerIdSchema,
  IsoDateTimeSchema,
  MoneyPaiseSchema,
  OrderIdSchema,
  OutletIdSchema,
  TenantIdSchema,
} from './primitives.js';

export const OrderStatusSchema = z.enum([
  'pending_payment',
  'placed',
  'confirmed',
  'preparing',
  'ready',
  'rider_assigned',
  'picked_up',
  'delivered',
  'cancelled',
]);

export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const LEGAL_ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  pending_payment: ['placed', 'cancelled'],
  placed: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['rider_assigned', 'picked_up', 'cancelled'],
  rider_assigned: ['picked_up', 'cancelled'],
  picked_up: ['delivered'],
  delivered: [],
  cancelled: [],
};

export const canTransitionOrder = (from: OrderStatus, to: OrderStatus): boolean =>
  LEGAL_ORDER_TRANSITIONS[from].includes(to);

export const assertOrderTransition = (from: OrderStatus, to: OrderStatus): void => {
  if (!canTransitionOrder(from, to)) {
    throw new Error(`Illegal order transition: ${from} -> ${to}`);
  }
};

export const OrderLineSchema = z.object({
  lineId: z.string().trim().min(6).max(80),
  itemId: z.string().trim().min(2).max(80),
  itemNameSnapshot: z.string().trim().min(1).max(160),
  quantity: z.number().int().positive().max(100),
  unitPricePaise: MoneyPaiseSchema,
  modifiers: z.array(
    z.object({
      modifierId: z.string().trim().min(2).max(80),
      nameSnapshot: z.string().trim().min(1).max(120),
      pricePaise: MoneyPaiseSchema,
    }),
  ),
  allergenAcknowledgements: z.array(z.string().trim().min(1).max(80)).max(30),
});

export const OrderSchema = z
  .object({
    id: OrderIdSchema,
    tenantId: TenantIdSchema,
    outletId: OutletIdSchema,
    customerId: CustomerIdSchema,
    source: z.enum([
      'customer_app',
      'meal_pass',
      'manager',
      'phone',
      'whatsapp',
      'partner',
    ]),
    status: OrderStatusSchema,
    currency: CurrencySchema,
    lines: z.array(OrderLineSchema).min(1).max(100),
    subtotalPaise: MoneyPaiseSchema,
    discountPaise: MoneyPaiseSchema,
    deliveryFeePaise: MoneyPaiseSchema,
    taxPaise: MoneyPaiseSchema,
    totalPaise: MoneyPaiseSchema,
    promisedAt: IsoDateTimeSchema.nullable(),
    placedAt: IsoDateTimeSchema.nullable(),
    version: z.number().int().positive(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .superRefine((order, context) => {
    const expectedTotal =
      order.subtotalPaise - order.discountPaise + order.deliveryFeePaise + order.taxPaise;

    if (expectedTotal !== order.totalPaise) {
      context.addIssue({
        code: 'custom',
        path: ['totalPaise'],
        message: 'Order total does not match its monetary components',
      });
    }

    if (order.status !== 'pending_payment' && order.status !== 'cancelled' && !order.placedAt) {
      context.addIssue({
        code: 'custom',
        path: ['placedAt'],
        message: 'A placed order must record placedAt',
      });
    }
  });

export type Order = z.infer<typeof OrderSchema>;
