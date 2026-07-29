import { Pool, type PoolClient, type PoolConfig } from 'pg';
import { TenantIdSchema, UserIdSchema, type TenantId } from '../contracts/index.js';
import { readDatabaseConfig, type DatabaseConfig } from './config.js';

export type TenantTransactionContext = {
  tenantId: TenantId;
  userId?: string;
  correlationId: string;
};

const createPoolConfig = (config: DatabaseConfig): PoolConfig => {
  const poolConfig: PoolConfig = {
    connectionString: config.databaseUrl,
    max: config.poolMax,
    idleTimeoutMillis: config.idleTimeoutMs,
    connectionTimeoutMillis: config.connectionTimeoutMs,
    application_name: 'rms-backend',
  };

  if (config.sslMode !== 'disable') {
    poolConfig.ssl = {
      rejectUnauthorized: config.sslMode === 'verify-full',
    };
  }

  return poolConfig;
};

export const createDatabasePool = (
  config: DatabaseConfig = readDatabaseConfig(),
): Pool => new Pool(createPoolConfig(config));

export const withTenantTransaction = async <T>(
  pool: Pool,
  context: TenantTransactionContext,
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> => {
  const tenantId = TenantIdSchema.parse(context.tenantId);
  const correlationId = context.correlationId.trim();

  if (correlationId.length < 8 || correlationId.length > 80) {
    throw new Error('A correlation ID between 8 and 80 characters is required');
  }

  const userId = context.userId ? UserIdSchema.parse(context.userId) : 'system';
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(
      "SELECT set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true), set_config('app.correlation_id', $3, true)",
      [tenantId, userId, correlationId],
    );

    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
