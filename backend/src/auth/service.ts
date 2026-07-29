import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import {
  CustomerIdSchema,
  TenantIdSchema,
  type MaosEvent,
} from '../contracts/index.js';
import { appendEventToOutbox, withTenantTransaction } from '../database/index.js';
import type { AuthConfig } from './config.js';
import {
  createOpaqueId,
  createOtpCode,
  createSessionToken,
  keyedDigest,
  normaliseIndianPhone,
  otpDigest,
  safeDigestEqual,
} from './crypto.js';
import { AuthError } from './errors.js';
import type { OtpProvider } from './otp-provider.js';
import type {
  CustomerProfileUpdate,
  RequestOtpBody,
  VerifyOtpBody,
} from './schemas.js';

type RequestMetadata = {
  ip: string;
  userAgent: string;
  correlationId: string;
};

type CustomerRecord = {
  id: string;
  phone_e164: string;
  first_name: string;
  dietary_preference: string;
  spice_preference: string;
  allergies: unknown;
  marketing_consent: boolean;
};

export type AuthenticatedCustomer = {
  tenantId: string;
  customerId: string;
  sessionId: string;
  profile: {
    id: string;
    phone: string;
    phoneE164: string;
    firstName: string;
    dietaryPreference: string;
    spicePreference: string;
    allergies: string[];
    marketingConsent: boolean;
  };
};

const toCustomerProfile = (record: CustomerRecord): AuthenticatedCustomer['profile'] => ({
  id: record.id,
  phone: record.phone_e164.slice(-10),
  phoneE164: record.phone_e164,
  firstName: record.first_name,
  dietaryPreference: record.dietary_preference,
  spicePreference: record.spice_preference,
  allergies: Array.isArray(record.allergies)
    ? record.allergies.filter((value): value is string => typeof value === 'string')
    : [],
  marketingConsent: record.marketing_consent,
});

const buildAuthEvent = (input: {
  type: string;
  tenantId: string;
  outletId: string;
  correlationId: string;
  idempotencyKey: string;
  subjectType: string;
  subjectId: string;
  data: Record<string, unknown>;
}): MaosEvent => ({
  specversion: '1.0',
  type: input.type,
  source: 'rms/customer-auth',
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
  data_class: 'operational',
  consent_ref: null,
  data: input.data,
});

export class CustomerAuthService {
  constructor(
    private readonly pool: Pool,
    private readonly config: AuthConfig,
    private readonly otpProvider: OtpProvider,
  ) {}

  async requestOtp(input: RequestOtpBody, metadata: RequestMetadata) {
    const phoneE164 = this.parsePhone(input.phone);
    const challengeId = createOpaqueId('otp');
    const code =
      this.config.provider === 'development'
        ? this.config.developmentOtp
        : createOtpCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.otpTtlSeconds * 1_000);

    const creation = await withTenantTransaction(
      this.pool,
      {
        tenantId: input.tenantId,
        correlationId: metadata.correlationId,
      },
      async (client) => {
        await this.assertActiveOutlet(client, input.tenantId, input.outletId);
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          `${input.tenantId}:${phoneE164}:otp`,
        ]);

        const recent = await client.query<{ retry_after_seconds: number }>(
          `
            SELECT GREATEST(
              0,
              CEIL(EXTRACT(EPOCH FROM (
                created_at + make_interval(secs => $3) - now()
              )))::integer
            ) AS retry_after_seconds
            FROM customer_otp_challenges
            WHERE tenant_id = $1
              AND phone_e164 = $2
              AND delivery_status <> 'failed'
              AND consumed_at IS NULL
              AND created_at > now() - make_interval(secs => $3)
            ORDER BY created_at DESC
            LIMIT 1
          `,
          [input.tenantId, phoneE164, this.config.otpCooldownSeconds],
        );

        const retryAfter = recent.rows[0]?.retry_after_seconds ?? 0;
        if (retryAfter > 0) {
          return { created: false as const, retryAfter };
        }

        await client.query(
          `
            UPDATE customer_otp_challenges
            SET consumed_at = now()
            WHERE tenant_id = $1
              AND phone_e164 = $2
              AND consumed_at IS NULL
          `,
          [input.tenantId, phoneE164],
        );

        await client.query(
          `
            INSERT INTO customer_otp_challenges (
              id,
              tenant_id,
              outlet_id,
              phone_e164,
              code_digest,
              delivery_status,
              max_attempts,
              expires_at,
              request_ip_digest
            )
            VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8)
          `,
          [
            challengeId,
            input.tenantId,
            input.outletId,
            phoneE164,
            otpDigest(this.config.pepper, challengeId, phoneE164, code),
            this.config.otpMaxAttempts,
            expiresAt.toISOString(),
            keyedDigest(this.config.pepper, metadata.ip),
          ],
        );

