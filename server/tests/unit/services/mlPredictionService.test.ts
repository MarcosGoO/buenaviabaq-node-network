import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * MLPredictionService Unit Tests
 *
 * Covers: healthCheck, predictTraffic, predictBatch, predictAllRoads,
 * getExplanation, getArroyoRisk, getModelHistory, rollbackModel, retrainModel.
 * All external calls (fetch, CacheService, FeatureStoreService, etc.) are mocked.
 */

// Mock logger
vi.mock('@/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mock CacheService — always executes callback (cache miss)
vi.mock('@/services/cacheService.js', () => ({
  CacheService: {
    getOrSet: vi.fn((_key: string, cb: () => unknown) => cb()),
    TTL: { SHORT: 60, MEDIUM: 300, LONG: 900 },
    Namespaces: { PREDICTIONS: 'predictions' },
  },
}));

// Mock FeatureStoreService
vi.mock('@/services/featureStoreService.js', () => ({
  FeatureStoreService: {
    extractFeatures: vi.fn(),
  },
}));

// Mock WeatherService
vi.mock('@/services/weatherService.js', () => ({
  WeatherService: {
    getForecast: vi.fn(),
  },
}));

// Mock GeoService
vi.mock('@/services/geoService.js', () => ({
  GeoService: {
    getArroyoZones: vi.fn(),
  },
}));

// Mock DB pool (for predictAllRoads)
vi.mock('@/db/index.js', () => ({
  pool: { query: vi.fn() },
}));

// Mock feedback recording service
vi.mock('@/services/predictionEvaluationService.js', () => ({
  PredictionEvaluationService: {
    recordPrediction: vi.fn().mockResolvedValue(undefined),
  },
}));

import { MLPredictionService } from '@/services/mlPredictionService.js';
import { FeatureStoreService } from '@/services/featureStoreService.js';
import { WeatherService } from '@/services/weatherService.js';
import { GeoService } from '@/services/geoService.js';
import { CacheService } from '@/services/cacheService.js';
import { PredictionEvaluationService } from '@/services/predictionEvaluationService.js';

// ── Fixture helpers ────────────────────────────────────────────────────────

const mockFeatureVector = {
  road_id: 1,
  timestamp: new Date(),
  features: {
    temporal: { hour_of_day: 8, day_of_week: 1, day_of_month: 1, month: 3, is_rush_hour: true, is_weekend: false },
    traffic: { avg_speed_historical: 35, avg_congestion_encoded: 0.5, std_deviation: 5 },
    weather: { temperature: 30, humidity: 72, wind_speed: 18, rain_probability: 40, condition_encoded: 0.3, is_raining: false },
    events: { nearby: false, type_encoded: 0, distance_km: 10 },
    geography: { zone_id: 1, road_type_encoded: 1, lanes: 2, max_speed: 60 },
    arroyo: { nearby: false, risk_encoded: 0, distance_km: 5 },
  },
};

const mockPrediction = {
  road_id: 1,
  timestamp: new Date().toISOString(),
  predicted_speed_kmh: 35,
  predicted_speed_lower: 28,
  predicted_speed_upper: 42,
  predicted_congestion_level: 'high',
  confidence_score: 0.87,
  model_version: '20260101_120000',
  shap_values: null,
};

const mockForecast = {
  location: 'Barranquilla',
  forecast: [{ timestamp: new Date(), temperature: 28, condition: 'Rain', description: 'light rain', rain_probability: 70, humidity: 85, wind_speed: 20 }],
};

const mockArroyos = [
  { id: 1, name: 'Arroyo La Paz', risk_level: 'high', zone_id: 1, geometry: {} },
  { id: 2, name: 'Arroyo El Country', risk_level: 'medium', zone_id: 2, geometry: {} },
];

describe('MLPredictionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(FeatureStoreService.extractFeatures).mockResolvedValue(mockFeatureVector as never);
    vi.mocked(WeatherService.getForecast).mockResolvedValue(mockForecast as never);
    vi.mocked(GeoService.getArroyoZones).mockResolvedValue(mockArroyos as never);
    vi.mocked(CacheService.getOrSet).mockImplementation((_key, cb) => cb() as never);
    global.fetch = vi.fn();
  });

  // ─── healthCheck ──────────────────────────────────────────────────────────

  describe('healthCheck', () => {
    it('should return true when service is healthy and model loaded', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy', model_loaded: true, database_connected: true }),
      } as never);

      expect(await MLPredictionService.healthCheck()).toBe(true);
    });

    it('should return false when model not loaded', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy', model_loaded: false, database_connected: true }),
      } as never);

      expect(await MLPredictionService.healthCheck()).toBe(false);
    });

    it('should return false when status is not healthy', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'degraded', model_loaded: true }),
      } as never);

      expect(await MLPredictionService.healthCheck()).toBe(false);
    });

    it('should return false when fetch fails (not ok)', async () => {
      vi.mocked(fetch).mockResolvedValue({ ok: false } as never);
      expect(await MLPredictionService.healthCheck()).toBe(false);
    });

    it('should return false on network error', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Connection refused'));
      expect(await MLPredictionService.healthCheck()).toBe(false);
    });
  });

  // ─── predictTraffic ───────────────────────────────────────────────────────

  describe('predictTraffic', () => {
    it('should return prediction on success', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockPrediction),
      } as never);

      const result = await MLPredictionService.predictTraffic(1);
      expect(result).not.toBeNull();
      expect(result!.road_id).toBe(1);
      expect(result!.predicted_speed_kmh).toBe(35);
    });

    it('should return null when ML service returns error', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal error'),
      } as never);

      const result = await MLPredictionService.predictTraffic(1);
      expect(result).toBeNull();
    });

    it('should return null when fetch throws', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Timeout'));
      const result = await MLPredictionService.predictTraffic(1);
      expect(result).toBeNull();
    });

    it('should return null when feature extraction fails', async () => {
      vi.mocked(FeatureStoreService.extractFeatures).mockRejectedValue(new Error('Feature error'));
      const result = await MLPredictionService.predictTraffic(1);
      expect(result).toBeNull();
    });

    it('should include horizon_minutes in features when provided', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockPrediction),
      } as never);

      await MLPredictionService.predictTraffic(1, undefined, 30);

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
      expect(body.features.horizon_minutes).toBe(30);
    });

    it('should call /predict endpoint', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockPrediction),
      } as never);

      await MLPredictionService.predictTraffic(1);

      const [url] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toContain('/predict');
    });

    it('should record prediction feedback in background', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockPrediction),
      } as never);

      await MLPredictionService.predictTraffic(1, new Date('2026-03-13T10:00:00Z'), 30);
      expect(vi.mocked(PredictionEvaluationService.recordPrediction)).toHaveBeenCalledTimes(1);
    });
  });

  // ─── predictBatch ─────────────────────────────────────────────────────────

  describe('predictBatch', () => {
    it('should return predictions for multiple roads', async () => {
      const predictions = [mockPrediction, { ...mockPrediction, road_id: 2 }];
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ predictions }),
      } as never);

      const result = await MLPredictionService.predictBatch([1, 2]);
      expect(result).toHaveLength(2);
    });

    it('should return empty array on ML service error', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 503,
        text: () => Promise.resolve('Unavailable'),
      } as never);

      const result = await MLPredictionService.predictBatch([1, 2]);
      expect(result).toEqual([]);
    });

    it('should return empty array on network error', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));
      const result = await MLPredictionService.predictBatch([1, 2, 3]);
      expect(result).toEqual([]);
    });

    it('should call /predict/batch endpoint', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ predictions: [] }),
      } as never);

      await MLPredictionService.predictBatch([1]);
      const [url] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toContain('/predict/batch');
    });

    it('should send features_list in body', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ predictions: [] }),
      } as never);

      await MLPredictionService.predictBatch([1, 2]);
      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
      expect(body).toHaveProperty('features_list');
      expect(body.features_list).toHaveLength(2);
    });
  });

  // ─── predictAllRoads ──────────────────────────────────────────────────────

  describe('predictAllRoads', () => {
    it('should return a record keyed by road_id', async () => {
      const { pool } = await import('@/db/index.js');
      vi.mocked(pool.query).mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }] } as never);

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ predictions: [mockPrediction, { ...mockPrediction, road_id: 2 }] }),
      } as never);

      const result = await MLPredictionService.predictAllRoads();
      expect(result[1]).toBeDefined();
      expect(result[2]).toBeDefined();
    });

    it('should return empty object on DB error', async () => {
      const { pool } = await import('@/db/index.js');
      vi.mocked(pool.query).mockRejectedValue(new Error('DB error'));

      const result = await MLPredictionService.predictAllRoads();
      expect(result).toEqual({});
    });
  });

  // ─── getExplanation ───────────────────────────────────────────────────────

  describe('getExplanation', () => {
    const mockExplanation = {
      road_id: 1,
      timestamp: new Date().toISOString(),
      top_features: [
        { feature_name: 'hour_of_day', shap_value: 0.45, contribution: 'positive' },
        { feature_name: 'is_rush_hour', shap_value: 0.38, contribution: 'positive' },
      ],
      model_version: '20260101_120000',
    };

    it('should return explanation on success', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockExplanation),
      } as never);

      const result = await MLPredictionService.getExplanation(1);
      expect(result).not.toBeNull();
      expect(result!.top_features).toHaveLength(2);
    });

    it('should return null on ML service error', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Error'),
      } as never);

      const result = await MLPredictionService.getExplanation(1);
      expect(result).toBeNull();
    });

    it('should return null on fetch throw', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Timeout'));
      const result = await MLPredictionService.getExplanation(1);
      expect(result).toBeNull();
    });

    it('should call /predict/explanation endpoint', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockExplanation),
      } as never);

      await MLPredictionService.getExplanation(1);
      const [url] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toContain('/predict/explanation');
    });
  });

  // ─── getArroyoRisk ────────────────────────────────────────────────────────

  describe('getArroyoRisk', () => {
    const mockArroyoRiskResponse = {
      timestamp: new Date().toISOString(),
      weather_summary: { rain_probability: 70, humidity: 85 },
      arroyos: [
        { arroyo_id: 1, zone_name: 'Arroyo La Paz', activation_probability: 0.82, risk_level: 'high' },
        { arroyo_id: 2, zone_name: 'Arroyo El Country', activation_probability: 0.55, risk_level: 'medium' },
      ],
    };

    it('should return arroyo risk response on success', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockArroyoRiskResponse),
      } as never);

      const result = await MLPredictionService.getArroyoRisk();
      expect(result).not.toBeNull();
      expect(result!.arroyos).toHaveLength(2);
    });

    it('should return null when ML service returns error', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Error'),
      } as never);

      const result = await MLPredictionService.getArroyoRisk();
      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Connection refused'));
      const result = await MLPredictionService.getArroyoRisk();
      expect(result).toBeNull();
    });

    it('should send rain_probability from forecast', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockArroyoRiskResponse),
      } as never);

      await MLPredictionService.getArroyoRisk();
      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
      expect(body).toHaveProperty('rain_probability', 70);
    });

    it('should use 0 for rain_probability when forecast is null', async () => {
      vi.mocked(WeatherService.getForecast).mockResolvedValue(null);
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockArroyoRiskResponse),
      } as never);

      await MLPredictionService.getArroyoRisk();
      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
      expect(body.rain_probability).toBe(0);
    });

    it('should include arroyos in request body with encoded risk levels', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockArroyoRiskResponse),
      } as never);

      await MLPredictionService.getArroyoRisk();
      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
      expect(body.arroyos).toHaveLength(2);
      expect(body.arroyos[0]).toHaveProperty('arroyo_id');
      expect(body.arroyos[0]).toHaveProperty('base_risk_encoded');
      // 'high' maps to 0.75
      expect(body.arroyos[0].base_risk_encoded).toBe(0.75);
    });
  });

  // ─── getModelHistory ──────────────────────────────────────────────────────

  describe('getModelHistory', () => {
    const mockHistory = {
      versions: [
        { version: '20260307_120000', model_type: 'lightgbm', metrics: { mae: 3.2, r2: 0.91 }, trained_at: '2026-03-07', training_samples: 5000, file: 'model_v1.pkl' },
        { version: '20260301_080000', model_type: 'lightgbm', metrics: { mae: 3.8, r2: 0.88 }, trained_at: '2026-03-01', training_samples: 4500, file: 'model_v0.pkl' },
      ],
      count: 2,
      active_model_version: '20260307_120000',
    };

    it('should return model history on success', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockHistory),
      } as never);

      const result = await MLPredictionService.getModelHistory();
      expect(result).not.toBeNull();
      expect(result!.versions).toHaveLength(2);
      expect(result!.count).toBe(2);
    });

    it('should return null on service error', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 503,
        text: () => Promise.resolve('Unavailable'),
      } as never);

      const result = await MLPredictionService.getModelHistory();
      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Timeout'));
      const result = await MLPredictionService.getModelHistory();
      expect(result).toBeNull();
    });
  });

  // ─── rollbackModel ────────────────────────────────────────────────────────

  describe('rollbackModel', () => {
    it('should return success response on rollback', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'ok', message: 'Rolled back to version 20260301_080000' }),
      } as never);

      const result = await MLPredictionService.rollbackModel('20260301_080000');
      expect(result).not.toBeNull();
      expect(result!.status).toBe('ok');
    });

    it('should return null on service error', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Version not found'),
      } as never);

      const result = await MLPredictionService.rollbackModel('nonexistent');
      expect(result).toBeNull();
    });

    it('should URL-encode the version in the path', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'ok', message: 'done' }),
      } as never);

      await MLPredictionService.rollbackModel('20260307_120000');
      const [url] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toContain(encodeURIComponent('20260307_120000'));
    });
  });

  // ─── retrainModel ─────────────────────────────────────────────────────────

  describe('retrainModel', () => {
    const goodMetrics = { mae: 3.2, rmse: 4.5, r2: 0.91, mape: 5.2 };
    const betterMetrics = { mae: 2.9, rmse: 4.0, r2: 0.93, mape: 4.8 };
    const worseMetrics = { mae: 3.8, rmse: 5.2, r2: 0.85, mape: 6.5 };

    it('should return training result with action_taken="swapped" on improvement', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ metrics: goodMetrics }) } as never)  // model/info
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ metrics: betterMetrics, model_version: '20260307_150000' }) } as never); // train

      const result = await MLPredictionService.retrainModel();
      expect(result).not.toBeNull();
      expect(result!.action_taken).toBe('swapped');
      expect(result!.model_version).toBe('20260307_150000');
    });

    it('should return action_taken="kept_current" on marginal change (<2% improvement)', async () => {
      const marginallyBetter = { mae: 3.15, rmse: 4.4, r2: 0.91 }; // 1.6% improvement
      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ metrics: goodMetrics }) } as never)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ metrics: marginallyBetter, model_version: 'v_new' }) } as never);

      const result = await MLPredictionService.retrainModel();
      expect(result!.action_taken).toBe('kept_current');
    });

    it('should rollback and return action_taken="rolled_back" when new model is >5% worse', async () => {
      const historyMock = {
        versions: [{ version: 'v_current' }, { version: 'v_previous' }],
        count: 2, active_model_version: 'v_current',
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ metrics: goodMetrics }) } as never)   // model/info
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ metrics: worseMetrics, model_version: 'v_worse' }) } as never) // train
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(historyMock) } as never)  // getModelHistory
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'ok', message: 'done' }) } as never); // rollback

      const result = await MLPredictionService.retrainModel();
      expect(result!.action_taken).toBe('rolled_back');
    });

    it('should return null on training failure', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ metrics: goodMetrics }) } as never)
        .mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve('Training failed') } as never);

      const result = await MLPredictionService.retrainModel();
      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network down'));
      const result = await MLPredictionService.retrainModel();
      expect(result).toBeNull();
    });

    it('should handle missing previous metrics gracefully', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: false } as never) // model/info fails
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ metrics: goodMetrics, model_version: 'v_new' }) } as never);

      const result = await MLPredictionService.retrainModel();
      expect(result).not.toBeNull();
      expect(result!.previous_metrics).toBeNull();
      // Without previous metrics to compare, action_taken defaults to 'swapped'
      expect(result!.action_taken).toBe('swapped');
    });
  });
});
