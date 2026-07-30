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
import {
  DeliveryAssignmentBodySchema,
  DeliveryLocationBodySchema,
  DeliveryStatusUpdateBodySchema,
  KitchenTaskIdSchema,
  KitchenTaskTransitionBodySchema,
  OrderIdSchema,
} from '../contracts/index.js';
import {
  OperationsAuthError,
  OperationsRequestVerifier,
} from '../operations/index.js';
import {
  TrackingError,
  TrackingEventHub,
  TrackingService,
} from '../tracking/index.js';

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
  trackingService?: Pick<
    TrackingService,
    | 'getCustomerSnapshot'
    | 'listCustomerEvents'
    | 'transitionKitchenTask'
    | 'assignDelivery'
    | 'updateDeliveryStatus'
    | 'recordDeliveryLocation'
  >;
  operationsVerifier?: Pick<OperationsRequestVerifier, 'verify'>;
  trackingHub?: Pick<TrackingEventHub, 'subscribe'>;
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
  trackingService,
  operationsVerifier,
  trackingHub,
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

  if (trackingService) {
    app.get<{
      Params: { orderId: string };
    }>('/api/v1/customer/orders/:orderId/tracking', async (request) => {
      const authenticated = await authService.authenticate(
        request.cookies[SESSION_COOKIE],
      );
      const orderId = OrderIdSchema.parse(request.params.orderId);
      const tracking = await trackingService.getCustomerSnapshot(
        authenticated,
        orderId,
        requestMetadata(request),
      );
      return { success: true, tracking };
    });

    app.get<{
      Params: { orderId: string };
    }>(
      '/api/v1/customer/orders/:orderId/tracking/stream',
      async (request, reply) => {
        const authenticated = await authService.authenticate(
          request.cookies[SESSION_COOKIE],
        );
        const orderId = OrderIdSchema.parse(request.params.orderId);
        const snapshot = await trackingService.getCustomerSnapshot(
          authenticated,
          orderId,
          requestMetadata(request),
        );

        reply.hijack();
        reply.raw.writeHead(200, {
          'cache-control': 'no-cache, no-store, must-revalidate',
          connection: 'keep-alive',
          'content-type': 'text/event-stream; charset=utf-8',
          'x-accel-buffering': 'no',
        });

        let closed = false;
        let polling = false;
        let cursor = snapshot.latestSequence;
        const send = (
          eventName: string,
          data: unknown,
          sequence?: number,
        ): void => {
          if (closed) return;
          if (sequence !== undefined) reply.raw.write(`id: ${sequence}\n`);
          reply.raw.write(`event: ${eventName}\n`);
          reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
        };
        send('tracking.snapshot', snapshot, cursor);

        const poll = async (): Promise<void> => {
          if (closed || polling) return;
          polling = true;
          try {
            const result = await trackingService.listCustomerEvents(
              authenticated,
              orderId,
              cursor,
              { correlationId: request.id },
            );
            for (const trackedEvent of result.events) {
              send(trackedEvent.type, trackedEvent, trackedEvent.sequence);
            }
            cursor = Math.max(cursor, result.latestSequence);
          } catch (error) {
            request.log.error(
              { error, orderId },
              'Customer tracking stream poll failed',
            );
            send('tracking.error', {
              code: 'STREAM_POLL_FAILED',
              message: 'Live updates are reconnecting',
            });
          } finally {
            polling = false;
          }
        };

        const unsubscribe = trackingHub?.subscribe(
          authenticated.tenantId,
          orderId,
          () => void poll(),
        );
        const pollTimer = setInterval(
          () => void poll(),
          trackingHub ? 30_000 : 5_000,
        );
        const heartbeatTimer = setInterval(() => {
          if (!closed) reply.raw.write(`: heartbeat ${Date.now()}\n\n`);
        }, 15_000);
        reply.raw.on('close', () => {
          closed = true;
          clearInterval(pollTimer);
          clearInterval(heartbeatTimer);
          unsubscribe?.();
        });
      },
    );
  }

  if (trackingService && operationsVerifier) {
    const verifyOperationsRequest = (
      request: FastifyRequest,
      body: unknown,
    ) => {
      const header = (name: string): string | undefined => {
        const value = request.headers[name];
        return Array.isArray(value) ? value[0] : value;
      };
      return operationsVerifier.verify({
        method: request.method,
        path: request.url.split('?')[0]!,
        timestamp: header('x-rms-operations-timestamp'),
        signature: header('x-rms-operations-signature'),
        tenantId: header('x-rms-tenant-id'),
        outletId: header('x-rms-outlet-id'),
        actorId: header('x-rms-actor-id'),
        role: header('x-rms-actor-role'),
        body,
      });
    };

    app.post<{
      Params: { taskId: string };
    }>(
      '/api/v1/internal/kitchen/tasks/:taskId/transition',
      async (request) => {
        const taskId = KitchenTaskIdSchema.parse(request.params.taskId);
        const body = KitchenTaskTransitionBodySchema.parse(request.body);
        const principal = verifyOperationsRequest(request, body);
        const task = await trackingService.transitionKitchenTask(
          principal,
          taskId,
          body,
          requestMetadata(request),
        );
        return { success: true, task };
      },
    );

    app.post<{
      Params: { orderId: string };
    }>(
      '/api/v1/internal/orders/:orderId/delivery/assignment',
      async (request, reply) => {
        const orderId = OrderIdSchema.parse(request.params.orderId);
        const body = DeliveryAssignmentBodySchema.parse(request.body);
        const principal = verifyOperationsRequest(request, body);
        const assignment = await trackingService.assignDelivery(
          principal,
          orderId,
          body,
          requestMetadata(request),
        );
        return reply.code(201).send({ success: true, assignment });
      },
    );

    app.post<{
      Params: { orderId: string };
    }>(
      '/api/v1/internal/orders/:orderId/delivery/status',
      async (request) => {
        const orderId = OrderIdSchema.parse(request.params.orderId);
        const body = DeliveryStatusUpdateBodySchema.parse(request.body);
        const principal = verifyOperationsRequest(request, body);
        const assignment = await trackingService.updateDeliveryStatus(
          principal,
          orderId,
          body,
          requestMetadata(request),
        );
        return { success: true, assignment };
      },
    );

    app.post<{
      Params: { orderId: string };
    }>(
      '/api/v1/internal/orders/:orderId/delivery/location',
      async (request, reply) => {
        const orderId = OrderIdSchema.parse(request.params.orderId);
        const body = DeliveryLocationBodySchema.parse(request.body);
        const principal = verifyOperationsRequest(request, body);
        const result = await trackingService.recordDeliveryLocation(
          principal,
          orderId,
          body,
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

    if (
      error instanceof TrackingError ||
      error instanceof OperationsAuthError
    ) {
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
