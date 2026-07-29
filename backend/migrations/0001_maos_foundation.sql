CREATE TABLE tenants (
  id text PRIMARY KEY CHECK (id ~ '^ten_[A-Za-z0-9][A-Za-z0-9_-]{5,63}$'),
  legal_name text NOT NULL CHECK (char_length(legal_name) BETWEEN 2 AND 160),
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 80),
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  currency char(3) NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  status text NOT NULL CHECK (status IN ('trial', 'active', 'suspended', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE outlets (
  id text PRIMARY KEY CHECK (id ~ '^out_[A-Za-z0-9][A-Za-z0-9_-]{5,63}$'),
  tenant_id text NOT NULL REFERENCES tenants(id),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  latitude numeric(9, 6) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude numeric(9, 6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  service_radius_km numeric(6, 2) NOT NULL CHECK (service_radius_km > 0 AND service_radius_km <= 100),
  status text NOT NULL CHECK (status IN ('onboarding', 'open', 'paused', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);

CREATE TABLE staff_users (
  id text PRIMARY KEY CHECK (id ~ '^usr_[A-Za-z0-9][A-Za-z0-9_-]{5,63}$'),
  tenant_id text NOT NULL REFERENCES tenants(id),
  phone_e164 text NOT NULL CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 100),
  status text NOT NULL CHECK (status IN ('invited', 'active', 'suspended', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, phone_e164)
);

CREATE TABLE user_outlet_roles (
  tenant_id text NOT NULL REFERENCES tenants(id),
  user_id text NOT NULL,
  outlet_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'manager', 'kitchen', 'counter', 'waiter', 'support')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id, outlet_id, role),
  FOREIGN KEY (tenant_id, user_id) REFERENCES staff_users(tenant_id, id),
  FOREIGN KEY (tenant_id, outlet_id) REFERENCES outlets(tenant_id, id)
);

CREATE TABLE customers (
  id text PRIMARY KEY CHECK (id ~ '^cus_[A-Za-z0-9][A-Za-z0-9_-]{5,63}$'),
  tenant_id text NOT NULL REFERENCES tenants(id),
  phone_e164 text NOT NULL CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  first_name text NOT NULL CHECK (char_length(first_name) BETWEEN 1 AND 80),
  dietary_preference text NOT NULL DEFAULT 'no_preference'
    CHECK (dietary_preference IN ('no_preference', 'vegetarian', 'eggetarian', 'non_vegetarian', 'vegan', 'jain')),
  spice_preference text NOT NULL DEFAULT 'medium'
    CHECK (spice_preference IN ('mild', 'medium', 'hot')),
  allergies jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(allergies) = 'array'),
  avoided_ingredients jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(avoided_ingredients) = 'array'),
  vegetarian_days smallint[] NOT NULL DEFAULT '{}'
    CHECK (vegetarian_days <@ ARRAY[1,2,3,4,5,6,7]::smallint[]),
  typical_budget_paise integer NOT NULL DEFAULT 35000 CHECK (typical_budget_paise > 0),
  portion_preference text NOT NULL DEFAULT 'regular'
    CHECK (portion_preference IN ('small', 'regular', 'large')),
  profile_version integer NOT NULL DEFAULT 1 CHECK (profile_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, phone_e164)
);

CREATE TABLE customer_consents (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  customer_id text NOT NULL,
  purpose text NOT NULL
    CHECK (purpose IN ('service', 'personalisation', 'marketing_sms', 'marketing_whatsapp', 'product_research')),
  status text NOT NULL CHECK (status IN ('granted', 'withdrawn')),
  notice_version text NOT NULL,
  source text NOT NULL CHECK (source IN ('customer_app', 'support', 'import')),
  recorded_at timestamptz NOT NULL,
  withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, customer_id) REFERENCES customers(tenant_id, id),
  CHECK (
    (status = 'granted' AND withdrawn_at IS NULL) OR
    (status = 'withdrawn' AND withdrawn_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX one_active_customer_consent
  ON customer_consents (tenant_id, customer_id, purpose)
  WHERE status = 'granted';

CREATE TABLE orders (
  id text PRIMARY KEY CHECK (id ~ '^ord_[A-Za-z0-9][A-Za-z0-9_-]{5,63}$'),
  tenant_id text NOT NULL REFERENCES tenants(id),
  outlet_id text NOT NULL,
  customer_id text NOT NULL,
  source text NOT NULL
    CHECK (source IN ('customer_app', 'meal_pass', 'manager', 'phone', 'whatsapp', 'partner')),
  status text NOT NULL
    CHECK (status IN ('pending_payment', 'placed', 'confirmed', 'preparing', 'ready', 'rider_assigned', 'picked_up', 'delivered', 'cancelled')),
  currency char(3) NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  subtotal_paise integer NOT NULL CHECK (subtotal_paise >= 0),
  discount_paise integer NOT NULL DEFAULT 0 CHECK (discount_paise >= 0),
  delivery_fee_paise integer NOT NULL DEFAULT 0 CHECK (delivery_fee_paise >= 0),
  tax_paise integer NOT NULL DEFAULT 0 CHECK (tax_paise >= 0),
  total_paise integer NOT NULL CHECK (
    total_paise = subtotal_paise - discount_paise + delivery_fee_paise + tax_paise
  ),
  promised_at timestamptz,
  placed_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, outlet_id) REFERENCES outlets(tenant_id, id),
  FOREIGN KEY (tenant_id, customer_id) REFERENCES customers(tenant_id, id),
  CHECK (status IN ('pending_payment', 'cancelled') OR placed_at IS NOT NULL)
);

CREATE TABLE order_lines (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  order_id text NOT NULL,
  item_id text NOT NULL,
  item_name_snapshot text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0 AND quantity <= 100),
  unit_price_paise integer NOT NULL CHECK (unit_price_paise >= 0),
  modifiers jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(modifiers) = 'array'),
  allergen_acknowledgements jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(allergen_acknowledgements) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, order_id) REFERENCES orders(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE order_status_events (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  order_id text NOT NULL,
  from_status text,
  to_status text NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('customer', 'staff', 'system', 'partner')),
  actor_id text NOT NULL,
  reason_code text,
  correlation_id text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, order_id) REFERENCES orders(tenant_id, id)
);

