CREATE TABLE customer_otp_challenges (
  id text PRIMARY KEY CHECK (id ~ '^otp_[A-Za-z0-9][A-Za-z0-9_-]{15,80}$'),
  tenant_id text NOT NULL REFERENCES tenants(id),
  outlet_id text NOT NULL,
  phone_e164 text NOT NULL CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  code_digest text NOT NULL CHECK (code_digest ~ '^[a-f0-9]{64}$'),
  delivery_status text NOT NULL
    CHECK (delivery_status IN ('pending', 'sent', 'failed')),
  provider_reference text,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL CHECK (max_attempts BETWEEN 1 AND 10),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  request_ip_digest text NOT NULL CHECK (request_ip_digest ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, outlet_id) REFERENCES outlets(tenant_id, id),
  CHECK (expires_at > created_at),
  CHECK (consumed_at IS NULL OR consumed_at >= created_at)
);

CREATE TABLE customer_sessions (
  id text PRIMARY KEY CHECK (id ~ '^ses_[A-Za-z0-9][A-Za-z0-9_-]{15,80}$'),
  tenant_id text NOT NULL REFERENCES tenants(id),
  customer_id text NOT NULL,
  token_digest text NOT NULL CHECK (token_digest ~ '^[a-f0-9]{64}$'),
  user_agent_digest text NOT NULL CHECK (user_agent_digest ~ '^[a-f0-9]{64}$'),
  ip_digest text NOT NULL CHECK (ip_digest ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (token_digest),
  FOREIGN KEY (tenant_id, customer_id) REFERENCES customers(tenant_id, id),
  CHECK (expires_at > created_at),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE INDEX customer_otp_recent_idx
  ON customer_otp_challenges (tenant_id, phone_e164, created_at DESC);
CREATE INDEX customer_otp_expiry_idx
  ON customer_otp_challenges (expires_at)
  WHERE consumed_at IS NULL;
CREATE INDEX customer_session_customer_idx
  ON customer_sessions (tenant_id, customer_id, created_at DESC)
  WHERE revoked_at IS NULL;
CREATE INDEX customer_session_expiry_idx
  ON customer_sessions (expires_at)
  WHERE revoked_at IS NULL;

DO $$
DECLARE
  tenant_table text;
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY[
    'customer_otp_challenges',
    'customer_sessions'
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

COMMENT ON TABLE customer_otp_challenges IS
  'Short-lived, rate-limited OTP challenges. Plain OTP values are never persisted.';
COMMENT ON TABLE customer_sessions IS
  'Revocable customer sessions. Only a keyed digest of the opaque cookie token is stored.';
