import { Pool, QueryResult } from 'pg';
import { DATABASE_URL } from '@/config';
import { logger } from '@/utils/logger';

export const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  logger.debug('New database connection established');
});

pool.on('error', (err) => {
  logger.error('Unexpected database error', { error: err.message });
});

export const query = async (text: string, params?: (string | number | Date | boolean | null | Record<string, unknown>)[]): Promise<QueryResult> => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    logger.error('Query error', { text, error });
    throw error;
  }
};

export const testConnection = async (): Promise<boolean> => {
  try {
    const result = await query('SELECT NOW(), PostGIS_Version() as postgis_version');
    logger.info('Database connection successful', {
      timestamp: result.rows[0].now,
      postgis: result.rows[0].postgis_version,
    });
    return true;
  } catch (error) {
    logger.error('Database connection failed', { error });
    return false;
  }
};
