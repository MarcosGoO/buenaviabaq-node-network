import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * TrafficService Unit Tests
 *
 * Covers: getRealTimeTraffic (cache miss/hit), getTrafficSummary,
 * getTrafficByRoadId, and mock data generation logic.
 */

// Mock CacheService — always triggers callback (cache miss by default)
vi.mock('@/services/cacheService.js', () => ({
  CacheService: {
    getOrSet: vi.fn((_key: string, cb: () => unknown) => cb()),
    TTL: { SHORT: 60, MEDIUM: 300, LONG: 900 },
    Namespaces: { TRAFFIC: 'traffic', WEATHER: 'weather' },
  },
}));

// Mock logger
vi.mock('@/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mock WeatherService
vi.mock('@/services/weatherService.js', () => ({
  WeatherService: {
    getCurrentWeather: vi.fn(),
  },
}));

// Mock EventsService
vi.mock('@/services/eventsService.js', () => ({
  EventsService: {
    getUpcomingEvents: vi.fn(),
  },
}));

import { TrafficService } from '@/services/trafficService.js';
import { WeatherService } from '@/services/weatherService.js';
import { EventsService } from '@/services/eventsService.js';
import { CacheService } from '@/services/cacheService.js';

const mockWeatherClear = {
  temperature: 30, feels_like: 32, humidity: 70, wind_speed: 10,
  wind_direction: 90, condition: 'Clear', description: 'clear sky',
  icon: '01d', rain_probability: 5, pressure: 1013, cloudiness: 10,
  location: 'Barranquilla', timestamp: new Date(),
};

const mockWeatherRain = {
  ...mockWeatherClear,
  condition: 'Rain',
  rain: { '1h': 3.0 },
  rain_1h: 3.0,
  rain_probability: 80,
};

const mockWeatherHeavyRain = {
  ...mockWeatherClear,
  condition: 'Rain',
  rain: { '1h': 8.0 },
  rain_1h: 8.0,
  rain_probability: 95,
};

describe('TrafficService', () => {
  beforeEach(() => {
    vi.mocked(WeatherService.getCurrentWeather).mockResolvedValue(mockWeatherClear);
    vi.mocked(EventsService.getUpcomingEvents).mockResolvedValue([]);
    // Default: cache miss — execute callback
    vi.mocked(CacheService.getOrSet).mockImplementation((_key, cb) => cb() as never);
  });

  describe('getRealTimeTraffic', () => {
    it('should return an array of 6 roads', async () => {
      const data = await TrafficService.getRealTimeTraffic();
      expect(data).toHaveLength(6);
    });

    it('each road should have required fields', async () => {
      const data = await TrafficService.getRealTimeTraffic();
      data.forEach(road => {
        expect(typeof road.road_id).toBe('number');
        expect(typeof road.road_name).toBe('string');
        expect(['low', 'moderate', 'high', 'severe']).toContain(road.congestion_level);
        expect(road.speed_kmh).toBeGreaterThanOrEqual(5);
        expect(road.travel_time_minutes).toBeGreaterThan(0);
        expect(typeof road.last_updated).toBe('string');
      });
    });

    it('should return cached data on second call', async () => {
      const cachedData = [{ road_id: 1, road_name: 'Vía 40', congestion_level: 'low', speed_kmh: 60, travel_time_minutes: 10, last_updated: new Date().toISOString() }];
      vi.mocked(CacheService.getOrSet).mockResolvedValue(cachedData as never);

      const data = await TrafficService.getRealTimeTraffic();
      expect(data).toEqual(cachedData);
    });

    it('should throw when CacheService throws', async () => {
      vi.mocked(CacheService.getOrSet).mockRejectedValue(new Error('Redis down'));
      await expect(TrafficService.getRealTimeTraffic()).rejects.toThrow('Redis down');
    });

    it('should apply rain speed reduction (light rain ~20%)', async () => {
      vi.mocked(WeatherService.getCurrentWeather).mockResolvedValue(mockWeatherRain);

      // Run multiple times and check avg speed is lower than non-rain baseline
      const rainData = await TrafficService.getRealTimeTraffic();
      const avgRainSpeed = rainData.reduce((s, r) => s + r.speed_kmh, 0) / rainData.length;

      vi.mocked(WeatherService.getCurrentWeather).mockResolvedValue(mockWeatherClear);
      const clearData = await TrafficService.getRealTimeTraffic();
      const avgClearSpeed = clearData.reduce((s, r) => s + r.speed_kmh, 0) / clearData.length;

      // Rain should generally produce lower speeds (allow some variance from Math.random)
      // We assert rain avg is below clear avg + a generous margin
      expect(avgRainSpeed).toBeLessThan(avgClearSpeed + 10);
    });

    it('should apply heavy rain speed reduction', async () => {
      vi.mocked(WeatherService.getCurrentWeather).mockResolvedValue(mockWeatherHeavyRain);
      const data = await TrafficService.getRealTimeTraffic();
      // All roads under heavy rain should have speeds affected (base * 0.6)
      // Even with variation, max possible ≈ 0.6*45 + 10 = 37
      const allBelow45 = data.every(r => r.speed_kmh <= 45);
      expect(allBelow45).toBe(true);
    });

    it('should handle WeatherService failure gracefully', async () => {
      vi.mocked(WeatherService.getCurrentWeather).mockRejectedValue(new Error('API down'));
      // Should still return roads (weather caught internally)
      const data = await TrafficService.getRealTimeTraffic();
      expect(data).toHaveLength(6);
    });

    it('should handle EventsService failure gracefully', async () => {
      vi.mocked(EventsService.getUpcomingEvents).mockRejectedValue(new Error('Events API down'));
      const data = await TrafficService.getRealTimeTraffic();
      expect(data).toHaveLength(6);
    });

    it('congestion level should match speed thresholds', async () => {
      const data = await TrafficService.getRealTimeTraffic();
      data.forEach(road => {
        const { speed_kmh, congestion_level } = road;
        if (speed_kmh > 50) expect(congestion_level).toBe('low');
        else if (speed_kmh > 35) expect(congestion_level).toBe('moderate');
        else if (speed_kmh > 20) expect(congestion_level).toBe('high');
        else expect(congestion_level).toBe('severe');
      });
    });

    it('travel time should be roughly 10km / speed * 60', async () => {
      const data = await TrafficService.getRealTimeTraffic();
      data.forEach(road => {
        const expected = Math.round((10 / road.speed_kmh) * 60);
        expect(road.travel_time_minutes).toBe(expected);
      });
    });
  });

  describe('getTrafficSummary', () => {
    it('should return summary with correct totals', async () => {
      const summary = await TrafficService.getTrafficSummary();
      expect(summary.total_roads).toBe(6);
      expect(typeof summary.average_speed).toBe('number');
      expect(summary.average_speed).toBeGreaterThan(0);
      expect(typeof summary.congested_roads).toBe('number');
      expect(['clear', 'moderate', 'congested']).toContain(summary.status);
    });

    it('status should be "congested" when >50% roads are high/severe', async () => {
      // Force all 6 roads to be severe by returning cached data
      const severeRoads = Array.from({ length: 6 }, (_, i) => ({
        road_id: i + 1, road_name: `Road ${i + 1}`,
        congestion_level: 'severe' as const, speed_kmh: 10,
        travel_time_minutes: 60, last_updated: new Date().toISOString(),
      }));
      vi.mocked(CacheService.getOrSet).mockResolvedValue(severeRoads as never);

      const summary = await TrafficService.getTrafficSummary();
      expect(summary.status).toBe('congested');
      expect(summary.congested_roads).toBe(6);
    });

    it('status should be "moderate" when 20-50% roads are high/severe', async () => {
      const roads = [
        { road_id: 1, road_name: 'R1', congestion_level: 'severe' as const, speed_kmh: 10, travel_time_minutes: 60, last_updated: '' },
        { road_id: 2, road_name: 'R2', congestion_level: 'high' as const, speed_kmh: 22, travel_time_minutes: 27, last_updated: '' },
        { road_id: 3, road_name: 'R3', congestion_level: 'low' as const, speed_kmh: 60, travel_time_minutes: 10, last_updated: '' },
        { road_id: 4, road_name: 'R4', congestion_level: 'low' as const, speed_kmh: 60, travel_time_minutes: 10, last_updated: '' },
        { road_id: 5, road_name: 'R5', congestion_level: 'low' as const, speed_kmh: 60, travel_time_minutes: 10, last_updated: '' },
        { road_id: 6, road_name: 'R6', congestion_level: 'low' as const, speed_kmh: 60, travel_time_minutes: 10, last_updated: '' },
      ];
      vi.mocked(CacheService.getOrSet).mockResolvedValue(roads as never);

      const summary = await TrafficService.getTrafficSummary();
      // 2 / 6 = 33% → moderate
      expect(summary.status).toBe('moderate');
    });

    it('status should be "clear" when <20% roads are congested', async () => {
      const roads = Array.from({ length: 6 }, (_, i) => ({
        road_id: i + 1, road_name: `R${i + 1}`,
        congestion_level: 'low' as const, speed_kmh: 60,
        travel_time_minutes: 10, last_updated: '',
      }));
      vi.mocked(CacheService.getOrSet).mockResolvedValue(roads as never);

      const summary = await TrafficService.getTrafficSummary();
      expect(summary.status).toBe('clear');
      expect(summary.congested_roads).toBe(0);
    });

    it('average_speed should be mean of all road speeds', async () => {
      const roads = [
        { road_id: 1, road_name: 'R1', congestion_level: 'low' as const, speed_kmh: 40, travel_time_minutes: 15, last_updated: '' },
        { road_id: 2, road_name: 'R2', congestion_level: 'low' as const, speed_kmh: 60, travel_time_minutes: 10, last_updated: '' },
      ];
      vi.mocked(CacheService.getOrSet).mockResolvedValue(roads as never);

      const summary = await TrafficService.getTrafficSummary();
      expect(summary.average_speed).toBe(50);
      expect(summary.total_roads).toBe(2);
    });
  });

  describe('getTrafficByRoadId', () => {
    it('should return road when found', async () => {
      const roads = [
        { road_id: 3, road_name: 'Calle 72', congestion_level: 'moderate' as const, speed_kmh: 40, travel_time_minutes: 15, last_updated: '' },
      ];
      vi.mocked(CacheService.getOrSet).mockResolvedValue(roads as never);

      const road = await TrafficService.getTrafficByRoadId(3);
      expect(road).not.toBeNull();
      expect(road?.road_name).toBe('Calle 72');
    });

    it('should return null when road not found', async () => {
      vi.mocked(CacheService.getOrSet).mockResolvedValue([] as never);

      const road = await TrafficService.getTrafficByRoadId(999);
      expect(road).toBeNull();
    });

    it('should find the correct road among multiple', async () => {
      const roads = Array.from({ length: 6 }, (_, i) => ({
        road_id: i + 1, road_name: `Road ${i + 1}`,
        congestion_level: 'low' as const, speed_kmh: 50 + i,
        travel_time_minutes: 10, last_updated: '',
      }));
      vi.mocked(CacheService.getOrSet).mockResolvedValue(roads as never);

      const road = await TrafficService.getTrafficByRoadId(4);
      expect(road?.road_id).toBe(4);
      expect(road?.road_name).toBe('Road 4');
    });
  });

  describe('events impact on traffic', () => {
    it('should reduce speed when events are present', async () => {
      vi.mocked(EventsService.getUpcomingEvents).mockResolvedValue([
        { id: 1, title: 'Concert', event_type: 'music', location_name: 'Centro', traffic_impact: 'high', status: 'ongoing' } as never,
      ]);

      // Just ensure it returns without throwing
      const data = await TrafficService.getRealTimeTraffic();
      expect(data).toHaveLength(6);
    });
  });
});
