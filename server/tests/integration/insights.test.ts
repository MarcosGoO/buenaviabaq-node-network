import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * InsightsService Integration Tests
 *
 * Tests the InsightsService with mocked dependencies.
 * All DB queries and external service calls are mocked to ensure
 * deterministic results without requiring a running database.
 *
 * Note: vitest.config.ts has clearMocks/mockReset/restoreMocks: true,
 * so mock implementations are re-applied in each test / beforeEach.
 */

// Module-level mocks must be declared before imports
vi.mock('@/db', () => ({ pool: { query: vi.fn() } }));
vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/services/weatherService.js', () => ({
  WeatherService: { getCurrentWeather: vi.fn(), getForecast: vi.fn() },
}));
vi.mock('@/services/alertService.js', () => ({
  AlertService: {
    detectActiveAlerts: vi.fn(),
    getActiveAlerts: vi.fn(),
    filterBySeverity: vi.fn(),
    filterByType: vi.fn(),
    getSeverityColor: vi.fn(),
  },
}));
vi.mock('@/services/geoService.js', () => ({
  GeoService: { getArroyos: vi.fn(), getArroyoZones: vi.fn(), getZones: vi.fn() },
}));

// Static imports — vitest resolves .js → .ts at runtime
import { InsightsService, type ComparativeMetrics } from '@/services/insightsService.js';
import { pool } from '@/db';
import { WeatherService } from '@/services/weatherService.js';
import { AlertService } from '@/services/alertService.js';
import { GeoService } from '@/services/geoService.js';

// Default weather stub used across tests
const DEFAULT_WEATHER = {
  temperature: 30,
  humidity: 80,
  wind_speed: 15,
  rain_probability: 25,
  condition: 'Partly Cloudy',
  description: 'Partly cloudy skies',
  feels_like: 33,
  pressure: 1010,
  visibility: 10,
  cloud_cover: 40,
};

/**
 * Set up DB pool to return responses in order (cycling if needed).
 */
function setupPool(responses: Array<{ rows: Record<string, unknown>[] }>) {
  let i = 0;
  vi.mocked(pool.query).mockImplementation(() =>
    Promise.resolve(responses[i++ % responses.length]) as never
  );
}

/**
 * Set up all service stubs needed by getExecutiveSummary.
 * Uses statically imported mocks — safe after vi.mocked().
 */
function setupServiceStubs() {
  vi.mocked(WeatherService.getCurrentWeather).mockResolvedValue(DEFAULT_WEATHER as never);
  vi.mocked(WeatherService.getForecast).mockResolvedValue({ forecast: [] } as never);
  vi.mocked(AlertService.detectActiveAlerts).mockResolvedValue([] as never);
  vi.mocked(AlertService.getActiveAlerts).mockReturnValue([] as never);
  // getArroyoMetrics calls getArroyos() 3 times (all, high, medium)
  vi.mocked(GeoService.getArroyos).mockResolvedValue([] as never);
}

// Standard pool responses for getExecutiveSummary (8 queries in order)
const SUMMARY_POOL_RESPONSES = (overrides: Partial<{
  trafficRow: Record<string, unknown>;
  zoneRow: Record<string, unknown>;
  currentRow: Record<string, unknown>;
  historicalRow: Record<string, unknown>;
  topCongested: Record<string, unknown>[];
  trendRows: Record<string, unknown>[];
  travelRow: Record<string, unknown>;
  confidenceRow: Record<string, unknown>;
}> = {}) => [
  // getSystemMetrics → 2 queries (traffic, zones) run in parallel
  { rows: [overrides.trafficRow ?? { avg_speed: 45, overall_congestion: 'moderate', total_roads: 120 }] },
  { rows: [overrides.zoneRow ?? { zone_count: 8 }] },
  // getTrafficMetrics → 3 queries (current, historical, topCongested) run in parallel
  { rows: [overrides.currentRow ?? { current_speed: 43, low_count: 50, moderate_count: 40, high_count: 20, severe_count: 10 }] },
  { rows: [overrides.historicalRow ?? { historical_speed: 48 }] },
  { rows: overrides.topCongested ?? [{ road_id: 1, road_name: 'Av. Murillo', speed: 20, congestion: 'severe' }] },
  // getPredictiveMetrics → 3 queries (trend, travel time, confidence)
  { rows: overrides.trendRows ?? [{ hour_of_day: 14, avg_speed: 40 }, { hour_of_day: 13, avg_speed: 45 }] },
  { rows: [overrides.travelRow ?? { avg_time: 18 }] },
  { rows: [overrides.confidenceRow ?? { sample_count: 30 }] },
];

