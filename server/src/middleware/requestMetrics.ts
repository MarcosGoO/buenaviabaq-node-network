import type { NextFunction, Request, Response } from 'express';
import { ObservabilityService } from '@/services/observabilityService.js';

function resolveRouteLabel(req: Request) {
  if (req.route?.path) {
    const routePath = typeof req.route.path === 'string' ? req.route.path : req.path;
    const base = req.baseUrl || '';
    return `${base}${routePath}` || req.originalUrl;
  }

  return req.path || req.originalUrl;
}

export function requestMetricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const startedAt = process.hrtime.bigint();
  ObservabilityService.recordRequestStart();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    ObservabilityService.recordRequestComplete({
      method: req.method,
      route: resolveRouteLabel(req),
      statusCode: res.statusCode,
      durationMs,
    });
  });

  next();
}

export function getRequestMetrics() {
  return ObservabilityService.getRequestMetrics();
}
