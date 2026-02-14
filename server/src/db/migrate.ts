import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './index.js';
import { logger } from '@/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.join(__dirname, '../../db/migrations');

async function ensureMigrationsTable() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      migration_name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_migration_name ON schema_migrations(migration_name);
  `;
  await pool.query(createTableSQL);
}

async function getMigrationsRun(): Promise<Set<string>> {
  const result = await pool.query(
    'SELECT migration_name FROM schema_migrations ORDER BY id'
  );
  return new Set(result.rows.map((row) => row.migration_name));
}

async function runMigrations() {
  try {
    logger.info('Starting database migrations...');

    // Ensure migrations tracking table exists
    await ensureMigrationsTable();

    // Get list of migrations already run
    const migrationsRun = await getMigrationsRun();
    logger.info(`Found ${migrationsRun.size} migrations already executed`);

    // Get all migration files
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let newMigrationsCount = 0;

    for (const file of files) {
      // Skip if already run
      if (migrationsRun.has(file)) {
        logger.info(`⊘ Skipping migration: ${file} (already executed)`);
        continue;
      }

      logger.info(`▶ Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');

      // Run migration in a transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (migration_name) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        logger.info(`✓ Migration ${file} completed`);
        newMigrationsCount++;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    if (newMigrationsCount === 0) {
      logger.info('✓ Database is up to date. No new migrations to run.');
    } else {
      logger.info(`✓ Successfully executed ${newMigrationsCount} new migration(s)`);
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed', { error });
    await pool.end();
    process.exit(1);
  }
}

void runMigrations();