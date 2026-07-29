import { z } from 'zod';

const DatabaseEnvironmentSchema = z.object({
  DATABASE_URL: z
    .string()
    .trim()
    .min(1)
    .refine(
      (value) => value.startsWith('postgres://') || value.startsWith('postgresql://'),
      'DATABASE_URL must be a PostgreSQL connection URL',
    ),
  DB_SSL: z.enum(['disable', 'require', 'verify-full']).default('disable'),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  DB_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(300_000).default(30_000),
  DB_CONNECTION_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(500)
    .max(60_000)
    .default(5_000),
});

export type DatabaseConfig = {
  databaseUrl: string;
  sslMode: 'disable' | 'require' | 'verify-full';
  poolMax: number;
  idleTimeoutMs: number;
  connectionTimeoutMs: number;
};

export const readDatabaseConfig = (
  environment: NodeJS.ProcessEnv = process.env,
): DatabaseConfig => {
  const parsed = DatabaseEnvironmentSchema.parse(environment);

  return {
    databaseUrl: parsed.DATABASE_URL,
    sslMode: parsed.DB_SSL,
    poolMax: parsed.DB_POOL_MAX,
    idleTimeoutMs: parsed.DB_IDLE_TIMEOUT_MS,
    connectionTimeoutMs: parsed.DB_CONNECTION_TIMEOUT_MS,
  };
};
