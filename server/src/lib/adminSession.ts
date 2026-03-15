import crypto from 'crypto';
import { config } from '@/config/index.js';

const SESSION_COOKIE_NAME = 'viabaq_admin_session';
const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 hours

interface SessionPayload {
  sub: 'admin';
  iat: number;
  exp: number;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function getSigningSecret(): string | null {
  const secret = config.JWT_SECRET || config.ADMIN_API_KEY || null;
  return secret && secret.length >= 12 ? secret : null;
}

function sign(content: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(content).digest('base64url');
}

export function createAdminSessionToken(now: Date = new Date()): string | null {
  const secret = getSigningSecret();
  if (!secret) return null;

  const iat = Math.floor(now.getTime() / 1000);
  const payload: SessionPayload = {
    sub: 'admin',
    iat,
    exp: iat + SESSION_TTL_SECONDS,
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(`${encodedHeader}.${encodedPayload}`, secret);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyAdminSessionToken(token: string, now: Date = new Date()): boolean {
  const secret = getSigningSecret();
  if (!secret) return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`, secret);
  const expectedBuffer = Buffer.from(expectedSignature);
  const providedBuffer = Buffer.from(signature);
  const signatureValid =
    expectedBuffer.length === providedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, providedBuffer);
  if (!signatureValid) return false;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
    if (payload.sub !== 'admin') return false;
    const nowSec = Math.floor(now.getTime() / 1000);
    return Number.isFinite(payload.exp) && payload.exp > nowSec;
  } catch {
    return false;
  }
}

export function getAdminSessionFromCookie(cookieHeader?: string): string | null {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(';').map((item) => item.trim());
  for (const pair of pairs) {
    const [key, ...rest] = pair.split('=');
    if (key === SESSION_COOKIE_NAME) {
      return rest.join('=');
    }
  }
  return null;
}

export function getAdminSessionCookie(token: string): string {
  const attributes = [
    `${SESSION_COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];

  if (config.NODE_ENV === 'production') {
    attributes.push('Secure');
  }

  return attributes.join('; ');
}

export function getAdminSessionClearCookie(): string {
  const attributes = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];

  if (config.NODE_ENV === 'production') {
    attributes.push('Secure');
  }

  return attributes.join('; ');
}

