import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  }
  return value;
}, z.boolean());

const optionalNonEmptyString = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }
  return value;
}, z.string().min(1).optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1000).max(65535).default(4000),
  API_VERSION: z.string().trim().min(1).default('v1'),

  // Database
  DB_HOST: z.string().trim().min(1).default('localhost'),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  DB_NAME: z.string().trim().min(1).default('viabaq_db'),
  DB_USER: z.string().trim().min(1).default('postgres'),
  DB_PASSWORD: z.string().min(1).default('postgres'),

  // Redis
  REDIS_HOST: z.string().trim().min(1).default('localhost'),
  REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
  REDIS_PASSWORD: optionalNonEmptyString,

  // External APIs
  OPENWEATHER_API_KEY: optionalNonEmptyString,
  GOOGLE_MAPS_API_KEY: optionalNonEmptyString,
  TOMTOM_API_KEY: optionalNonEmptyString,
  TRAFFIC_PROVIDER: z.enum(['auto', 'mock', 'tomtom']).default('auto'),

  // ML Service
  ML_SERVICE_URL: z.string().url().default('http://localhost:8000'),

  // Security
  JWT_SECRET: z.preprocess((value) => {
    if (typeof value === 'string' && value.trim() === '') return undefined;
    return value;
  }, z.string().min(12).optional()),
  ADMIN_API_KEY: z.preprocess((value) => {
    if (typeof value === 'string' && value.trim() === '') return undefined;
    return value;
  }, z.string().min(12).optional()),
  SOCKET_AUTH_TOKEN: z.preprocess((value) => {
    if (typeof value === 'string' && value.trim() === '') return undefined;
    return value;
  }, z.string().min(12).optional()),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).max(86_400_000).default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).max(10000).default(100),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // RCC governance controls
  ML_RCC_ALLOW_DECISION_EXECUTION: booleanFromEnv.default(false),
  ML_RCC_ALLOW_ROLLBACK: booleanFromEnv.default(true),
  ML_RCC_SUSTAINED_DRIFT_DAYS: z.coerce.number().int().min(1).max(30).default(2),
  ML_RCC_ROLLBACK_CRITICAL_RATIO: z.coerce.number().min(0).max(3).default(0.12),
  ML_RCC_RETRAIN_MAE_RATIO: z.coerce.number().min(0).max(3).default(0.1),
  ML_RCC_MIN_SAMPLES: z.coerce.number().int().min(1).max(100000).default(40),
});

const parsed = envSchema.parse(process.env);

export type RuntimeConfig = z.infer<typeof envSchema>;

export function validateSecurityConfig(current: RuntimeConfig): void {
  if (current.NODE_ENV !== 'production') {
    return;
  }

  const weakPasswords = new Set(['postgres', 'password', 'admin', 'changeme', '123456']);
  if (weakPasswords.has(current.DB_PASSWORD.toLowerCase())) {
    throw new Error('In production, DB_PASSWORD cannot be a known weak default.');
  }

  if (!current.JWT_SECRET || current.JWT_SECRET.length < 32) {
    throw new Error('In production, JWT_SECRET is required and must have at least 32 chars.');
  }

  if (!current.ADMIN_API_KEY || current.ADMIN_API_KEY.length < 32) {
    throw new Error('In production, ADMIN_API_KEY is required and must have at least 32 chars.');
  }

  if (current.ADMIN_API_KEY === current.JWT_SECRET) {
    throw new Error('In production, ADMIN_API_KEY and JWT_SECRET must be different values.');
  }

  if (current.SOCKET_AUTH_TOKEN && current.SOCKET_AUTH_TOKEN.length < 24) {
    throw new Error('In production, SOCKET_AUTH_TOKEN must have at least 24 chars when configured.');
  }

  if (!current.FRONTEND_URL.startsWith('https://')) {
    throw new Error('In production, FRONTEND_URL must use HTTPS.');
  }

  if (current.ML_RCC_ALLOW_DECISION_EXECUTION) {
    throw new Error('In production, ML_RCC_ALLOW_DECISION_EXECUTION must remain disabled by default.');
  }
}

validateSecurityConfig(parsed);

export const config = Object.freeze(parsed);

export const DATABASE_URL = `postgresql://${config.DB_USER}:${config.DB_PASSWORD}@${config.DB_HOST}:${config.DB_PORT}/${config.DB_NAME}`;
