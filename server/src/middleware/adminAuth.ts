import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '@/utils/logger.js';
import { config } from '@/config/index.js';

/**
 * Admin authentication middleware for sensitive operations.
 * Validates `x-admin-key` against ADMIN_API_KEY.
 * In non-production only, it can fall back to JWT_SECRET for local convenience.
 */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const nodeEnv = process.env.NODE_ENV ?? config.NODE_ENV;
  const runtimeAdminKey = process.env.ADMIN_API_KEY;
  const runtimeJwtSecret = process.env.JWT_SECRET ?? config.JWT_SECRET;
  const adminKey = runtimeAdminKey ?? (nodeEnv === 'production' ? undefined : runtimeJwtSecret);

  if (!adminKey) {
    logger.error('Admin auth is not configured - set ADMIN_API_KEY');
    return res.status(503).json({
      status: 'error',
      message: 'Admin authentication is not configured on this server',
    });
  }

  if (nodeEnv === 'production' && adminKey.length < 32) {
    logger.error('Admin auth rejected due to weak ADMIN_API_KEY length in production');
    return res.status(503).json({
      status: 'error',
      message: 'Admin authentication is not configured on this server',
    });
  }

  const provided = req.headers['x-admin-key'];
  const providedValue = Array.isArray(provided) ? provided[0] : provided;

  if (!providedValue) {
    logger.warn(`Rejected unauthorized admin request from ${req.ip} to ${req.path}`);
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized: valid x-admin-key header required',
    });
  }

  const expectedBuffer = Buffer.from(adminKey);
  const providedBuffer = Buffer.from(providedValue);
  const isValid =
    expectedBuffer.length === providedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, providedBuffer);

  if (!isValid) {
    logger.warn(`Rejected unauthorized admin request from ${req.ip} to ${req.path}`);
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized: valid x-admin-key header required',
    });
  }

  next();
}
