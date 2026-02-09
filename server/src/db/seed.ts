import fs from 'fs';
import path from 'path';
import { pool } from './index';
import { logger } from '@/utils/logger';

const SEEDS_DIR = path.join(__dirname, '../../db/seeds');

async function runSeeds() {
  try {
    logger.info('Starting database seeding...');

    const files = fs
      .readdirSync(SEEDS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      logger.info(`Running seed: ${file}`);
      const sql = fs.readFileSync(path.join(SEEDS_DIR, file), 'utf-8');
      await pool.query(sql);
      logger.info(`✓ Seed ${file} completed`);
    }

    logger.info('All seeds completed successfully');
    await pool.end();
    process.exit(0);
  } catch (error) {
    logger.error('Seeding failed', { error });
    await pool.end();
    process.exit(1);
  }
}

runSeeds();
