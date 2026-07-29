import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { PoolClient } from 'pg';
import { createDatabasePool } from './client.js';

type Migration = {
  version: string;
  checksum: string;
  sql: string;
};

const migrationDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../../migrations');

export const readMigrations = async (): Promise<Migration[]> => {
  const filenames = (await readdir(migrationDirectory))
    .filter((filename) => /^\d{4}_[a-z0-9_]+\.sql$/.test(filename))
    .sort();

  return Promise.all(
    filenames.map(async (filename) => {
      const sql = await readFile(resolve(migrationDirectory, filename), 'utf8');
      return {
        version: filename,
        checksum: createHash('sha256').update(sql).digest('hex'),
        sql,
      };
    }),
  );
};

const ensureMigrationLedger = async (client: PoolClient): Promise<void> => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
};

export const runMigrations = async (): Promise<void> => {
  const pool = createDatabasePool();
  const client = await pool.connect();
  let advisoryLockHeld = false;

  try {
    await client.query("SELECT pg_advisory_lock(hashtext('rms_schema_migrations'))");
    advisoryLockHeld = true;
    await ensureMigrationLedger(client);

    const appliedResult = await client.query<{ version: string; checksum: string }>(
      'SELECT version, checksum FROM schema_migrations ORDER BY version',
    );
    const applied = new Map(
      appliedResult.rows.map((migration) => [migration.version, migration.checksum]),
    );

    for (const migration of await readMigrations()) {
      const existingChecksum = applied.get(migration.version);
      if (existingChecksum && existingChecksum !== migration.checksum) {
        throw new Error(
          `Migration ${migration.version} was changed after being applied`,
        );
      }
      if (existingChecksum) continue;

      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)',
          [migration.version, migration.checksum],
        );
        await client.query('COMMIT');
        process.stdout.write(`Applied ${migration.version}\n`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    try {
      if (advisoryLockHeld) {
        await client.query("SELECT pg_advisory_unlock(hashtext('rms_schema_migrations'))");
      }
    } finally {
      client.release();
      await pool.end();
    }
  }
};

const invokedFile = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;

if (invokedFile === import.meta.url) {
  runMigrations().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Migration failed: ${message}\n`);
    process.exitCode = 1;
  });
}
