import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './index.js';
import { logger } from '@/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SEEDS_DIR = path.join(__dirname, '../../db/seeds');

async function ensureSeedsTable() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS schema_seeds (
      id SERIAL PRIMARY KEY,
      seed_name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_seed_name ON schema_seeds(seed_name);
  `;
  await pool.query(createTableSQL);
}

async function getSeedsRun(): Promise<Set<string>> {
  const result = await pool.query(
    'SELECT seed_name FROM schema_seeds ORDER BY id'
  );
  return new Set(result.rows.map((row) => row.seed_name));
}

async function runSeeds() {
  try {
    logger.info('Starting database seeding...');

    // Ensure seeds tracking table exists
    await ensureSeedsTable();

    // Get list of seeds already run
    const seedsRun = await getSeedsRun();
    logger.info(`Found ${seedsRun.size} seeds already executed`);

    // Get all seed files
    const files = fs
      .readdirSync(SEEDS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let newSeedsCount = 0;

    for (const file of files) {
      // Skip if already run
      if (seedsRun.has(file)) {
        logger.info(`⊘ Skipping seed: ${file} (already executed)`);
        continue;
      }

      logger.info(`▶ Running seed: ${file}`);
      const sql = fs.readFileSync(path.join(SEEDS_DIR, file), 'utf-8');

      // Run seed in a transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_seeds (seed_name) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        logger.info(`✓ Seed ${file} completed`);
        newSeedsCount++;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    if (newSeedsCount === 0) {
      logger.info('✓ Database is already seeded. No new seeds to run.');
    } else {
      logger.info(`✓ Successfully executed ${newSeedsCount} new seed(s)`);
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    logger.error('Seeding failed', { error });
    await pool.end();
    process.exit(1);
  }
}

runSeeds();