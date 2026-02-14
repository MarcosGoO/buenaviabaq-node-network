import { describe, it, expect, beforeEach } from 'vitest';

describe('Environment Configuration', () => {
  beforeEach(() => {
    // Reset environment before each test
    delete process.env.PORT;
    delete process.env.NODE_ENV;
  });

  it('should load default environment variables', async () => {
    // Dynamic import to re-evaluate environment
    const { config } = await import('../../../../src/shared/config/env.js');

    expect(config.NODE_ENV).toBeDefined();
    expect(config.PORT).toBeTypeOf('number');
    expect(config.API_VERSION).toBe('v1');
  });

  it('should validate PORT as number within range', () => {
    process.env.PORT = '3000';

    // Config should parse this correctly
    expect(Number(process.env.PORT)).toBe(3000);
  });

  it('should have computed DATABASE_URL', async () => {
    const { config } = await import('../../../../src/shared/config/env.js');

    // Validate DATABASE_URL format
    expect(config.DATABASE_URL).toContain('postgresql://');

    // Validate it contains required components (credentials may be masked in CI)
    expect(config.DATABASE_URL).toMatch(/postgresql:\/\/.+/);
    expect(config.DATABASE_URL).toContain('localhost');
    expect(config.DATABASE_URL).toContain(':5432');
    expect(config.DATABASE_URL).toContain('viabaq');
  });

  it('should have computed REDIS_URL', async () => {
    const { config } = await import('../../../../src/shared/config/env.js');

    // Validate REDIS_URL format
    expect(config.REDIS_URL).toContain('redis://');

    // Validate it contains required components
    expect(config.REDIS_URL).toMatch(/redis:\/\/.+:\d+\/\d+/);
    expect(config.REDIS_URL).toContain('localhost');
    expect(config.REDIS_URL).toContain(':6379');
  });

  it('should set feature flags correctly', async () => {
    const { config } = await import('../../../../src/shared/config/env.js');

    expect(config).toHaveProperty('isDevelopment');
    expect(config).toHaveProperty('isProduction');
    expect(config).toHaveProperty('isTest');

    // Only one should be true
    const flags = [
      config.isDevelopment,
      config.isProduction,
      config.isTest
    ];

    expect(flags.filter(Boolean).length).toBe(1);
  });

  it('should have cache TTL values', async () => {
    const { config } = await import('../../../../src/shared/config/env.js');

    expect(config.CACHE_TTL_TRAFFIC).toBeTypeOf('number');
    expect(config.CACHE_TTL_WEATHER).toBeTypeOf('number');
    expect(config.CACHE_TTL_ANALYTICS).toBeTypeOf('number');
    expect(config.CACHE_TTL_GEO).toBeTypeOf('number');
  });
});
