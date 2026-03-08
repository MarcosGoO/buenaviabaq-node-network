import type { NextFunction, Request, Response } from 'express';

const ONE_MINUTE_MS = 60_000;
let totalRequests = 0;
const requestTimestamps: number[] = [];

function trimWindow(now: number) {
  const cutoff = now - ONE_MINUTE_MS;
  while (requestTimestamps.length > 0 && requestTimestamps[0] < cutoff) {
    requestTimestamps.shift();
  }
}

export function requestMetricsMiddleware(_req: Request, _res: Response, next: NextFunction) {
  const now = Date.now();
  totalRequests += 1;
  requestTimestamps.push(now);
  trimWindow(now);
  next();
}

export function getRequestMetrics() {
  const now = Date.now();
  trimWindow(now);
  return {
    total: totalRequests,
    perMinute: requestTimestamps.length,
  };
}

