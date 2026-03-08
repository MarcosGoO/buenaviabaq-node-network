import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * AnalyticsService Unit Tests
 *
 * Covers: getTrafficPatterns, getHotspots, getTodayHourlyPattern,
 * compareToHistorical, getWeatherImpact, getRushHourStats.
 * All DB queries are mocked via pool.
 */

// Mock DB pool
vi.mock('@/db', () => ({
  pool: {
    query: vi.fn(),
  },
}));

// Mock logger
vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { AnalyticsService } from '@/services/analyticsService.js';
import { pool } from '@/db';

describe('AnalyticsService', () => {
  beforeEach(() => {
    vi.mocked(pool.query).mockReset();
  });

  // ─── getTrafficPatterns ────────────────────────────────────────────────────

  describe('getTrafficPatterns', () => {
    it('should return traffic patterns for all roads (no roadId)', async () => {
      const mockRows = [
        { hour_of_day: 8, day_of_week: 1, avg_speed: 25, avg_congestion_level: 'high', sample_count: 120 },
        { hour_of_day: 9, day_of_week: 1, avg_speed: 30, avg_congestion_level: 'moderate', sample_count: 95 },
      ];
      vi.mocked(pool.query).mockResolvedValue({ rows: mockRows } as never);

      const result = await AnalyticsService.getTrafficPatterns();
      expect(result).toHaveLength(2);
      expect(result[0].hour_of_day).toBe(8);
      expect(result[0].avg_speed).toBe(25);
    });

    it('should query with roadId when provided', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);

      await AnalyticsService.getTrafficPatterns(3, 7);
      expect(pool.query).toHaveBeenCalledOnce();
      const [, params] = vi.mocked(pool.query).mock.calls[0];
      expect(params).toContain(3); // roadId
      expect(params).toContain(7); // days
    });

    it('should query without roadId when not provided', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);

      await AnalyticsService.getTrafficPatterns(undefined, 14);
      const [, params] = vi.mocked(pool.query).mock.calls[0];
      expect(params).toContain(14);
      expect(params).not.toContain(undefined);
    });

    it('should use default 30 days when days param omitted', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);

      await AnalyticsService.getTrafficPatterns();
      const [, params] = vi.mocked(pool.query).mock.calls[0];
      expect(params).toContain(30);
    });

    it('should throw on DB error', async () => {
      vi.mocked(pool.query).mockRejectedValue(new Error('DB connection lost'));
      await expect(AnalyticsService.getTrafficPatterns()).rejects.toThrow('DB connection lost');
    });

    it('should return empty array when no rows', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);
      const result = await AnalyticsService.getTrafficPatterns();
      expect(result).toEqual([]);
    });
  });

  // ─── getHotspots ──────────────────────────────────────────────────────────

  describe('getHotspots', () => {
    const mockHotspots = [
      { road_id: 1, road_name: 'Vía 40', congestion_frequency: 75, avg_speed: 18, peak_hour: 8, total_incidents: 23 },
      { road_id: 3, road_name: 'Calle 72', congestion_frequency: 60, avg_speed: 22, peak_hour: 17, total_incidents: 15 },
    ];

    it('should return hotspots ordered by congestion_frequency', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: mockHotspots } as never);

      const result = await AnalyticsService.getHotspots();
      expect(result).toHaveLength(2);
      expect(result[0].congestion_frequency).toBeGreaterThanOrEqual(result[1].congestion_frequency);
    });

    it('should pass limit and days params to query', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);

      await AnalyticsService.getHotspots(5, 14);
      const [, params] = vi.mocked(pool.query).mock.calls[0];
      expect(params).toContain(5);
      expect(params).toContain(14);
    });

    it('should use default limit=10 and days=7', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);

      await AnalyticsService.getHotspots();
      const [, params] = vi.mocked(pool.query).mock.calls[0];
      expect(params).toContain(10);
      expect(params).toContain(7);
    });

    it('each hotspot should have all required fields', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: mockHotspots } as never);

      const result = await AnalyticsService.getHotspots();
      result.forEach(h => {
        expect(h).toHaveProperty('road_id');
        expect(h).toHaveProperty('road_name');
        expect(h).toHaveProperty('congestion_frequency');
        expect(h).toHaveProperty('avg_speed');
        expect(h).toHaveProperty('peak_hour');
        expect(h).toHaveProperty('total_incidents');
      });
    });

    it('should throw on DB error', async () => {
      vi.mocked(pool.query).mockRejectedValue(new Error('Timeout'));
      await expect(AnalyticsService.getHotspots()).rejects.toThrow('Timeout');
    });
  });

  // ─── getTodayHourlyPattern ────────────────────────────────────────────────

  describe('getTodayHourlyPattern', () => {
    it('should return hourly patterns without roadId', async () => {
      const mockRows = [
        { hour: 6, avg_speed: 50, congestion_level: 'low', traffic_volume: 30 },
        { hour: 8, avg_speed: 20, congestion_level: 'severe', traffic_volume: 200 },
      ];
      vi.mocked(pool.query).mockResolvedValue({ rows: mockRows } as never);

      const result = await AnalyticsService.getTodayHourlyPattern();
      expect(result).toHaveLength(2);
      expect(result[1].hour).toBe(8);
      expect(result[1].congestion_level).toBe('severe');
    });

    it('should pass roadId to query when provided', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);

      await AnalyticsService.getTodayHourlyPattern(2);
      expect(pool.query).toHaveBeenCalledOnce();
      const [, params] = vi.mocked(pool.query).mock.calls[0];
      expect(params).toContain(2);
    });

    it('should not pass params when roadId is undefined', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);

      await AnalyticsService.getTodayHourlyPattern();
      // query called without params array or with undefined params
      const call = vi.mocked(pool.query).mock.calls[0];
      expect(call[1]).toBeUndefined();
    });

    it('should throw on DB error', async () => {
      vi.mocked(pool.query).mockRejectedValue(new Error('Query failed'));
      await expect(AnalyticsService.getTodayHourlyPattern()).rejects.toThrow('Query failed');
    });
  });

  // ─── compareToHistorical ─────────────────────────────────────────────────

  describe('compareToHistorical', () => {
    it('should return comparison with correct speed_difference', async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ current_avg_speed: 45, current_congestion_level: 'moderate' }] } as never)
        .mockResolvedValueOnce({ rows: [{ historical_avg_speed: 50, historical_congestion_level: 'low' }] } as never);

      const result = await AnalyticsService.compareToHistorical(1);
      expect(result).not.toBeNull();
      expect(result!.speed_difference).toBe(-5); // 45 - 50
      expect(result!.percentage_change).toBe(-10); // -5/50 * 100
    });

    it('should return null when current data is missing', async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [] } as never)
        .mockResolvedValueOnce({ rows: [{ historical_avg_speed: 50, historical_congestion_level: 'low' }] } as never);

      const result = await AnalyticsService.compareToHistorical(1);
      expect(result).toBeNull();
    });

    it('should return null when historical data is missing', async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ current_avg_speed: 45, current_congestion_level: 'moderate' }] } as never)
        .mockResolvedValueOnce({ rows: [] } as never);

      const result = await AnalyticsService.compareToHistorical(1);
      expect(result).toBeNull();
    });

    it('should handle percentage_change = 0 when historical_avg_speed is 0', async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ current_avg_speed: 30, current_congestion_level: 'high' }] } as never)
        .mockResolvedValueOnce({ rows: [{ historical_avg_speed: 0, historical_congestion_level: 'high' }] } as never);

      const result = await AnalyticsService.compareToHistorical(5);
      expect(result!.percentage_change).toBe(0);
    });

    it('should include all required DailyComparison fields', async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ current_avg_speed: 40, current_congestion_level: 'high' }] } as never)
        .mockResolvedValueOnce({ rows: [{ historical_avg_speed: 55, historical_congestion_level: 'low' }] } as never);

      const result = await AnalyticsService.compareToHistorical(2);
      expect(result).toHaveProperty('current_avg_speed');
      expect(result).toHaveProperty('historical_avg_speed');
      expect(result).toHaveProperty('speed_difference');
      expect(result).toHaveProperty('percentage_change');
      expect(result).toHaveProperty('current_congestion_level');
      expect(result).toHaveProperty('historical_congestion_level');
    });

    it('should throw on DB error', async () => {
      vi.mocked(pool.query).mockRejectedValue(new Error('DB error'));
      await expect(AnalyticsService.compareToHistorical(1)).rejects.toThrow('DB error');
    });
  });

  // ─── getWeatherImpact ────────────────────────────────────────────────────

  describe('getWeatherImpact', () => {
    it('should return weather impact data', async () => {
      const mockRows = [
        { is_raining: false, avg_speed: 50, typical_congestion: 'low', sample_count: 300, avg_travel_time: 12 },
        { is_raining: true, avg_speed: 30, typical_congestion: 'high', sample_count: 80, avg_travel_time: 20 },
      ];
      vi.mocked(pool.query).mockResolvedValue({ rows: mockRows } as never);

      const result = await AnalyticsService.getWeatherImpact();
      expect(result).toHaveLength(2);
    });

    it('should pass days parameter', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);

      await AnalyticsService.getWeatherImpact(60);
      const [, params] = vi.mocked(pool.query).mock.calls[0];
      expect(params).toContain(60);
    });

    it('should default to 30 days', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);

      await AnalyticsService.getWeatherImpact();
      const [, params] = vi.mocked(pool.query).mock.calls[0];
      expect(params).toContain(30);
    });

    it('should throw on DB error', async () => {
      vi.mocked(pool.query).mockRejectedValue(new Error('Connection refused'));
      await expect(AnalyticsService.getWeatherImpact()).rejects.toThrow('Connection refused');
    });
  });

  // ─── getRushHourStats ────────────────────────────────────────────────────

  describe('getRushHourStats', () => {
    it('should return rush vs non-rush stats', async () => {
      const mockRows = [
        { is_rush_hour: true, avg_speed: 20, avg_travel_time: 30, typical_congestion: 'severe', sample_count: 500 },
        { is_rush_hour: false, avg_speed: 50, avg_travel_time: 12, typical_congestion: 'low', sample_count: 1000 },
      ];
      vi.mocked(pool.query).mockResolvedValue({ rows: mockRows } as never);

      const result = await AnalyticsService.getRushHourStats();
      expect(result).toHaveLength(2);
    });

    it('should pass days and roadId when both provided', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);

      await AnalyticsService.getRushHourStats(2, 14);
      const [, params] = vi.mocked(pool.query).mock.calls[0];
      expect(params).toContain(14);
      expect(params).toContain(2);
    });

    it('should pass only days when no roadId', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);

      await AnalyticsService.getRushHourStats(undefined, 30);
      const [, params] = vi.mocked(pool.query).mock.calls[0];
      expect(params).toContain(30);
    });

    it('should default to 30 days', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);

      await AnalyticsService.getRushHourStats();
      const [, params] = vi.mocked(pool.query).mock.calls[0];
      expect(params).toContain(30);
    });

    it('should throw on DB error', async () => {
      vi.mocked(pool.query).mockRejectedValue(new Error('Rush hour query failed'));
      await expect(AnalyticsService.getRushHourStats()).rejects.toThrow('Rush hour query failed');
    });
  });
});
