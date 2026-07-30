import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type { AuthenticatedCustomer } from '../auth/index.js';
import { createOpaqueId } from '../auth/crypto.js';
import {
  CustomerTrackingSnapshotSchema,
  DeliveryAssignmentUpdatedEventDataSchema,
  DeliveryLocationUpdatedEventDataSchema,
  DeliveryMilestoneRecordedEventDataSchema,
  KitchenTaskStatusChangedEventDataSchema,
  type CustomerTrackingSnapshot,
  type DeliveryAssignmentBody,
  type DeliveryLocationBody,
  type DeliveryStatusUpdateBody,
  type KitchenTaskTransitionBody,
  type MaosEvent,
  type TrackingPosition,
} from '../contracts/index.js';
import { appendEventToOutbox, withTenantTransaction } from '../database/index.js';
import type { OperationsPrincipal } from '../operations/index.js';
import { TrackingError } from './errors.js';

type RequestMetadata = {
  correlationId: string;
};

type OrderRecord = QueryResultRow & {
  id: string;
  tenant_id: string;
  outlet_id: string;
  customer_id: string;
  status: string;
  fulfilment_type: 'delivery' | 'pickup';
  fulfilment_snapshot: Record<string, unknown>;
  promised_at: Date | string | null;
  version: number;
};

type AssignmentRecord = QueryResultRow & {
  id: string;
  tenant_id: string;
  outlet_id: string;
  order_id: string;
  partner_name: string;
  partner_assignment_reference: string;
  rider_display_name: string;
  rider_phone_masked: string;
  vehicle_label_masked: string;
  status: 'assigned' | 'picked_up' | 'delivered' | 'cancelled';
  location_sharing_enabled: boolean;
  version: number;
};

type TaskRecord = QueryResultRow & {
  id: string;
  tenant_id: string;
  outlet_id: string;
  order_id: string;
  status: string;
  version: number;
};

const asIso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const event = (input: {
  type: string;
  source: string;
  tenantId: string;
  outletId: string;
  subjectType: string;
  subjectId: string;
  correlationId: string;
  idempotencyKey: string;
  dataClass?: MaosEvent['data_class'];
  data: Record<string, unknown>;
}): MaosEvent => ({
  specversion: '1.0',
  type: input.type,
  source: input.source,
  id: createOpaqueId('evt'),
  time: new Date().toISOString(),
  subject: `tenant/${input.tenantId}/outlet/${input.outletId}/${input.subjectType}/${input.subjectId}`,
  datacontenttype: 'application/json',
  tenant_id: input.tenantId,
  outlet_id: input.outletId,
  correlation_id: input.correlationId,
  causation_id: null,
  idempotency_key: input.idempotencyKey,
  schema_version: '1.0',
  data_class: input.dataClass ?? 'operational',
  consent_ref: null,
  data: input.data,
});