        await appendEventToOutbox(
          client,
          buildAuthEvent({
            type: 'customer.otp_requested',
            tenantId: input.tenantId,
            outletId: input.outletId,
            correlationId: metadata.correlationId,
            idempotencyKey: `otp:${challengeId}:requested`,
            subjectType: 'otp',
            subjectId: challengeId,
            data: { expiresAt: expiresAt.toISOString() },
          }),
        );

        return { created: true as const };
      },
    );

    if (!creation.created) {
      throw new AuthError(
        'OTP_COOLDOWN',
        429,
        'Please wait before requesting another OTP',
        creation.retryAfter,
      );
    }

    try {
      const delivery = await this.otpProvider.send({
        phoneE164,
        code,
        expiresInSeconds: this.config.otpTtlSeconds,
      });
      await this.setDeliveryStatus(
        input.tenantId,
        challengeId,
        'sent',
        delivery.providerReference,
        metadata.correlationId,
      );
    } catch {
      await this.setDeliveryStatus(
        input.tenantId,
        challengeId,
        'failed',
        null,
        metadata.correlationId,
      );
      throw new AuthError(
        'OTP_DELIVERY_FAILED',
        502,
        'We could not send the OTP. Please try again.',
      );
    }

    return {
      requestId: challengeId,
      phone: phoneE164.slice(-10),
      expiresAt: expiresAt.toISOString(),
      retryAfterSeconds: this.config.otpCooldownSeconds,
      ...(this.config.provider === 'development' ? { developmentOtp: code } : {}),
    };
  }

  async verifyOtp(input: VerifyOtpBody, metadata: RequestMetadata) {
    const phoneE164 = this.parsePhone(input.phone);
    const sessionId = createOpaqueId('ses');
    const sessionToken = createSessionToken(input.tenantId);
    const sessionExpiresAt = new Date(
      Date.now() + this.config.sessionTtlDays * 24 * 60 * 60 * 1_000,
    );

    const verification = await withTenantTransaction(
      this.pool,
      {
        tenantId: input.tenantId,
        correlationId: metadata.correlationId,
      },
      async (client) => {
        await this.assertActiveOutlet(client, input.tenantId, input.outletId);
        const challengeResult = await client.query<{
          code_digest: string;
          attempts: number;
          max_attempts: number;
          expires_at: Date;
          consumed_at: Date | null;
          delivery_status: string;
        }>(
          `
            SELECT
              code_digest,
              attempts,
              max_attempts,
              expires_at,
              consumed_at,
              delivery_status
            FROM customer_otp_challenges
            WHERE tenant_id = $1
              AND outlet_id = $2
              AND id = $3
              AND phone_e164 = $4
            FOR UPDATE
          `,
          [input.tenantId, input.outletId, input.requestId, phoneE164],
        );

        const challenge = challengeResult.rows[0];
        if (!challenge || challenge.delivery_status !== 'sent') {
          return { ok: false as const, code: 'OTP_INVALID' };
        }
        if (challenge.consumed_at) {
          return { ok: false as const, code: 'OTP_USED' };
        }
        if (challenge.expires_at.getTime() <= Date.now()) {
          return { ok: false as const, code: 'OTP_EXPIRED' };
        }
        if (challenge.attempts >= challenge.max_attempts) {
          return { ok: false as const, code: 'OTP_LOCKED' };
        }

        const candidateDigest = otpDigest(
          this.config.pepper,
          input.requestId,
          phoneE164,
          input.otp,
        );
        if (!safeDigestEqual(challenge.code_digest, candidateDigest)) {
          const nextAttempts = challenge.attempts + 1;
          await client.query(
            `
              UPDATE customer_otp_challenges
              SET
                attempts = $3,
                consumed_at = CASE WHEN $3 >= max_attempts THEN now() ELSE NULL END
              WHERE tenant_id = $1 AND id = $2
            `,
            [input.tenantId, input.requestId, nextAttempts],
          );
          return {
            ok: false as const,
            code: nextAttempts >= challenge.max_attempts ? 'OTP_LOCKED' : 'OTP_INVALID',
          };
        }

        await client.query(
          `
            UPDATE customer_otp_challenges
            SET consumed_at = now()
            WHERE tenant_id = $1 AND id = $2
          `,
          [input.tenantId, input.requestId],
        );

        const newCustomerId = createOpaqueId('cus');
        const customerResult = await client.query<CustomerRecord>(
          `
            INSERT INTO customers (
              id,
              tenant_id,
              phone_e164,
              first_name
            )
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (tenant_id, phone_e164)
            DO UPDATE SET updated_at = now()
            RETURNING
              id,
              phone_e164,
              first_name,
              dietary_preference,
              spice_preference,
              allergies,
              EXISTS (
                SELECT 1
                FROM customer_consents
                WHERE tenant_id = $2
                  AND customer_id = customers.id
                  AND purpose = 'marketing_whatsapp'
                  AND status = 'granted'
              ) AS marketing_consent
          `,
          [newCustomerId, input.tenantId, phoneE164, input.firstName],
        );
        const customer = customerResult.rows[0];
        if (!customer) throw new Error('Customer upsert did not return a record');

        await client.query(
          `
            INSERT INTO customer_sessions (
              id,
              tenant_id,
              customer_id,
              token_digest,
              user_agent_digest,
              ip_digest,
              expires_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            sessionId,
            input.tenantId,
            customer.id,
            keyedDigest(this.config.pepper, sessionToken),
            keyedDigest(this.config.pepper, metadata.userAgent),
            keyedDigest(this.config.pepper, metadata.ip),
            sessionExpiresAt.toISOString(),
          ],
        );

        await appendEventToOutbox(
          client,
          buildAuthEvent({
            type: 'customer.authenticated',
            tenantId: input.tenantId,
            outletId: input.outletId,
            correlationId: metadata.correlationId,
            idempotencyKey: `otp:${input.requestId}:verified`,
            subjectType: 'customer',
            subjectId: customer.id,
            data: { sessionId },
          }),
        );

        return { ok: true as const, customer };
      },
    );

    if (!verification.ok) {
      const messages: Record<string, string> = {
        OTP_USED: 'This OTP has already been used',
        OTP_EXPIRED: 'This OTP has expired',
        OTP_LOCKED: 'Too many incorrect attempts. Request a new OTP.',
        OTP_INVALID: 'The OTP is incorrect',
      };
      throw new AuthError(
        verification.code,
        401,
        messages[verification.code] ?? 'OTP verification failed',
      );
    }

    return {
      sessionToken,
      expiresAt: sessionExpiresAt.toISOString(),
      customer: toCustomerProfile(verification.customer),
    };
  }

  async authenticate(sessionToken: string | undefined): Promise<AuthenticatedCustomer> {
    if (!sessionToken) {
      throw new AuthError('AUTH_REQUIRED', 401, 'Sign in to continue');
    }

    const [tenantCandidate] = sessionToken.split('.', 1);
    const tenantId = TenantIdSchema.safeParse(tenantCandidate);
    if (!tenantId.success) {
      throw new AuthError('SESSION_INVALID', 401, 'Your session is invalid');
    }

    const result = await withTenantTransaction(
      this.pool,
      {
        tenantId: tenantId.data,
        correlationId: createOpaqueId('cor'),
      },
      async (client) => {
        const sessionResult = await client.query<
          CustomerRecord & { session_id: string; customer_id: string }
        >(
          `
            SELECT
              session.id AS session_id,
              session.customer_id,
              customer.id,
              customer.phone_e164,
              customer.first_name,
              customer.dietary_preference,
              customer.spice_preference,
              customer.allergies,
              EXISTS (
                SELECT 1
                FROM customer_consents consent
                WHERE consent.tenant_id = session.tenant_id
                  AND consent.customer_id = session.customer_id
                  AND consent.purpose = 'marketing_whatsapp'
                  AND consent.status = 'granted'
              ) AS marketing_consent
            FROM customer_sessions session
            JOIN customers customer
              ON customer.tenant_id = session.tenant_id
             AND customer.id = session.customer_id
            WHERE session.tenant_id = $1
              AND session.token_digest = $2
              AND session.revoked_at IS NULL
              AND session.expires_at > now()
            LIMIT 1
          `,
          [tenantId.data, keyedDigest(this.config.pepper, sessionToken)],
        );
        const session = sessionResult.rows[0];
        if (!session) return null;

        await client.query(
          `
            UPDATE customer_sessions
            SET last_seen_at = now()
            WHERE tenant_id = $1
              AND id = $2
              AND last_seen_at < now() - interval '5 minutes'
          `,
          [tenantId.data, session.session_id],
        );
        return session;
      },
    );

    if (!result) {
      throw new AuthError('SESSION_EXPIRED', 401, 'Your session has expired');
    }

    return {
      tenantId: tenantId.data,
      customerId: CustomerIdSchema.parse(result.customer_id),
      sessionId: result.session_id,
      profile: toCustomerProfile(result),
    };
  }

  async revokeSession(authenticated: AuthenticatedCustomer): Promise<void> {
    await withTenantTransaction(
      this.pool,
      {
        tenantId: authenticated.tenantId,
        correlationId: createOpaqueId('cor'),
      },
      async (client) => {
        await client.query(
          `
            UPDATE customer_sessions
            SET revoked_at = now()
            WHERE tenant_id = $1
              AND id = $2
              AND revoked_at IS NULL
          `,
          [authenticated.tenantId, authenticated.sessionId],
        );
      },
    );
  }

  async updateProfile(
    authenticated: AuthenticatedCustomer,
    update: CustomerProfileUpdate,
  ): Promise<AuthenticatedCustomer['profile']> {
    return withTenantTransaction(
      this.pool,
      {
        tenantId: authenticated.tenantId,
        correlationId: createOpaqueId('cor'),
      },
      async (client) => {
        const result = await client.query<CustomerRecord>(
          `
            UPDATE customers
            SET
              first_name = COALESCE($3, first_name),
              dietary_preference = COALESCE($4, dietary_preference),
              spice_preference = COALESCE($5, spice_preference),
              allergies = COALESCE($6::jsonb, allergies),
              profile_version = profile_version + 1,
              updated_at = now()
            WHERE tenant_id = $1 AND id = $2
            RETURNING
              id,
              phone_e164,
              first_name,
              dietary_preference,
              spice_preference,
              allergies,
              false AS marketing_consent
          `,
          [
            authenticated.tenantId,
            authenticated.customerId,
            update.firstName ?? null,
            update.dietaryPreference ?? null,
            update.spicePreference ?? null,
            update.allergies ? JSON.stringify(update.allergies) : null,
          ],
        );
        const customer = result.rows[0];
        if (!customer) throw new AuthError('CUSTOMER_NOT_FOUND', 404, 'Customer not found');

        if (update.marketingConsent !== undefined) {
          await this.updateMarketingConsent(
            client,
            authenticated.tenantId,
            authenticated.customerId,
            update.marketingConsent,
          );
          customer.marketing_consent = update.marketingConsent;
        } else {
          customer.marketing_consent = authenticated.profile.marketingConsent;
        }

        return toCustomerProfile(customer);
      },
    );
  }

  private async setDeliveryStatus(
    tenantId: string,
    challengeId: string,
    status: 'sent' | 'failed',
    providerReference: string | null,
    correlationId: string,
  ): Promise<void> {
    await withTenantTransaction(
      this.pool,
      { tenantId: TenantIdSchema.parse(tenantId), correlationId },
      async (client) => {
        await client.query(
          `
            UPDATE customer_otp_challenges
            SET delivery_status = $3, provider_reference = $4
            WHERE tenant_id = $1 AND id = $2 AND delivery_status = 'pending'
          `,
          [tenantId, challengeId, status, providerReference],
        );
      },
    );
  }

  private parsePhone(input: string): string {
    try {
      return normaliseIndianPhone(input);
    } catch {
      throw new AuthError('PHONE_INVALID', 400, 'Enter a valid Indian mobile number');
    }
  }

  private async assertActiveOutlet(
    client: PoolClient,
    tenantId: string,
    outletId: string,
  ): Promise<void> {
    const result = await client.query(
      `
        SELECT 1
        FROM outlets outlet
        JOIN tenants tenant ON tenant.id = outlet.tenant_id
        WHERE outlet.tenant_id = $1
          AND outlet.id = $2
          AND tenant.status IN ('trial', 'active')
          AND outlet.status <> 'closed'
      `,
      [tenantId, outletId],
    );
    if (result.rowCount !== 1) {
      throw new AuthError('OUTLET_UNAVAILABLE', 404, 'This kitchen is unavailable');
    }
  }

  private async updateMarketingConsent(
    client: PoolClient,
    tenantId: string,
    customerId: string,
    granted: boolean,
  ): Promise<void> {
    if (granted) {
      await client.query(
        `
          INSERT INTO customer_consents (
            id,
            tenant_id,
            customer_id,
            purpose,
            status,
            notice_version,
            source,
            recorded_at
          )
          SELECT $1, $2, $3, 'marketing_whatsapp', 'granted', 'privacy-1.0', 'customer_app', now()
          WHERE NOT EXISTS (
            SELECT 1
            FROM customer_consents
            WHERE tenant_id = $2
              AND customer_id = $3
              AND purpose = 'marketing_whatsapp'
              AND status = 'granted'
          )
        `,
        [randomUUID(), tenantId, customerId],
      );
      return;
    }

    await client.query(
      `
        UPDATE customer_consents
        SET status = 'withdrawn', withdrawn_at = now()
        WHERE tenant_id = $1
          AND customer_id = $2
          AND purpose = 'marketing_whatsapp'
          AND status = 'granted'
      `,
      [tenantId, customerId],
    );
  }
}
