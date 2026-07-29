import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/api/app.js';
import { AuthError, type AuthConfig } from '../src/auth/index.js';
import type { CustomerAuthService } from '../src/auth/service.js';
import { CommerceError, type CommerceService } from '../src/commerce/index.js';

const authConfig: AuthConfig = {
  nodeEnv: 'test',
  pepper: 'test-pepper-that-is-definitely-longer-than-32-characters',
  provider: 'development',
  developmentOtp: '123456',
  otpTtlSeconds: 300,
  otpCooldownSeconds: 60,
  otpMaxAttempts: 5,
  sessionTtlDays: 30,
  secureCookie: false,
};

const profile = {
  id: 'cus_demo01',
  phone: '9876543210',
  phoneE164: '+919876543210',
  firstName: 'Asha',
  dietaryPreference: 'vegetarian',
  spicePreference: 'medium',
  allergies: [],
  marketingConsent: false,
};

const createAuthService = () =>
  ({
    requestOtp: vi.fn().mockResolvedValue({
      requestId: 'otp_01JABCDEFGHJKLMNPQ',
      phone: '9876543210',
      expiresAt: '2026-07-29T13:17:08.000Z',
      retryAfterSeconds: 60,
      developmentOtp: '123456',
    }),
    verifyOtp: vi.fn().mockResolvedValue({
      sessionToken: 'ten_demo01.opaque-token',
      expiresAt: '2026-08-28T13:12:08.000Z',
      customer: profile,
    }),
    authenticate: vi.fn().mockResolvedValue({
      tenantId: 'ten_demo01',
      customerId: 'cus_demo01',
      sessionId: 'ses_demo_session01',
      profile,
    }),
    revokeSession: vi.fn().mockResolvedValue(undefined),
    updateProfile: vi.fn().mockResolvedValue(profile),
  }) satisfies Pick<
    CustomerAuthService,
    'requestOtp' | 'verifyOtp' | 'authenticate' | 'revokeSession' | 'updateProfile'
  >;

const createCommerceService = () =>
  ({
    createQuote: vi.fn().mockResolvedValue({
      id: 'qte_demo01',
      status: 'active',
      pricing: { totalPaise: 32_500 },
    }),
    createPaymentIntent: vi.fn().mockResolvedValue({
      id: 'pay_demo01',
      status: 'pending',
    }),
    applyPaymentWebhook: vi.fn().mockResolvedValue({
      accepted: true,
      duplicate: false,
    }),
    checkout: vi.fn().mockResolvedValue({
      id: 'ord_demo01',
      status: 'placed',
      duplicate: false,
    }),
  }) satisfies Pick<
    CommerceService,
    'createQuote' | 'createPaymentIntent' | 'applyPaymentWebhook' | 'checkout'
  >;

describe('customer authentication API', () => {
  const applications: Awaited<ReturnType<typeof buildApp>>[] = [];

  afterEach(async () => {
    await Promise.all(applications.splice(0).map((app) => app.close()));
  });

  it('does not accept state-changing requests without the customer client header', async () => {
    const authService = createAuthService();
    const app = await buildApp({ authService, authConfig });
    applications.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/customer/auth/otp/request',
      payload: {
        tenantId: 'ten_demo01',
        outletId: 'out_demo01',
        phone: '9876543210',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('CLIENT_HEADER_REQUIRED');
    expect(authService.requestOtp).not.toHaveBeenCalled();
  });

  it('creates a rate-limited OTP challenge without setting a session', async () => {
    const authService = createAuthService();
    const app = await buildApp({ authService, authConfig });
    applications.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/customer/auth/otp/request',
      headers: { 'x-rms-client': 'customer-web' },
      payload: {
        tenantId: 'ten_demo01',
        outletId: 'out_demo01',
        phone: '9876543210',
      },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json().challenge.requestId).toBe('otp_01JABCDEFGHJKLMNPQ');
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('sets an HttpOnly session cookie only after successful verification', async () => {
    const authService = createAuthService();
    const app = await buildApp({ authService, authConfig });
    applications.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/customer/auth/otp/verify',
      headers: { 'x-rms-client': 'customer-web' },
      payload: {
        tenantId: 'ten_demo01',
        outletId: 'out_demo01',
        requestId: 'otp_01JABCDEFGHJKLMNPQ',
        phone: '9876543210',
        otp: '123456',
        firstName: 'Asha',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['set-cookie']).toContain('HttpOnly');
    expect(response.headers['set-cookie']).toContain('SameSite=Lax');
    expect(response.headers['set-cookie']).toContain('Path=/api/v1/customer');
    expect(response.json().customer.phoneE164).toBe('+919876543210');
  });

  it('returns a stable error shape for an expired session', async () => {
    const authService = createAuthService();
    authService.authenticate.mockRejectedValue(
      new AuthError('SESSION_EXPIRED', 401, 'Your session has expired'),
    );
    const app = await buildApp({ authService, authConfig });
    applications.push(app);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/customer/auth/me',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      success: false,
      error: {
        code: 'SESSION_EXPIRED',
        message: 'Your session has expired',
      },
    });
  });
});

