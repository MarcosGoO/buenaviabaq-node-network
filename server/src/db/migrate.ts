import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './index.js';
import { logger } from '@/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.join(__dirname, '../../db/migrations');

async function runMigrations() {
  try {
    logger.info('Starting database migrations...');

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      logger.info(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
      await pool.query(sql);
      logger.info(`✓ Migration ${file} completed`);
    }

    logger.info('All migrations completed successfully');
    await pool.end();
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed', { error });
    await pool.end();
    process.exit(1);
  }
}

runMigrations();
