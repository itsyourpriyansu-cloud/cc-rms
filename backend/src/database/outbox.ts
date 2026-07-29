import type { PoolClient } from 'pg';
import { MaosEventSchema, type MaosEvent } from '../contracts/index.js';

export type AppendEventResult = {
  inserted: boolean;
  eventId: string;
};

export const appendEventToOutbox = async (
  client: PoolClient,
  input: unknown,
): Promise<AppendEventResult> => {
  const event: MaosEvent = MaosEventSchema.parse(input);

  const result = await client.query<{ id: string }>(
    `
      WITH ledger_entry AS (
        INSERT INTO maos_events (
          id,
          tenant_id,
          outlet_id,
          event_type,
          source,
          subject,
          correlation_id,
          causation_id,
          idempotency_key,
          schema_version,
          data_class,
          consent_ref,
          event_time,
          payload
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb
        )
        ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
        RETURNING id
      )
      INSERT INTO outbox_events (
        id,
        tenant_id,
        outlet_id,
        event_type,
        aggregate_type,
        aggregate_id,
        correlation_id,
        payload,
        occurred_at,
        available_at
      )
      SELECT
        id,
        $2,
        $3,
        $4,
        split_part($6, '/', 5),
        split_part($6, '/', 6),
        $7,
        $15::jsonb,
        $13,
        $13
      FROM ledger_entry
      RETURNING id
    `,
    [
      event.id,
      event.tenant_id,
      event.outlet_id,
      event.type,
      event.source,
      event.subject,
      event.correlation_id,
      event.causation_id,
      event.idempotency_key,
      event.schema_version,
      event.data_class,
      event.consent_ref,
      event.time,
      JSON.stringify(event.data),
      JSON.stringify(event),
    ],
  );

  return {
    inserted: result.rowCount === 1,
    eventId: event.id,
  };
};
