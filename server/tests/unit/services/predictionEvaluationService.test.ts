import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/db/index.js', () => ({
  pool: { query: vi.fn() },
}));

import { pool } from '@/db/index.js';
import { PredictionEvaluationService } from '@/services/predictionEvaluationService.js';

describe('PredictionEvaluationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores feedback without road lookup when zone_id is provided', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [], rowCount: 1 } as never);

    await PredictionEvaluationService.recordPrediction({
      road_id: 10,
      zone_id: 4,
      predicted_at: new Date('2026-03-13T10:00:00Z'),
      target_time: new Date('2026-03-13T10:30:00Z'),
      horizon_minutes: 30,
      predicted_speed_kmh: 36.5,
      model_version: '20260313_100000',
    });

    expect(vi.mocked(pool.query)).toHaveBeenCalledTimes(1);
    const [sql, params] = vi.mocked(pool.query).mock.calls[0];
    expect(String(sql)).toContain('INSERT INTO ml_prediction_feedback');
    expect((params ?? [])[1]).toBe(4);
  });

  it('resolves zone_id from geo.roads when zone_id is missing', async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ zone_id: 9 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

    await PredictionEvaluationService.recordPrediction({
      road_id: 22,
      predicted_at: new Date('2026-03-13T10:00:00Z'),
      target_time: new Date('2026-03-13T11:00:00Z'),
      horizon_minutes: 60,
      predicted_speed_kmh: 42,
      model_version: '20260313_100000',
    });

    expect(vi.mocked(pool.query)).toHaveBeenCalledTimes(2);
    expect(String(vi.mocked(pool.query).mock.calls[0][0])).toContain('FROM geo.roads');
    expect((vi.mocked(pool.query).mock.calls[1][1] ?? [])[1]).toBe(9);
  });

  it('syncs actual values and returns updated row count', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [], rowCount: 7 } as never);

    const result = await PredictionEvaluationService.syncActualValues(24, 20);

    expect(result.updated).toBe(7);
    expect(vi.mocked(pool.query)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(pool.query).mock.calls[0][1]).toEqual([24, 20]);
  });

  it('returns mapped temporal evaluation metrics', async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({
        rows: [{ n: '12', mae: '4.1', mape: '10.5', rmse: '5.2', p95: '8.0' }],
        rowCount: 1,
      } as never)
      .mockResolvedValueOnce({
        rows: [{ horizon_minutes: 30, n: '6', mae: '3.8', mape: '9.2', rmse: '4.8', p95: '7.1' }],
        rowCount: 1,
      } as never)
      .mockResolvedValueOnce({
        rows: [{ zone_id: 2, n: '5', mae: '4.0', mape: '11.0' }],
        rowCount: 1,
      } as never)
      .mockResolvedValueOnce({
        rows: [{ hour_of_day: 8, n: '3', mae: '4.5', mape: '12.2' }],
        rowCount: 1,
      } as never)
      .mockResolvedValueOnce({
        rows: [{ bucket: 'rush_hour', n: '7', mae: '4.9', mape: '13.4' }],
        rowCount: 1,
      } as never);

    const result = await PredictionEvaluationService.getTemporalEvaluation(14);

    expect(result.window_days).toBe(14);
    expect(result.overall.samples).toBe(12);
    expect(result.overall.mae).toBe(4.1);
    expect(result.by_horizon[0].horizon_minutes).toBe(30);
    expect(result.by_zone[0].zone_id).toBe(2);
    expect(result.by_hour[0].hour_of_day).toBe(8);
    expect(result.by_rush_hour[0].bucket).toBe('rush_hour');
    expect(vi.mocked(pool.query)).toHaveBeenCalledTimes(5);
  });
});