describe('InsightsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getExecutiveSummary', () => {
    it('should return a summary with all required sections', async () => {
      setupServiceStubs();
      setupPool(SUMMARY_POOL_RESPONSES());

      const summary = await InsightsService.getExecutiveSummary();

      expect(summary).toHaveProperty('system');
      expect(summary).toHaveProperty('traffic');
      expect(summary).toHaveProperty('weather');
      expect(summary).toHaveProperty('alerts');
      expect(summary).toHaveProperty('arroyos');
      expect(summary).toHaveProperty('predictions');
      expect(summary).toHaveProperty('generated_at');

      expect(summary.system.avg_speed_kmh).toBe(45);
      expect(summary.system.overall_congestion_level).toBe('moderate');
      expect(summary.system.total_active_roads).toBe(120);
      expect(summary.system.monitored_zones).toBe(8);
    });

    it('should calculate speed_change_percentage correctly', async () => {
      setupServiceStubs();
      setupPool(SUMMARY_POOL_RESPONSES({
        currentRow: { current_speed: 40, low_count: 30, moderate_count: 40, high_count: 20, severe_count: 10 },
        historicalRow: { historical_speed: 50 }, // 40 vs 50 = -20%
        topCongested: [],
        trendRows: [],
      }));

      const summary = await InsightsService.getExecutiveSummary();

      expect(summary.traffic.current_avg_speed).toBe(40);
      expect(summary.traffic.historical_avg_speed).toBe(50);
      expect(summary.traffic.speed_change_percentage).toBe(-20);
    });

    it('should include weather data in summary', async () => {
      setupServiceStubs();
      setupPool(SUMMARY_POOL_RESPONSES({
        topCongested: [],
        trendRows: [],
      }));

      const summary = await InsightsService.getExecutiveSummary();

      expect(summary.weather).toHaveProperty('current_condition');
      expect(summary.weather).toHaveProperty('temperature_celsius');
      expect(summary.weather).toHaveProperty('rain_probability');
      expect(summary.weather).toHaveProperty('is_affecting_traffic');
      expect(summary.weather).toHaveProperty('weather_impact_score');
      expect(summary.weather.weather_impact_score).toBeGreaterThanOrEqual(0);
      expect(summary.weather.weather_impact_score).toBeLessThanOrEqual(100);
    });

    it('should detect worsening trend when speed drops', async () => {
      setupServiceStubs();
      setupPool(SUMMARY_POOL_RESPONSES({
        trafficRow: { avg_speed: 35, overall_congestion: 'high', total_roads: 100 },
        currentRow: { current_speed: 35, low_count: 10, moderate_count: 20, high_count: 50, severe_count: 20 },
        // Trend: current (index 0) speed 30 < previous (index 1) 45 → worsening
        trendRows: [{ hour_of_day: 8, avg_speed: 30 }, { hour_of_day: 7, avg_speed: 45 }],
        travelRow: { avg_time: 25 },
      }));

      const summary = await InsightsService.getExecutiveSummary();

      expect(summary.predictions.next_hour_trend).toBe('worsening');
      expect(typeof summary.predictions.rush_hour_active).toBe('boolean');
    });

    it('should detect improving trend when speed rises', async () => {
      setupServiceStubs();
      setupPool(SUMMARY_POOL_RESPONSES({
        // Trend: current (index 0) speed 55 > previous (index 1) 40 → improving
        trendRows: [{ hour_of_day: 16, avg_speed: 55 }, { hour_of_day: 15, avg_speed: 40 }],
        topCongested: [],
      }));

      const summary = await InsightsService.getExecutiveSummary();

      expect(summary.predictions.next_hour_trend).toBe('improving');
    });

    it('should cap confidence_score at 100', async () => {
      setupServiceStubs();
      setupPool(SUMMARY_POOL_RESPONSES({
        confidenceRow: { sample_count: 9999 }, // Very high sample count
        topCongested: [],
        trendRows: [],
      }));

      const summary = await InsightsService.getExecutiveSummary();

      expect(summary.predictions.confidence_score).toBeLessThanOrEqual(100);
    });

    it('should include alerts summary with correct counts', async () => {
      setupServiceStubs();
      setupPool(SUMMARY_POOL_RESPONSES({ topCongested: [], trendRows: [] }));

      const summary = await InsightsService.getExecutiveSummary();

      expect(summary.alerts).toHaveProperty('total_active');
      expect(summary.alerts).toHaveProperty('critical_count');
      expect(summary.alerts.total_active).toBe(0);
      expect(summary.alerts.critical_count).toBe(0);
    });

    it('should return generated_at as ISO timestamp', async () => {
      setupServiceStubs();
      setupPool(SUMMARY_POOL_RESPONSES({ topCongested: [], trendRows: [] }));

      const before = new Date();
      const summary = await InsightsService.getExecutiveSummary();
      const after = new Date();

      const generatedAt = new Date(summary.generated_at);
      expect(generatedAt >= before).toBe(true);
      expect(generatedAt <= after).toBe(true);
    });
  });

  describe('getZoneInsights', () => {
    beforeEach(() => {
      vi.mocked(AlertService.detectActiveAlerts).mockResolvedValue([] as never);
      vi.mocked(AlertService.getActiveAlerts).mockReturnValue([] as never);
    });

    it('should return an array of zone insights', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [
          { zone_id: 1, zone_name: 'Centro', avg_speed: 30, congestion_level: 'high', total_roads: 15, arroyo_risk_level: 'low' },
          { zone_id: 2, zone_name: 'Norte', avg_speed: 50, congestion_level: 'low', total_roads: 20, arroyo_risk_level: 'none' },
        ],
      } as never);

      const insights = await InsightsService.getZoneInsights();

      expect(Array.isArray(insights)).toBe(true);
      expect(insights.length).toBe(2);

      const centro = insights.find(z => z.zone_name === 'Centro');
      expect(centro).toBeDefined();
      expect(centro!.zone_id).toBe(1);
      expect(centro!.congestion_level).toBe('high');
      expect(centro!.avg_speed).toBe(30);
    });

    it('should filter by zone_id when provided', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [{ zone_id: 3, zone_name: 'Sur', avg_speed: 45, congestion_level: 'moderate', total_roads: 12, arroyo_risk_level: 'none' }],
      } as never);

      const insights = await InsightsService.getZoneInsights(3);

      expect(insights.length).toBe(1);
      expect(insights[0].zone_id).toBe(3);
    });

    it('should set arroyo_risk_level to null when value is "none"', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [{ zone_id: 1, zone_name: 'Norte', avg_speed: 55, congestion_level: 'low', total_roads: 18, arroyo_risk_level: 'none' }],
      } as never);

      const insights = await InsightsService.getZoneInsights();

      expect(insights[0].arroyo_risk_level).toBeNull();
    });

    it('should preserve arroyo_risk_level when not "none"', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [{ zone_id: 5, zone_name: 'Sur', avg_speed: 25, congestion_level: 'high', total_roads: 8, arroyo_risk_level: 'high' }],
      } as never);

      const insights = await InsightsService.getZoneInsights(5);

      expect(insights[0].arroyo_risk_level).toBe('high');
    });

    it('should return empty array when no zones found', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);

      const insights = await InsightsService.getZoneInsights();

      expect(insights).toHaveLength(0);
    });

    it('should count active_alerts per zone from AlertService', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [
          { zone_id: 1, zone_name: 'Centro', avg_speed: 25, congestion_level: 'severe', total_roads: 10, arroyo_risk_level: 'high' },
          { zone_id: 2, zone_name: 'Norte', avg_speed: 50, congestion_level: 'low', total_roads: 20, arroyo_risk_level: 'none' },
        ],
      } as never);

      const mockAlerts = [
        { id: 'a1', affectedZones: [1], type: 'severe_congestion', severity: 'high' },
        { id: 'a2', affectedZones: [1, 2], type: 'weather_traffic_impact', severity: 'medium' },
        { id: 'a3', affectedZones: [1], type: 'arroyo_flood_risk', severity: 'critical' },
      ];
      vi.mocked(AlertService.detectActiveAlerts).mockResolvedValue(mockAlerts as never);
      vi.mocked(AlertService.getActiveAlerts).mockReturnValue(mockAlerts as never);

      const insights = await InsightsService.getZoneInsights();

      const centro = insights.find(z => z.zone_id === 1);
      const norte = insights.find(z => z.zone_id === 2);

      expect(centro!.active_alerts).toBe(3); // a1, a2, a3 all include zone 1
      expect(norte!.active_alerts).toBe(1);  // only a2 includes zone 2
    });
  });

  describe('getComparativeMetrics', () => {
    it('should return array of metrics with required fields', async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ current_speed: 42 }] } as never)
        .mockResolvedValueOnce({ rows: [{ historical_speed: 48 }] } as never)
        .mockResolvedValueOnce({ rows: [{ current_time: 18 }] } as never)
        .mockResolvedValueOnce({ rows: [{ historical_time: 14 }] } as never);

      const metrics = await InsightsService.getComparativeMetrics(30);

      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeGreaterThan(0);

      metrics.forEach((metric: ComparativeMetrics) => {
        expect(metric).toHaveProperty('metric_name');
        expect(metric).toHaveProperty('current_value');
        expect(metric).toHaveProperty('historical_value');
        expect(metric).toHaveProperty('difference');
        expect(metric).toHaveProperty('percentage_change');
        expect(metric).toHaveProperty('trend');
        expect(metric).toHaveProperty('is_favorable');
        expect(['up', 'down', 'stable']).toContain(metric.trend);
      });
    });

    it('should correctly identify favorable vs unfavorable speed changes', async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ current_speed: 55 }] } as never)   // higher speed = favorable
        .mockResolvedValueOnce({ rows: [{ historical_speed: 40 }] } as never)
        .mockResolvedValueOnce({ rows: [{ current_time: 12 }] } as never)    // lower time = favorable
        .mockResolvedValueOnce({ rows: [{ historical_time: 18 }] } as never);

      const metrics = await InsightsService.getComparativeMetrics();

      const speedMetric = metrics.find(m => m.metric_name.includes('Speed'));
      expect(speedMetric?.is_favorable).toBe(true);
      expect(speedMetric?.trend).toBe('up');

      const timeMetric = metrics.find(m => m.metric_name.includes('Travel Time'));
      expect(timeMetric?.is_favorable).toBe(true);
      expect(timeMetric?.trend).toBe('down');
    });

    it('should handle zero historical values without division errors', async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ current_speed: 40 }] } as never)
        .mockResolvedValueOnce({ rows: [{ historical_speed: 0 }] } as never) // zero historical
        .mockResolvedValueOnce({ rows: [{ current_time: 15 }] } as never)
        .mockResolvedValueOnce({ rows: [{ historical_time: 0 }] } as never); // zero historical

      // Should not throw
      const metrics = await InsightsService.getComparativeMetrics();
      expect(Array.isArray(metrics)).toBe(true);
      metrics.forEach((m: ComparativeMetrics) => {
        expect(isNaN(m.percentage_change)).toBe(false);
      });
    });

    it('should use default 30-day window when no argument provided', async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ current_speed: 44 }] } as never)
        .mockResolvedValueOnce({ rows: [{ historical_speed: 44 }] } as never)
        .mockResolvedValueOnce({ rows: [{ current_time: 16 }] } as never)
        .mockResolvedValueOnce({ rows: [{ historical_time: 16 }] } as never);

      const metrics = await InsightsService.getComparativeMetrics(); // no arg

      expect(Array.isArray(metrics)).toBe(true);
      // Equal values → trend should be 'stable'
      metrics.forEach((m: ComparativeMetrics) => {
        expect(m.trend).toBe('stable');
      });
    });
  });
});
