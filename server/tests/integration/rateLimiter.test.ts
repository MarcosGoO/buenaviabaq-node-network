import express from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

let routingLimiter: express.RequestHandler;
let insightsLimiter: express.RequestHandler;
let alertsLimiter: express.RequestHandler;
let geoWeatherLimiter: express.RequestHandler;
let metricsLimiter: express.RequestHandler;

function createAppWithLimiter(limiter: express.RequestHandler) {
  const app = express();
  app.set('trust proxy', 1);
  app.get('/test', limiter, (_req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

async function assertRateLimit(
  limiter: express.RequestHandler,
  allowed: number,
  ip: string
) {
  const app = createAppWithLimiter(limiter);

  for (let i = 0; i < allowed; i += 1) {
    const response = await request(app)
      .get('/test')
      .set('X-Forwarded-For', ip);
    expect(response.status).toBe(200);
  }

  const limitedResponse = await request(app)
    .get('/test')
    .set('X-Forwarded-For', ip);

  expect(limitedResponse.status).toBe(429);
}

describe.sequential('Rate Limiter Middleware', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const module = await import('@/middleware/rateLimiter.js');
    routingLimiter = module.routingLimiter;
    insightsLimiter = module.insightsLimiter;
    alertsLimiter = module.alertsLimiter;
    geoWeatherLimiter = module.geoWeatherLimiter;
    metricsLimiter = module.metricsLimiter;
  });

  it('limits /routes group at 30 req/min', async () => {
    await assertRateLimit(routingLimiter, 30, '10.10.0.1');
  });

  it('limits /insights group at 60 req/min', async () => {
    await assertRateLimit(insightsLimiter, 60, '10.10.0.2');
  });

  it('limits /alerts group at 120 req/min', async () => {
    await assertRateLimit(alertsLimiter, 120, '10.10.0.3');
  });

  it('limits /geo and /weather group at 300 req/min', async () => {
    await assertRateLimit(geoWeatherLimiter, 300, '10.10.0.4');
  });

  it('limits /metrics at 60 req/min', async () => {
    await assertRateLimit(metricsLimiter, 60, '10.10.0.5');
  });
});
