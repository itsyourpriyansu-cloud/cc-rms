import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { PaymentWebhookBodySchema, type PaymentWebhookBody } from './schemas.js';

export type CreateProviderIntentInput = {
  paymentIntentId: string;
  tenantId: string;
  outletId: string;
  quoteId: string;
  amountPaise: number;
  currency: 'INR';
  idempotencyKey: string;
};

export type ProviderIntent = {
  providerIntentReference: string;
  clientPayload: Record<string, unknown>;
};

export interface PaymentProvider {
  readonly name: string;
  createIntent(input: CreateProviderIntentInput): Promise<ProviderIntent>;
  verifyWebhook(body: unknown, signature: string | undefined): PaymentWebhookBody;
}

const PaymentEnvironmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PAYMENT_PROVIDER: z.enum(['development', 'http']).default('development'),
    PAYMENT_HTTP_URL: z.url().optional(),
    PAYMENT_HTTP_API_KEY: z.string().min(24).optional(),
    PAYMENT_WEBHOOK_SECRET: z.string().min(32),
  })
  .superRefine((environment, context) => {
    if (
      environment.NODE_ENV === 'production' &&
      environment.PAYMENT_PROVIDER === 'development'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['PAYMENT_PROVIDER'],
        message: 'Development payments are prohibited in production',
      });
    }
    if (environment.PAYMENT_PROVIDER === 'http') {
      if (!environment.PAYMENT_HTTP_URL?.startsWith('https://')) {
        context.addIssue({
          code: 'custom',
          path: ['PAYMENT_HTTP_URL'],
          message: 'The production payment adapter requires an HTTPS URL',
        });
      }
      if (!environment.PAYMENT_HTTP_API_KEY) {
        context.addIssue({
          code: 'custom',
          path: ['PAYMENT_HTTP_API_KEY'],
          message: 'The HTTP payment adapter requires an API key',
        });
      }
    }
  });

export type PaymentConfig = z.infer<typeof PaymentEnvironmentSchema>;

export const readPaymentConfig = (
  environment: NodeJS.ProcessEnv = process.env,
): PaymentConfig => PaymentEnvironmentSchema.parse(environment);

const canonicalWebhook = (event: PaymentWebhookBody): string =>
  JSON.stringify({
    eventId: event.eventId,
    type: event.type,
    tenantId: event.tenantId,
    outletId: event.outletId,
    providerIntentReference: event.providerIntentReference,
    providerPaymentReference: event.providerPaymentReference ?? null,
    amountPaise: event.amountPaise,
    currency: event.currency,
    occurredAt: event.occurredAt,
    failureCode: event.failureCode ?? null,
  });

export const signPaymentWebhook = (
  secret: string,
  body: PaymentWebhookBody,
): string =>
  `sha256=${createHmac('sha256', secret).update(canonicalWebhook(body)).digest('hex')}`;

abstract class SignedPaymentProvider implements PaymentProvider {
  abstract readonly name: string;

  constructor(private readonly webhookSecret: string) {}

  abstract createIntent(
    input: CreateProviderIntentInput,
  ): Promise<ProviderIntent>;

  verifyWebhook(body: unknown, signature: string | undefined): PaymentWebhookBody {
    const event = PaymentWebhookBodySchema.parse(body);
    const expected = signPaymentWebhook(this.webhookSecret, event);
    const supplied = signature ?? '';
    const matches =
      supplied.length === expected.length &&
      timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));

    if (!matches) throw new Error('Invalid payment webhook signature');
    return event;
  }
}

class DevelopmentPaymentProvider extends SignedPaymentProvider {
  readonly name = 'development';

  async createIntent(input: CreateProviderIntentInput): Promise<ProviderIntent> {
    const intentReference = `dev_${createHash('sha256')
      .update(input.idempotencyKey)
      .digest('hex')
      .slice(0, 32)}`;
    return {
      providerIntentReference: intentReference,
      clientPayload: {
        mode: 'development',
        intentReference,
        amountPaise: input.amountPaise,
        currency: input.currency,
      },
    };
  }
}

class HttpPaymentProvider extends SignedPaymentProvider {
  readonly name = 'http';

  constructor(
    webhookSecret: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {
    super(webhookSecret);
  }

  async createIntent(input: CreateProviderIntentInput): Promise<ProviderIntent> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/intents`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
        'idempotency-key': input.idempotencyKey,
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      throw new Error(`Payment provider returned HTTP ${response.status}`);
    }

    return z
      .object({
        providerIntentReference: z.string().trim().min(1).max(160),
        clientPayload: z.record(z.string(), z.unknown()),
      })
      .parse(await response.json());
  }
}

export const createPaymentProvider = (config: PaymentConfig): PaymentProvider =>
  config.PAYMENT_PROVIDER === 'development'
    ? new DevelopmentPaymentProvider(config.PAYMENT_WEBHOOK_SECRET)
    : new HttpPaymentProvider(
        config.PAYMENT_WEBHOOK_SECRET,
        config.PAYMENT_HTTP_URL!,
        config.PAYMENT_HTTP_API_KEY!,
      );