CREATE TABLE maos_events (
  id text PRIMARY KEY CHECK (id ~ '^evt_[A-Za-z0-9][A-Za-z0-9_-]{5,63}$'),
  tenant_id text NOT NULL REFERENCES tenants(id),
  outlet_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  source text NOT NULL CHECK (source LIKE 'rms/%'),
  subject text NOT NULL,
  correlation_id text NOT NULL,
  causation_id text,
  idempotency_key text NOT NULL,
  schema_version text NOT NULL CHECK (schema_version ~ '^[0-9]+\.[0-9]+$'),
  data_class text NOT NULL CHECK (data_class IN ('public', 'operational', 'personal', 'sensitive', 'financial')),
  consent_ref text,
  event_time timestamptz NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, idempotency_key),
  FOREIGN KEY (tenant_id, outlet_id) REFERENCES outlets(tenant_id, id)
);

CREATE TABLE maos_decision_proposals (
  id text PRIMARY KEY CHECK (id ~ '^prp_[A-Za-z0-9][A-Za-z0-9_-]{5,63}$'),
  tenant_id text NOT NULL REFERENCES tenants(id),
  outlet_id text NOT NULL,
  objective text NOT NULL,
  trigger_event_ids jsonb NOT NULL CHECK (jsonb_typeof(trigger_event_ids) = 'array'),
  tool_name text NOT NULL,
  tool_arguments jsonb NOT NULL CHECK (jsonb_typeof(tool_arguments) = 'object'),
  evidence jsonb NOT NULL CHECK (jsonb_typeof(evidence) = 'array'),
  confidence numeric(5, 4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  expected_impact jsonb NOT NULL CHECK (jsonb_typeof(expected_impact) = 'object'),
  risk_class text NOT NULL CHECK (risk_class IN ('A0', 'A1', 'A2', 'A3', 'A4')),
  approval_mode text NOT NULL
    CHECK (approval_mode IN ('automatic', 'outlet_manager', 'finance_approver', 'two_person', 'prohibited')),
  expires_at timestamptz NOT NULL,
  rollback_plan text,
  policy_version text NOT NULL,
  model_id text,
  prompt_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, outlet_id) REFERENCES outlets(tenant_id, id),
  CHECK (risk_class NOT IN ('A2', 'A3', 'A4') OR approval_mode <> 'automatic'),
  CHECK (risk_class <> 'A4' OR approval_mode IN ('two_person', 'prohibited')),
  CHECK (approval_mode = 'prohibited' OR rollback_plan IS NOT NULL)
);

CREATE TABLE maos_approvals (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  proposal_id text NOT NULL,
  approver_user_id text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  reason text,
  proposal_hash text NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, proposal_id) REFERENCES maos_decision_proposals(tenant_id, id),
  FOREIGN KEY (tenant_id, approver_user_id) REFERENCES staff_users(tenant_id, id),
  UNIQUE (tenant_id, proposal_id, approver_user_id)
);

