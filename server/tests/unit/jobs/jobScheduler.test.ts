import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/jobs/queues.js', () => ({
  JobTypes: {
    COLLECT_TRAFFIC: 'collect-traffic',
    COLLECT_WEATHER: 'collect-weather',
    COLLECT_ALL: 'collect-all',
    DETECT_ALERTS: 'detect-alerts',
    RETRAIN_MODEL: 'retrain-model',
  },
  dataCollectionQueue: {
    add: vi.fn(),
    getWaitingCount: vi.fn().mockResolvedValue(0),
    getActiveCount: vi.fn().mockResolvedValue(0),
    getCompletedCount: vi.fn().mockResolvedValue(0),
    getFailedCount: vi.fn().mockResolvedValue(0),
    getDelayedCount: vi.fn().mockResolvedValue(0),
  },
}));

vi.mock('@/services/modelReliabilityService.js', () => ({
  ModelReliabilityService: {
    runReliabilityCheckNow: vi.fn(),
    materializeDailyQuality: vi.fn(),
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
    emitAlertNotification: vi.fn(),
  },
}));

vi.mock('@/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { JobScheduler } from '@/jobs/scheduler.js';
import { ModelReliabilityService } from '@/services/modelReliabilityService.js';
import { SocketService } from '@/lib/socket.js';

describe('JobScheduler monitorPredictionDrift', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (JobScheduler as unknown as { lastDriftAlertStatus: 'drift' | 'critical' | null }).lastDriftAlertStatus = null;
    vi.mocked(ModelReliabilityService.runReliabilityCheckNow).mockResolvedValue({
      sync: { updated: 5 },
      drift: {
        status: 'healthy',
        generated_at: new Date().toISOString(),
        windows: { recent_hours: 24, baseline_days: 30, min_samples: 40 },
        recent: { samples: 120, mae: 6, mape: 14, rmse: 7, p95_error: 10 },
        baseline: { samples: 600, mae: 6, mape: 14, rmse: 7, p95_error: 10 },
        deltas: { mae_change_ratio: 0, mape_change_ratio: 0, rmse_change_ratio: 0, max_change_ratio: 0 },
        thresholds: { watch: 0.1, drift: 0.2, critical: 0.35 },
      },
      incident: { action: 'none', incident_id: null },
      recommendation: {
        decision_id: 1,
        decision_type: 'keep',
        reason: 'stable',
        confidence_score: 0.8,
        evidence: {},
      },
    } as never);
  });

  it('emits drift alert when degradation is detected and deduplicates repeated status', async () => {
    vi.mocked(ModelReliabilityService.runReliabilityCheckNow).mockResolvedValue({
      sync: { updated: 5 },
      drift: {
        status: 'critical',
        generated_at: new Date().toISOString(),
        windows: { recent_hours: 24, baseline_days: 30, min_samples: 40 },
        recent: { samples: 120, mae: 9, mape: 20, rmse: 10, p95_error: 14 },
        baseline: { samples: 600, mae: 6, mape: 14, rmse: 7, p95_error: 10 },
        deltas: { mae_change_ratio: 0.5, mape_change_ratio: 0.43, rmse_change_ratio: 0.42, max_change_ratio: 0.5 },
        thresholds: { watch: 0.1, drift: 0.2, critical: 0.35 },
      },
      incident: { action: 'opened', incident_id: 42 },
      recommendation: {
        decision_id: 7,
        decision_type: 'retrain',
        reason: 'degraded',
        confidence_score: 0.9,
        evidence: {},
      },
    } as never);

    await JobScheduler.monitorPredictionDrift();
    await JobScheduler.monitorPredictionDrift();

    expect(vi.mocked(SocketService.emitAlertNotification)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(SocketService.emitAlertNotification).mock.calls[0][0]).toMatchObject({
      type: 'model:drift',
      drift_status: 'critical',
    });
  });

  it('emits recovery event when drift returns to healthy', async () => {
    vi.mocked(ModelReliabilityService.runReliabilityCheckNow)
      .mockResolvedValueOnce({
        sync: { updated: 5 },
        drift: {
          status: 'drift',
          generated_at: new Date().toISOString(),
          windows: { recent_hours: 24, baseline_days: 30, min_samples: 40 },
          recent: { samples: 120, mae: 8, mape: 18, rmse: 9, p95_error: 13 },
          baseline: { samples: 600, mae: 6, mape: 14, rmse: 7, p95_error: 10 },
          deltas: { mae_change_ratio: 0.33, mape_change_ratio: 0.28, rmse_change_ratio: 0.29, max_change_ratio: 0.33 },
          thresholds: { watch: 0.1, drift: 0.2, critical: 0.35 },
        },
        incident: { action: 'opened', incident_id: 1 },
        recommendation: {
          decision_id: 9,
          decision_type: 'retrain',
          reason: 'drift',
          confidence_score: 0.7,
          evidence: {},
        },
      } as never)
      .mockResolvedValueOnce({
        sync: { updated: 6 },
        drift: {
          status: 'healthy',
          generated_at: new Date().toISOString(),
          windows: { recent_hours: 24, baseline_days: 30, min_samples: 40 },
          recent: { samples: 120, mae: 6.1, mape: 14.2, rmse: 7.2, p95_error: 10.2 },
          baseline: { samples: 600, mae: 6, mape: 14, rmse: 7, p95_error: 10 },
          deltas: { mae_change_ratio: 0.016, mape_change_ratio: 0.014, rmse_change_ratio: 0.028, max_change_ratio: 0.028 },
          thresholds: { watch: 0.1, drift: 0.2, critical: 0.35 },
        },
        incident: { action: 'resolved', incident_id: 1 },
        recommendation: {
          decision_id: 10,
          decision_type: 'keep',
          reason: 'healthy',
          confidence_score: 0.8,
          evidence: {},
        },
      } as never);

    await JobScheduler.monitorPredictionDrift();
    await JobScheduler.monitorPredictionDrift();

    expect(vi.mocked(SocketService.emitAlertNotification)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(SocketService.emitAlertNotification).mock.calls[1][0]).toMatchObject({
      type: 'model:drift_recovered',
      previous_status: 'drift',
    });
  });
});
