import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/services/weatherService.js', () => ({
  WeatherService: {
    getCurrentWeather: vi.fn(),
  },
}));

vi.mock('@/services/trafficService.js', () => ({
  TrafficService: {
    getRealTimeTraffic: vi.fn(),
  },
}));

vi.mock('@/services/geoService.js', () => ({
  GeoService: {
    getArroyos: vi.fn(),
    getRoadsZones: vi.fn(),
  },
}));

vi.mock('@/services/eventsService.js', () => ({
  EventsService: {
    getUpcomingEvents: vi.fn(),
  },
}));

import { AlertService, AlertSeverity, AlertType } from '@/services/alertService.js';
import { WeatherService } from '@/services/weatherService.js';
import { TrafficService } from '@/services/trafficService.js';
import { GeoService } from '@/services/geoService.js';
import { EventsService } from '@/services/eventsService.js';

describe('Alert Service Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(WeatherService.getCurrentWeather).mockResolvedValue({
      condition: 'Rain',
      rain_1h: 8,
      rain_probability: 80,
      weather: [{ main: 'Rain', description: 'heavy rain' }],
    } as never);

    vi.mocked(TrafficService.getRealTimeTraffic).mockResolvedValue([
      { road_id: 1, road_name: 'Murillo', congestion_level: 'severe' },
      { road_id: 2, road_name: 'Via 40', congestion_level: 'high' },
      { road_id: 3, road_name: 'Circunvalar', congestion_level: 'low' },
    ] as never);

    vi.mocked(GeoService.getArroyos).mockImplementation(async (riskLevel?: string) => {
      const all = [
        { id: 10, name: 'Arroyo A', zone_id: 1, risk_level: 'high' },
        { id: 11, name: 'Arroyo B', zone_id: 2, risk_level: 'medium' },
      ];
      return riskLevel ? all.filter((item) => item.risk_level === riskLevel) : all;
    });

    vi.mocked(GeoService.getRoadsZones).mockResolvedValue(
      new Map<number, number[]>([
        [1, [1, 2]],
        [2, [2]],
      ]) as never
    );

    vi.mocked(EventsService.getUpcomingEvents).mockResolvedValue([
      {
        id: 77,
        title: 'Concierto',
        event_type: 'music',
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
    ] as never);
  });

  it('should detect active alerts and filter expired ones', async () => {
    const allAlerts = await AlertService.detectActiveAlerts();
    const activeAlerts = AlertService.getActiveAlerts(allAlerts);

    expect(Array.isArray(allAlerts)).toBe(true);
    expect(Array.isArray(activeAlerts)).toBe(true);

    const now = new Date();
    activeAlerts.forEach(alert => {
      expect(new Date(alert.expiresAt) > now).toBe(true);
    });
  });

  it('should filter alerts by severity correctly', async () => {
    const allAlerts = await AlertService.detectActiveAlerts();

    const criticalAlerts = AlertService.filterBySeverity(allAlerts, AlertSeverity.CRITICAL);
    const highAlerts = AlertService.filterBySeverity(allAlerts, AlertSeverity.HIGH);
    const mediumAlerts = AlertService.filterBySeverity(allAlerts, AlertSeverity.MEDIUM);
    const lowAlerts = AlertService.filterBySeverity(allAlerts, AlertSeverity.LOW);

    criticalAlerts.forEach(alert => {
      expect(alert.severity).toBe(AlertSeverity.CRITICAL);
    });

    highAlerts.forEach(alert => {
      expect(alert.severity).toBe(AlertSeverity.HIGH);
    });

    mediumAlerts.forEach(alert => {
      expect(alert.severity).toBe(AlertSeverity.MEDIUM);
    });

    lowAlerts.forEach(alert => {
      expect(alert.severity).toBe(AlertSeverity.LOW);
    });
  });

  it('should filter alerts by type correctly', async () => {
    const allAlerts = await AlertService.detectActiveAlerts();

    const arroyoAlerts = AlertService.filterByType(allAlerts, AlertType.ARROYO_FLOOD_RISK);
    const congestionAlerts = AlertService.filterByType(allAlerts, AlertType.SEVERE_CONGESTION);
    const weatherAlerts = AlertService.filterByType(allAlerts, AlertType.WEATHER_TRAFFIC_IMPACT);
    const eventAlerts = AlertService.filterByType(allAlerts, AlertType.EVENT_TRAFFIC_IMPACT);

    arroyoAlerts.forEach(alert => {
      expect(alert.type).toBe(AlertType.ARROYO_FLOOD_RISK);
    });

    congestionAlerts.forEach(alert => {
      expect(alert.type).toBe(AlertType.SEVERE_CONGESTION);
    });

    weatherAlerts.forEach(alert => {
      expect(alert.type).toBe(AlertType.WEATHER_TRAFFIC_IMPACT);
    });

    eventAlerts.forEach(alert => {
      expect(alert.type).toBe(AlertType.EVENT_TRAFFIC_IMPACT);
    });
  });

  it('should return correct severity colors', () => {
    expect(AlertService.getSeverityColor(AlertSeverity.LOW)).toBe('#22c55e');
    expect(AlertService.getSeverityColor(AlertSeverity.MEDIUM)).toBe('#eab308');
    expect(AlertService.getSeverityColor(AlertSeverity.HIGH)).toBe('#f97316');
    expect(AlertService.getSeverityColor(AlertSeverity.CRITICAL)).toBe('#ef4444');
  });

  it('should detect arroyo flood risk based on rainfall', async () => {
    const alerts = await AlertService.detectArroyoFloodRisk();

    expect(Array.isArray(alerts)).toBe(true);
    alerts.forEach(alert => {
      expect(alert.id).toBeDefined();
      expect(alert.type).toBe(AlertType.ARROYO_FLOOD_RISK);
      expect([AlertSeverity.HIGH, AlertSeverity.CRITICAL].includes(alert.severity)).toBe(true);
      expect(alert.title).toBeDefined();
      expect(alert.description).toBeDefined();
      expect(alert.timestamp).toBeDefined();
      expect(alert.expiresAt).toBeDefined();
      expect(alert.metadata).toBeDefined();
    });
  });

  it('should detect severe congestion', async () => {
    const alerts = await AlertService.detectSevereCongestion();

    expect(Array.isArray(alerts)).toBe(true);
    alerts.forEach(alert => {
      expect(alert.type).toBe(AlertType.SEVERE_CONGESTION);
      expect(alert.severity).toBe(AlertSeverity.HIGH);
      expect(alert.affectedRoads).toBeDefined();
      expect(Array.isArray(alert.affectedRoads)).toBe(true);
    });
  });

  it('should detect weather traffic impact', async () => {
    const alerts = await AlertService.detectWeatherTrafficImpact();

    expect(Array.isArray(alerts)).toBe(true);
    alerts.forEach(alert => {
      expect(alert.type).toBe(AlertType.WEATHER_TRAFFIC_IMPACT);
      expect(alert.severity).toBe(AlertSeverity.MEDIUM);
      expect(alert.metadata.weatherCondition).toBeDefined();
    });
  });

  it('should detect event traffic impact', async () => {
    const alerts = await AlertService.detectEventTrafficImpact();

    expect(Array.isArray(alerts)).toBe(true);
    alerts.forEach(alert => {
      expect(alert.type).toBe(AlertType.EVENT_TRAFFIC_IMPACT);
      expect(alert.metadata.eventId).toBeDefined();
      expect(alert.metadata.eventName).toBeDefined();
    });
  });

  it('should have all required alert fields', async () => {
    const allAlerts = await AlertService.detectActiveAlerts();

    allAlerts.forEach(alert => {
      expect(alert.id).toBeDefined();
      expect(typeof alert.id).toBe('string');
      expect(alert.type).toBeDefined();
      expect(Object.values(AlertType).includes(alert.type)).toBe(true);
      expect(alert.severity).toBeDefined();
      expect(Object.values(AlertSeverity).includes(alert.severity)).toBe(true);
      expect(alert.title).toBeDefined();
      expect(typeof alert.title).toBe('string');
      expect(alert.description).toBeDefined();
      expect(typeof alert.description).toBe('string');
      expect(alert.affectedZones).toBeDefined();
      expect(Array.isArray(alert.affectedZones)).toBe(true);
      expect(alert.timestamp).toBeDefined();
      expect(alert.expiresAt).toBeDefined();
      expect(alert.metadata).toBeDefined();
      expect(typeof alert.metadata).toBe('object');
    });
  });
});

