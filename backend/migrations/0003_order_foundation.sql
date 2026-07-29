CREATE TABLE brands (
  id text PRIMARY KEY
    CONSTRAINT brands_id_format CHECK (id ~ '^brd_[A-Za-z0-9][A-Za-z0-9_-]{5,63}$'),
  tenant_id text NOT NULL REFERENCES tenants(id),
  name text NOT NULL CONSTRAINT brands_name_length CHECK (char_length(name) BETWEEN 2 AND 100),
  status text NOT NULL CONSTRAINT brands_status_valid CHECK (status IN ('active', 'paused', 'retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, name)
);

CREATE TABLE menu_categories (
  id text PRIMARY KEY
    CONSTRAINT menu_categories_id_format CHECK (id ~ '^cat_[A-Za-z0-9][A-Za-z0-9_-]{5,63}$'),
  tenant_id text NOT NULL REFERENCES tenants(id),
  brand_id text NOT NULL,
  name text NOT NULL CONSTRAINT menu_categories_name_length CHECK (char_length(name) BETWEEN 1 AND 100),
  display_order integer NOT NULL DEFAULT 0,
  status text NOT NULL CONSTRAINT menu_categories_status_valid CHECK (status IN ('active', 'paused', 'retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, brand_id, name),
  FOREIGN KEY (tenant_id, brand_id) REFERENCES brands(tenant_id, id)
);

CREATE TABLE kitchen_stations (
  id text PRIMARY KEY
    CONSTRAINT kitchen_stations_id_format CHECK (id ~ '^stn_[A-Za-z0-9][A-Za-z0-9_-]{5,63}$'),
  tenant_id text NOT NULL REFERENCES tenants(id),
  outlet_id text NOT NULL,
  name text NOT NULL CONSTRAINT kitchen_stations_name_length CHECK (char_length(name) BETWEEN 1 AND 100),
  capacity_units integer NOT NULL DEFAULT 1
    CONSTRAINT kitchen_stations_capacity_positive CHECK (capacity_units > 0),
  status text NOT NULL CONSTRAINT kitchen_stations_status_valid CHECK (status IN ('active', 'paused', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, outlet_id, name),
  FOREIGN KEY (tenant_id, outlet_id) REFERENCES outlets(tenant_id, id)
);

CREATE TABLE menu_items (
  id text PRIMARY KEY
    CONSTRAINT menu_items_id_format CHECK (id ~ '^itm_[A-Za-z0-9][A-Za-z0-9_-]{5,63}$'),
  tenant_id text NOT NULL REFERENCES tenants(id),
  brand_id text NOT NULL,
  category_id text NOT NULL,
  name text NOT NULL CONSTRAINT menu_items_name_length CHECK (char_length(name) BETWEEN 1 AND 160),
  description text NOT NULL DEFAULT '',
  dietary_type text NOT NULL
    CONSTRAINT menu_items_dietary_type_valid
    CHECK (dietary_type IN ('vegetarian', 'eggetarian', 'non_vegetarian', 'vegan', 'jain')),
  allergen_facts jsonb NOT NULL DEFAULT '[]'::jsonb
    CONSTRAINT menu_items_allergens_array CHECK (jsonb_typeof(allergen_facts) = 'array'),
  base_price_paise integer NOT NULL
    CONSTRAINT menu_items_price_nonnegative CHECK (base_price_paise >= 0),
  currency char(3) NOT NULL DEFAULT 'INR'
    CONSTRAINT menu_items_currency_inr CHECK (currency = 'INR'),
  tax_category text NOT NULL DEFAULT 'prepared_food',
  version integer NOT NULL DEFAULT 1
    CONSTRAINT menu_items_version_positive CHECK (version > 0),
  status text NOT NULL
    CONSTRAINT menu_items_status_valid CHECK (status IN ('draft', 'active', 'paused', 'retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, brand_id) REFERENCES brands(tenant_id, id),
  FOREIGN KEY (tenant_id, category_id) REFERENCES menu_categories(tenant_id, id)
);

CREATE TABLE modifier_groups (
  id text PRIMARY KEY
    CONSTRAINT modifier_groups_id_format CHECK (id ~ '^mdg_[A-Za-z0-9][A-Za-z0-9_-]{5,63}$'),
  tenant_id text NOT NULL REFERENCES tenants(id),
  name text NOT NULL CONSTRAINT modifier_groups_name_length CHECK (char_length(name) BETWEEN 1 AND 100),
  minimum_selections integer NOT NULL DEFAULT 0
    CONSTRAINT modifier_groups_min_nonnegative CHECK (minimum_selections >= 0),
  maximum_selections integer NOT NULL DEFAULT 1
    CONSTRAINT modifier_groups_max_positive CHECK (maximum_selections > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CONSTRAINT modifier_groups_selection_range
    CHECK (minimum_selections <= maximum_selections)
);

CREATE TABLE modifier_options (
  id text PRIMARY KEY
    CONSTRAINT modifier_options_id_format CHECK (id ~ '^mod_[A-Za-z0-9][A-Za-z0-9_-]{5,63}$'),
  tenant_id text NOT NULL REFERENCES tenants(id),
  group_id text NOT NULL,
  name text NOT NULL CONSTRAINT modifier_options_name_length CHECK (char_length(name) BETWEEN 1 AND 120),
  price_paise integer NOT NULL DEFAULT 0
    CONSTRAINT modifier_options_price_nonnegative CHECK (price_paise >= 0),
  status text NOT NULL
    CONSTRAINT modifier_options_status_valid CHECK (status IN ('active', 'paused', 'retired')),
  version integer NOT NULL DEFAULT 1
    CONSTRAINT modifier_options_version_positive CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, group_id) REFERENCES modifier_groups(tenant_id, id)
);

CREATE TABLE menu_item_modifier_groups (
  tenant_id text NOT NULL REFERENCES tenants(id),
  item_id text NOT NULL,
  group_id text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, item_id, group_id),
  FOREIGN KEY (tenant_id, item_id) REFERENCES menu_items(tenant_id, id),
  FOREIGN KEY (tenant_id, group_id) REFERENCES modifier_groups(tenant_id, id)
);

CREATE TABLE inventory_items (
  id text PRIMARY KEY
    CONSTRAINT inventory_items_id_format CHECK (id ~ '^inv_[A-Za-z0-9][A-Za-z0-9_-]{5,63}$'),
  tenant_id text NOT NULL REFERENCES tenants(id),
  name text NOT NULL CONSTRAINT inventory_items_name_length CHECK (char_length(name) BETWEEN 1 AND 120),
  unit text NOT NULL
    CONSTRAINT inventory_items_unit_valid CHECK (unit IN ('g', 'kg', 'ml', 'l', 'piece', 'portion')),
  allergen_facts jsonb NOT NULL DEFAULT '[]'::jsonb
    CONSTRAINT inventory_items_allergens_array CHECK (jsonb_typeof(allergen_facts) = 'array'),
  status text NOT NULL
    CONSTRAINT inventory_items_status_valid CHECK (status IN ('active', 'paused', 'retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);

CREATE TABLE recipe_versions (
  id text PRIMARY KEY
    CONSTRAINT recipe_versions_id_format CHECK (id ~ '^rcp_[A-Za-z0-9][A-Za-z0-9_-]{5,63}$'),
  tenant_id text NOT NULL REFERENCES tenants(id),
  item_id text NOT NULL,
  station_id text NOT NULL,
  version integer NOT NULL CONSTRAINT recipe_versions_version_positive CHECK (version > 0),
  expected_duration_seconds integer NOT NULL
    CONSTRAINT recipe_versions_duration_positive CHECK (
      expected_duration_seconds > 0 AND expected_duration_seconds <= 86400
    ),
  instructions text NOT NULL DEFAULT '',
  yield_quantity numeric(12, 3) NOT NULL DEFAULT 1
    CONSTRAINT recipe_versions_yield_positive CHECK (yield_quantity > 0),
  status text NOT NULL
    CONSTRAINT recipe_versions_status_valid CHECK (status IN ('draft', 'published', 'retired')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, item_id, version),
  FOREIGN KEY (tenant_id, item_id) REFERENCES menu_items(tenant_id, id),
  FOREIGN KEY (tenant_id, station_id) REFERENCES kitchen_stations(tenant_id, id),
  CONSTRAINT recipe_versions_publish_time CHECK (
    status = 'draft' OR published_at IS NOT NULL
  )
);

CREATE UNIQUE INDEX recipe_versions_one_published_per_item
  ON recipe_versions (tenant_id, item_id)
  WHERE status = 'published';

CREATE TABLE recipe_components (
  id text PRIMARY KEY
    CONSTRAINT recipe_components_id_format CHECK (id ~ '^rcc_[A-Za-z0-9][A-Za-z0-9_-]{5,63}$'),
  tenant_id text NOT NULL REFERENCES tenants(id),
  recipe_version_id text NOT NULL,
  inventory_item_id text NOT NULL,
  quantity numeric(12, 3) NOT NULL
    CONSTRAINT recipe_components_quantity_positive CHECK (quantity > 0),
  unit text NOT NULL
    CONSTRAINT recipe_components_unit_valid CHECK (unit IN ('g', 'kg', 'ml', 'l', 'piece', 'portion')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, recipe_version_id, inventory_item_id),
  FOREIGN KEY (tenant_id, recipe_version_id) REFERENCES recipe_versions(tenant_id, id),
  FOREIGN KEY (tenant_id, inventory_item_id) REFERENCES inventory_items(tenant_id, id)
);

CREATE TABLE item_availability (
  tenant_id text NOT NULL REFERENCES tenants(id),
  outlet_id text NOT NULL,
  item_id text NOT NULL,
  status text NOT NULL
    CONSTRAINT item_availability_status_valid CHECK (status IN ('available', 'limited', 'paused', 'sold_out')),
  available_quantity integer
    CONSTRAINT item_availability_quantity_nonnegative CHECK (
      available_quantity IS NULL OR available_quantity >= 0
    ),
  reason_code text,
  resumes_at timestamptz,
  version integer NOT NULL DEFAULT 1
    CONSTRAINT item_availability_version_positive CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, outlet_id, item_id),
  FOREIGN KEY (tenant_id, outlet_id) REFERENCES outlets(tenant_id, id),
  FOREIGN KEY (tenant_id, item_id) REFERENCES menu_items(tenant_id, id),
  CONSTRAINT item_availability_limited_requires_quantity CHECK (
    status <> 'limited' OR available_quantity IS NOT NULL
  )
);

CREATE TABLE checkout_quotes (
  id text PRIMARY KEY
    CONSTRAINT checkout_quotes_id_format CHECK (id ~ '^qte_[A-Za-z0-9][A-Za-z0-9_-]{5,63}$'),
  tenant_id text NOT NULL REFERENCES tenants(id),
  outlet_id text NOT NULL,
  customer_id text NOT NULL,
  idempotency_key text NOT NULL
    CONSTRAINT checkout_quotes_idempotency_length CHECK (char_length(idempotency_key) BETWEEN 16 AND 160),
  status text NOT NULL
    CONSTRAINT checkout_quotes_status_valid CHECK (status IN ('active', 'consumed', 'expired', 'cancelled')),
  fulfilment_type text NOT NULL
    CONSTRAINT checkout_quotes_fulfilment_valid CHECK (fulfilment_type IN ('delivery', 'pickup')),
  fulfilment_snapshot jsonb NOT NULL
    CONSTRAINT checkout_quotes_fulfilment_object CHECK (jsonb_typeof(fulfilment_snapshot) = 'object'),
  currency char(3) NOT NULL DEFAULT 'INR'
    CONSTRAINT checkout_quotes_currency_inr CHECK (currency = 'INR'),
  subtotal_paise integer NOT NULL
    CONSTRAINT checkout_quotes_subtotal_nonnegative CHECK (subtotal_paise >= 0),
  discount_paise integer NOT NULL DEFAULT 0
    CONSTRAINT checkout_quotes_discount_nonnegative CHECK (discount_paise >= 0),
  delivery_fee_paise integer NOT NULL DEFAULT 0
    CONSTRAINT checkout_quotes_delivery_nonnegative CHECK (delivery_fee_paise >= 0),
  packaging_fee_paise integer NOT NULL DEFAULT 0
    CONSTRAINT checkout_quotes_packaging_nonnegative CHECK (packaging_fee_paise >= 0),
  tax_paise integer NOT NULL DEFAULT 0
    CONSTRAINT checkout_quotes_tax_nonnegative CHECK (tax_paise >= 0),
  total_paise integer NOT NULL,
  calculation_version text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  version integer NOT NULL DEFAULT 1
    CONSTRAINT checkout_quotes_version_positive CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, customer_id, idempotency_key),
  FOREIGN KEY (tenant_id, outlet_id) REFERENCES outlets(tenant_id, id),
  FOREIGN KEY (tenant_id, customer_id) REFERENCES customers(tenant_id, id),
  CONSTRAINT checkout_quotes_total_matches CHECK (
    total_paise = subtotal_paise - discount_paise + delivery_fee_paise + packaging_fee_paise + tax_paise
  ),
  CONSTRAINT checkout_quotes_expiry_after_creation CHECK (expires_at > created_at),
  CONSTRAINT checkout_quotes_consumed_time CHECK (
    status <> 'consumed' OR consumed_at IS NOT NULL
  )
);

CREATE TABLE checkout_quote_lines (
  id text PRIMARY KEY
    CONSTRAINT checkout_quote_lines_id_format CHECK (id ~ '^qln_[A-Za-z0-9][A-Za-z0-9_-]{5,63}$'),
  tenant_id text NOT NULL REFERENCES tenants(id),
  quote_id text NOT NULL,
  item_id text NOT NULL,
  item_version integer NOT NULL
    CONSTRAINT checkout_quote_lines_item_version_positive CHECK (item_version > 0),
  recipe_version_id text NOT NULL,
  item_name_snapshot text NOT NULL,
  quantity integer NOT NULL
    CONSTRAINT checkout_quote_lines_quantity_range CHECK (quantity > 0 AND quantity <= 100),
  unit_price_paise integer NOT NULL
    CONSTRAINT checkout_quote_lines_unit_price_nonnegative CHECK (unit_price_paise >= 0),
  modifier_total_paise integer NOT NULL DEFAULT 0
    CONSTRAINT checkout_quote_lines_modifier_nonnegative CHECK (modifier_total_paise >= 0),
  line_total_paise integer NOT NULL
    CONSTRAINT checkout_quote_lines_total_nonnegative CHECK (line_total_paise >= 0),
  modifiers_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb
    CONSTRAINT checkout_quote_lines_modifiers_array CHECK (jsonb_typeof(modifiers_snapshot) = 'array'),
  allergen_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb
    CONSTRAINT checkout_quote_lines_allergens_array CHECK (jsonb_typeof(allergen_snapshot) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, quote_id) REFERENCES checkout_quotes(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, item_id) REFERENCES menu_items(tenant_id, id),
  FOREIGN KEY (tenant_id, recipe_version_id) REFERENCES recipe_versions(tenant_id, id),
  CONSTRAINT checkout_quote_lines_total_matches CHECK (
    line_total_paise = quantity * (unit_price_paise + modifier_total_paise)
  )
);

CREATE TABLE payment_intents (
  id text PRIMARY KEY
    CONSTRAINT payment_intents_id_format CHECK (id ~ '^pay_[A-Za-z0-9][A-Za-z0-9_-]{5,63}$'),
  tenant_id text NOT NULL REFERENCES tenants(id),
  outlet_id text NOT NULL,
  quote_id text NOT NULL,
  provider text NOT NULL
    CONSTRAINT payment_intents_provider_length CHECK (char_length(provider) BETWEEN 2 AND 40),
  provider_intent_reference text,
  idempotency_key text NOT NULL
    CONSTRAINT payment_intents_idempotency_length CHECK (char_length(idempotency_key) BETWEEN 16 AND 160),
  status text NOT NULL
    CONSTRAINT payment_intents_status_valid CHECK (status IN ('created', 'pending', 'verified', 'failed', 'cancelled')),
  amount_paise integer NOT NULL
    CONSTRAINT payment_intents_amount_nonnegative CHECK (amount_paise >= 0),
  currency char(3) NOT NULL DEFAULT 'INR'
    CONSTRAINT payment_intents_currency_inr CHECK (currency = 'INR'),
  verified_at timestamptz,
  version integer NOT NULL DEFAULT 1
    CONSTRAINT payment_intents_version_positive CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, idempotency_key),
  FOREIGN KEY (tenant_id, outlet_id) REFERENCES outlets(tenant_id, id),
  FOREIGN KEY (tenant_id, quote_id) REFERENCES checkout_quotes(tenant_id, id),
  CONSTRAINT payment_intents_verified_time CHECK (
    status <> 'verified' OR verified_at IS NOT NULL
  )
);

CREATE UNIQUE INDEX payment_intents_provider_reference_unique
  ON payment_intents (provider, provider_intent_reference)
  WHERE provider_intent_reference IS NOT NULL;

ALTER TABLE orders
  ADD COLUMN quote_id text NOT NULL,
  ADD COLUMN payment_intent_id text,
  ADD COLUMN checkout_idempotency_key text NOT NULL,
  ADD COLUMN fulfilment_type text NOT NULL
    CONSTRAINT orders_fulfilment_type_valid CHECK (fulfilment_type IN ('delivery', 'pickup')),
  ADD COLUMN fulfilment_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
    CONSTRAINT orders_fulfilment_snapshot_object CHECK (jsonb_typeof(fulfilment_snapshot) = 'object'),
  ADD COLUMN calculation_version text NOT NULL,
  ADD COLUMN packaging_fee_paise integer NOT NULL DEFAULT 0
    CONSTRAINT orders_packaging_fee_nonnegative CHECK (packaging_fee_paise >= 0),
  ADD CONSTRAINT orders_total_with_packaging_matches CHECK (
    total_paise = subtotal_paise - discount_paise + delivery_fee_paise + packaging_fee_paise + tax_paise
  ),
  ADD CONSTRAINT orders_quote_fk
    FOREIGN KEY (tenant_id, quote_id) REFERENCES checkout_quotes(tenant_id, id),
  ADD CONSTRAINT orders_payment_intent_fk
    FOREIGN KEY (tenant_id, payment_intent_id) REFERENCES payment_intents(tenant_id, id),
  ADD CONSTRAINT orders_quote_unique UNIQUE (tenant_id, quote_id),
  ADD CONSTRAINT orders_checkout_idempotency_unique
    UNIQUE (tenant_id, customer_id, checkout_idempotency_key);

ALTER TABLE orders DROP CONSTRAINT orders_check;

ALTER TABLE order_lines
  ADD COLUMN quote_line_id text NOT NULL,
  ADD COLUMN item_version integer NOT NULL
    CONSTRAINT order_lines_item_version_positive CHECK (item_version > 0),
  ADD COLUMN recipe_version_id text NOT NULL,
  ADD COLUMN instructions_snapshot text NOT NULL DEFAULT '',
  ADD CONSTRAINT order_lines_quote_line_fk
    FOREIGN KEY (tenant_id, quote_line_id) REFERENCES checkout_quote_lines(tenant_id, id),
  ADD CONSTRAINT order_lines_menu_item_fk
    FOREIGN KEY (tenant_id, item_id) REFERENCES menu_items(tenant_id, id),
  ADD CONSTRAINT order_lines_recipe_version_fk
    FOREIGN KEY (tenant_id, recipe_version_id) REFERENCES recipe_versions(tenant_id, id),
  ADD CONSTRAINT order_lines_quote_line_unique UNIQUE (tenant_id, quote_line_id);

CREATE TABLE kitchen_tasks (
  id text PRIMARY KEY
    CONSTRAINT kitchen_tasks_id_format CHECK (id ~ '^tsk_[A-Za-z0-9][A-Za-z0-9_-]{5,63}$'),
  tenant_id text NOT NULL REFERENCES tenants(id),
  outlet_id text NOT NULL,
  order_id text NOT NULL,
  order_line_id text NOT NULL,
  station_id text NOT NULL,
  recipe_version_id text NOT NULL,
  sequence integer NOT NULL
    CONSTRAINT kitchen_tasks_sequence_positive CHECK (sequence > 0),
  dependencies jsonb NOT NULL DEFAULT '[]'::jsonb
    CONSTRAINT kitchen_tasks_dependencies_array CHECK (jsonb_typeof(dependencies) = 'array'),
  status text NOT NULL
    CONSTRAINT kitchen_tasks_status_valid CHECK (
      status IN ('queued', 'ready_to_start', 'in_progress', 'completed', 'cancelled')
    ),
  item_name_snapshot text NOT NULL,
  instructions_snapshot text NOT NULL DEFAULT '',
  modifier_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb
    CONSTRAINT kitchen_tasks_modifiers_array CHECK (jsonb_typeof(modifier_snapshot) = 'array'),
  allergen_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb
    CONSTRAINT kitchen_tasks_allergens_array CHECK (jsonb_typeof(allergen_snapshot) = 'array'),
  expected_duration_seconds integer NOT NULL
    CONSTRAINT kitchen_tasks_duration_positive CHECK (
      expected_duration_seconds > 0 AND expected_duration_seconds <= 86400
    ),
  started_at timestamptz,
  completed_at timestamptz,
  version integer NOT NULL DEFAULT 1
    CONSTRAINT kitchen_tasks_version_positive CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, order_line_id, sequence),
  FOREIGN KEY (tenant_id, outlet_id) REFERENCES outlets(tenant_id, id),
  FOREIGN KEY (tenant_id, order_id) REFERENCES orders(tenant_id, id),
  FOREIGN KEY (tenant_id, order_line_id) REFERENCES order_lines(tenant_id, id),
  FOREIGN KEY (tenant_id, station_id) REFERENCES kitchen_stations(tenant_id, id),
  FOREIGN KEY (tenant_id, recipe_version_id) REFERENCES recipe_versions(tenant_id, id),
  CONSTRAINT kitchen_tasks_started_time CHECK (
    status NOT IN ('in_progress', 'completed') OR started_at IS NOT NULL
  ),
  CONSTRAINT kitchen_tasks_completed_time CHECK (
    status <> 'completed' OR completed_at IS NOT NULL
  )
);

CREATE TABLE delivery_milestones (
  id text PRIMARY KEY
    CONSTRAINT delivery_milestones_id_format CHECK (id ~ '^mil_[A-Za-z0-9][A-Za-z0-9_-]{5,63}$'),
  tenant_id text NOT NULL REFERENCES tenants(id),
  outlet_id text NOT NULL,
  order_id text NOT NULL,
  milestone_type text NOT NULL
    CONSTRAINT delivery_milestones_type_valid CHECK (
      milestone_type IN (
        'order_placed',
        'order_confirmed',
        'preparation_started',
        'quality_checked',
        'ready',
        'rider_assigned',
        'picked_up',
        'nearby',
        'delivered',
        'cancelled',
        'delay_explained'
      )
    ),
  public_message text NOT NULL
    CONSTRAINT delivery_milestones_message_length CHECK (char_length(public_message) BETWEEN 1 AND 280),
  customer_visible boolean NOT NULL DEFAULT true,
  occurred_at timestamptz NOT NULL,
  actor_type text NOT NULL
    CONSTRAINT delivery_milestones_actor_type_valid CHECK (
      actor_type IN ('customer', 'staff', 'system', 'partner')
    ),
  actor_id text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
    CONSTRAINT delivery_milestones_data_object CHECK (jsonb_typeof(data) = 'object'),
  correlation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, outlet_id) REFERENCES outlets(tenant_id, id),
  FOREIGN KEY (tenant_id, order_id) REFERENCES orders(tenant_id, id)
);

CREATE TABLE order_risk_snapshots (
  id text PRIMARY KEY
    CONSTRAINT order_risk_snapshots_id_format CHECK (id ~ '^rsk_[A-Za-z0-9][A-Za-z0-9_-]{5,63}$'),
  tenant_id text NOT NULL REFERENCES tenants(id),
  outlet_id text NOT NULL,
  order_id text NOT NULL,
  risk_probability numeric(5, 4) NOT NULL
    CONSTRAINT order_risk_probability_range CHECK (risk_probability BETWEEN 0 AND 1),
  predicted_ready_at timestamptz NOT NULL,
  promised_at timestamptz NOT NULL,
  primary_constraint text NOT NULL,
  evidence jsonb NOT NULL
    CONSTRAINT order_risk_evidence_array CHECK (jsonb_typeof(evidence) = 'array'),
  algorithm_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, outlet_id) REFERENCES outlets(tenant_id, id),
  FOREIGN KEY (tenant_id, order_id) REFERENCES orders(tenant_id, id)
);

CREATE INDEX menu_items_browse_idx
  ON menu_items (tenant_id, brand_id, category_id, status);
CREATE INDEX item_availability_lookup_idx
  ON item_availability (tenant_id, outlet_id, status, item_id);
CREATE INDEX checkout_quotes_active_idx
  ON checkout_quotes (tenant_id, customer_id, expires_at)
  WHERE status = 'active';
CREATE INDEX payment_intents_pending_idx
  ON payment_intents (tenant_id, outlet_id, created_at)
  WHERE status IN ('created', 'pending');
CREATE INDEX kitchen_tasks_live_queue_idx
  ON kitchen_tasks (tenant_id, outlet_id, station_id, status, created_at)
  WHERE status NOT IN ('completed', 'cancelled');
CREATE INDEX delivery_milestones_timeline_idx
  ON delivery_milestones (tenant_id, order_id, occurred_at);
CREATE INDEX order_risk_latest_idx
  ON order_risk_snapshots (tenant_id, outlet_id, order_id, created_at DESC);

CREATE OR REPLACE FUNCTION enforce_quote_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'Quote version must increase by exactly one';
  END IF;

  IF NEW.status <> OLD.status AND NOT (
    OLD.status = 'active' AND NEW.status IN ('consumed', 'expired', 'cancelled')
  ) THEN
    RAISE EXCEPTION 'Illegal quote transition: % -> %', OLD.status, NEW.status;
  END IF;

  IF (
    NEW.tenant_id,
    NEW.outlet_id,
    NEW.customer_id,
    NEW.idempotency_key,
    NEW.fulfilment_type,
    NEW.fulfilment_snapshot,
    NEW.currency,
    NEW.subtotal_paise,
    NEW.discount_paise,
    NEW.delivery_fee_paise,
    NEW.packaging_fee_paise,
    NEW.tax_paise,
    NEW.total_paise,
    NEW.calculation_version,
    NEW.expires_at
  ) IS DISTINCT FROM (
    OLD.tenant_id,
    OLD.outlet_id,
    OLD.customer_id,
    OLD.idempotency_key,
    OLD.fulfilment_type,
    OLD.fulfilment_snapshot,
    OLD.currency,
    OLD.subtotal_paise,
    OLD.discount_paise,
    OLD.delivery_fee_paise,
    OLD.packaging_fee_paise,
    OLD.tax_paise,
    OLD.total_paise,
    OLD.calculation_version,
    OLD.expires_at
  ) THEN
    RAISE EXCEPTION 'Quoted commercial facts are immutable';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END
$$;

CREATE TRIGGER checkout_quotes_enforce_transition
  BEFORE UPDATE ON checkout_quotes
  FOR EACH ROW EXECUTE FUNCTION enforce_quote_transition();

CREATE OR REPLACE FUNCTION enforce_payment_intent_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'Payment intent version must increase by exactly one';
  END IF;

  IF NEW.status <> OLD.status AND NOT (
    (OLD.status = 'created' AND NEW.status IN ('pending', 'cancelled')) OR
    (OLD.status = 'pending' AND NEW.status IN ('verified', 'failed', 'cancelled'))
  ) THEN
    RAISE EXCEPTION 'Illegal payment intent transition: % -> %', OLD.status, NEW.status;
  END IF;

  IF (
    NEW.tenant_id,
    NEW.outlet_id,
    NEW.quote_id,
    NEW.provider,
    NEW.idempotency_key,
    NEW.amount_paise,
    NEW.currency
  ) IS DISTINCT FROM (
    OLD.tenant_id,
    OLD.outlet_id,
    OLD.quote_id,
    OLD.provider,
    OLD.idempotency_key,
    OLD.amount_paise,
    OLD.currency
  ) THEN
    RAISE EXCEPTION 'Payment intent commercial facts are immutable';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END
$$;

CREATE TRIGGER payment_intents_enforce_transition
  BEFORE UPDATE ON payment_intents
  FOR EACH ROW EXECUTE FUNCTION enforce_payment_intent_transition();

CREATE OR REPLACE FUNCTION validate_and_consume_order_quote()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  quoted checkout_quotes%ROWTYPE;
  payment payment_intents%ROWTYPE;
BEGIN
  SELECT *
  INTO quoted
  FROM checkout_quotes
  WHERE tenant_id = NEW.tenant_id
    AND id = NEW.quote_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checkout quote does not exist for this tenant';
  END IF;

  IF quoted.status <> 'active' OR quoted.expires_at <= now() THEN
    RAISE EXCEPTION 'Checkout quote is not active or has expired';
  END IF;

  IF (
    NEW.outlet_id,
    NEW.customer_id,
    NEW.fulfilment_type,
    NEW.fulfilment_snapshot,
    NEW.currency,
    NEW.subtotal_paise,
    NEW.discount_paise,
    NEW.delivery_fee_paise,
    NEW.packaging_fee_paise,
    NEW.tax_paise,
    NEW.total_paise,
    NEW.calculation_version
  ) IS DISTINCT FROM (
    quoted.outlet_id,
    quoted.customer_id,
    quoted.fulfilment_type,
    quoted.fulfilment_snapshot,
    quoted.currency,
    quoted.subtotal_paise,
    quoted.discount_paise,
    quoted.delivery_fee_paise,
    quoted.packaging_fee_paise,
    quoted.tax_paise,
    quoted.total_paise,
    quoted.calculation_version
  ) THEN
    RAISE EXCEPTION 'Order commercial facts do not match the accepted quote';
  END IF;

  IF NEW.payment_intent_id IS NOT NULL THEN
    SELECT *
    INTO payment
    FROM payment_intents
    WHERE tenant_id = NEW.tenant_id
      AND id = NEW.payment_intent_id
    FOR SHARE;

    IF NOT FOUND OR
       payment.quote_id <> NEW.quote_id OR
       payment.outlet_id <> NEW.outlet_id OR
       payment.status <> 'verified' OR
       payment.amount_paise <> NEW.total_paise OR
       payment.currency <> NEW.currency THEN
      RAISE EXCEPTION 'Payment intent is not verified for this exact quote';
    END IF;
  END IF;

  UPDATE checkout_quotes
  SET status = 'consumed',
      consumed_at = now(),
      version = version + 1
  WHERE tenant_id = NEW.tenant_id
    AND id = NEW.quote_id;

  RETURN NEW;
END
$$;

CREATE TRIGGER orders_validate_and_consume_quote
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION validate_and_consume_order_quote();

CREATE OR REPLACE FUNCTION validate_order_line_quote_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_quote_id text;
  quoted_line checkout_quote_lines%ROWTYPE;
BEGIN
  SELECT quote_id
  INTO parent_quote_id
  FROM orders
  WHERE tenant_id = NEW.tenant_id
    AND id = NEW.order_id;

  SELECT *
  INTO quoted_line
  FROM checkout_quote_lines
  WHERE tenant_id = NEW.tenant_id
    AND id = NEW.quote_line_id;

  IF parent_quote_id IS NULL OR NOT FOUND THEN
    RAISE EXCEPTION 'Order and quote line must exist in the same tenant';
  END IF;

  IF (
    parent_quote_id,
    NEW.item_id,
    NEW.item_version,
    NEW.recipe_version_id,
    NEW.item_name_snapshot,
    NEW.quantity,
    NEW.unit_price_paise,
    NEW.modifiers
  ) IS DISTINCT FROM (
    quoted_line.quote_id,
    quoted_line.item_id,
    quoted_line.item_version,
    quoted_line.recipe_version_id,
    quoted_line.item_name_snapshot,
    quoted_line.quantity,
    quoted_line.unit_price_paise,
    quoted_line.modifiers_snapshot
  ) THEN
    RAISE EXCEPTION 'Order line does not match the accepted quote snapshot';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER order_lines_validate_quote_snapshot
  BEFORE INSERT ON order_lines
  FOR EACH ROW EXECUTE FUNCTION validate_order_line_quote_snapshot();

CREATE OR REPLACE FUNCTION enforce_kitchen_task_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'Kitchen task version must increase by exactly one';
  END IF;

  IF NEW.status <> OLD.status AND NOT (
    (OLD.status = 'queued' AND NEW.status IN ('ready_to_start', 'cancelled')) OR
    (OLD.status = 'ready_to_start' AND NEW.status IN ('in_progress', 'cancelled')) OR
    (OLD.status = 'in_progress' AND NEW.status IN ('completed', 'cancelled'))
  ) THEN
    RAISE EXCEPTION 'Illegal kitchen task transition: % -> %', OLD.status, NEW.status;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END
$$;

CREATE TRIGGER kitchen_tasks_enforce_transition
  BEFORE UPDATE ON kitchen_tasks
  FOR EACH ROW EXECUTE FUNCTION enforce_kitchen_task_transition();

CREATE OR REPLACE FUNCTION protect_published_recipe()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'published' AND (
    NEW.item_id,
    NEW.station_id,
    NEW.version,
    NEW.expected_duration_seconds,
    NEW.instructions,
    NEW.yield_quantity
  ) IS DISTINCT FROM (
    OLD.item_id,
    OLD.station_id,
    OLD.version,
    OLD.expected_duration_seconds,
    OLD.instructions,
    OLD.yield_quantity
  ) THEN
    RAISE EXCEPTION 'Published recipe facts are immutable; create a new version';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER recipe_versions_protect_published
  BEFORE UPDATE ON recipe_versions
  FOR EACH ROW EXECUTE FUNCTION protect_published_recipe();

CREATE TRIGGER checkout_quote_lines_are_immutable
  BEFORE UPDATE OR DELETE ON checkout_quote_lines
  FOR EACH ROW EXECUTE FUNCTION prevent_immutable_row_change();
CREATE TRIGGER delivery_milestones_are_immutable
  BEFORE UPDATE OR DELETE ON delivery_milestones
  FOR EACH ROW EXECUTE FUNCTION prevent_immutable_row_change();
CREATE TRIGGER order_risk_snapshots_are_immutable
  BEFORE UPDATE OR DELETE ON order_risk_snapshots
  FOR EACH ROW EXECUTE FUNCTION prevent_immutable_row_change();

DO $$
DECLARE
  tenant_table text;
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY[
    'brands',
    'menu_categories',
    'kitchen_stations',
    'menu_items',
    'modifier_groups',
    'modifier_options',
    'menu_item_modifier_groups',
    'inventory_items',
    'recipe_versions',
    'recipe_components',
    'item_availability',
    'checkout_quotes',
    'checkout_quote_lines',
    'payment_intents',
    'kitchen_tasks',
    'delivery_milestones',
    'order_risk_snapshots'
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

COMMENT ON TABLE checkout_quotes IS
  'Immutable commercial calculation snapshot. Only lifecycle status and optimistic version may change.';
COMMENT ON TABLE checkout_quote_lines IS
  'Immutable item, recipe, modifier, allergen and price facts accepted by the customer.';
COMMENT ON TABLE kitchen_tasks IS
  'Recipe-derived station work with explicit state and optimistic concurrency.';
COMMENT ON TABLE order_risk_snapshots IS
  'Append-only measured risk output; a snapshot is evidence, not an action.';