describe('customer commerce API', () => {
  const applications: Awaited<ReturnType<typeof buildApp>>[] = [];

  afterEach(async () => {
    await Promise.all(applications.splice(0).map((app) => app.close()));
  });

  it('authenticates and validates a server-priced quote request', async () => {
    const authService = createAuthService();
    const commerceService = createCommerceService();
    const app = await buildApp({ authService, commerceService, authConfig });
    applications.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/customer/quotes',
      headers: {
        cookie: 'rms_customer_session=opaque-session',
        'x-rms-client': 'customer-web',
      },
      payload: {
        outletId: 'out_demo01',
        idempotencyKey: 'quote-request-demo-0001',
        fulfilment: { type: 'pickup' },
        lines: [
          {
            itemId: 'itm_demo01',
            quantity: 1,
            modifierOptionIds: [],
          },
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().quote.id).toBe('qte_demo01');
    expect(authService.authenticate).toHaveBeenCalledWith('opaque-session');
    expect(commerceService.createQuote).toHaveBeenCalledOnce();
  });

  it('rejects checkout before invoking commerce when request data is invalid', async () => {
    const authService = createAuthService();
    const commerceService = createCommerceService();
    const app = await buildApp({ authService, commerceService, authConfig });
    applications.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/customer/checkout',
      headers: { 'x-rms-client': 'customer-web' },
      payload: {
        quoteId: 'invalid',
        paymentIntentId: 'invalid',
        idempotencyKey: 'checkout-request-demo-01',
        allergenAcknowledgements: {},
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect(commerceService.checkout).not.toHaveBeenCalled();
  });

  it('returns stable commerce conflicts without leaking database details', async () => {
    const authService = createAuthService();
    const commerceService = createCommerceService();
    commerceService.createPaymentIntent.mockRejectedValue(
      new CommerceError(
        'QUOTE_UNAVAILABLE',
        409,
        'The quote has expired or is no longer available',
      ),
    );
    const app = await buildApp({ authService, commerceService, authConfig });
    applications.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/customer/payments/intents',
      headers: { 'x-rms-client': 'customer-web' },
      payload: {
        quoteId: 'qte_demo01',
        idempotencyKey: 'payment-request-demo-01',
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      success: false,
      error: {
        code: 'QUOTE_UNAVAILABLE',
        message: 'The quote has expired or is no longer available',
      },
    });
  });

  it('forwards the signed provider webhook through the payment boundary', async () => {
    const authService = createAuthService();
    const commerceService = createCommerceService();
    const app = await buildApp({ authService, commerceService, authConfig });
    applications.push(app);

    const body = {
      eventId: 'provider-event-demo-01',
      type: 'payment.verified',
      tenantId: 'ten_demo01',
      outletId: 'out_demo01',
      providerIntentReference: 'provider-intent-demo-01',
      providerPaymentReference: 'provider-payment-demo-01',
      amountPaise: 32_500,
      currency: 'INR',
      occurredAt: '2026-07-29T18:30:00.000Z',
    };
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/webhooks/development',
      headers: { 'x-rms-payment-signature': 'sha256=signed' },
      payload: body,
    });

    expect(response.statusCode).toBe(202);
    expect(commerceService.applyPaymentWebhook).toHaveBeenCalledWith(
      'development',
      body,
      'sha256=signed',
      expect.objectContaining({ correlationId: expect.any(String) }),
    );
  });
});
