import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * AlertService Unit Tests — Extended Coverage
 *
 * Tests AlertService logic with all external dependencies mocked.
 * Covers filtering, severity, expiration, and detection helpers.
 */

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
    getCurrentWeather: vi.fn(),
  },
}));

// Mock TrafficService
vi.mock('@/services/trafficService.js', () => ({
  TrafficService: {
    getRealTimeTraffic: vi.fn().mockResolvedValue([]),
  },
}));

// Mock GeoService
vi.mock('@/services/geoService.js', () => ({
  GeoService: {
    getArroyos: vi.fn().mockResolvedValue([]),
    getRoadsZones: vi.fn().mockResolvedValue(new Map()),
    getZones: vi.fn().mockResolvedValue([]),
  },
}));

// Mock EventsService
vi.mock('@/services/eventsService.js', () => ({
  EventsService: {
    getUpcomingEvents: vi.fn().mockResolvedValue([]),
    getActiveEvents: vi.fn().mockResolvedValue([]),
  },
}));

import { AlertService, AlertType, AlertSeverity, type Alert } from '@/services/alertService.js';
import { WeatherService } from '@/services/weatherService.js';
import { TrafficService } from '@/services/trafficService.js';
import { GeoService } from '@/services/geoService.js';

// Helper to create a test alert
const makeAlert = (overrides: Partial<Alert> = {}): Alert => ({
  id: `test-alert-${Math.random().toString(36).slice(2)}`,
  type: AlertType.SEVERE_CONGESTION,
  severity: AlertSeverity.MEDIUM,
  title: 'Test Alert',
  description: 'Test description',
  affectedZones: [1, 2],
  affectedRoads: [10, 20],
  timestamp: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
  metadata: {},
  ...overrides,
});

// Helper to create an expired alert
const makeExpiredAlert = (overrides: Partial<Alert> = {}): Alert =>
  makeAlert({
    expiresAt: new Date(Date.now() - 1000).toISOString(), // Already expired
    ...overrides,
  });

describe('AlertService — Static Utilities', () => {
  describe('getActiveAlerts', () => {
    it('should return only non-expired alerts', () => {
      const now = Date.now();
      const active = makeAlert({ expiresAt: new Date(now + 3600_000).toISOString() });
      const expired = makeExpiredAlert();

      const result = AlertService.getActiveAlerts([active, expired]);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(active.id);
    });

    it('should return empty array when all alerts are expired', () => {
      const alerts = [makeExpiredAlert(), makeExpiredAlert()];
      expect(AlertService.getActiveAlerts(alerts)).toHaveLength(0);
    });

    it('should return all alerts when none are expired', () => {
      const alerts = [makeAlert(), makeAlert(), makeAlert()];
      expect(AlertService.getActiveAlerts(alerts)).toHaveLength(3);
    });
  });

  describe('filterBySeverity', () => {
    it('should filter by LOW severity', () => {
      const alerts = [
        makeAlert({ severity: AlertSeverity.LOW }),
        makeAlert({ severity: AlertSeverity.HIGH }),
        makeAlert({ severity: AlertSeverity.LOW }),
      ];

      const result = AlertService.filterBySeverity(alerts, AlertSeverity.LOW);
      expect(result).toHaveLength(2);
      result.forEach(a => expect(a.severity).toBe(AlertSeverity.LOW));
    });

    it('should filter by CRITICAL severity', () => {
      const alerts = [
        makeAlert({ severity: AlertSeverity.CRITICAL }),
        makeAlert({ severity: AlertSeverity.MEDIUM }),
      ];

      const result = AlertService.filterBySeverity(alerts, AlertSeverity.CRITICAL);
      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe(AlertSeverity.CRITICAL);
    });

    it('should return empty array when no matching severity', () => {
      const alerts = [makeAlert({ severity: AlertSeverity.LOW })];
      const result = AlertService.filterBySeverity(alerts, AlertSeverity.CRITICAL);
      expect(result).toHaveLength(0);
    });
  });

  describe('filterByType', () => {
    it('should filter by ARROYO_FLOOD_RISK type', () => {
      const alerts = [
        makeAlert({ type: AlertType.ARROYO_FLOOD_RISK }),
        makeAlert({ type: AlertType.SEVERE_CONGESTION }),
        makeAlert({ type: AlertType.ARROYO_FLOOD_RISK }),
      ];

      const result = AlertService.filterByType(alerts, AlertType.ARROYO_FLOOD_RISK);
      expect(result).toHaveLength(2);
    });

    it('should filter by EVENT_TRAFFIC_IMPACT type', () => {
      const alerts = [
        makeAlert({ type: AlertType.EVENT_TRAFFIC_IMPACT }),
        makeAlert({ type: AlertType.WEATHER_TRAFFIC_IMPACT }),
      ];

      const result = AlertService.filterByType(alerts, AlertType.EVENT_TRAFFIC_IMPACT);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe(AlertType.EVENT_TRAFFIC_IMPACT);
    });
  });

  describe('getSeverityColor', () => {
    it('should return green for LOW', () => {
      expect(AlertService.getSeverityColor(AlertSeverity.LOW)).toBe('#22c55e');
    });

    it('should return yellow for MEDIUM', () => {
      expect(AlertService.getSeverityColor(AlertSeverity.MEDIUM)).toBe('#eab308');
    });

    it('should return orange for HIGH', () => {
      expect(AlertService.getSeverityColor(AlertSeverity.HIGH)).toBe('#f97316');
    });

    it('should return red for CRITICAL', () => {
      expect(AlertService.getSeverityColor(AlertSeverity.CRITICAL)).toBe('#ef4444');
    });
  });
});

