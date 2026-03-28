import type { Request, Response } from 'express';
import { pool } from '@/db/index.js';
import { CacheService } from '@/services/cacheService.js';
import { getRequestMetrics } from '@/middleware/requestMetrics.js';
import { RedisClient } from '@/lib/redis.js';
import { ObservabilityService } from '@/services/observabilityService.js';
import { JobScheduler } from '@/jobs/scheduler.js';

export class MetricsController {
  static async getMetrics(req: Request, res: Response) {
    const memoryUsage = process.memoryUsage();
    const requestMetrics = getRequestMetrics();
    const cacheMetrics = CacheService.getRuntimeStats();
    const socketMetrics = ObservabilityService.getSocketMetrics();
    const jobMetrics = ObservabilityService.getJobMetrics();
    const queueStats = await JobScheduler.getQueueStats();
    const redisConnected = await RedisClient.healthCheck();

    const payload = {
      uptime_seconds: Math.floor(process.uptime()),
      process: {
        pid: process.pid,
        memory_mb: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024),
        },
      },
      requests: {
        total: requestMetrics.total,
        in_flight: requestMetrics.inFlight,
        per_minute: requestMetrics.perMinute,
        server_errors: requestMetrics.serverErrors,
        status_codes: requestMetrics.statusCodes,
        latency_ms: {
          avg: requestMetrics.latencyMs.avg,
          p95: requestMetrics.latencyMs.p95,
          max: requestMetrics.latencyMs.max,
        },
        busiest_routes: requestMetrics.routes,
      },
      cache: {
        hits: cacheMetrics.hits,
        misses: cacheMetrics.misses,
        hit_rate: cacheMetrics.hitRate,
      },
      db: {
        pool_size: pool.totalCount,
        idle_connections: pool.idleCount,
        active_connections: pool.totalCount - pool.idleCount,
      },
      redis: {
        connected: redisConnected,
      },
      sockets: {
        connected_clients: socketMetrics.connectedClients,
        peak_connections: socketMetrics.peakConnections,
        total_connections: socketMetrics.totalConnections,
        total_disconnections: socketMetrics.totalDisconnections,
        auth_failures: socketMetrics.authFailures,
        errors: socketMetrics.errors,
        emitted_events: socketMetrics.emittedEvents,
        channels: socketMetrics.channels,
      },
      jobs: {
        scheduler: jobMetrics.scheduler,
        queue: queueStats,
        execution: jobMetrics.jobs,
      },
      timestamp: new Date().toISOString(),
    };

    const format = typeof req.query.format === 'string' ? req.query.format.toLowerCase() : '';
    const acceptHeader = req.get('accept') || '';
    const wantsPrometheus = format === 'prometheus' || acceptHeader.includes('text/plain');

    if (wantsPrometheus) {
      return res
        .type('text/plain; version=0.0.4; charset=utf-8')
        .send(ObservabilityService.toPrometheusSnapshot({
          uptimeSeconds: payload.uptime_seconds,
          cache: {
            hits: payload.cache.hits,
            misses: payload.cache.misses,
            hitRate: payload.cache.hit_rate,
          },
          db: {
            poolSize: payload.db.pool_size,
            activeConnections: payload.db.active_connections,
          },
          requests: requestMetrics,
          sockets: socketMetrics,
          jobs: jobMetrics,
        }));
    }

    return res.json(payload);
  }
}
