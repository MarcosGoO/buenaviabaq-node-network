import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import metricsRoutes from '@/routes/metricsRoutes.js';
import { cacheHeaders } from '@/middleware/cacheHeaders.js';
import { requestMetricsMiddleware } from '@/middleware/requestMetrics.js';

vi.mock('@/lib/redis.js', () => ({
  RedisClient: {
    healthCheck: vi.fn(async () => true),
  },
}));

vi.mock('@/jobs/scheduler.js', () => ({
  JobScheduler: {
    getQueueStats: vi.fn(async () => ({
      waiting: 0,
      active: 1,
      completed: 12,
      failed: 0,
      delayed: 0,
      total: 13,
    })),
  },
}));

describe('Metrics and Cache Headers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns expected payload structure from /api/v1/metrics', async () => {
    const app = express();
    app.use(requestMetricsMiddleware);
    app.get('/ping', (_req, res) => res.json({ ok: true }));
    app.use('/api/v1/metrics', metricsRoutes);

    await request(app).get('/ping');
    await request(app).get('/ping');

    const response = await request(app).get('/api/v1/metrics');
    expect(response.status).toBe(200);

    expect(typeof response.body.uptime_seconds).toBe('number');
    expect(typeof response.body.process.pid).toBe('number');
    expect(typeof response.body.process.memory_mb.used).toBe('number');
    expect(typeof response.body.process.memory_mb.total).toBe('number');
    expect(typeof response.body.requests.total).toBe('number');
    expect(typeof response.body.requests.in_flight).toBe('number');
    expect(typeof response.body.requests.per_minute).toBe('number');
    expect(typeof response.body.requests.server_errors).toBe('number');
    expect(typeof response.body.requests.latency_ms.avg).toBe('number');
    expect(typeof response.body.requests.latency_ms.p95).toBe('number');
    expect(Array.isArray(response.body.requests.busiest_routes)).toBe(true);
    expect(typeof response.body.cache.hits).toBe('number');
    expect(typeof response.body.cache.misses).toBe('number');
    expect(typeof response.body.cache.hit_rate).toBe('number');
    expect(typeof response.body.db.pool_size).toBe('number');
    expect(typeof response.body.db.active_connections).toBe('number');
    expect(typeof response.body.redis.connected).toBe('boolean');
    expect(typeof response.body.sockets.connected_clients).toBe('number');
    expect(typeof response.body.jobs.scheduler.status).toBe('string');
    expect(typeof response.body.timestamp).toBe('string');
    expect(response.body.requests.total).toBeGreaterThanOrEqual(3);
  });

  it('returns Prometheus text format when requested', async () => {
    const app = express();
    app.use(requestMetricsMiddleware);
    app.get('/ping', (_req, res) => res.json({ ok: true }));
    app.use('/api/v1/metrics', metricsRoutes);

    await request(app).get('/ping');
    const response = await request(app)
      .get('/api/v1/metrics?format=prometheus')
      .set('Accept', 'text/plain');

    expect(response.status).toBe(200);
    expect(response.text).toContain('viabaq_requests_total');
    expect(response.text).toContain('viabaq_socket_connected_clients');
    expect(response.headers['content-type']).toContain('text/plain');
  });

  it('injects X-Cache headers for cache hit', async () => {
    const app = express();
    app.use(cacheHeaders);
    app.get('/cache-hit', (_req, res) => {
      res.locals.cacheHit = true;
      res.locals.cacheTTL = 300;
      res.json({ ok: true });
    });

    const response = await request(app).get('/cache-hit');
    expect(response.status).toBe(200);
    expect(response.headers['x-cache-hit']).toBe('true');
    expect(response.headers['x-cache-ttl']).toBe('300');
  });

  it('injects X-Cache headers for cache miss', async () => {
    const app = express();
    app.use(cacheHeaders);
    app.get('/cache-miss', (_req, res) => {
      res.locals.cacheHit = false;
      res.locals.cacheTTL = 600;
      res.json({ ok: true });
    });

    const response = await request(app).get('/cache-miss');
    expect(response.status).toBe(200);
    expect(response.headers['x-cache-hit']).toBe('false');
    expect(response.headers['x-cache-ttl']).toBe('600');
  });
});
