import rateLimit, { type Options } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { config } from '@/config/index.js';
import { redis } from '@/lib/redis.js';

const isTest = config.NODE_ENV === 'test';

function createLimiter(options: {
  windowMs: number;
  max: number;
  message: string;
  keyPrefix: string;
}) {
  const baseConfig: Partial<Options> = {
    windowMs: options.windowMs,
    max: options.max,
    message: options.message,
    standardHeaders: true,
    legacyHeaders: false,
  };

  if (!isTest) {
    baseConfig.store = new RedisStore({
      prefix: options.keyPrefix,
      // @ts-expect-error - ioredis and rate-limit-redis type mismatch
      sendCommand: (...args: string[]) => redis.call(...args),
    });
  }

  return rateLimit(baseConfig as Options);
}

export const globalApiLimiter = createLimiter({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.NODE_ENV === 'development' ? 500 : config.RATE_LIMIT_MAX_REQUESTS,
  message: 'Too many requests from this IP, please try again later.',
  keyPrefix: 'rl:global:',
});

export const routingLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many routing requests, please try again later.',
  keyPrefix: 'rl:routes:',
});

export const insightsLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Too many insights requests, please try again later.',
  keyPrefix: 'rl:insights:',
});

export const alertsLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: 'Too many alerts requests, please try again later.',
  keyPrefix: 'rl:alerts:',
});

export const geoWeatherLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 300,
  message: 'Too many geospatial/weather requests, please try again later.',
  keyPrefix: 'rl:geoweather:',
});

export const metricsLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Too many metrics requests, please try again later.',
  keyPrefix: 'rl:metrics:',
});

