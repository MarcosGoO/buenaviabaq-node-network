import { describe, expect, it } from 'vitest';
import { validateSecurityConfig, type RuntimeConfig } from '@/config/index.js';

function baseConfig(overrides: Partial<RuntimeConfig> = {}): RuntimeConfig {
  return {
    NODE_ENV: 'test',
    PORT: 4000,
    API_VERSION: 'v1',
    DB_HOST: 'localhost',
    DB_PORT: 5432,
    DB_NAME: 'viabaq_db',
    DB_USER: 'postgres',
    DB_PASSWORD: 'db-password-strong-123',
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_PASSWORD: undefined,
    OPENWEATHER_API_KEY: undefined,
    GOOGLE_MAPS_API_KEY: undefined,
    TOMTOM_API_KEY: undefined,
    TRAFFIC_PROVIDER: 'auto',
    ML_SERVICE_URL: 'http://localhost:8000',
    JWT_SECRET: undefined,
    ADMIN_API_KEY: undefined,
    FRONTEND_URL: 'http://localhost:3000',
    RATE_LIMIT_WINDOW_MS: 900000,
    RATE_LIMIT_MAX_REQUESTS: 100,
    LOG_LEVEL: 'info',
    ML_RCC_ALLOW_DECISION_EXECUTION: false,
    ML_RCC_ALLOW_ROLLBACK: true,
    ML_RCC_SUSTAINED_DRIFT_DAYS: 2,
    ML_RCC_ROLLBACK_CRITICAL_RATIO: 0.12,
    ML_RCC_RETRAIN_MAE_RATIO: 0.1,
    ML_RCC_MIN_SAMPLES: 40,
    ...overrides,
  };
}

describe('validateSecurityConfig', () => {
  it('does not throw in non-production', () => {
    expect(() => validateSecurityConfig(baseConfig({ NODE_ENV: 'test' }))).not.toThrow();
  });

  it('throws for insecure production admin key', () => {
    expect(() =>
      validateSecurityConfig(baseConfig({
        NODE_ENV: 'production',
        JWT_SECRET: 'x'.repeat(32),
        ADMIN_API_KEY: 'short',
        FRONTEND_URL: 'https://app.example.com',
      }))
    ).toThrow(/ADMIN_API_KEY/);
  });

  it('throws when production frontend url is not https', () => {
    expect(() =>
      validateSecurityConfig(baseConfig({
        NODE_ENV: 'production',
        JWT_SECRET: 'x'.repeat(32),
        ADMIN_API_KEY: 'y'.repeat(32),
        FRONTEND_URL: 'http://insecure.example.com',
      }))
    ).toThrow(/HTTPS/);
  });
});
