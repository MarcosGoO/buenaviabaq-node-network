import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db/index.js', () => ({
  pool: { query: vi.fn() },
}));

import { pool } from '@/db/index.js';
import { PredictionDriftService } from '@/services/predictionDriftService.js';

describe('PredictionDriftService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ML_DRIFT_WATCH_THRESHOLD;
    delete process.env.ML_DRIFT_THRESHOLD;
    delete process.env.ML_DRIFT_CRITICAL_THRESHOLD;
  });

  it('returns healthy when metric drift is below watch threshold', async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({
        rows: [{ samples: '120', mae: '5.2', mape: '14.0', rmse: '6.1', p95_error: '9.0' }],
      } as never)
      .mockResolvedValueOnce({
        rows: [{ samples: '500', mae: '5.0', mape: '13.8', rmse: '6.0', p95_error: '8.8' }],
      } as never);

    const result = await PredictionDriftService.getDriftStatus(24, 30, 40);

    expect(result.status).toBe('healthy');
    expect(result.deltas.max_change_ratio).not.toBeNull();
    expect((result.deltas.max_change_ratio ?? 0)).toBeLessThan(0.1);
  });

  it('returns drift when max change ratio crosses drift threshold', async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({
        rows: [{ samples: '120', mae: '7.2', mape: '18.2', rmse: '8.1', p95_error: '12.0' }],
      } as never)
      .mockResolvedValueOnce({
        rows: [{ samples: '500', mae: '5.5', mape: '14.1', rmse: '6.3', p95_error: '9.5' }],
      } as never);

    const result = await PredictionDriftService.getDriftStatus(24, 30, 40);

    expect(result.status).toBe('drift');
    expect((result.deltas.max_change_ratio ?? 0)).toBeGreaterThanOrEqual(0.2);
  });

  it('returns critical when max change ratio crosses critical threshold', async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({
        rows: [{ samples: '80', mae: '9.5', mape: '24.0', rmse: '10.0', p95_error: '15.0' }],
      } as never)
      .mockResolvedValueOnce({
        rows: [{ samples: '480', mae: '6.0', mape: '15.0', rmse: '7.0', p95_error: '10.0' }],
      } as never);

    const result = await PredictionDriftService.getDriftStatus(24, 30, 40);

    expect(result.status).toBe('critical');
    expect((result.deltas.max_change_ratio ?? 0)).toBeGreaterThanOrEqual(0.35);
  });

  it('returns insufficient_data when sample size is below threshold', async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({
        rows: [{ samples: '10', mae: '6.2', mape: '15.0', rmse: '7.0', p95_error: '10.0' }],
      } as never)
      .mockResolvedValueOnce({
        rows: [{ samples: '20', mae: '5.0', mape: '12.0', rmse: '6.0', p95_error: '8.0' }],
      } as never);

    const result = await PredictionDriftService.getDriftStatus(24, 30, 40);

    expect(result.status).toBe('insufficient_data');
  });

  it('uses environment thresholds when provided', async () => {
    process.env.ML_DRIFT_WATCH_THRESHOLD = '0.05';
    process.env.ML_DRIFT_THRESHOLD = '0.07';
    process.env.ML_DRIFT_CRITICAL_THRESHOLD = '0.09';

    vi.mocked(pool.query)
      .mockResolvedValueOnce({
        rows: [{ samples: '120', mae: '5.6', mape: '14.8', rmse: '6.6', p95_error: '9.5' }],
      } as never)
      .mockResolvedValueOnce({
        rows: [{ samples: '500', mae: '5.0', mape: '14.0', rmse: '6.0', p95_error: '9.0' }],
      } as never);

    const result = await PredictionDriftService.getDriftStatus(24, 30, 40);

    expect(result.thresholds.watch).toBe(0.05);
    expect(result.thresholds.drift).toBe(0.07);
    expect(result.thresholds.critical).toBe(0.09);
    expect(result.status).toBe('critical');
  });
});
