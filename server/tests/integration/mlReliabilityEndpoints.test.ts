import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import mlRoutes from '@/routes/mlRoutes.js';

vi.mock('@/services/modelReliabilityService.js', () => ({
  ModelReliabilityService: {
    getOverview: vi.fn(),
    getIncidents: vi.fn(),
    getDecisions: vi.fn(),
    runReliabilityCheckNow: vi.fn(),
  },
}));

vi.mock('@/services/modelGovernanceService.js', () => ({
  ModelGovernanceService: {
    executeDecision: vi.fn(),
  },
}));

import { ModelReliabilityService } from '@/services/modelReliabilityService.js';
import { ModelGovernanceService } from '@/services/modelGovernanceService.js';

describe('ML Reliability Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_API_KEY = 'test-admin-key';

    vi.mocked(ModelReliabilityService.getOverview).mockResolvedValue({
      days: 30,
      summary: { samples: 100, open_incidents: 1 },
      daily: [],
    } as never);
    vi.mocked(ModelReliabilityService.getIncidents).mockResolvedValue([
      { id: 1, current_status: 'drift', resolved_at: null },
    ] as never);
    vi.mocked(ModelReliabilityService.getDecisions).mockResolvedValue([
      { id: 3, decision_type: 'watch', executed: false },
    ] as never);
    vi.mocked(ModelReliabilityService.runReliabilityCheckNow).mockResolvedValue({
      sync: { updated: 12 },
      drift: { status: 'watch' },
      incident: { action: 'none', incident_id: null },
      recommendation: { decision_id: 10, decision_type: 'watch' },
    } as never);
    vi.mocked(ModelGovernanceService.executeDecision).mockResolvedValue({
      executed: true,
      action: 'queued_retrain',
      decisionId: 10,
      details: { job_id: 'abc' },
    } as never);
  });

  it('GET /api/v1/ml/reliability/overview returns RCC aggregate', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/ml', mlRoutes);

    const response = await request(app)
      .get('/api/v1/ml/reliability/overview')
      .query({ days: '30' });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('success');
    expect(vi.mocked(ModelReliabilityService.getOverview)).toHaveBeenCalledWith(30);
  });

  it('GET /api/v1/ml/reliability/incidents validates status enum', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/ml', mlRoutes);

    const response = await request(app)
      .get('/api/v1/ml/reliability/incidents')
      .query({ status: 'invalid' });

    expect(response.status).toBe(400);
  });

  it('POST /api/v1/ml/reliability/check-now requires admin key', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/ml', mlRoutes);

    const response = await request(app)
      .post('/api/v1/ml/reliability/check-now')
      .send({});

    expect(response.status).toBe(401);
  });

  it('POST /api/v1/ml/reliability/check-now executes check with strict body', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/ml', mlRoutes);

    const response = await request(app)
      .post('/api/v1/ml/reliability/check-now')
      .set('x-admin-key', 'test-admin-key')
      .send({
        lookback_hours: 72,
        tolerance_minutes: 20,
        recent_hours: 12,
        baseline_days: 21,
        min_samples: 50,
        governance_days: 30,
      });

    expect(response.status).toBe(200);
    expect(response.body.data.forced_check).toBe(true);
    expect(vi.mocked(ModelReliabilityService.runReliabilityCheckNow)).toHaveBeenCalledWith({
      lookbackHours: 72,
      toleranceMinutes: 20,
      recentHours: 12,
      baselineDays: 21,
      minSamples: 50,
      governanceDays: 30,
    });
  });

  it('POST /api/v1/ml/reliability/execute-decision enforces admin auth and executes', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/ml', mlRoutes);

    const response = await request(app)
      .post('/api/v1/ml/reliability/execute-decision')
      .set('x-admin-key', 'test-admin-key')
      .send({
        decision_id: 10,
        force: true,
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('success');
    expect(vi.mocked(ModelGovernanceService.executeDecision)).toHaveBeenCalledWith({
      decisionId: 10,
      decisionType: undefined,
      modelVersion: undefined,
      force: true,
    });
  });
});
