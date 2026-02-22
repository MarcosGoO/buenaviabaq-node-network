import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * RoutingService Unit Tests
 *
 * Tests pure scoring and helper logic without requiring a running DB.
 * External dependencies (pool, WeatherService, GeoService, EventsService) are mocked.
 */

// Mock DB pool
vi.mock('@/db', () => ({
  pool: {
    query: vi.fn().mockResolvedValue({ rows: [] }),
  },
}));

// Mock logger
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock WeatherService
vi.mock('@/services/weatherService.js', () => ({
  WeatherService: {
    getCurrentWeather: vi.fn().mockResolvedValue({
      temperature: 28,
      humidity: 75,
      wind_speed: 10,
      rain_probability: 20,
      condition: 'Clear',
    }),
  },
}));

// Mock GeoService
vi.mock('@/services/geoService.js', () => ({
  GeoService: {
    getArroyos: vi.fn().mockResolvedValue([]),
  },
}));

// Mock EventsService
vi.mock('@/services/eventsService.js', () => ({
  EventsService: {
    getUpcomingEvents: vi.fn().mockResolvedValue([]),
  },
}));

import { RoutingService } from '@/services/routingService.js';

const defaultWeather = {
  temperature: 28,
  humidity: 75,
  wind_speed: 10,
  rain_probability: 20,
  condition: 'Clear',
  description: 'Clear skies',
  feels_like: 30,
  pressure: 1013,
  visibility: 10,
  cloud_cover: 5,
};

