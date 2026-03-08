import type { Request, Response } from 'express';
import { pool } from '@/db/index.js';
import { CacheService } from '@/services/cacheService.js';
import { getRequestMetrics } from '@/middleware/requestMetrics.js';

export class MetricsController {
  static getMetrics(_req: Request, res: Response) {
    const memoryUsage = process.memoryUsage();
    const requestMetrics = getRequestMetrics();
    const cacheMetrics = CacheService.getRuntimeStats();

    return res.json({
      uptime_seconds: Math.floor(process.uptime()),
      memory_mb: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      },
      requests: {
        total: requestMetrics.total,
        per_minute: requestMetrics.perMinute,
      },
      cache: {
        hits: cacheMetrics.hits,
        misses: cacheMetrics.misses,
        hit_rate: cacheMetrics.hitRate,
      },
      db: {
        pool_size: pool.totalCount,
        active_connections: pool.totalCount - pool.idleCount,
      },
      timestamp: new Date().toISOString(),
    });
  }
}

