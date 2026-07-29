import { describe, expect, it } from 'vitest';
import {
  createPaymentProvider,
  readPaymentConfig,
  signPaymentWebhook,
} from '../src/commerce/index.js';

const secret = 'payment-webhook-secret-that-is-long-enough-for-tests';
const webhook = {
  eventId: 'provider-event-0001',
  type: 'payment.verified' as const,
  tenantId: 'ten_demo01',
  outletId: 'out_demo01',
  providerIntentReference: 'provider-intent-0001',
  providerPaymentReference: 'provider-payment-0001',
  amountPaise: 40_750,
  currency: 'INR' as const,
  occurredAt: '2026-07-29T18:30:00.000Z',
};

describe('payment provider boundary', () => {
  it('prohibits development payments in production', () => {
    expect(() =>
      readPaymentConfig({
        NODE_ENV: 'production',
        PAYMENT_PROVIDER: 'development',
        PAYMENT_WEBHOOK_SECRET: secret,
      }),
    ).toThrow(/prohibited in production/);
  });

  it('requires an HTTPS endpoint and credentials for the HTTP adapter', () => {
    expect(() =>
      readPaymentConfig({
        NODE_ENV: 'production',
        PAYMENT_PROVIDER: 'http',
        PAYMENT_HTTP_URL: 'http://payments.example.com',
        PAYMENT_WEBHOOK_SECRET: secret,
      }),
    ).toThrow();
  });

  it('accepts a correctly signed normalized webhook and rejects tampering', () => {
    const provider = createPaymentProvider(
      readPaymentConfig({
        NODE_ENV: 'test',
        PAYMENT_PROVIDER: 'development',
        PAYMENT_WEBHOOK_SECRET: secret,
      }),
    );
    const signature = signPaymentWebhook(secret, webhook);

    expect(provider.verifyWebhook(webhook, signature)).toEqual(webhook);
    expect(() =>
      provider.verifyWebhook({ ...webhook, amountPaise: 1 }, signature),
    ).toThrow(/signature/);
  });
});
