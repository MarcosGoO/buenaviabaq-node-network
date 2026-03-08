import type { NextFunction, Request, Response } from 'express';

/**
 * Injects cache observability headers from res.locals:
 * - cacheHit: boolean
 * - cacheTTL: number (seconds)
 */
export function cacheHeaders(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res);

  res.json = ((body: unknown) => {
    if (typeof res.locals.cacheHit === 'boolean') {
      res.setHeader('X-Cache-Hit', String(res.locals.cacheHit));
    }

    if (typeof res.locals.cacheTTL === 'number' && res.locals.cacheTTL >= 0) {
      res.setHeader('X-Cache-TTL', String(res.locals.cacheTTL));
    }

    return originalJson(body);
  }) as Response['json'];

  next();
}

