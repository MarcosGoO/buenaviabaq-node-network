import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db/index.js', () => ({
  pool: { query: vi.fn() },
}));

vi.mock('@/services/predictionEvaluationService.js', () => ({
  PredictionEvaluationService: {
    syncActualValues: vi.fn(),
  },
}));

vi.mock('@/services/predictionDriftService.js', () => ({
  PredictionDriftService: {
    getDriftStatus: vi.fn(),
  },
}));

vi.mock('@/services/modelGovernanceService.js', () => ({
  ModelGovernanceService: {
    buildGovernanceInput: vi.fn(),
    evaluateOperationalDecision: vi.fn(),
    persistDecision: vi.fn(),
  },
}));

vi.mock('@/lib/socket.js', () => ({
  SocketService: {
    emitReliabilityIncidentOpened: vi.fn(),
    emitReliabilityIncidentResolved: vi.fn(),
    emitReliabilityDecisionRecommended: vi.fn(),
    emitReliabilityUpdate: vi.fn(),
  },
}));

vi.mock('@/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { pool } from '@/db/index.js';
import { PredictionEvaluationService } from '@/services/predictionEvaluationService.js';
import { PredictionDriftService } from '@/services/predictionDriftService.js';
import { ModelGovernanceService } from '@/services/modelGovernanceService.js';
import { SocketService } from '@/lib/socket.js';
import { ModelReliabilityService } from '@/services/modelReliabilityService.js';

function driftSnapshot(status: 'healthy' | 'watch' | 'drift' | 'critical' | 'insufficient_data') {
  return {
    status,
    generated_at: new Date().toISOString(),
    windows: { recent_hours: 24, baseline_days: 30, min_samples: 40 },
    recent: { samples: 100, mae: 7, mape: 18, rmse: 9, p95_error: 12 },
    baseline: { samples: 500, mae: 6, mape: 14, rmse: 7, p95_error: 9 },
    deltas: { mae_change_ratio: 0.2, mape_change_ratio: 0.22, rmse_change_ratio: 0.21, max_change_ratio: 0.22 },
    thresholds: { watch: 0.1, drift: 0.2, critical: 0.35 },
  };
}

describe('ModelReliabilityService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens incident when drift snapshot is degradated', async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ id: '22' }] } as never);

    const result = await ModelReliabilityService.openOrUpdateDriftIncident(driftSnapshot('drift') as never);
    expect(result).toEqual({ incidentId: 22, action: 'opened' });
    expect(vi.mocked(SocketService.emitReliabilityIncidentOpened)).toHaveBeenCalled();
  });

  it('updates existing open incident without duplication', async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ id: '22', peak_status: 'drift', peak_change_ratio: '0.2', snapshots_count: '3' }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const result = await ModelReliabilityService.openOrUpdateDriftIncident(driftSnapshot('critical') as never);
    expect(result).toEqual({ incidentId: 22, action: 'updated' });
    expect(vi.mocked(SocketService.emitReliabilityIncidentOpened)).not.toHaveBeenCalled();
  });

  it('resolves open incident when status recovers', async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ id: '22', current_status: 'drift' }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const result = await ModelReliabilityService.resolveDriftIncidentIfNeeded(driftSnapshot('healthy') as never);
    expect(result).toEqual({ resolved: true, incidentId: 22 });
    expect(vi.mocked(SocketService.emitReliabilityIncidentResolved)).toHaveBeenCalled();
  });

  it('materializes daily quality snapshot', async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({
        rows: [{ samples: '15', mae: '6.1', mape: '14.2', rmse: '7.0', p95_error: '10.1' }],
      } as never)
      .mockResolvedValueOnce({
        rows: [{ drift_events: '2', critical_events: '1' }],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const result = await ModelReliabilityService.materializeDailyQuality('2026-03-10');
    expect(result.day).toBe('2026-03-10');
    expect(result.samples).toBe(15);
    expect(result.drift_events).toBe(2);
  });

  it('runs check-now flow and emits decision/reliability events', async () => {
    vi.mocked(PredictionEvaluationService.syncActualValues).mockResolvedValue({ updated: 8 });
    vi.mocked(PredictionDriftService.getDriftStatus).mockResolvedValue(driftSnapshot('drift') as never);

    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [] } as never) // no open incident
      .mockResolvedValueOnce({ rows: [{ id: '50' }] } as never); // created incident

    vi.mocked(ModelGovernanceService.buildGovernanceInput).mockResolvedValue({
      drift: driftSnapshot('drift'),
      driftTrend: { watch: 0, drift: 2, critical: 0 },
      recentSamples: 100,
      baselineSamples: 500,
      qualityTrend: { recentMae: 7, baselineMae: 6, maeChangeRatio: 0.16 },
    } as never);
    vi.mocked(ModelGovernanceService.evaluateOperationalDecision).mockReturnValue({
      decisionType: 'retrain',
      reason: 'sustained drift',
      confidenceScore: 0.88,
      evidence: { any: true },
      modelVersionFrom: 'v2',
      modelVersionTo: 'v1',
    });
    vi.mocked(ModelGovernanceService.persistDecision).mockResolvedValue(99);

    const result = await ModelReliabilityService.runReliabilityCheckNow();
    expect(result.incident.incident_id).toBe(50);
    expect(result.recommendation.decision_id).toBe(99);
    expect(vi.mocked(SocketService.emitReliabilityDecisionRecommended)).toHaveBeenCalled();
    expect(vi.mocked(SocketService.emitReliabilityUpdate)).toHaveBeenCalled();
  });
});