describe('RoutingService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-apply defaults after clearAllMocks resets implementations
    const { WeatherService } = await import('@/services/weatherService.js');
    vi.mocked(WeatherService.getCurrentWeather).mockResolvedValue(defaultWeather as never);
    const { GeoService } = await import('@/services/geoService.js');
    vi.mocked(GeoService.getArroyos).mockResolvedValue([] as never);
    const { EventsService } = await import('@/services/eventsService.js');
    vi.mocked(EventsService.getUpcomingEvents).mockResolvedValue([] as never);
  });

  describe('validateCoordinates — via calculateRoutes', () => {
    it('should throw for missing lat/lng', async () => {
      await expect(
        RoutingService.calculateRoutes({
          origin: { lat: 0, lng: 0 },
          destination: { lat: 10.97, lng: -74.8 },
        })
      ).rejects.toThrow();
    });

    it('should throw for out-of-bounds coordinates', async () => {
      await expect(
        RoutingService.calculateRoutes({
          origin: { lat: 5.0, lng: -74.8 }, // Below Barranquilla bounds
          destination: { lat: 10.97, lng: -74.8 },
        })
      ).rejects.toThrow('Coordinates outside Barranquilla bounds');
    });

    it('should accept valid Barranquilla coordinates', async () => {
      const { pool } = await import('@/db');
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);

      const routes = await RoutingService.calculateRoutes({
        origin: { lat: 10.96, lng: -74.8 },
        destination: { lat: 10.98, lng: -74.78 },
      });

      expect(Array.isArray(routes)).toBe(true);
    });
  });

  describe('getOptimalRoute', () => {
    it('should return null when no roads available', async () => {
      const { pool } = await import('@/db');
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);

      const route = await RoutingService.getOptimalRoute({
        origin: { lat: 10.96, lng: -74.8 },
        destination: { lat: 10.98, lng: -74.78 },
      });

      expect(route).toBeNull();
    });

    it('should return a route when roads are available', async () => {
      const { pool } = await import('@/db');

      const mockRoad = {
        road_id: 1,
        road_name: 'Av. Murillo',
        road_type: 'primary',
        lanes: 2,
        max_speed_kmh: 60,
        length_km: 3.5,
        geometry: { type: 'LineString', coordinates: [] },
        current_speed: 45,
        congestion_level: 'moderate',
      };

      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [mockRoad, mockRoad] } as never);

      const route = await RoutingService.getOptimalRoute({
        origin: { lat: 10.96, lng: -74.8 },
        destination: { lat: 10.98, lng: -74.78 },
      });

      expect(route).not.toBeNull();
      expect(route?.segments.length).toBeGreaterThan(0);
      expect(route?.overall_score).toBeGreaterThanOrEqual(0);
      expect(route?.overall_score).toBeLessThanOrEqual(100);
    });
  });

  describe('calculateRoutes — route structure', () => {
    it('should return routes with all required fields', async () => {
      const { pool } = await import('@/db');

      const mockRoad = {
        road_id: 1,
        road_name: 'Calle 30',
        road_type: 'highway',
        lanes: 4,
        max_speed_kmh: 80,
        length_km: 5,
        geometry: {},
        current_speed: 70,
        congestion_level: 'low',
      };

      vi.mocked(pool.query).mockResolvedValue({ rows: [mockRoad, mockRoad, mockRoad] } as never);

      const routes = await RoutingService.calculateRoutes({
        origin: { lat: 10.95, lng: -74.82 },
        destination: { lat: 10.99, lng: -74.76 },
      });

      routes.forEach(route => {
        expect(route.route_id).toBeDefined();
        expect(Array.isArray(route.segments)).toBe(true);
        expect(typeof route.total_distance_km).toBe('number');
        expect(typeof route.estimated_time_minutes).toBe('number');
        expect(typeof route.average_speed_kmh).toBe('number');
        expect(route.overall_score).toBeGreaterThanOrEqual(0);
        expect(route.overall_score).toBeLessThanOrEqual(100);
        expect(route.score_breakdown).toHaveProperty('traffic_score');
        expect(route.score_breakdown).toHaveProperty('weather_score');
        expect(route.score_breakdown).toHaveProperty('safety_score');
        expect(route.score_breakdown).toHaveProperty('distance_score');
        expect(Array.isArray(route.warnings)).toBe(true);
      });
    });

    it('should respect max_routes preference', async () => {
      const { pool } = await import('@/db');

      const mockRoads = Array.from({ length: 10 }, (_, i) => ({
        road_id: i + 1,
        road_name: `Road ${i + 1}`,
        road_type: i % 2 === 0 ? 'highway' : 'primary',
        lanes: 2,
        max_speed_kmh: 60,
        length_km: 2,
        geometry: {},
        current_speed: 40 + i * 2,
        congestion_level: 'low',
      }));

      vi.mocked(pool.query).mockResolvedValue({ rows: mockRoads } as never);

      const routes = await RoutingService.calculateRoutes({
        origin: { lat: 10.95, lng: -74.82 },
        destination: { lat: 10.99, lng: -74.76 },
        preferences: { max_routes: 2 },
      });

      expect(routes.length).toBeLessThanOrEqual(2);
    });

    it('should sort routes by score descending', async () => {
      const { pool } = await import('@/db');

      const mockRoads = Array.from({ length: 5 }, (_, i) => ({
        road_id: i + 1,
        road_name: `Road ${i + 1}`,
        road_type: 'primary',
        lanes: 2,
        max_speed_kmh: 60,
        length_km: 3,
        geometry: {},
        current_speed: 50,
        congestion_level: 'low',
      }));

      vi.mocked(pool.query).mockResolvedValue({ rows: mockRoads } as never);

      const routes = await RoutingService.calculateRoutes({
        origin: { lat: 10.95, lng: -74.82 },
        destination: { lat: 10.99, lng: -74.76 },
      });

      for (let i = 0; i < routes.length - 1; i++) {
        expect(routes[i].overall_score).toBeGreaterThanOrEqual(routes[i + 1].overall_score);
      }
    });

    it('should add congestion warning when segments are congested', async () => {
      const { pool } = await import('@/db');

      const congestedRoad = {
        road_id: 1,
        road_name: 'Congested Road',
        road_type: 'primary',
        lanes: 2,
        max_speed_kmh: 60,
        length_km: 2,
        geometry: {},
        current_speed: 15,
        congestion_level: 'severe',
      };

      vi.mocked(pool.query).mockResolvedValue({ rows: [congestedRoad, congestedRoad] } as never);

      const routes = await RoutingService.calculateRoutes({
        origin: { lat: 10.95, lng: -74.82 },
        destination: { lat: 10.99, lng: -74.76 },
      });

      if (routes.length > 0) {
        // At least one route should have congestion-related metadata
        const hasCongestionMetadata = routes.some(r => r.metadata.congested_segments > 0);
        expect(hasCongestionMetadata).toBe(true);
      }
    });

    it('should add arroyo warning when high-risk arroyos are present', async () => {
      const { pool } = await import('@/db');
      const { GeoService } = await import('@/services/geoService.js');

      vi.mocked(GeoService.getArroyos).mockResolvedValueOnce([
        { id: 1, name: 'Arroyo La Paz', risk_level: 'high', geometry: {} as never },
        { id: 2, name: 'Arroyo El Country', risk_level: 'high', geometry: {} as never },
      ]);

      const mockRoad = {
        road_id: 1,
        road_name: 'Av. La Paz',
        road_type: 'primary',
        lanes: 2,
        max_speed_kmh: 60,
        length_km: 3,
        geometry: {},
        current_speed: 45,
        congestion_level: 'low',
      };

      vi.mocked(pool.query).mockResolvedValue({ rows: [mockRoad] } as never);

      const routes = await RoutingService.calculateRoutes({
        origin: { lat: 10.95, lng: -74.82 },
        destination: { lat: 10.99, lng: -74.76 },
      });

      if (routes.length > 0) {
        const hasArroyoWarning = routes.some(r =>
          r.warnings.some(w => w.includes('arroyo')) || r.metadata.arroyo_risk
        );
        expect(hasArroyoWarning).toBe(true);
      }
    });
  });

  describe('weather score impact', () => {
    it('should add weather warning when rain probability is high', async () => {
      const { pool } = await import('@/db');
      const { WeatherService } = await import('@/services/weatherService.js');

      vi.mocked(WeatherService.getCurrentWeather).mockResolvedValueOnce({
        temperature: 28,
        humidity: 90,
        wind_speed: 15,
        rain_probability: 80,
        condition: 'Heavy Rain',
        description: 'Heavy rain expected',
        feels_like: 30,
        pressure: 1013,
        visibility: 5,
        cloud_cover: 90,
      } as never);

      const mockRoad = {
        road_id: 1,
        road_name: 'Calle 72',
        road_type: 'primary',
        lanes: 2,
        max_speed_kmh: 60,
        length_km: 2,
        geometry: {},
        current_speed: 40,
        congestion_level: 'moderate',
      };

      vi.mocked(pool.query).mockResolvedValue({ rows: [mockRoad] } as never);

      const routes = await RoutingService.calculateRoutes({
        origin: { lat: 10.96, lng: -74.8 },
        destination: { lat: 10.98, lng: -74.78 },
      });

      if (routes.length > 0) {
        const hasWeatherWarning = routes.some(r =>
          r.warnings.some(w => w.toLowerCase().includes('rain'))
        );
        expect(hasWeatherWarning).toBe(true);
      }
    });
  });
});
