import { describe, it, expect } from 'vitest';
import { AlertService, AlertType, AlertSeverity } from '@/services/alertService.js';

/**
 * WebSocket Integration Tests
 *
 * Note: These tests require a running server and are skipped in CI/CD.
 * To run manually: Start server with `npm run dev` then run tests.
 *
 * For CI/CD, we test the core alert logic without requiring a live server.
 */

describe('Alert Service Unit Tests', () => {
  it('should detect active alerts and filter expired ones', async () => {
    const allAlerts = await AlertService.detectActiveAlerts();
    const activeAlerts = AlertService.getActiveAlerts(allAlerts);

    expect(Array.isArray(allAlerts)).toBe(true);
    expect(Array.isArray(activeAlerts)).toBe(true);

    // All active alerts should have expiration in the future
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

    // If there are alerts, they should be properly formatted
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
      // Required fields
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