CREATE TABLE maos_action_receipts (
  id text PRIMARY KEY CHECK (id ~ '^act_[A-Za-z0-9][A-Za-z0-9_-]{5,63}$'),
  tenant_id text NOT NULL REFERENCES tenants(id),
  proposal_id text NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('system', 'staff')),
  actor_id text NOT NULL,
  tool_name text NOT NULL,
  before_state_hash text NOT NULL CHECK (before_state_hash ~ '^sha256:[a-f0-9]{64}$'),
  external_reference text,
  status text NOT NULL CHECK (status IN ('requested', 'executed', 'verified', 'failed', 'rolled_back')),
  verification jsonb,
  after_state_hash text CHECK (after_state_hash IS NULL OR after_state_hash ~ '^sha256:[a-f0-9]{64}$'),
  rollback_until timestamptz,
  duration_ms integer NOT NULL CHECK (duration_ms >= 0),
  estimated_ai_cost_paise integer NOT NULL DEFAULT 0 CHECK (estimated_ai_cost_paise >= 0),
  recorded_at timestamptz NOT NULL,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, proposal_id) REFERENCES maos_decision_proposals(tenant_id, id),
  CHECK (status <> 'verified' OR (verification IS NOT NULL AND after_state_hash IS NOT NULL))
);

CREATE TABLE outbox_events (
  sequence_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id text NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  outlet_id text NOT NULL,
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  correlation_id text NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  occurred_at timestamptz NOT NULL,
  available_at timestamptz NOT NULL,
  published_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text,
  claimed_at timestamptz,
  claimed_by text,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, outlet_id) REFERENCES outlets(tenant_id, id),
  CHECK (published_at IS NULL OR published_at >= occurred_at)
);

CREATE INDEX orders_live_queue_idx
  ON orders (tenant_id, outlet_id, status, promised_at)
  WHERE status NOT IN ('delivered', 'cancelled');
CREATE INDEX order_status_events_timeline_idx
  ON order_status_events (tenant_id, order_id, occurred_at);
CREATE INDEX maos_events_correlation_idx
  ON maos_events (tenant_id, correlation_id, event_time);
CREATE INDEX maos_proposals_pending_idx
  ON maos_decision_proposals (tenant_id, outlet_id, expires_at)
  WHERE approval_mode NOT IN ('automatic', 'prohibited');
CREATE INDEX outbox_unpublished_idx
  ON outbox_events (available_at, sequence_id)
  WHERE published_at IS NULL;

CREATE OR REPLACE FUNCTION enforce_order_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'Order version must increase by exactly one';
  END IF;

  IF NEW.status <> OLD.status AND NOT (
    (OLD.status = 'pending_payment' AND NEW.status IN ('placed', 'cancelled')) OR
    (OLD.status = 'placed' AND NEW.status IN ('confirmed', 'cancelled')) OR
    (OLD.status = 'confirmed' AND NEW.status IN ('preparing', 'cancelled')) OR
    (OLD.status = 'preparing' AND NEW.status IN ('ready', 'cancelled')) OR
    (OLD.status = 'ready' AND NEW.status IN ('rider_assigned', 'picked_up', 'cancelled')) OR
    (OLD.status = 'rider_assigned' AND NEW.status IN ('picked_up', 'cancelled')) OR
    (OLD.status = 'picked_up' AND NEW.status = 'delivered')
  ) THEN
    RAISE EXCEPTION 'Illegal order transition: % -> %', OLD.status, NEW.status;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END
$$;

CREATE TRIGGER orders_enforce_transition
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION enforce_order_transition();

CREATE OR REPLACE FUNCTION prevent_immutable_row_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END
$$;

CREATE TRIGGER maos_events_are_immutable
  BEFORE UPDATE OR DELETE ON maos_events
  FOR EACH ROW EXECUTE FUNCTION prevent_immutable_row_change();
CREATE TRIGGER maos_approvals_are_immutable
  BEFORE UPDATE OR DELETE ON maos_approvals
  FOR EACH ROW EXECUTE FUNCTION prevent_immutable_row_change();
CREATE TRIGGER maos_action_receipts_are_immutable
  BEFORE UPDATE OR DELETE ON maos_action_receipts
  FOR EACH ROW EXECUTE FUNCTION prevent_immutable_row_change();
CREATE TRIGGER order_status_events_are_immutable
  BEFORE UPDATE OR DELETE ON order_status_events
  FOR EACH ROW EXECUTE FUNCTION prevent_immutable_row_change();

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenants
  USING (id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (id = nullif(current_setting('app.tenant_id', true), ''));

DO $$
DECLARE
  tenant_table text;
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY[
    'outlets',
    'staff_users',
    'user_outlet_roles',
    'customers',
    'customer_consents',
    'orders',
    'order_lines',
    'order_status_events',
    'maos_events',
    'maos_decision_proposals',
    'maos_approvals',
    'maos_action_receipts',
    'outbox_events'
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

COMMENT ON TABLE outbox_events IS
  'Transactional event delivery queue. Insert in the same transaction as the business state change.';
COMMENT ON TABLE maos_events IS
  'Append-only canonical MAOS event ledger. Models and external adapters never write here directly.';
