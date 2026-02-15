import { logger } from '@/utils/logger.js';
import { WeatherService } from './weatherService.js';
import { TrafficService } from './trafficService.js';
import { GeoService } from './geoService.js';
import { EventsService, type Event } from './eventsService.js';

export enum AlertType {
  ARROYO_FLOOD_RISK = 'arroyo_flood_risk',
  SEVERE_CONGESTION = 'severe_congestion',
  WEATHER_TRAFFIC_IMPACT = 'weather_traffic_impact',
  EVENT_TRAFFIC_IMPACT = 'event_traffic_impact',
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  affectedZones: number[];
  affectedRoads?: number[];
  timestamp: string;
  expiresAt: string;
  metadata: {
    weatherCondition?: string;
    rainfall?: number;
    congestionLevel?: string;
    eventId?: number;
    [key: string]: unknown;
  };
}

export class AlertService {
  /**
   * Detect all active alerts in the system
   */
  static async detectActiveAlerts(): Promise<Alert[]> {
    try {
      logger.info('Starting alert detection...');

      const alerts: Alert[] = [];

      // Run all alert detections in parallel
      const [arroyoAlerts, congestionAlerts, weatherTrafficAlerts, eventTrafficAlerts] =
        await Promise.all([
          this.detectArroyoFloodRisk(),
          this.detectSevereCongestion(),
          this.detectWeatherTrafficImpact(),
          this.detectEventTrafficImpact(),
        ]);

      alerts.push(...arroyoAlerts);
      alerts.push(...congestionAlerts);
      alerts.push(...weatherTrafficAlerts);
      alerts.push(...eventTrafficAlerts);

      logger.info(`Alert detection complete: ${alerts.length} active alerts`);

      return alerts;
    } catch (error) {
      logger.error('Error detecting alerts:', error);
      return [];
    }
  }

  /**
   * Detect arroyo flood risk alerts
   * Logic: Heavy rain (>5mm/h precipitation) + arroyo zone = HIGH risk
   */
  static async detectArroyoFloodRisk(): Promise<Alert[]> {
    try {
      const weather = await WeatherService.getCurrentWeather();

      const alerts: Alert[] = [];

      // Check if there's significant rainfall
      const rainIntensity = weather.rain?.['1h'] || weather.rain_1h || 0; // mm in last hour
      const isRaining = rainIntensity > 0;
      const isHeavyRain = rainIntensity > 5; // 5mm/h is heavy rain

      if (!isRaining) {
        return alerts;
      }

      // Get high-risk arroyo zones
      const highRiskArroyos = await GeoService.getArroyos('high');

      if (highRiskArroyos.length > 0) {
        const severity = isHeavyRain ? AlertSeverity.CRITICAL : AlertSeverity.HIGH;

        const alert: Alert = {
          id: `arroyo-flood-${Date.now()}`,
          type: AlertType.ARROYO_FLOOD_RISK,
          severity,
          title: isHeavyRain ? 'CRITICAL: High Flood Risk in Arroyo Zones' : 'Flood Risk Warning',
          description: `Heavy rainfall detected (${rainIntensity.toFixed(1)}mm/h). ${highRiskArroyos.length} high-risk arroyo zone(s) affected: ${highRiskArroyos.map(a => a.name).join(', ')}. Avoid travel in these areas.`,
          affectedZones: highRiskArroyos.map(a => a.zone_id).filter((id): id is number => id !== null),
          timestamp: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
          metadata: {
            weatherCondition: weather.weather?.[0]?.main || weather.condition,
            rainfall: rainIntensity,
            affectedArroyoCount: highRiskArroyos.length,
            arroyoNames: highRiskArroyos.map(a => a.name).join(', '),
            arroyoIds: highRiskArroyos.map(a => a.id),
          },
        };

        alerts.push(alert);
        logger.info(`Arroyo flood risk alert created: ${alert.id} (severity: ${severity}, ${highRiskArroyos.length} zones)`);
      }

      return alerts;
    } catch (error) {
      logger.error('Error detecting arroyo flood risk:', error);
      return [];
    }
  }

  /**
   * Detect severe congestion alerts
   * Logic: Traffic level 'severe' = alert
   */
  static async detectSevereCongestion(): Promise<Alert[]> {
    try {
      const traffic = await TrafficService.getRealTimeTraffic();
      const alerts: Alert[] = [];

      const severeRoads = traffic.filter((road) => road.congestion_level === 'severe');

      if (severeRoads.length > 0) {
        // Get affected zones by mapping roads to zones
        const roadIds = severeRoads.map(r => r.road_id);
        const roadZoneMap = await GeoService.getRoadsZones(roadIds);

        // Collect all unique zone IDs
        const affectedZones = Array.from(
          new Set(
            Array.from(roadZoneMap.values()).flat()
          )
        );

        const alert: Alert = {
          id: `congestion-severe-${Date.now()}`,
          type: AlertType.SEVERE_CONGESTION,
          severity: AlertSeverity.HIGH,
          title: 'Severe Traffic Congestion',
          description: `${severeRoads.length} road(s) experiencing severe congestion. ${affectedZones.length > 0 ? `Affecting ${affectedZones.length} zone(s).` : ''} Consider alternate routes.`,
          affectedZones,
          affectedRoads: roadIds,
          timestamp: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
          metadata: {
            congestionLevel: 'severe',
            affectedRoadCount: severeRoads.length,
            roadNames: severeRoads.map((r) => r.road_name).join(', '),
            affectedZoneCount: affectedZones.length,
          },
        };

        alerts.push(alert);
        logger.info(`Severe congestion alert created: ${alert.id} (${severeRoads.length} roads, ${affectedZones.length} zones)`);
      }

      return alerts;
    } catch (error) {
      logger.error('Error detecting severe congestion:', error);
      return [];
    }
  }

