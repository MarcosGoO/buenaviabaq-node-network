import { Request, Response } from 'express';
import crypto from 'crypto';
import { config } from '@/config/index.js';
import {
  createAdminSessionToken,
  getAdminSessionClearCookie,
  getAdminSessionCookie,
  getAdminSessionFromCookie,
  verifyAdminSessionToken,
} from '@/lib/adminSession.js';
import { logger } from '@/utils/logger.js';

function hasValidAdminKey(provided: string | undefined): boolean {
  if (!provided) return false;
  const nodeEnv = process.env.NODE_ENV ?? config.NODE_ENV;
  const runtimeAdminKey = process.env.ADMIN_API_KEY;
  const fallbackKey = nodeEnv === 'production' ? undefined : (process.env.JWT_SECRET ?? config.JWT_SECRET);
  const expected = runtimeAdminKey ?? config.ADMIN_API_KEY ?? fallbackKey;

  if (!expected) return false;

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return (
    expectedBuffer.length === providedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

export class AuthController {
  static async adminLogin(req: Request, res: Response) {
    const headerValue = req.headers['x-admin-key'];
    const adminKey = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (!hasValidAdminKey(adminKey)) {
      logger.warn(`Rejected admin login from ${req.ip}`);
      return res.status(401).json({
        status: 'error',
        message: 'Unauthorized: valid x-admin-key header required',
      });
    }

    const token = createAdminSessionToken();
    if (!token) {
      return res.status(503).json({
        status: 'error',
        message: 'Admin session signing is not configured',
      });
    }

    res.setHeader('Set-Cookie', getAdminSessionCookie(token));
    return res.json({
      status: 'success',
      data: {
        authenticated: true,
        mode: 'cookie_session',
      },
      timestamp: new Date().toISOString(),
    });
  }

  static async adminLogout(_req: Request, res: Response) {
    res.setHeader('Set-Cookie', getAdminSessionClearCookie());
    return res.json({
      status: 'success',
      data: { authenticated: false },
      timestamp: new Date().toISOString(),
    });
  }

  static async adminSession(req: Request, res: Response) {
    const cookieHeader = req.headers.cookie;
    const token = getAdminSessionFromCookie(cookieHeader);
    const authenticated = token ? verifyAdminSessionToken(token) : false;

    return res.json({
      status: 'success',
      data: { authenticated },
      timestamp: new Date().toISOString(),
    });
  }
}
