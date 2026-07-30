import { z } from 'zod';
import {
  DeliveryAssignmentIdSchema,
  DeliveryLocationIdSchema,
  IsoDateTimeSchema,
  KitchenTaskIdSchema,
  MilestoneIdSchema,
  OrderIdSchema,
  OutletIdSchema,
} from './primitives.js';

export const KitchenTaskTransitionBodySchema = z.object({
  outletId: OutletIdSchema,
  expectedVersion: z.number().int().positive(),
  toStatus: z.enum([
    'ready_to_start',
    'in_progress',
    'completed',
    'cancelled',
  ]),
  reasonCode: z.string().trim().min(2).max(100).optional(),
});

export const DeliveryAssignmentBodySchema = z.object({
  outletId: OutletIdSchema,
  partnerName: z.string().trim().min(2).max(100),
  partnerAssignmentReference: z.string().trim().min(6).max(160),
  riderDisplayName: z.string().trim().min(1).max(100),
  riderPhoneMasked: z.string().regex(/^[*Xx+0-9 -]{4,24}$/),
  vehicleLabelMasked: z.string().trim().max(60),
  assignedAt: IsoDateTimeSchema,
});

export const DeliveryStatusUpdateBodySchema = z.object({
  outletId: OutletIdSchema,
  expectedVersion: z.number().int().positive(),
  toStatus: z.enum(['picked_up', 'delivered', 'cancelled']),
  occurredAt: IsoDateTimeSchema,
  delayExplanation: z.string().trim().min(3).max(280).optional(),
});

export const DeliveryLocationBodySchema = z.object({
  outletId: OutletIdSchema,
  providerEventId: z.string().trim().min(8).max(160),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMetres: z.number().positive().max(10_000),
  headingDegrees: z.number().min(0).max(360).optional(),
  speedKph: z.number().min(0).max(250).optional(),
  recordedAt: IsoDateTimeSchema,
});

export const TrackingMilestoneSchema = z.object({
  id: MilestoneIdSchema,
  type: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(280),
  occurredAt: IsoDateTimeSchema,
});

export const TrackingPositionSchema = z.object({
  id: DeliveryLocationIdSchema,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMetres: z.number().positive(),
  recordedAt: IsoDateTimeSchema,
  freshness: z.enum(['live', 'stale']),
});

export const CustomerTrackingSnapshotSchema = z.object({
  orderId: OrderIdSchema,
  outletId: OutletIdSchema,
  status: z.string(),
  fulfilmentType: z.enum(['delivery', 'pickup']),
  promisedAt: IsoDateTimeSchema.nullable(),
  serverTime: IsoDateTimeSchema,
  kitchen: z.object({
    latitude: z.number(),
    longitude: z.number(),
    label: z.string(),
  }),
  destination: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      label: z.string(),
      addressLine: z.string(),
    })
    .nullable(),
  milestones: z.array(TrackingMilestoneSchema),
  preparation: z.object({
    totalTasks: z.number().int().nonnegative(),
    completedTasks: z.number().int().nonnegative(),
    activeTaskIds: z.array(KitchenTaskIdSchema),
  }),
  rider: z
    .object({
      assignmentId: DeliveryAssignmentIdSchema,
      displayName: z.string(),
      phoneMasked: z.string(),
      vehicleLabelMasked: z.string(),
      status: z.enum(['assigned', 'picked_up', 'delivered', 'cancelled']),
      locationSharingEnabled: z.boolean(),
      position: TrackingPositionSchema.nullable(),
    })
    .nullable(),
  latestSequence: z.number().int().nonnegative(),
});

export type KitchenTaskTransitionBody = z.infer<
  typeof KitchenTaskTransitionBodySchema
>;
export type DeliveryAssignmentBody = z.infer<
  typeof DeliveryAssignmentBodySchema
>;
export type DeliveryStatusUpdateBody = z.infer<
  typeof DeliveryStatusUpdateBodySchema
>;
export type DeliveryLocationBody = z.infer<typeof DeliveryLocationBodySchema>;
export type CustomerTrackingSnapshot = z.infer<
  typeof CustomerTrackingSnapshotSchema
>;
export type TrackingPosition = z.infer<typeof TrackingPositionSchema>;
