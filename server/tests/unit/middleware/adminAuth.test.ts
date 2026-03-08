import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { requireAdminAuth } from '@/middleware/adminAuth.js';

describe('requireAdminAuth middleware', () => {
  const originalAdminApiKey = process.env.ADMIN_API_KEY;
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.ADMIN_API_KEY = 'super-secret-key';
  });

  afterEach(() => {
    process.env.ADMIN_API_KEY = originalAdminApiKey;
    process.env.JWT_SECRET = originalJwtSecret;
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
});

