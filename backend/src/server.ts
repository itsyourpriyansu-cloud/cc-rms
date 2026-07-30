import { z } from 'zod';
import { buildApp } from './api/app.js';
import {
  CustomerAuthService,
  createOtpProvider,
  readAuthConfig,
} from './auth/index.js';
import {
  CommerceService,
  createPaymentProvider,
  readPaymentConfig,
} from './commerce/index.js';
import { createDatabasePool } from './database/index.js';
import {
  OperationsRequestVerifier,
  readOperationsAuthConfig,
} from './operations/index.js';
import { TrackingEventHub, TrackingService } from './tracking/index.js';

const ServerEnvironmentSchema = z.object({
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
});

const start = async (): Promise<void> => {
  const serverConfig = ServerEnvironmentSchema.parse(process.env);
  const authConfig = readAuthConfig();
  const paymentConfig = readPaymentConfig();
  const operationsAuthConfig = readOperationsAuthConfig();
  const pool = createDatabasePool();
  const authService = new CustomerAuthService(
    pool,
    authConfig,
    createOtpProvider(authConfig),
  );
  const commerceService = new CommerceService(
    pool,
    createPaymentProvider(paymentConfig),
  );
  const trackingService = new TrackingService(pool);
  const trackingHub = new TrackingEventHub(pool);
  const operationsVerifier = new OperationsRequestVerifier(
    operationsAuthConfig,
  );
  const app = await buildApp({
    authService,
    commerceService,
    trackingService,
    trackingHub,
    operationsVerifier,
    authConfig,
    logger: true,
  });
  app.addHook('onClose', async () => {
    await trackingHub.stop();
  });
  await trackingHub.start();

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'Shutting down');
    await app.close();
    await pool.end();
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({
    host: serverConfig.HOST,
    port: serverConfig.PORT,
  });
};

start().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Backend startup failed: ${message}\n`);
  process.exitCode = 1;
});
