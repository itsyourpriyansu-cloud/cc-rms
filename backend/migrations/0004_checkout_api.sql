CREATE TABLE commerce_pricing_policies (
  id text PRIMARY KEY
    CONSTRAINT commerce_pricing_policies_id_format
    CHECK (id ~ '^prc_[A-Za-z0-9][A-Za-z0-9_-]{5,63}$'),
  tenant_id text NOT NULL REFERENCES tenants(id),
  outlet_id text NOT NULL,
  name text NOT NULL
    CONSTRAINT commerce_pricing_policies_name_length
    CHECK (char_length(name) BETWEEN 2 AND 100),
  tax_rate_bps integer NOT NULL
    CONSTRAINT commerce_pricing_policies_tax_range
    CHECK (tax_rate_bps BETWEEN 0 AND 10000),
  delivery_fee_paise integer NOT NULL DEFAULT 0
    CONSTRAINT commerce_pricing_policies_delivery_nonnegative
    CHECK (delivery_fee_paise >= 0),
  packaging_fee_paise integer NOT NULL DEFAULT 0
    CONSTRAINT commerce_pricing_policies_packaging_nonnegative
    CHECK (packaging_fee_paise >= 0),
  calculation_version text NOT NULL
    CONSTRAINT commerce_pricing_policies_version_length
    CHECK (char_length(calculation_version) BETWEEN 1 AND 80),
  effective_from timestamptz NOT NULL,
  effective_until timestamptz,
  status text NOT NULL
    CONSTRAINT commerce_pricing_policies_status_valid
    CHECK (status IN ('draft', 'active', 'retired')),
  version integer NOT NULL DEFAULT 1
    CONSTRAINT commerce_pricing_policies_version_positive
    CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, outlet_id, calculation_version),
  FOREIGN KEY (tenant_id, outlet_id) REFERENCES outlets(tenant_id, id),
  CONSTRAINT commerce_pricing_policies_effective_range
    CHECK (effective_until IS NULL OR effective_until > effective_from)
);

CREATE UNIQUE INDEX commerce_pricing_policies_one_active_per_outlet
  ON commerce_pricing_policies (tenant_id, outlet_id)
  WHERE status = 'active';

ALTER TABLE commerce_pricing_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_pricing_policies FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON commerce_pricing_policies
  USING (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')
  )
  WITH CHECK (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')
  );

CREATE OR REPLACE FUNCTION enforce_pricing_policy_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'Pricing policy version must increase by exactly one';
  END IF;

  IF NEW.status <> OLD.status AND NOT (
    (OLD.status = 'draft' AND NEW.status IN ('active', 'retired')) OR
    (OLD.status = 'active' AND NEW.status = 'retired')
  ) THEN
    RAISE EXCEPTION 'Illegal pricing policy transition: % -> %', OLD.status, NEW.status;
  END IF;

  IF OLD.status = 'active' AND (
    NEW.tenant_id,
    NEW.outlet_id,
    NEW.tax_rate_bps,
    NEW.delivery_fee_paise,
    NEW.packaging_fee_paise,
    NEW.calculation_version,
    NEW.effective_from,
    NEW.effective_until
  ) IS DISTINCT FROM (
    OLD.tenant_id,
    OLD.outlet_id,
    OLD.tax_rate_bps,
    OLD.delivery_fee_paise,
    OLD.packaging_fee_paise,
    OLD.calculation_version,
    OLD.effective_from,
    OLD.effective_until
  ) THEN
    RAISE EXCEPTION 'Active pricing facts are immutable; retire and create a new policy';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END
$$;

CREATE TRIGGER commerce_pricing_policies_enforce_transition
  BEFORE UPDATE ON commerce_pricing_policies
  FOR EACH ROW EXECUTE FUNCTION enforce_pricing_policy_transition();

ALTER TABLE checkout_quotes
  ADD COLUMN request_fingerprint text NOT NULL
    DEFAULT 'legacy-request-unavailable';

ALTER TABLE checkout_quotes
  ALTER COLUMN request_fingerprint DROP DEFAULT,
  ADD CONSTRAINT checkout_quotes_request_fingerprint_length
    CHECK (char_length(request_fingerprint) BETWEEN 16 AND 128);

ALTER TABLE payment_intents
  ADD COLUMN request_fingerprint text NOT NULL
    DEFAULT 'legacy-request-unavailable',
  ADD COLUMN provider_payment_reference text,
  ADD COLUMN provider_event_id text,
  ADD COLUMN provider_client_payload jsonb NOT NULL DEFAULT '{}'::jsonb
    CONSTRAINT payment_intents_client_payload_object
    CHECK (jsonb_typeof(provider_client_payload) = 'object'),
  ADD COLUMN failure_code text;

ALTER TABLE payment_intents
  ALTER COLUMN request_fingerprint DROP DEFAULT,
  ADD CONSTRAINT payment_intents_request_fingerprint_length
    CHECK (char_length(request_fingerprint) BETWEEN 16 AND 128);

CREATE UNIQUE INDEX payment_intents_provider_payment_unique
  ON payment_intents (provider, provider_payment_reference)
  WHERE provider_payment_reference IS NOT NULL;

CREATE UNIQUE INDEX payment_intents_provider_event_unique
  ON payment_intents (provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;

COMMENT ON COLUMN checkout_quotes.request_fingerprint IS
  'Digest of canonical customer quote input. Reusing an idempotency key with different input is rejected.';
COMMENT ON COLUMN payment_intents.provider_client_payload IS
  'Provider-approved public checkout fields only; secrets and raw webhook bodies are prohibited.';
COMMENT ON TABLE commerce_pricing_policies IS
  'Effective-dated, versioned tax and fee input. Legal changes must be activated as a new reviewed policy.';

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
    NEW.request_fingerprint,
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
    OLD.request_fingerprint,
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
    NEW.provider_intent_reference,
    NEW.idempotency_key,
    NEW.request_fingerprint,
    NEW.amount_paise,
    NEW.currency,
    NEW.provider_client_payload
  ) IS DISTINCT FROM (
    OLD.tenant_id,
    OLD.outlet_id,
    OLD.quote_id,
    OLD.provider,
    OLD.provider_intent_reference,
    OLD.idempotency_key,
    OLD.request_fingerprint,
    OLD.amount_paise,
    OLD.currency,
    OLD.provider_client_payload
  ) THEN
    RAISE EXCEPTION 'Payment intent commercial facts are immutable';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END
$$;
