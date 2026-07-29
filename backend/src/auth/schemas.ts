import { z } from 'zod';
import { OutletIdSchema, TenantIdSchema } from '../contracts/index.js';

export const RequestOtpBodySchema = z.object({
  tenantId: TenantIdSchema,
  outletId: OutletIdSchema,
  phone: z.string().trim().min(10).max(20),
});

export const VerifyOtpBodySchema = z.object({
  tenantId: TenantIdSchema,
  outletId: OutletIdSchema,
  requestId: z.string().regex(/^otp_[A-Za-z0-9_-]{16,80}$/),
  phone: z.string().trim().min(10).max(20),
  otp: z.string().regex(/^\d{6}$/),
  firstName: z.string().trim().min(1).max(80),
});

export const CustomerProfileUpdateSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80).optional(),
    dietaryPreference: z
      .enum([
        'no_preference',
        'vegetarian',
        'eggetarian',
        'non_vegetarian',
        'vegan',
        'jain',
      ])
      .optional(),
    spicePreference: z.enum(['mild', 'medium', 'hot']).optional(),
    allergies: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
    marketingConsent: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export type RequestOtpBody = z.infer<typeof RequestOtpBodySchema>;
export type VerifyOtpBody = z.infer<typeof VerifyOtpBodySchema>;
export type CustomerProfileUpdate = z.infer<typeof CustomerProfileUpdateSchema>;
