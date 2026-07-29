import { z } from 'zod';
import {
  DataClassSchema,
  EventIdSchema,
  IsoDateTimeSchema,
  OutletIdSchema,
  TenantIdSchema,
} from './primitives.js';

export const EventTypeSchema = z
  .string()
  .trim()
  .regex(
    /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/,
    'Event type must use a namespaced lowercase form',
  );

export const MaosEventSchema = z.object({
  specversion: z.literal('1.0'),
  type: EventTypeSchema,
  source: z.string().trim().startsWith('rms/').max(120),
  id: EventIdSchema,
  time: IsoDateTimeSchema,
  subject: z.string().trim().min(3).max(240),
  datacontenttype: z.literal('application/json'),
  tenant_id: TenantIdSchema,
  outlet_id: OutletIdSchema,
  correlation_id: z.string().trim().min(8).max(80),
  causation_id: EventIdSchema.nullable(),
  idempotency_key: z.string().trim().min(8).max(200),
  schema_version: z.string().regex(/^\d+\.\d+$/),
  data_class: DataClassSchema,
  consent_ref: z.string().trim().min(6).max(100).nullable(),
  data: z.record(z.string(), z.unknown()),
});

export type MaosEvent = z.infer<typeof MaosEventSchema>;

export const parseMaosEvent = (input: unknown): MaosEvent => MaosEventSchema.parse(input);
