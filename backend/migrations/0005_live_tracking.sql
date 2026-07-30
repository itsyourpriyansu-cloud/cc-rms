CREATE TABLE delivery_assignments (
  id text PRIMARY KEY
    CONSTRAINT delivery_assignments_id_format
    CHECK (id ~ '^das_[A-Za-z0-9][A-Za-z0-9_-]{5,63}$'),
  tenant_id text NOT NULL REFERENCES tenants(id),
  outlet_id text NOT NULL,
  order_id text NOT NULL,
  partner_name text NOT NULL
    CONSTRAINT delivery_assignments_partner_length
    CHECK (char_length(partner_name) BETWEEN 2 AND 100),
  partner_assignment_reference text NOT NULL,
  rider_display_name text NOT NULL
    CONSTRAINT delivery_assignments_rider_name_length
    CHECK (char_length(rider_display_name) BETWEEN 1 AND 100),
  rider_phone_masked text NOT NULL
    CONSTRAINT delivery_assignments_masked_phone
    CHECK (rider_phone_masked ~ '^[*Xx+0-9 -]{4,24}$'),
  vehicle_label_masked text NOT NULL DEFAULT '',
  status text NOT NULL
    CONSTRAINT delivery_assignments_status_valid
    CHECK (status IN ('assigned', 'picked_up', 'delivered', 'cancelled')),
  location_sharing_enabled boolean NOT NULL DEFAULT false,
  assigned_at timestamptz NOT NULL,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  version integer NOT NULL DEFAULT 1
    CONSTRAINT delivery_assignments_version_positive CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, partner_name, partner_assignment_reference),
  FOREIGN KEY (tenant_id, outlet_id) REFERENCES outlets(tenant_id, id),
  FOREIGN KEY (tenant_id, order_id) REFERENCES orders(tenant_id, id),
  CONSTRAINT delivery_assignments_pickup_time CHECK (
    status NOT IN ('picked_up', 'delivered') OR picked_up_at IS NOT NULL
  ),
  CONSTRAINT delivery_assignments_delivery_time CHECK (
    status <> 'delivered' OR delivered_at IS NOT NULL
  )
);

CREATE TABLE delivery_location_events (
  id text PRIMARY KEY
    CONSTRAINT delivery_location_events_id_format
    CHECK (id ~ '^loc_[A-Za-z0-9][A-Za-z0-9_-]{5,63}$'),
  tenant_id text NOT NULL REFERENCES tenants(id),
  outlet_id text NOT NULL,
  order_id text NOT NULL,
  assignment_id text NOT NULL,
  provider_event_id text NOT NULL,
  latitude numeric(9, 6) NOT NULL
    CONSTRAINT delivery_location_events_latitude CHECK (latitude BETWEEN -90 AND 90),
  longitude numeric(9, 6) NOT NULL
    CONSTRAINT delivery_location_events_longitude CHECK (longitude BETWEEN -180 AND 180),
  accuracy_metres numeric(8, 2) NOT NULL
    CONSTRAINT delivery_location_events_accuracy CHECK (
      accuracy_metres > 0 AND accuracy_metres <= 10000
    ),
  heading_degrees numeric(6, 2)
    CONSTRAINT delivery_location_events_heading CHECK (
      heading_degrees IS NULL OR heading_degrees BETWEEN 0 AND 360
    ),
  speed_kph numeric(7, 2)
    CONSTRAINT delivery_location_events_speed CHECK (
      speed_kph IS NULL OR speed_kph BETWEEN 0 AND 250
    ),
  visibility text NOT NULL
    CONSTRAINT delivery_location_events_visibility
    CHECK (visibility IN ('exact', 'coarse', 'hidden')),
  recorded_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, assignment_id, provider_event_id),
  FOREIGN KEY (tenant_id, outlet_id) REFERENCES outlets(tenant_id, id),
  FOREIGN KEY (tenant_id, order_id) REFERENCES orders(tenant_id, id),
  FOREIGN KEY (tenant_id, assignment_id) REFERENCES delivery_assignments(tenant_id, id),
  CONSTRAINT delivery_location_events_expiry CHECK (expires_at > recorded_at)
);

CREATE INDEX delivery_assignments_live_idx
  ON delivery_assignments (tenant_id, outlet_id, status, updated_at)
  WHERE status NOT IN ('delivered', 'cancelled');

CREATE UNIQUE INDEX delivery_assignments_one_active_per_order
  ON delivery_assignments (tenant_id, order_id)
  WHERE status IN ('assigned', 'picked_up');

CREATE INDEX delivery_location_events_latest_idx
  ON delivery_location_events (tenant_id, order_id, recorded_at DESC)
  WHERE visibility <> 'hidden';

CREATE OR REPLACE FUNCTION enforce_delivery_assignment_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'Delivery assignment version must increase by exactly one';
  END IF;

  IF NEW.status <> OLD.status AND NOT (
    (OLD.status = 'assigned' AND NEW.status IN ('picked_up', 'cancelled')) OR
    (OLD.status = 'picked_up' AND NEW.status IN ('delivered', 'cancelled'))
  ) THEN
    RAISE EXCEPTION 'Illegal delivery assignment transition: % -> %', OLD.status, NEW.status;
  END IF;

  IF (
    NEW.tenant_id,
    NEW.outlet_id,
    NEW.order_id,
    NEW.partner_name,
    NEW.partner_assignment_reference,
    NEW.rider_display_name,
    NEW.rider_phone_masked,
    NEW.vehicle_label_masked,
    NEW.assigned_at
  ) IS DISTINCT FROM (
    OLD.tenant_id,
    OLD.outlet_id,
    OLD.order_id,
    OLD.partner_name,
    OLD.partner_assignment_reference,
    OLD.rider_display_name,
    OLD.rider_phone_masked,
    OLD.vehicle_label_masked,
    OLD.assigned_at
  ) THEN
    RAISE EXCEPTION 'Delivery assignment identity facts are immutable';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END
$$;

CREATE TRIGGER delivery_assignments_enforce_transition
  BEFORE UPDATE ON delivery_assignments
  FOR EACH ROW EXECUTE FUNCTION enforce_delivery_assignment_transition();

CREATE TRIGGER delivery_location_events_are_immutable
  BEFORE UPDATE OR DELETE ON delivery_location_events
  FOR EACH ROW EXECUTE FUNCTION prevent_immutable_row_change();

DO $$
DECLARE
  tenant_table text;
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY[
    'delivery_assignments',
    'delivery_location_events'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')) WITH CHECK (tenant_id = nullif(current_setting(''app.tenant_id'', true), ''''))',
      tenant_table
    );
  END LOOP;
END
$$;

COMMENT ON TABLE delivery_location_events IS
  'Append-only delivery positions. Customer APIs expose only unexpired positions allowed by assignment sharing state.';

CREATE OR REPLACE FUNCTION notify_customer_tracking_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.aggregate_type = 'order' AND NEW.event_type IN (
    'order.status_changed',
    'kitchen.task_status_changed',
    'delivery.milestone_recorded',
    'delivery.assignment_updated',
    'delivery.location_updated'
  ) THEN
    PERFORM pg_notify(
      'rms_tracking_events',
      json_build_object(
        'tenantId', NEW.tenant_id,
        'orderId', NEW.aggregate_id,
        'sequence', NEW.sequence_id
      )::text
    );
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER outbox_notify_customer_tracking
  AFTER INSERT ON outbox_events
  FOR EACH ROW EXECUTE FUNCTION notify_customer_tracking_event();