const readDestination = (
  snapshot: Record<string, unknown>,
): CustomerTrackingSnapshot['destination'] => {
  const address =
    snapshot.address && typeof snapshot.address === 'object'
      ? (snapshot.address as Record<string, unknown>)
      : null;
  const latitude = Number(address?.latitude);
  const longitude = Number(address?.longitude);
  if (!address || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return {
    latitude,
    longitude,
    label:
      typeof address.recipientName === 'string'
        ? address.recipientName
        : 'Delivery address',
    addressLine: [address.line1, address.line2, address.city, address.pincode]
      .filter((part): part is string => typeof part === 'string' && part.length > 0)
      .join(', '),
  };
};

const assertRole = (
  principal: OperationsPrincipal,
  allowed: OperationsPrincipal['role'][],
): void => {
  if (!allowed.includes(principal.role)) {
    throw new TrackingError(
      'OPERATIONS_ROLE_FORBIDDEN',
      403,
      'This operations identity cannot perform that action',
    );
  }
};

const assertOutlet = (
  principal: OperationsPrincipal,
  outletId: string,
): void => {
  if (principal.outletId !== outletId) {
    throw new TrackingError(
      'OUTLET_SCOPE_MISMATCH',
      403,
      'The operation is outside this identity’s outlet scope',
    );
  }
};

const actorTypeFor = (
  principal: OperationsPrincipal,
): 'staff' | 'partner' | 'system' =>
  principal.role === 'delivery_partner'
    ? 'partner'
    : principal.role === 'system'
      ? 'system'
      : 'staff';

export class TrackingService {
  constructor(private readonly pool: Pool) {}

  async getCustomerSnapshot(
    authenticated: AuthenticatedCustomer,
    orderId: string,
    metadata: RequestMetadata,
  ): Promise<CustomerTrackingSnapshot> {
    return withTenantTransaction(
      this.pool,
      {
        tenantId: authenticated.tenantId,
        correlationId: metadata.correlationId,
      },
      async (client) => {
        const orderResult = await client.query<
          OrderRecord & {
            outlet_name: string;
            outlet_latitude: number | string;
            outlet_longitude: number | string;
          }
        >(
          `
            SELECT
              orders.*,
              outlets.name AS outlet_name,
              outlets.latitude AS outlet_latitude,
              outlets.longitude AS outlet_longitude
            FROM orders
            JOIN outlets
              ON outlets.tenant_id = orders.tenant_id
             AND outlets.id = orders.outlet_id
            WHERE orders.tenant_id = $1
              AND orders.customer_id = $2
              AND orders.id = $3
          `,
          [authenticated.tenantId, authenticated.customerId, orderId],
        );
        const order = orderResult.rows[0];
        if (!order) {
          throw new TrackingError(
            'ORDER_NOT_FOUND',
            404,
            'Order was not found',
          );
        }

        const milestones = await client.query<{
          id: string;
          milestone_type: string;
          public_message: string;
          occurred_at: Date | string;
        }>(
          `
            SELECT id, milestone_type, public_message, occurred_at
            FROM delivery_milestones
            WHERE tenant_id = $1
              AND order_id = $2
              AND customer_visible = true
            ORDER BY occurred_at, created_at, id
          `,
          [authenticated.tenantId, order.id],
        );
        const tasks = await client.query<{
          id: string;
          status: string;
        }>(
          `
            SELECT id, status
            FROM kitchen_tasks
            WHERE tenant_id = $1 AND order_id = $2
            ORDER BY sequence, id
          `,
          [authenticated.tenantId, order.id],
        );
        const assignmentResult = await client.query<AssignmentRecord>(
          `
            SELECT *
            FROM delivery_assignments
            WHERE tenant_id = $1
              AND order_id = $2
              AND status <> 'cancelled'
            ORDER BY created_at DESC
            LIMIT 1
          `,
          [authenticated.tenantId, order.id],
        );
        const assignment = assignmentResult.rows[0] ?? null;
        let position: TrackingPosition | null = null;

        if (
          assignment?.location_sharing_enabled &&
          assignment.status === 'picked_up'
        ) {
          const positionResult = await client.query<{
            id: string;
            latitude: number | string;
            longitude: number | string;
            accuracy_metres: number | string;
            visibility: 'exact' | 'coarse' | 'hidden';
            recorded_at: Date | string;
          }>(
            `
              SELECT
                id,
                latitude,
                longitude,
                accuracy_metres,
                visibility,
                recorded_at
              FROM delivery_location_events
              WHERE tenant_id = $1
                AND assignment_id = $2
                AND visibility <> 'hidden'
                AND expires_at > now()
              ORDER BY recorded_at DESC
              LIMIT 1
            `,
            [authenticated.tenantId, assignment.id],
          );
          const latest = positionResult.rows[0];
          if (latest) {
            const precision = latest.visibility === 'coarse' ? 3 : 6;
            const recordedAt = asIso(latest.recorded_at);
            position = {
              id: latest.id,
              latitude: Number(Number(latest.latitude).toFixed(precision)),
              longitude: Number(Number(latest.longitude).toFixed(precision)),
              accuracyMetres: Number(latest.accuracy_metres),
              recordedAt,
              freshness:
                Date.now() - new Date(recordedAt).getTime() <= 120_000
                  ? 'live'
                  : 'stale',
            };
          }
        }

        const sequenceResult = await client.query<{ latest: number | string }>(
          `
            SELECT COALESCE(max(sequence_id), 0) AS latest
            FROM outbox_events
            WHERE tenant_id = $1 AND aggregate_id = $2
          `,
          [authenticated.tenantId, order.id],
        );
        const completedTasks = tasks.rows.filter(
          (task) => task.status === 'completed',
        ).length;
        const activeTaskIds = tasks.rows
          .filter((task) =>
            ['ready_to_start', 'in_progress'].includes(task.status),
          )
          .map((task) => task.id);

        return CustomerTrackingSnapshotSchema.parse({
          orderId: order.id,
          outletId: order.outlet_id,
          status: order.status,
          fulfilmentType: order.fulfilment_type,
          promisedAt: order.promised_at ? asIso(order.promised_at) : null,
          serverTime: new Date().toISOString(),
          kitchen: {
            latitude: Number(order.outlet_latitude),
            longitude: Number(order.outlet_longitude),
            label: order.outlet_name,
          },
          destination:
            order.fulfilment_type === 'delivery'
              ? readDestination(order.fulfilment_snapshot)
              : null,
          milestones: milestones.rows.map((milestone) => ({
            id: milestone.id,
            type: milestone.milestone_type,
            message: milestone.public_message,
            occurredAt: asIso(milestone.occurred_at),
          })),
          preparation: {
            totalTasks: tasks.rows.length,
            completedTasks,
            activeTaskIds,
          },
          rider: assignment
            ? {
                assignmentId: assignment.id,
                displayName: assignment.rider_display_name,
                phoneMasked: assignment.rider_phone_masked,
                vehicleLabelMasked: assignment.vehicle_label_masked,
                status: assignment.status,
                locationSharingEnabled:
                  assignment.location_sharing_enabled &&
                  assignment.status === 'picked_up',
                position,
              }
            : null,
          latestSequence: Number(sequenceResult.rows[0]?.latest ?? 0),
        });
      },
    );
  }

  async listCustomerEvents(
    authenticated: AuthenticatedCustomer,
    orderId: string,
    afterSequence: number,
    metadata: RequestMetadata,
  ): Promise<{
    events: Array<{
      sequence: number;
      type: string;
      occurredAt: string;
      data: Record<string, unknown>;
    }>;
    latestSequence: number;
  }> {
    return withTenantTransaction(
      this.pool,
      {
        tenantId: authenticated.tenantId,
        correlationId: metadata.correlationId,
      },
      async (client) => {
        const owned = await client.query<{ id: string }>(
          `
            SELECT id
            FROM orders
            WHERE tenant_id = $1 AND customer_id = $2 AND id = $3
          `,
          [authenticated.tenantId, authenticated.customerId, orderId],
        );
        if (!owned.rows[0]) {
          throw new TrackingError(
            'ORDER_NOT_FOUND',
            404,
            'Order was not found',
          );
        }

        const sharing = await client.query<{ allowed: boolean }>(
          `
            SELECT EXISTS (
              SELECT 1
              FROM delivery_assignments
              WHERE tenant_id = $1
                AND order_id = $2
                AND status = 'picked_up'
                AND location_sharing_enabled = true
            ) AS allowed
          `,
          [authenticated.tenantId, orderId],
        );
        const canShareLocation = sharing.rows[0]?.allowed ?? false;
        const result = await client.query<{
          sequence_id: number | string;
          event_type: string;
          occurred_at: Date | string;
          payload: { data?: Record<string, unknown> };
        }>(
          `
            SELECT sequence_id, event_type, occurred_at, payload
            FROM outbox_events
            WHERE tenant_id = $1
              AND aggregate_id = $2
              AND sequence_id > $3
              AND event_type IN (
                'order.status_changed',
                'kitchen.task_status_changed',
                'delivery.milestone_recorded',
                'delivery.assignment_updated',
                'delivery.location_updated'
              )
            ORDER BY sequence_id
            LIMIT 100
          `,
          [authenticated.tenantId, orderId, afterSequence],
        );
        const safeRows = result.rows.filter(
          (row) =>
            row.event_type !== 'delivery.location_updated' || canShareLocation,
        );
        const latestSequence = result.rows.reduce(
          (latest, row) => Math.max(latest, Number(row.sequence_id)),
          afterSequence,
        );
        return {
          events: safeRows.map((row) => ({
            sequence: Number(row.sequence_id),
            type: row.event_type,
            occurredAt: asIso(row.occurred_at),
            data: row.payload.data ?? {},
          })),
          latestSequence,
        };
      },
    );
  }

  async transitionKitchenTask(
    principal: OperationsPrincipal,
    taskId: string,
    input: KitchenTaskTransitionBody,
    metadata: RequestMetadata,
  ): Promise<{ taskId: string; status: string; version: number }> {
    assertRole(principal, ['kitchen', 'manager']);
    assertOutlet(principal, input.outletId);

    return withTenantTransaction(
      this.pool,
      {
        tenantId: principal.tenantId,
        userId: principal.actorId,
        correlationId: metadata.correlationId,
      },
      async (client) => {
        await this.assertStaffRole(client, principal);
        const taskResult = await client.query<TaskRecord>(
          `
            SELECT *
            FROM kitchen_tasks
            WHERE tenant_id = $1 AND outlet_id = $2 AND id = $3
            FOR UPDATE
          `,
          [principal.tenantId, principal.outletId, taskId],
        );
        const task = taskResult.rows[0];
        if (!task) {
          throw new TrackingError(
            'KITCHEN_TASK_NOT_FOUND',
            404,
            'Kitchen task was not found',
          );
        }
        if (task.version !== input.expectedVersion) {
          throw new TrackingError(
            'VERSION_CONFLICT',
            409,
            'Kitchen task changed; refresh before trying again',
          );
        }
        const occurredAt = new Date();
        const updated = await client.query<{
          status: string;
          version: number;
        }>(
          `
            UPDATE kitchen_tasks
            SET
              status = $4,
              started_at = CASE
                WHEN $4 = 'in_progress' THEN COALESCE(started_at, $5)
                ELSE started_at
              END,
              completed_at = CASE WHEN $4 = 'completed' THEN $5 ELSE completed_at END,
              version = version + 1
            WHERE tenant_id = $1 AND outlet_id = $2 AND id = $3
            RETURNING status, version
          `,
          [
            principal.tenantId,
            principal.outletId,
            task.id,
            input.toStatus,
            occurredAt.toISOString(),
          ],
        );
        const next = updated.rows[0]!;

        await appendEventToOutbox(
          client,
          event({
            type: 'kitchen.task_status_changed',
            source: 'rms/kitchen-core',
            tenantId: principal.tenantId,
            outletId: principal.outletId,
            subjectType: 'order',
            subjectId: task.order_id,
            correlationId: metadata.correlationId,
            idempotencyKey: `task:${task.id}:version:${next.version}`,
            data: KitchenTaskStatusChangedEventDataSchema.parse({
              orderId: task.order_id,
              taskId: task.id,
              fromStatus: task.status,
              toStatus: next.status,
              version: next.version,
              occurredAt: occurredAt.toISOString(),
            }),
          }),
        );

        await this.projectKitchenOrderState(
          client,
          principal,
          task.order_id,
          input.toStatus,
          occurredAt,
          metadata.correlationId,
        );
        return { taskId: task.id, status: next.status, version: next.version };
      },
    );
  }

  async assignDelivery(
    principal: OperationsPrincipal,
    orderId: string,
    input: DeliveryAssignmentBody,
    metadata: RequestMetadata,
  ): Promise<{ assignmentId: string; status: 'assigned'; version: 1 }> {
    assertRole(principal, ['delivery_partner', 'system', 'manager']);
    assertOutlet(principal, input.outletId);

    return withTenantTransaction(
      this.pool,
      {
        tenantId: principal.tenantId,
        correlationId: metadata.correlationId,
      },
      async (client) => {
        if (principal.role === 'manager') {
          await this.assertStaffRole(client, principal);
        }
        const existing = await client.query<AssignmentRecord>(
          `
            SELECT *
            FROM delivery_assignments
            WHERE tenant_id = $1
              AND partner_name = $2
              AND partner_assignment_reference = $3
          `,
          [
            principal.tenantId,
            input.partnerName,
            input.partnerAssignmentReference,
          ],
        );
        const prior = existing.rows[0];
        if (prior) {
          if (prior.order_id !== orderId || prior.outlet_id !== input.outletId) {
            throw new TrackingError(
              'ASSIGNMENT_REFERENCE_CONFLICT',
              409,
              'Partner assignment reference is already used',
            );
          }
          return {
            assignmentId: prior.id,
            status: 'assigned',
            version: 1,
          };
        }

        const order = await this.lockOrder(
          client,
          principal.tenantId,
          input.outletId,
          orderId,
        );
        if (!['ready', 'rider_assigned'].includes(order.status)) {
          throw new TrackingError(
            'ORDER_NOT_READY_FOR_RIDER',
            409,
            'The order is not ready for rider assignment',
          );
        }
        const assignmentId = createOpaqueId('das');
        await client.query(
          `
            INSERT INTO delivery_assignments (
              id,
              tenant_id,
              outlet_id,
              order_id,
              partner_name,
              partner_assignment_reference,
              rider_display_name,
              rider_phone_masked,
              vehicle_label_masked,
              status,
              assigned_at
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, 'assigned', $10
            )
          `,
          [
            assignmentId,
            principal.tenantId,
            input.outletId,
            orderId,
            input.partnerName,
            input.partnerAssignmentReference,
            input.riderDisplayName,
            input.riderPhoneMasked,
            input.vehicleLabelMasked,
            input.assignedAt,
          ],
        );
        if (order.status === 'ready') {
          await this.transitionOrder(
            client,
            principal,
            order,
            'rider_assigned',
            'rider_assigned',
            'A delivery partner has been assigned',
            new Date(input.assignedAt),
            metadata.correlationId,
          );
        }
        await appendEventToOutbox(
          client,
          event({
            type: 'delivery.assignment_updated',
            source: 'rms/delivery-core',
            tenantId: principal.tenantId,
            outletId: input.outletId,
            subjectType: 'order',
            subjectId: orderId,
            correlationId: metadata.correlationId,
            idempotencyKey: `assignment:${assignmentId}:version:1`,
            data: DeliveryAssignmentUpdatedEventDataSchema.parse({
              orderId,
              assignmentId,
              status: 'assigned',
              occurredAt: input.assignedAt,
            }),
          }),
        );
        return { assignmentId, status: 'assigned', version: 1 };
      },
    );
  }

  async updateDeliveryStatus(
    principal: OperationsPrincipal,
    orderId: string,
    input: DeliveryStatusUpdateBody,
    metadata: RequestMetadata,
  ): Promise<{ assignmentId: string; status: string; version: number }> {
    assertRole(principal, ['delivery_partner', 'system', 'manager']);
    assertOutlet(principal, input.outletId);

    return withTenantTransaction(
      this.pool,
      {
        tenantId: principal.tenantId,
        correlationId: metadata.correlationId,
      },
      async (client) => {
        if (principal.role === 'manager') {
          await this.assertStaffRole(client, principal);
        }
        const assignmentResult = await client.query<AssignmentRecord>(
          `
            SELECT *
            FROM delivery_assignments
            WHERE tenant_id = $1
              AND outlet_id = $2
              AND order_id = $3
              AND status IN ('assigned', 'picked_up')
            ORDER BY created_at DESC
            LIMIT 1
            FOR UPDATE
          `,
          [principal.tenantId, input.outletId, orderId],
        );
        const assignment = assignmentResult.rows[0];
        if (!assignment) {
          throw new TrackingError(
            'DELIVERY_ASSIGNMENT_NOT_FOUND',
            404,
            'Active delivery assignment was not found',
          );
        }
        if (assignment.version !== input.expectedVersion) {
          throw new TrackingError(
            'VERSION_CONFLICT',
            409,
            'Delivery assignment changed; refresh before trying again',
          );
        }
        const next = await client.query<{ status: string; version: number }>(
          `
            UPDATE delivery_assignments
            SET
              status = $4,
              location_sharing_enabled = ($4 = 'picked_up'),
              picked_up_at = CASE WHEN $4 = 'picked_up' THEN $5 ELSE picked_up_at END,
              delivered_at = CASE WHEN $4 = 'delivered' THEN $5 ELSE delivered_at END,
              version = version + 1
            WHERE tenant_id = $1 AND outlet_id = $2 AND id = $3
            RETURNING status, version
          `,
          [
            principal.tenantId,
            input.outletId,
            assignment.id,
            input.toStatus,
            input.occurredAt,
          ],
        );
        const updated = next.rows[0]!;
        const order = await this.lockOrder(
          client,
          principal.tenantId,
          input.outletId,
          orderId,
        );

        if (input.toStatus === 'picked_up') {
          await this.transitionOrder(
            client,
            principal,
            order,
            'picked_up',
            'picked_up',
            'Your order is on the way',
            new Date(input.occurredAt),
            metadata.correlationId,
          );
        } else if (input.toStatus === 'delivered') {
          await this.transitionOrder(
            client,
            principal,
            order,
            'delivered',
            'delivered',
            'Your order has been delivered',
            new Date(input.occurredAt),
            metadata.correlationId,
          );
        } else if (input.delayExplanation) {
          await this.recordMilestone(
            client,
            principal,
            orderId,
            'delay_explained',
            input.delayExplanation,
            new Date(input.occurredAt),
            metadata.correlationId,
          );
        }

        await appendEventToOutbox(
          client,
          event({
            type: 'delivery.assignment_updated',
            source: 'rms/delivery-core',
            tenantId: principal.tenantId,
            outletId: input.outletId,
            subjectType: 'order',
            subjectId: orderId,
            correlationId: metadata.correlationId,
            idempotencyKey: `assignment:${assignment.id}:version:${updated.version}`,
            data: DeliveryAssignmentUpdatedEventDataSchema.parse({
              orderId,
              assignmentId: assignment.id,
              status: updated.status,
              occurredAt: input.occurredAt,
            }),
          }),
        );
        return {
          assignmentId: assignment.id,
          status: updated.status,
          version: updated.version,
        };
      },
    );
  }

  async recordDeliveryLocation(
    principal: OperationsPrincipal,
    orderId: string,
    input: DeliveryLocationBody,
    metadata: RequestMetadata,
  ): Promise<{ accepted: true; duplicate: boolean; visibility: string }> {
    assertRole(principal, ['delivery_partner', 'system']);
    assertOutlet(principal, input.outletId);
    const recordedAt = new Date(input.recordedAt);
    if (
      recordedAt.getTime() > Date.now() + 5 * 60 * 1_000 ||
      recordedAt.getTime() < Date.now() - 24 * 60 * 60 * 1_000
    ) {
      throw new TrackingError(
        'LOCATION_TIME_INVALID',
        400,
        'Delivery location timestamp is outside the accepted window',
      );
    }

    return withTenantTransaction(
      this.pool,
      {
        tenantId: principal.tenantId,
        correlationId: metadata.correlationId,
      },
      async (client) => {
        const assignmentResult = await client.query<AssignmentRecord>(
          `
            SELECT *
            FROM delivery_assignments
            WHERE tenant_id = $1
              AND outlet_id = $2
              AND order_id = $3
              AND status = 'picked_up'
              AND location_sharing_enabled = true
            ORDER BY created_at DESC
            LIMIT 1
          `,
          [principal.tenantId, input.outletId, orderId],
        );
        const assignment = assignmentResult.rows[0];
        if (!assignment) {
          throw new TrackingError(
            'LOCATION_SHARING_DISABLED',
            409,
            'Location sharing is not active for this delivery',
          );
        }
        const duplicate = await client.query<{ id: string; visibility: string }>(
          `
            SELECT id, visibility
            FROM delivery_location_events
            WHERE tenant_id = $1
              AND assignment_id = $2
              AND provider_event_id = $3
          `,
          [principal.tenantId, assignment.id, input.providerEventId],
        );
        if (duplicate.rows[0]) {
          return {
            accepted: true,
            duplicate: true,
            visibility: duplicate.rows[0].visibility,
          };
        }

        const visibility =
          input.accuracyMetres <= 100
            ? 'exact'
            : input.accuracyMetres <= 1_000
              ? 'coarse'
              : 'hidden';
        const locationId = createOpaqueId('loc');
        const expiresAt = new Date(
          recordedAt.getTime() + 24 * 60 * 60 * 1_000,
        );
        await client.query(
          `
            INSERT INTO delivery_location_events (
              id,
              tenant_id,
              outlet_id,
              order_id,
              assignment_id,
              provider_event_id,
              latitude,
              longitude,
              accuracy_metres,
              heading_degrees,
              speed_kph,
              visibility,
              recorded_at,
              expires_at
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
            )
          `,
          [
            locationId,
            principal.tenantId,
            input.outletId,
            orderId,
            assignment.id,
            input.providerEventId,
            input.latitude,
            input.longitude,
            input.accuracyMetres,
            input.headingDegrees ?? null,
            input.speedKph ?? null,
            visibility,
            input.recordedAt,
            expiresAt.toISOString(),
          ],
        );

        if (visibility !== 'hidden') {
          await appendEventToOutbox(
            client,
            event({
              type: 'delivery.location_updated',
              source: 'rms/delivery-core',
              tenantId: principal.tenantId,
              outletId: input.outletId,
              subjectType: 'order',
              subjectId: orderId,
              correlationId: metadata.correlationId,
              idempotencyKey: `location:${assignment.id}:${input.providerEventId}`,
              dataClass: 'personal',
              data: DeliveryLocationUpdatedEventDataSchema.parse({
                orderId,
                assignmentId: assignment.id,
                accuracyMetres: input.accuracyMetres,
                recordedAt: input.recordedAt,
                visibility,
              }),
            }),
          );
        }
        return { accepted: true, duplicate: false, visibility };
      },
    );
  }

  private async assertStaffRole(
    client: PoolClient,
    principal: OperationsPrincipal,
  ): Promise<void> {
    const result = await client.query<{ allowed: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM staff_users staff
          JOIN user_outlet_roles role
            ON role.tenant_id = staff.tenant_id
           AND role.user_id = staff.id
          WHERE staff.tenant_id = $1
            AND staff.id = $2
            AND staff.status = 'active'
            AND role.outlet_id = $3
            AND role.role = ANY($4::text[])
        ) AS allowed
      `,
      [
        principal.tenantId,
        principal.actorId,
        principal.outletId,
        principal.role === 'manager'
          ? ['manager', 'owner']
          : ['kitchen', 'manager', 'owner'],
      ],
    );
    if (!result.rows[0]?.allowed) {
      throw new TrackingError(
        'STAFF_ROLE_FORBIDDEN',
        403,
        'Active staff authorization was not found',
      );
    }
  }

  private async lockOrder(
    client: PoolClient,
    tenantId: string,
    outletId: string,
    orderId: string,
  ): Promise<OrderRecord> {
    const result = await client.query<OrderRecord>(
      `
        SELECT *
        FROM orders
        WHERE tenant_id = $1 AND outlet_id = $2 AND id = $3
        FOR UPDATE
      `,
      [tenantId, outletId, orderId],
    );
    const order = result.rows[0];
    if (!order) {
      throw new TrackingError('ORDER_NOT_FOUND', 404, 'Order was not found');
    }
    return order;
  }

  private async projectKitchenOrderState(
    client: PoolClient,
    principal: OperationsPrincipal,
    orderId: string,
    taskStatus: string,
    occurredAt: Date,
    correlationId: string,
  ): Promise<void> {
    const order = await this.lockOrder(
      client,
      principal.tenantId,
      principal.outletId,
      orderId,
    );
    if (
      ['ready_to_start', 'in_progress', 'completed'].includes(taskStatus) &&
      order.status === 'placed'
    ) {
      await this.transitionOrder(
        client,
        principal,
        order,
        'confirmed',
        'order_confirmed',
        'The kitchen confirmed your order',
        occurredAt,
        correlationId,
      );
    }
    if (
      ['in_progress', 'completed'].includes(taskStatus) &&
      order.status === 'confirmed'
    ) {
      await this.transitionOrder(
        client,
        principal,
        order,
        'preparing',
        'preparation_started',
        'Your meal is being prepared',
        occurredAt,
        correlationId,
      );
    }
    if (taskStatus === 'completed') {
      const remaining = await client.query<{ count: number | string }>(
        `
          SELECT count(*) AS count
          FROM kitchen_tasks
          WHERE tenant_id = $1
            AND order_id = $2
            AND status NOT IN ('completed', 'cancelled')
        `,
        [principal.tenantId, orderId],
      );
      if (Number(remaining.rows[0]?.count ?? 0) === 0) {
        if (order.status === 'confirmed') {
          await this.transitionOrder(
            client,
            principal,
            order,
            'preparing',
            'preparation_started',
            'Your meal is being prepared',
            occurredAt,
            correlationId,
          );
        }
        if (order.status === 'preparing') {
          await this.recordMilestone(
            client,
            principal,
            order.id,
            'quality_checked',
            'Item count, packaging and seal checks are complete',
            occurredAt,
            correlationId,
          );
          await this.transitionOrder(
            client,
            principal,
            order,
            'ready',
            'ready',
            order.fulfilment_type === 'delivery'
              ? 'Your order is ready for rider pickup'
              : 'Your order is ready for collection',
            occurredAt,
            correlationId,
          );
        }
      }
    }
  }

  private async transitionOrder(
    client: PoolClient,
    principal: OperationsPrincipal,
    order: OrderRecord,
    toStatus: string,
    milestoneType: string,
    publicMessage: string,
    occurredAt: Date,
    correlationId: string,
  ): Promise<void> {
    const fromStatus = order.status;
    const nextVersion = order.version + 1;
    await client.query(
      `
        UPDATE orders
        SET status = $4, version = $5
        WHERE tenant_id = $1 AND outlet_id = $2 AND id = $3
      `,
      [
        principal.tenantId,
        principal.outletId,
        order.id,
        toStatus,
        nextVersion,
      ],
    );
    await client.query(
      `
        INSERT INTO order_status_events (
          id,
          tenant_id,
          order_id,
          from_status,
          to_status,
          actor_type,
          actor_id,
          correlation_id,
          occurred_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        randomUUID(),
        principal.tenantId,
        order.id,
        fromStatus,
        toStatus,
        actorTypeFor(principal),
        principal.actorId,
        correlationId,
        occurredAt.toISOString(),
      ],
    );
    await appendEventToOutbox(
      client,
      event({
        type: 'order.status_changed',
        source: 'rms/order-core',
        tenantId: principal.tenantId,
        outletId: principal.outletId,
        subjectType: 'order',
        subjectId: order.id,
        correlationId,
        idempotencyKey: `order:${order.id}:version:${nextVersion}`,
        data: {
          orderId: order.id,
          fromStatus,
          toStatus,
          version: nextVersion,
          occurredAt: occurredAt.toISOString(),
        },
      }),
    );
    order.status = toStatus;
    order.version = nextVersion;
    await this.recordMilestone(
      client,
      principal,
      order.id,
      milestoneType,
      publicMessage,
      occurredAt,
      correlationId,
    );
  }

  private async recordMilestone(
    client: PoolClient,
    principal: OperationsPrincipal,
    orderId: string,
    milestoneType: string,
    publicMessage: string,
    occurredAt: Date,
    correlationId: string,
  ): Promise<void> {
    const milestoneId = createOpaqueId('mil');
    await client.query(
      `
        INSERT INTO delivery_milestones (
          id,
          tenant_id,
          outlet_id,
          order_id,
          milestone_type,
          public_message,
          customer_visible,
          occurred_at,
          actor_type,
          actor_id,
          data,
          correlation_id
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, true, $7, $8, $9, '{}'::jsonb, $10
        )
      `,
      [
        milestoneId,
        principal.tenantId,
        principal.outletId,
        orderId,
        milestoneType,
        publicMessage,
        occurredAt.toISOString(),
        actorTypeFor(principal),
        principal.actorId,
        correlationId,
      ],
    );
    await appendEventToOutbox(
      client,
      event({
        type: 'delivery.milestone_recorded',
        source: 'rms/order-core',
        tenantId: principal.tenantId,
        outletId: principal.outletId,
        subjectType: 'order',
        subjectId: orderId,
        correlationId,
        idempotencyKey: `milestone:${milestoneId}`,
        data: DeliveryMilestoneRecordedEventDataSchema.parse({
          orderId,
          milestoneType,
          occurredAt: occurredAt.toISOString(),
          customerVisible: true,
        }),
      }),
    );
  }
}
