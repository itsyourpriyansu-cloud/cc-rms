import { createDatabasePool } from '../src/database/index.js';

const tenantId = 'ten_mangamma01';
const outletId = 'out_hyderabad01';

const seed = async (): Promise<void> => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Development seed is prohibited in production');
  }

  const pool = createDatabasePool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    await client.query(
      `
        INSERT INTO tenants (
          id,
          legal_name,
          display_name,
          status
        )
        VALUES (
          $1,
          'Lakshya Foodways',
          'Mangamma Ruchulu',
          'active'
        )
        ON CONFLICT (id) DO NOTHING
      `,
      [tenantId],
    );
    await client.query(
      `
        INSERT INTO outlets (
          id,
          tenant_id,
          name,
          latitude,
          longitude,
          service_radius_km,
          status
        )
        VALUES (
          $1,
          $2,
          'Mangamma Ruchulu Cloud Kitchen',
          17.385044,
          78.486671,
          8,
          'open'
        )
        ON CONFLICT (id) DO NOTHING
      `,
      [outletId, tenantId],
    );
    await client.query('COMMIT');
    process.stdout.write(`Seeded ${tenantId}/${outletId}\n`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

seed().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Development seed failed: ${message}\n`);
  process.exitCode = 1;
});
