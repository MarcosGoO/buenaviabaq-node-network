import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db/index.js', () => ({
  pool: { query: vi.fn() },
}));

vi.mock('@/services/predictionDriftService.js', () => ({
  PredictionDriftService: { getDriftStatus: vi.fn() },
}));

vi.mock('@/services/predictionEvaluationService.js', () => ({
  PredictionEvaluationService: { getTemporalEvaluation: vi.fn() },
}));

vi.mock('@/services/mlPredictionService.js', () => ({
  MLPredictionService: {
    getModelHistory: vi.fn(),
    rollbackModel: vi.fn(),
  },
}));

vi.mock('@/jobs/queues.js', () => ({
  JobTypes: {
    RETRAIN_MODEL: 'retrain-model',
  },
  dataCollectionQueue: {
    add: vi.fn(),
  },
}));

vi.mock('@/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { pool } from '@/db/index.js';
import { PredictionDriftService } from '@/services/predictionDriftService.js';
import { PredictionEvaluationService } from '@/services/predictionEvaluationService.js';
import { MLPredictionService } from '@/services/mlPredictionService.js';
import { dataCollectionQueue } from '@/jobs/queues.js';
import { ModelGovernanceService } from '@/services/modelGovernanceService.js';

describe('ModelGovernanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ML_RCC_ALLOW_DECISION_EXECUTION;
    delete process.env.ML_RCC_ALLOW_ROLLBACK;
    vi.mocked(PredictionDriftService.getDriftStatus).mockResolvedValue({
      status: 'healthy',
      generated_at: new Date().toISOString(),
      windows: { recent_hours: 24, baseline_days: 30, min_samples: 40 },
      recent: { samples: 120, mae: 6, mape: 14, rmse: 7, p95_error: 10 },
      baseline: { samples: 600, mae: 6, mape: 14, rmse: 7, p95_error: 10 },
      deltas: { mae_change_ratio: 0, mape_change_ratio: 0, rmse_change_ratio: 0, max_change_ratio: 0 },
      thresholds: { watch: 0.1, drift: 0.2, critical: 0.35 },
    } as never);
    vi.mocked(PredictionEvaluationService.getTemporalEvaluation).mockResolvedValue({
      window_days: 14,
      overall: { samples: 500, mae: 6, mape: 14, rmse: 7, p95_error: 10 },
      by_horizon: [],
      by_zone: [],
      by_hour: [],
      by_rush_hour: [],
    } as never);
    vi.mocked(MLPredictionService.getModelHistory).mockResolvedValue({
      versions: [{ version: '20260314_010101' }, { version: '20260307_010101' }] as never,
      count: 2,
      active_model_version: '20260314_010101',
    } as never);
    vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);
  });

  it('builds governance input from drift/evaluation/history sources', async () => {
    const input = await ModelGovernanceService.buildGovernanceInput(30);
    expect(input.drift.status).toBe('healthy');
    expect(input.modelVersionFrom).toBe('20260314_010101');
  });

  it('returns keep when model is healthy and stable', () => {
    const decision = ModelGovernanceService.evaluateOperationalDecision({
      drift: {
        status: 'healthy',
        generated_at: new Date().toISOString(),
        windows: { recent_hours: 24, baseline_days: 30, min_samples: 40 },
        recent: { samples: 100, mae: 6, mape: 14, rmse: 7, p95_error: 9 },
        baseline: { samples: 500, mae: 6, mape: 14, rmse: 7, p95_error: 9 },
        deltas: { mae_change_ratio: 0.01, mape_change_ratio: 0.01, rmse_change_ratio: 0.01, max_change_ratio: 0.01 },
        thresholds: { watch: 0.1, drift: 0.2, critical: 0.35 },
      },
      driftTrend: { watch: 0, drift: 0, critical: 0 },
      recentSamples: 100,
      baselineSamples: 500,
      qualityTrend: { recentMae: 6, baselineMae: 6, maeChangeRatio: 0 },
      modelVersionFrom: 'a',
      modelVersionTo: 'b',
    });

    expect(decision.decisionType).toBe('keep');
  });

  it('returns watch for insufficient data', () => {
    const decision = ModelGovernanceService.evaluateOperationalDecision({
      drift: {
        status: 'insufficient_data',
        generated_at: new Date().toISOString(),
        windows: { recent_hours: 24, baseline_days: 30, min_samples: 40 },
        recent: { samples: 5, mae: null, mape: null, rmse: null, p95_error: null },
        baseline: { samples: 10, mae: null, mape: null, rmse: null, p95_error: null },
        deltas: { mae_change_ratio: null, mape_change_ratio: null, rmse_change_ratio: null, max_change_ratio: null },
        thresholds: { watch: 0.1, drift: 0.2, critical: 0.35 },
      },
      driftTrend: { watch: 0, drift: 0, critical: 0 },
      recentSamples: 5,
      baselineSamples: 10,
      qualityTrend: { recentMae: null, baselineMae: null, maeChangeRatio: null },
    });

    expect(decision.decisionType).toBe('watch');
  });

  it('returns retrain for sustained drift', () => {
    const decision = ModelGovernanceService.evaluateOperationalDecision({
      drift: {
        status: 'drift',
        generated_at: new Date().toISOString(),
        windows: { recent_hours: 24, baseline_days: 30, min_samples: 40 },
        recent: { samples: 100, mae: 7, mape: 18, rmse: 9, p95_error: 12 },
        baseline: { samples: 500, mae: 6, mape: 14, rmse: 7, p95_error: 9 },
        deltas: { mae_change_ratio: 0.2, mape_change_ratio: 0.2, rmse_change_ratio: 0.2, max_change_ratio: 0.2 },
        thresholds: { watch: 0.1, drift: 0.2, critical: 0.35 },
      },
      driftTrend: { watch: 1, drift: 2, critical: 0 },
      recentSamples: 100,
      baselineSamples: 500,
      qualityTrend: { recentMae: 7, baselineMae: 6, maeChangeRatio: 0.17 },
    });

    expect(decision.decisionType).toBe('retrain');
  });

  it('returns rollback when critical degradation exceeds threshold', () => {
    const decision = ModelGovernanceService.evaluateOperationalDecision({
      drift: {
        status: 'critical',
        generated_at: new Date().toISOString(),
        windows: { recent_hours: 24, baseline_days: 30, min_samples: 40 },
        recent: { samples: 100, mae: 8, mape: 20, rmse: 10, p95_error: 14 },
        baseline: { samples: 500, mae: 6, mape: 14, rmse: 7, p95_error: 9 },
        deltas: { mae_change_ratio: 0.4, mape_change_ratio: 0.42, rmse_change_ratio: 0.43, max_change_ratio: 0.43 },
        thresholds: { watch: 0.1, drift: 0.2, critical: 0.35 },
      },
      driftTrend: { watch: 0, drift: 1, critical: 2 },
      recentSamples: 100,
      baselineSamples: 500,
      qualityTrend: { recentMae: 8, baselineMae: 6, maeChangeRatio: 0.2 },
      modelVersionTo: 'rollback_target',
    });

    expect(decision.decisionType).toBe('rollback');
  });

  it('persists decision evidence', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ id: '9' }] } as never);
    const id = await ModelGovernanceService.persistDecision({
      decisionType: 'watch',
      reason: 'insufficient data',
      confidenceScore: 0.6,
      inputs: { drift: 'insufficient_data' },
    });
    expect(id).toBe(9);
  });

  it('blocks execution by policy when disabled', async () => {
    const result = await ModelGovernanceService.executeDecision({
      decisionType: 'retrain',
    });
    expect(result.executed).toBe(false);
    expect(result.action).toBe('blocked_by_policy');
  });

  it('queues retraining when execution is enabled', async () => {
    process.env.ML_RCC_ALLOW_DECISION_EXECUTION = 'true';
    vi.mocked(dataCollectionQueue.add).mockResolvedValue({ id: 'job-1' } as never);
    const result = await ModelGovernanceService.executeDecision({
      decisionType: 'retrain',
    });
    expect(result.executed).toBe(true);
    expect(result.action).toBe('queued_retrain');
    expect(vi.mocked(dataCollectionQueue.add)).toHaveBeenCalled();
  });
});