  /**
   * Detect weather impact on traffic
   * Logic: Rain + high/severe traffic = alert
   */
  static async detectWeatherTrafficImpact(): Promise<Alert[]> {
    try {
      const [weather, traffic] = await Promise.all([
        WeatherService.getCurrentWeather(),
        TrafficService.getRealTimeTraffic(),
      ]);

      const alerts: Alert[] = [];

      const rainIntensity = weather.rain?.['1h'] || weather.rain_1h || 0;
      const isRaining = rainIntensity > 0;
      const highTrafficRoads = traffic.filter(
        (road) => road.congestion_level === 'high' || road.congestion_level === 'severe'
      );

      if (isRaining && highTrafficRoads.length > 0) {
        const alert: Alert = {
          id: `weather-traffic-${Date.now()}`,
          type: AlertType.WEATHER_TRAFFIC_IMPACT,
          severity: AlertSeverity.MEDIUM,
          title: 'Weather Affecting Traffic',
          description: `Rain is causing increased congestion on ${highTrafficRoads.length} major road(s). Drive carefully and expect delays.`,
          affectedZones: [],
          affectedRoads: highTrafficRoads.map((r) => r.road_id),
          timestamp: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(), // 1 hour
          metadata: {
            weatherCondition: weather.weather?.[0]?.main || weather.condition,
            rainfall: rainIntensity,
            affectedRoadCount: highTrafficRoads.length,
          },
        };

        alerts.push(alert);
        logger.info(`Weather-traffic impact alert created: ${alert.id}`);
      }

      return alerts;
    } catch (error) {
      logger.error('Error detecting weather-traffic impact:', error);
      return [];
    }
  }

  /**
   * Detect event impact on traffic
   * Logic: Upcoming event (within 2 hours) + high traffic nearby = alert
   */
  static async detectEventTrafficImpact(): Promise<Alert[]> {
    try {
      const [upcomingEvents, traffic] = await Promise.all([
        EventsService.getUpcomingEvents(), // Get upcoming events
        TrafficService.getRealTimeTraffic(),
      ]);

      const alerts: Alert[] = [];

      for (const event of upcomingEvents) {
        // Check if there's high traffic (simplified - would need geospatial query in real scenario)
        const highTrafficCount = traffic.filter(
          (road) => road.congestion_level === 'high' || road.congestion_level === 'severe'
        ).length;

        if (highTrafficCount > 0) {
          const alert: Alert = {
            id: `event-traffic-${event.id}-${Date.now()}`,
            type: AlertType.EVENT_TRAFFIC_IMPACT,
            severity: AlertSeverity.MEDIUM,
            title: `Event Causing Traffic: ${event.title}`,
            description: `Upcoming event "${event.title}" is affecting traffic. Plan alternative routes if traveling to this area.`,
            affectedZones: [],
            timestamp: new Date().toISOString(),
            expiresAt: event.end_time,
            metadata: {
              eventId: event.id,
              eventName: event.title,
              eventType: event.event_type,
              eventStartDate: event.start_time,
            },
          };

          alerts.push(alert);
          logger.info(`Event-traffic impact alert created: ${alert.id}`);
        }
      }

      return alerts;
    } catch (error) {
      logger.error('Error detecting event-traffic impact:', error);
      return [];
    }
  }

  /**
   * Get severity color for frontend
   */
  static getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.LOW:
        return '#22c55e'; // green
      case AlertSeverity.MEDIUM:
        return '#eab308'; // yellow
      case AlertSeverity.HIGH:
        return '#f97316'; // orange
      case AlertSeverity.CRITICAL:
        return '#ef4444'; // red
      default:
        return '#6b7280'; // gray
    }
  }

  /**
   * Filter alerts by severity
   */
  static filterBySeverity(alerts: Alert[], severity: AlertSeverity): Alert[] {
    return alerts.filter((alert) => alert.severity === severity);
  }

  /**
   * Filter alerts by type
   */
  static filterByType(alerts: Alert[], type: AlertType): Alert[] {
    return alerts.filter((alert) => alert.type === type);
  }

  /**
   * Get only non-expired alerts
   */
  static getActiveAlerts(alerts: Alert[]): Alert[] {
    const now = new Date();
    return alerts.filter((alert) => new Date(alert.expiresAt) > now);
  }
}
