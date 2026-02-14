import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Request ID Middleware
 * Adds a unique ID to each request for tracing
 */
export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Use existing request ID from header or generate new one
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();

  // Attach to request object
  (req as any).id = requestId;

  // Add to response headers
  res.setHeader('X-Request-ID', requestId);

  next();
};
