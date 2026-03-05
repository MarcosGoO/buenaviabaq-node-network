import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger.js';
import { config } from '@/config/index.js';

/**
 * Admin authentication middleware for sensitive operations
 * (model retraining, rollback, feature batch extraction).
 *
 * Validates the `x-admin-key` header against the ADMIN_API_KEY environment variable.
 * Falls back to JWT_SECRET when ADMIN_API_KEY is not set (development convenience).
 *
 * In production, always set ADMIN_API_KEY to a strong random value:
 *   openssl rand -hex 32
 */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const adminKey = process.env.ADMIN_API_KEY || config.JWT_SECRET;

  if (!adminKey) {
    logger.error('Admin auth is not configured — set ADMIN_API_KEY or JWT_SECRET env var');
    return res.status(503).json({
      status: 'error',
      message: 'Admin authentication is not configured on this server',
    });
  }

  const provided = req.headers['x-admin-key'];

  if (!provided || provided !== adminKey) {
    logger.warn(`Rejected unauthorized admin request from ${req.ip} to ${req.path}`);
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized: valid x-admin-key header required',
    });
  }

  next();
}
