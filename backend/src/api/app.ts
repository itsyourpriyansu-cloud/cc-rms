import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import { ZodError } from 'zod';
import {
  AuthError,
  CustomerAuthService,
  CustomerProfileUpdateSchema,
  RequestOtpBodySchema,
  VerifyOtpBodySchema,
  type AuthConfig,
} from '../auth/index.js';
import {
  CheckoutBodySchema,
  CommerceError,
  CommerceService,
  CreatePaymentIntentBodySchema,
  CreateQuoteBodySchema,
} from '../commerce/index.js';

const SESSION_COOKIE = 'rms_customer_session';

type BuildAppOptions = {
  authService: Pick<
    CustomerAuthService,
    'requestOtp' | 'verifyOtp' | 'authenticate' | 'revokeSession' | 'updateProfile'
  >;
  commerceService?: Pick<
    CommerceService,
    'createQuote' | 'createPaymentIntent' | 'applyPaymentWebhook' | 'checkout'
  >;
  authConfig: AuthConfig;
  logger?: boolean;
};

const requestMetadata = (request: FastifyRequest) => ({
  ip: request.ip,
  userAgent: request.headers['user-agent'] ?? 'unknown',
  correlationId: request.id,
});

const requireCustomerClient = (request: FastifyRequest): void => {
  if (request.headers['x-rms-client'] !== 'customer-web') {
    throw new AuthError('CLIENT_HEADER_REQUIRED', 403, 'Request origin could not be verified');
  }
};

const setSessionCookie = (
  reply: FastifyReply,
  token: string,
  expiresAt: string,
  secure: boolean,
): void => {
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/api/v1/customer',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    expires: new Date(expiresAt),
  });
};

const clearSessionCookie = (reply: FastifyReply, secure: boolean): void => {
  reply.clearCookie(SESSION_COOKIE, {
    path: '/api/v1/customer',
    httpOnly: true,
    sameSite: 'lax',
    secure,
  });
};

export const buildApp = async ({
  authService,
  commerceService,
  authConfig,
  logger = false,
}: BuildAppOptions): Promise<FastifyInstance> => {
  const app = Fastify({
    logger,
    trustProxy: true,
    requestIdHeader: 'x-correlation-id',
    genReqId: () => `cor_${crypto.randomUUID().replaceAll('-', '')}`,
    bodyLimit: 32 * 1024,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });
  await app.register(cookie);
  await app.register(rateLimit, {
    global: true,
    max: 120,
    timeWindow: '1 minute',
    ban: 3,
  });

  app.addHook('onSend', (request, reply, payload, done) => {
    if (request.url.startsWith('/api/v1/customer/')) {
      reply.header('cache-control', 'no-store');
      reply.header('pragma', 'no-cache');
    }
    done(null, payload);
  });

  app.get('/health', async () => ({
    status: 'ok',
    service: 'rms-backend',
  }));

  app.post(
    '/api/v1/customer/auth/otp/request',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '10 minutes',
        },
      },
    },
    async (request, reply) => {
      requireCustomerClient(request);
      const body = RequestOtpBodySchema.parse(request.body);
      const challenge = await authService.requestOtp(body, requestMetadata(request));
      return reply.code(202).send({ success: true, challenge });
    },
  );

  app.post(
    '/api/v1/customer/auth/otp/verify',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '10 minutes',
        },
      },
    },
    async (request, reply) => {
      requireCustomerClient(request);
      const body = VerifyOtpBodySchema.parse(request.body);
      const result = await authService.verifyOtp(body, requestMetadata(request));
      setSessionCookie(
        reply,
        result.sessionToken,
        result.expiresAt,
        authConfig.secureCookie,
      );
      return {
        success: true,
        session: {
          authenticatedAt: new Date().toISOString(),
          expiresAt: result.expiresAt,
        },
        customer: result.customer,
      };
    },
  );

  app.get('/api/v1/customer/auth/me', async (request) => {
    const authenticated = await authService.authenticate(
      request.cookies[SESSION_COOKIE],
    );
    return {
      success: true,
      session: { authenticated: true },
      customer: authenticated.profile,
    };
  });

  app.post('/api/v1/customer/auth/logout', async (request, reply) => {
    requireCustomerClient(request);
    const authenticated = await authService.authenticate(
      request.cookies[SESSION_COOKIE],
    );
    await authService.revokeSession(authenticated);
    clearSessionCookie(reply, authConfig.secureCookie);
    return reply.code(204).send();
  });

  app.patch('/api/v1/customer/profile', async (request) => {
    requireCustomerClient(request);
    const authenticated = await authService.authenticate(
      request.cookies[SESSION_COOKIE],
    );
    const update = CustomerProfileUpdateSchema.parse(request.body);
    const customer = await authService.updateProfile(authenticated, update);
    return { success: true, customer };
  });

  if (commerceService) {
    app.post('/api/v1/customer/quotes', async (request, reply) => {
      requireCustomerClient(request);
      const authenticated = await authService.authenticate(
        request.cookies[SESSION_COOKIE],
      );
      const body = CreateQuoteBodySchema.parse(request.body);
      const quote = await commerceService.createQuote(
        authenticated,
        body,
        requestMetadata(request),
      );
      return reply.code(201).send({ success: true, quote });
    });

    app.post('/api/v1/customer/payments/intents', async (request, reply) => {
      requireCustomerClient(request);
      const authenticated = await authService.authenticate(
        request.cookies[SESSION_COOKIE],
      );
      const body = CreatePaymentIntentBodySchema.parse(request.body);
      const paymentIntent = await commerceService.createPaymentIntent(
        authenticated,
        body,
        requestMetadata(request),
      );
      return reply.code(201).send({ success: true, paymentIntent });
    });

    app.post('/api/v1/customer/checkout', async (request, reply) => {
      requireCustomerClient(request);
      const authenticated = await authService.authenticate(
        request.cookies[SESSION_COOKIE],
      );
      const body = CheckoutBodySchema.parse(request.body);
      const order = await commerceService.checkout(
        authenticated,
        body,
        requestMetadata(request),
      );
      return reply.code(order.duplicate === true ? 200 : 201).send({
        success: true,
        order,
      });
    });

    app.post<{
      Params: { provider: string };
    }>(
      '/api/v1/payments/webhooks/:provider',
      {
        config: {
          rateLimit: {
            max: 300,
            timeWindow: '1 minute',
          },
        },
      },
      async (request, reply) => {
        const suppliedSignature = request.headers['x-rms-payment-signature'];
        const signature = Array.isArray(suppliedSignature)
          ? suppliedSignature[0]
          : suppliedSignature;
        const result = await commerceService.applyPaymentWebhook(
          request.params.provider,
          request.body,
          signature,
          requestMetadata(request),
        );
        return reply.code(202).send({ success: true, ...result });
      },
    );
  }

  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Endpoint not found' },
    }),
  );

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AuthError) {
      if (error.retryAfterSeconds) {
        reply.header('retry-after', String(error.retryAfterSeconds));
      }
      return reply.code(error.statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.retryAfterSeconds
            ? { retryAfterSeconds: error.retryAfterSeconds }
            : {}),
        },
      });
    }

    if (error instanceof CommerceError) {
      return reply.code(error.statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    if (error instanceof ZodError) {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Check the information and try again',
          fields: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      });
    }

    app.log.error(error);
    return reply.code(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again.',
      },
    });
  });

  return app;
};
