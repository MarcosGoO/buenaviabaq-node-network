import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

/**
 * Environment Variables Schema
 * Validates and provides type-safe access to environment variables
 */
const envSchema = z.object({
  // ============ APPLICATION ============
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z
    .string()
    .transform(Number)
    .pipe(z.number().min(1000).max(65535))
    .default('4000'),
  API_VERSION: z.string().default('v1'),
  HOST: z.string().default('localhost'),

  // ============ DATABASE ============
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z
    .string()
    .transform(Number)
    .pipe(z.number())
    .default('5432'),
  DB_NAME: z.string().default('viabaq_db'),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default('postgres'),
  DB_POOL_MIN: z
    .string()
    .transform(Number)
    .pipe(z.number())
    .default('2'),
  DB_POOL_MAX: z
    .string()
    .transform(Number)
    .pipe(z.number())
    .default('20'),
  DB_IDLE_TIMEOUT_MS: z
    .string()
    .transform(Number)
    .pipe(z.number())
    .default('30000'),
  DB_CONNECTION_TIMEOUT_MS: z
    .string()
    .transform(Number)
    .pipe(z.number())
    .default('2000'),

  // ============ REDIS ============
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z
    .string()
    .transform(Number)
    .pipe(z.number())
    .default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z
    .string()
    .transform(Number)
    .pipe(z.number())
    .default('0'),
  REDIS_MAX_RETRIES: z
    .string()
    .transform(Number)
    .pipe(z.number())
    .default('3'),

  // ============ CACHE TTL (seconds) ============
  CACHE_TTL_TRAFFIC: z
    .string()
    .transform(Number)
    .pipe(z.number())
    .default('300'), // 5 minutes
  CACHE_TTL_WEATHER: z
    .string()
    .transform(Number)
    .pipe(z.number())
    .default('300'), // 5 minutes
  CACHE_TTL_ANALYTICS: z
    .string()
    .transform(Number)
    .pipe(z.number())
    .default('900'), // 15 minutes
  CACHE_TTL_GEO: z
    .string()
    .transform(Number)
    .pipe(z.number())
    .default('3600'), // 1 hour
  CACHE_TTL_EVENTS: z
    .string()
    .transform(Number)
    .pipe(z.number())
    .default('900'), // 15 minutes

  // ============ EXTERNAL APIs ============
  OPENWEATHER_API_KEY: z.string().optional(),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  TOMTOM_API_KEY: z.string().optional(),
  HERE_API_KEY: z.string().optional(),

  // ============ ML SERVICE ============
  ML_SERVICE_URL: z.string().url().default('http://localhost:8000'),
  ML_SERVICE_TIMEOUT_MS: z
    .string()
    .transform(Number)
    .pipe(z.number())
    .default('5000'),

  // ============ SECURITY ============
  JWT_SECRET: z.string().optional(),
  JWT_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_ROUNDS: z
    .string()
    .transform(Number)
    .pipe(z.number())
    .default('10'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z
    .string()
    .transform(Number)
    .pipe(z.number())
    .default('900000'), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z
    .string()
    .transform(Number)
    .pipe(z.number())
    .default('100'),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  CORS_CREDENTIALS: z
    .string()
    .transform(v => v === 'true')
    .default('true'),

  // ============ BACKGROUND JOBS ============
  JOB_CONCURRENCY: z
    .string()
    .transform(Number)
    .pipe(z.number())
    .default('1'),
  JOB_ATTEMPTS: z
    .string()
    .transform(Number)
    .pipe(z.number())
    .default('3'),
  JOB_BACKOFF_DELAY_MS: z
    .string()
    .transform(Number)
    .pipe(z.number())
    .default('2000'),
  JOB_COLLECTION_INTERVAL_MS: z
    .string()
    .transform(Number)
    .pipe(z.number())
    .default('300000'), // 5 minutes

  // ============ LOGGING ============
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'http', 'debug'])
    .default('info'),
  LOG_FILE_ERROR: z.string().default('logs/error.log'),
  LOG_FILE_COMBINED: z.string().default('logs/combined.log'),
  LOG_MAX_SIZE: z.string().default('10m'),
  LOG_MAX_FILES: z
    .string()
    .transform(Number)
    .pipe(z.number())
    .default('14'), // Keep 14 days

  // ============ SSL/TLS (Production) ============
  SSL_KEY_PATH: z.string().optional(),
  SSL_CERT_PATH: z.string().optional(),

  // ============ MONITORING ============
  PROMETHEUS_ENABLED: z
    .string()
    .transform(v => v === 'true')
    .default('false'),
  PROMETHEUS_PORT: z
    .string()
    .transform(Number)
    .pipe(z.number())
    .default('9090'),
});

// Parse and validate
let env: z.infer<typeof envSchema>;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Environment validation failed:');
    console.error(JSON.stringify(error.errors, null, 2));
    process.exit(1);
  }
  throw error;
}

/**
 * Computed values from environment
 */
export const config = {
  ...env,

  // Computed connection strings
  DATABASE_URL: `postgresql://${env.DB_USER}:${env.DB_PASSWORD}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`,
  REDIS_URL: env.REDIS_PASSWORD
    ? `redis://:${env.REDIS_PASSWORD}@${env.REDIS_HOST}:${env.REDIS_PORT}/${env.REDIS_DB}`
    : `redis://${env.REDIS_HOST}:${env.REDIS_PORT}/${env.REDIS_DB}`,

  // Feature flags
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',

  // API URLs
  apiBaseUrl: `http://${env.HOST}:${env.PORT}/api/${env.API_VERSION}`,
} as const;

// Type export for TypeScript
export type Config = typeof config;

/**
 * Validate required environment variables for production
 */
export const validateProductionConfig = () => {
  if (config.isProduction) {
    const requiredVars = [
      'DATABASE_URL',
      'REDIS_URL',
      'JWT_SECRET',
    ];

    const missing = requiredVars.filter(key => !config[key as keyof typeof config]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required production environment variables: ${missing.join(', ')}`
      );
    }
  }
};

// Auto-validate on import in production
if (config.isProduction) {
  validateProductionConfig();
}

export default config;
