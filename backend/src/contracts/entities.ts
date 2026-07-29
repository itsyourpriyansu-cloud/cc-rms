import { z } from 'zod';
import {
  CustomerIdSchema,
  IsoDateTimeSchema,
  OutletIdSchema,
  PhoneE164Schema,
  TenantIdSchema,
} from './primitives.js';

export const TenantStatusSchema = z.enum(['trial', 'active', 'suspended', 'closed']);

export const TenantSchema = z.object({
  id: TenantIdSchema,
  legalName: z.string().trim().min(2).max(160),
  displayName: z.string().trim().min(2).max(80),
  timezone: z.string().trim().default('Asia/Kolkata'),
  currency: z.literal('INR').default('INR'),
  status: TenantStatusSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const OutletSchema = z.object({
  id: OutletIdSchema,
  tenantId: TenantIdSchema,
  name: z.string().trim().min(2).max(100),
  timezone: z.string().trim().default('Asia/Kolkata'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  serviceRadiusKm: z.number().positive().max(100),
  status: z.enum(['onboarding', 'open', 'paused', 'closed']),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const DietaryPreferenceSchema = z.enum([
  'no_preference',
  'vegetarian',
  'eggetarian',
  'non_vegetarian',
  'vegan',
  'jain',
]);

export const SpicePreferenceSchema = z.enum(['mild', 'medium', 'hot']);
export const PortionPreferenceSchema = z.enum(['small', 'regular', 'large']);

export const CustomerProfileSchema = z.object({
  id: CustomerIdSchema,
  tenantId: TenantIdSchema,
  phoneE164: PhoneE164Schema,
  firstName: z.string().trim().min(1).max(80),
  dietaryPreference: DietaryPreferenceSchema,
  spicePreference: SpicePreferenceSchema,
  allergies: z.array(z.string().trim().min(1).max(80)).max(30),
  avoidedIngredients: z.array(z.string().trim().min(1).max(80)).max(50),
  vegetarianDays: z
    .array(z.number().int().min(1).max(7))
    .max(7)
    .refine((days) => new Set(days).size === days.length, 'Days must be unique'),
  typicalBudgetPaise: z.number().int().positive().max(1_000_000),
  portionPreference: PortionPreferenceSchema,
  profileVersion: z.number().int().positive(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const ConsentPurposeSchema = z.enum([
  'service',
  'personalisation',
  'marketing_sms',
  'marketing_whatsapp',
  'product_research',
]);

export const ConsentRecordSchema = z
  .object({
    tenantId: TenantIdSchema,
    customerId: CustomerIdSchema,
    purpose: ConsentPurposeSchema,
    status: z.enum(['granted', 'withdrawn']),
    noticeVersion: z.string().trim().min(1).max(40),
    source: z.enum(['customer_app', 'support', 'import']),
    recordedAt: IsoDateTimeSchema,
    withdrawnAt: IsoDateTimeSchema.nullable(),
  })
  .superRefine((consent, context) => {
    if (consent.status === 'withdrawn' && consent.withdrawnAt === null) {
      context.addIssue({
        code: 'custom',
        path: ['withdrawnAt'],
        message: 'Withdrawn consent must record when it was withdrawn',
      });
    }

    if (consent.status === 'granted' && consent.withdrawnAt !== null) {
      context.addIssue({
        code: 'custom',
        path: ['withdrawnAt'],
        message: 'Granted consent cannot have a withdrawal timestamp',
      });
    }
  });

export type Tenant = z.infer<typeof TenantSchema>;
export type Outlet = z.infer<typeof OutletSchema>;
export type CustomerProfile = z.infer<typeof CustomerProfileSchema>;
export type ConsentRecord = z.infer<typeof ConsentRecordSchema>;