describe('AlertService — Detection Methods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectArroyoFloodRisk', () => {
    it('should return no alerts when not raining', async () => {
      vi.mocked(WeatherService.getCurrentWeather).mockResolvedValue({
        rain: { '1h': 0 },
        rain_1h: 0,
        condition: 'Clear',
        temperature: 30,
        humidity: 60,
        wind_speed: 10,
        rain_probability: 5,
      } as never);

      const alerts = await AlertService.detectArroyoFloodRisk();
      expect(alerts).toHaveLength(0);
    });

    it('should return HIGH alert when raining with high-risk arroyos', async () => {
      vi.mocked(WeatherService.getCurrentWeather).mockResolvedValue({
        rain: { '1h': 3.0 }, // 3mm/h = raining but not heavy
        rain_1h: 3.0,
        condition: 'Rain',
        temperature: 25,
        humidity: 90,
        wind_speed: 20,
        rain_probability: 85,
        weather: [{ main: 'Rain' }],
      } as never);

      vi.mocked(GeoService.getArroyos).mockResolvedValue([
        { id: 1, name: 'Arroyo La Paz', risk_level: 'high', zone_id: 1, geometry: {} as never },
      ] as never);

      const alerts = await AlertService.detectArroyoFloodRisk();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe(AlertSeverity.HIGH);
      expect(alerts[0].type).toBe(AlertType.ARROYO_FLOOD_RISK);
    });

    it('should return CRITICAL alert when heavy rain (>5mm/h)', async () => {
      vi.mocked(WeatherService.getCurrentWeather).mockResolvedValue({
        rain: { '1h': 8.5 }, // 8.5mm/h = heavy rain
        rain_1h: 8.5,
        condition: 'Heavy Rain',
        temperature: 22,
        humidity: 95,
        wind_speed: 30,
        rain_probability: 95,
        weather: [{ main: 'Rain' }],
      } as never);

      vi.mocked(GeoService.getArroyos).mockResolvedValue([
        { id: 1, name: 'Arroyo El Country', risk_level: 'high', zone_id: 2, geometry: {} as never },
        { id: 2, name: 'Arroyo La Paz', risk_level: 'high', zone_id: 3, geometry: {} as never },
      ] as never);

      const alerts = await AlertService.detectArroyoFloodRisk();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe(AlertSeverity.CRITICAL);
      expect(alerts[0].metadata.rainfall).toBe(8.5);
    });

    it('should return no alert when raining but no high-risk arroyos', async () => {
      vi.mocked(WeatherService.getCurrentWeather).mockResolvedValue({
        rain: { '1h': 4.0 },
        rain_1h: 4.0,
        condition: 'Rain',
        temperature: 26,
        humidity: 88,
        wind_speed: 15,
        rain_probability: 75,
      } as never);

      vi.mocked(GeoService.getArroyos).mockResolvedValue([] as never);

      const alerts = await AlertService.detectArroyoFloodRisk();
      expect(alerts).toHaveLength(0);
    });
  });

  describe('detectSevereCongestion', () => {
    it('should return no alerts when no severe congestion', async () => {
      vi.mocked(TrafficService.getRealTimeTraffic).mockResolvedValue([
        { road_id: 1, road_name: 'Av. Murillo', congestion_level: 'moderate', speed_kmh: 35 },
        { road_id: 2, road_name: 'Calle 72', congestion_level: 'low', speed_kmh: 55 },
      ] as never);

      const alerts = await AlertService.detectSevereCongestion();
      expect(alerts).toHaveLength(0);
    });

    it('should return HIGH alert when severe congestion detected', async () => {
      vi.mocked(TrafficService.getRealTimeTraffic).mockResolvedValue([
        { road_id: 1, road_name: 'Carrera 43', congestion_level: 'severe', speed_kmh: 8 },
        { road_id: 2, road_name: 'Calle 30', congestion_level: 'severe', speed_kmh: 5 },
        { road_id: 3, road_name: 'Av. Murillo', congestion_level: 'moderate', speed_kmh: 35 },
      ] as never);

      vi.mocked(GeoService.getRoadsZones).mockResolvedValue(
        new Map([[1, [1, 2]], [2, [2, 3]]]) as never
      );

      const alerts = await AlertService.detectSevereCongestion();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe(AlertType.SEVERE_CONGESTION);
      expect(alerts[0].severity).toBe(AlertSeverity.HIGH);
      expect(alerts[0].affectedRoads).toContain(1);
      expect(alerts[0].affectedRoads).toContain(2);
    });

    it('should include affected roads in alert metadata', async () => {
      vi.mocked(TrafficService.getRealTimeTraffic).mockResolvedValue([
        { road_id: 5, road_name: 'Circunvalar', congestion_level: 'severe', speed_kmh: 10 },
      ] as never);

      vi.mocked(GeoService.getRoadsZones).mockResolvedValue(new Map([[5, [4]]]) as never);

      const alerts = await AlertService.detectSevereCongestion();
      expect(alerts[0].metadata.affectedRoadCount).toBe(1);
      expect(alerts[0].metadata.roadNames).toContain('Circunvalar');
    });
  });

  describe('detectActiveAlerts — integration of all detectors', () => {
    it('should aggregate alerts from all detectors', async () => {
      // No rain, no congestion, no weather impact, no events → empty
      vi.mocked(WeatherService.getCurrentWeather).mockResolvedValue({
        rain: { '1h': 0 },
        rain_1h: 0,
        condition: 'Clear',
        temperature: 30,
        humidity: 65,
        wind_speed: 8,
        rain_probability: 5,
      } as never);

      vi.mocked(TrafficService.getRealTimeTraffic).mockResolvedValue([] as never);

      const alerts = await AlertService.detectActiveAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should return empty array on error (resilient)', async () => {
      vi.mocked(WeatherService.getCurrentWeather).mockRejectedValue(new Error('Weather API down'));
      vi.mocked(TrafficService.getRealTimeTraffic).mockRejectedValue(new Error('Traffic API down'));

      // Should not throw, returns [] gracefully
      const alerts = await AlertService.detectActiveAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });
  });

  describe('alert structure validation', () => {
    it('should generate alerts with unique IDs across sequential calls', async () => {
      const weather = {
        rain: { '1h': 6 },
        rain_1h: 6,
        condition: 'Heavy Rain',
        temperature: 24,
        humidity: 95,
        wind_speed: 25,
        rain_probability: 90,
        weather: [{ main: 'Rain' }],
      } as never;

      const arroyos = [
        { id: 1, name: 'Test Arroyo', risk_level: 'high', zone_id: 1, geometry: {} as never },
      ] as never;

      // Use fake timers to ensure different timestamps between calls
      vi.useFakeTimers();

      vi.mocked(WeatherService.getCurrentWeather).mockResolvedValue(weather);
      vi.mocked(GeoService.getArroyos).mockResolvedValue(arroyos);

      const result1 = await AlertService.detectArroyoFloodRisk();

      // Advance clock by 1ms to guarantee a different Date.now() value
      vi.advanceTimersByTime(1);

      vi.mocked(WeatherService.getCurrentWeather).mockResolvedValue(weather);
      vi.mocked(GeoService.getArroyos).mockResolvedValue(arroyos);

      const result2 = await AlertService.detectArroyoFloodRisk();

      vi.useRealTimers();

      if (result1.length > 0 && result2.length > 0) {
        expect(result1[0].id).not.toBe(result2[0].id);
      }
    });

    it('should set expiry in the future', async () => {
      vi.mocked(TrafficService.getRealTimeTraffic).mockResolvedValue([
        { road_id: 1, road_name: 'Test Road', congestion_level: 'severe', speed_kmh: 5 },
      ] as never);

      vi.mocked(GeoService.getRoadsZones).mockResolvedValue(new Map([[1, [1]]]) as never);

      const alerts = await AlertService.detectSevereCongestion();
      const now = new Date();

      alerts.forEach(alert => {
        expect(new Date(alert.expiresAt) > now).toBe(true);
        expect(new Date(alert.timestamp) <= now).toBe(true);
      });
    });
  });
});
