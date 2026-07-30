import { z } from 'zod';

const prefixedId = (prefix: string) =>
  z
    .string()
    .trim()
    .regex(
      new RegExp(`^${prefix}_[A-Za-z0-9][A-Za-z0-9_-]{5,63}$`),
      `Expected a ${prefix}_ prefixed identifier`,
    );

export const TenantIdSchema = prefixedId('ten');
export const OutletIdSchema = prefixedId('out');
export const UserIdSchema = prefixedId('usr');
export const CustomerIdSchema = prefixedId('cus');
export const OrderIdSchema = prefixedId('ord');
export const QuoteIdSchema = prefixedId('qte');
export const PaymentIntentIdSchema = prefixedId('pay');
export const MenuItemIdSchema = prefixedId('itm');
export const RecipeVersionIdSchema = prefixedId('rcp');
export const KitchenTaskIdSchema = prefixedId('tsk');
export const MilestoneIdSchema = prefixedId('mil');
export const RiskSnapshotIdSchema = prefixedId('rsk');
export const DeliveryAssignmentIdSchema = prefixedId('das');
export const DeliveryLocationIdSchema = prefixedId('loc');
export const EventIdSchema = prefixedId('evt');
export const ProposalIdSchema = prefixedId('prp');
export const ActionIdSchema = prefixedId('act');

export const IsoDateTimeSchema = z.iso.datetime({ offset: true });
export const CurrencySchema = z.literal('INR');
export const MoneyPaiseSchema = z.number().int().nonnegative();
export const ProbabilitySchema = z.number().min(0).max(1);
export const PhoneE164Schema = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, 'Expected an E.164 phone number');

export const DataClassSchema = z.enum([
  'public',
  'operational',
  'personal',
  'sensitive',
  'financial',
]);

export const RiskClassSchema = z.enum(['A0', 'A1', 'A2', 'A3', 'A4']);

export type TenantId = z.infer<typeof TenantIdSchema>;
export type OutletId = z.infer<typeof OutletIdSchema>;
export type CustomerId = z.infer<typeof CustomerIdSchema>;
export type OrderId = z.infer<typeof OrderIdSchema>;
export type QuoteId = z.infer<typeof QuoteIdSchema>;
export type PaymentIntentId = z.infer<typeof PaymentIntentIdSchema>;
export type RiskClass = z.infer<typeof RiskClassSchema>;
