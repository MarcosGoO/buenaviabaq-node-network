import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import mlRoutes from '@/routes/mlRoutes.js';

vi.mock('@/services/predictionDriftService.js', () => ({
  PredictionDriftService: {
    getDriftStatus: vi.fn(),
  },
}));

vi.mock('@/services/predictionEvaluationService.js', () => ({
  PredictionEvaluationService: {
    syncActualValues: vi.fn(),
    getTemporalEvaluation: vi.fn(),
  },
}));

import { PredictionDriftService } from '@/services/predictionDriftService.js';
import { PredictionEvaluationService } from '@/services/predictionEvaluationService.js';

describe('ML Drift Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_API_KEY = 'test-admin-key';

    vi.mocked(PredictionEvaluationService.syncActualValues).mockResolvedValue({ updated: 12 });
    vi.mocked(PredictionDriftService.getDriftStatus).mockResolvedValue({
      status: 'watch',
      generated_at: new Date().toISOString(),
      windows: { recent_hours: 24, baseline_days: 30, min_samples: 40 },
      recent: { samples: 100, mae: 6, mape: 15, rmse: 7, p95_error: 10 },
      baseline: { samples: 500, mae: 5, mape: 13, rmse: 6, p95_error: 9 },
      deltas: { mae_change_ratio: 0.2, mape_change_ratio: 0.15, rmse_change_ratio: 0.16, max_change_ratio: 0.2 },
      thresholds: { watch: 0.1, drift: 0.2, critical: 0.35 },
    } as never);
  });

  it('GET /api/v1/ml/drift-status returns drift snapshot', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/ml', mlRoutes);

    const response = await request(app)
      .get('/api/v1/ml/drift-status')
      .query({ recent_hours: '12', baseline_days: '21', min_samples: '55' });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('success');
    expect(response.body.data).toHaveProperty('status');
    expect(vi.mocked(PredictionDriftService.getDriftStatus)).toHaveBeenCalledWith(12, 21, 55);
  });

  it('POST /api/v1/ml/drift-status/check requires admin key', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/ml', mlRoutes);

    const response = await request(app)
      .post('/api/v1/ml/drift-status/check')
      .send({});

    expect(response.status).toBe(401);
  });

  it('POST /api/v1/ml/drift-status/check forces sync and returns snapshot', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/ml', mlRoutes);

    const response = await request(app)
      .post('/api/v1/ml/drift-status/check')
      .set('x-admin-key', 'test-admin-key')
      .send({
        recent_hours: 8,
        baseline_days: 14,
        min_samples: 30,
        lookback_hours: 48,
        tolerance_minutes: 20,
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('success');
    expect(response.body.data.forced_check).toBe(true);
    expect(response.body.data.sync.updated).toBe(12);
    expect(vi.mocked(PredictionEvaluationService.syncActualValues)).toHaveBeenCalledWith(48, 20);
    expect(vi.mocked(PredictionDriftService.getDriftStatus)).toHaveBeenCalledWith(8, 14, 30);
  });
});
