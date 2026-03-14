import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { requireAdminAuth } from '@/middleware/adminAuth.js';

describe('requireAdminAuth middleware', () => {
  const originalAdminApiKey = process.env.ADMIN_API_KEY;
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.ADMIN_API_KEY = 'super-secret-key';
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env.ADMIN_API_KEY = originalAdminApiKey;
    process.env.JWT_SECRET = originalJwtSecret;
    process.env.NODE_ENV = originalNodeEnv;
  });

  function buildApp() {
    const app = express();
    app.get('/admin', requireAdminAuth, (_req, res) => {
      res.status(200).json({ ok: true });
    });
    return app;
  }

  it('rejects request without x-admin-key', async () => {
    const app = buildApp();
    const response = await request(app).get('/admin');
    expect(response.status).toBe(401);
  });

  it('rejects request with invalid x-admin-key', async () => {
    const app = buildApp();
    const response = await request(app)
      .get('/admin')
      .set('x-admin-key', 'invalid');
    expect(response.status).toBe(401);
  });

  it('allows request with valid x-admin-key', async () => {
    const app = buildApp();
    const response = await request(app)
      .get('/admin')
      .set('x-admin-key', 'super-secret-key');
    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });

  it('allows fallback to JWT_SECRET only in non-production', async () => {
    delete process.env.ADMIN_API_KEY;
    process.env.JWT_SECRET = 'jwt-fallback-secret';

    const app = buildApp();
    const response = await request(app)
      .get('/admin')
      .set('x-admin-key', 'jwt-fallback-secret');

    expect(response.status).toBe(200);
  });

  it('rejects fallback to JWT_SECRET in production without ADMIN_API_KEY', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ADMIN_API_KEY;
    process.env.JWT_SECRET = 'jwt-fallback-secret';

    const app = buildApp();
    const response = await request(app)
      .get('/admin')
      .set('x-admin-key', 'jwt-fallback-secret');

    expect(response.status).toBe(503);
  });
});
