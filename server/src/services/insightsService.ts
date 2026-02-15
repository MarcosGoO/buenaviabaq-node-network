import { pool } from '@/db';
import { logger } from '@/utils/logger';
import { WeatherService } from './weatherService.js';
import { AlertService } from './alertService.js';
import { GeoService } from './geoService.js';

/**
 * Executive Summary Interface
 * Comprehensive dashboard metrics for VíaBaq platform
 */
export interface ExecutiveSummary {
  // Overall system metrics
  system: {
    avg_speed_kmh: number;
    overall_congestion_level: string;
    total_active_roads: number;
    monitored_zones: number;
  };

  // Current traffic conditions
  traffic: {
    current_avg_speed: number;
    historical_avg_speed: number;
    speed_change_percentage: number;
    congestion_breakdown: {
      low: number;
      moderate: number;
      high: number;
      severe: number;
    };
    top_congested_roads: Array<{
      road_id: number;
      road_name: string;
      speed_kmh: number;
      congestion_level: string;
    }>;
  };

  // Weather conditions impact
  weather: {
    current_condition: string;
    temperature_celsius: number;
    rain_probability: number;
    is_affecting_traffic: boolean;
    weather_impact_score: number; // 0-100
  };

  // Alerts summary
  alerts: {
    total_active: number;
    critical_count: number;
    by_type: {
      arroyo_flood: number;
      severe_congestion: number;
      weather_traffic: number;
      event_traffic: number;
    };
    by_severity: {
      low: number;
      medium: number;
      high: number;
      critical: number;
    };
  };

  // Arroyo zones at risk
  arroyos: {
    total_zones: number;
    high_risk_count: number;
    medium_risk_count: number;
    affected_zones: Array<{
      id: number;
      name: string;
      risk_level: string;
    }>;
  };

  // Predictive insights
  predictions: {
    next_hour_trend: 'improving' | 'stable' | 'worsening';
    rush_hour_active: boolean;
    estimated_avg_travel_time_minutes: number;
    confidence_score: number; // 0-100
  };

  // Timestamp
  generated_at: string;
}

/**
 * Zone-specific insights
 */
export interface ZoneInsights {
  zone_id: number;
  zone_name: string;
  avg_speed: number;
  congestion_level: string;
  total_roads: number;
  active_alerts: number;
  arroyo_risk_level: string | null;
  travel_time_impact_percentage: number;
}

/**
 * Comparative metrics (Current vs Historical)
 */
export interface ComparativeMetrics {
  metric_name: string;
  current_value: number;
  historical_value: number;
  difference: number;
  percentage_change: number;
  trend: 'up' | 'down' | 'stable';
  is_favorable: boolean;
}

/**
 * InsightsService
 * Provides high-level aggregated insights for dashboard analytics
 * Sprint 6.1 - Dashboard Analytics
 */
export class InsightsService {
  /**
   * Get comprehensive executive summary for dashboard
   * Aggregates data from multiple services
   */
  static async getExecutiveSummary(): Promise<ExecutiveSummary> {
    try {
      logger.info('Generating executive summary...');

      // Fetch data in parallel for performance
      const [
        systemMetrics,
        trafficMetrics,
        weatherData,
        alertsData,
        arroyoData,
        predictiveData
      ] = await Promise.all([
        this.getSystemMetrics(),
        this.getTrafficMetrics(),
        this.getWeatherMetrics(),
        this.getAlertsMetrics(),
        this.getArroyoMetrics(),
        this.getPredictiveMetrics()
      ]);

      const summary: ExecutiveSummary = {
        system: systemMetrics,
        traffic: trafficMetrics,
        weather: weatherData,
        alerts: alertsData,
        arroyos: arroyoData,
        predictions: predictiveData,
        generated_at: new Date().toISOString()
      };

      logger.info('Executive summary generated successfully');
      return summary;
    } catch (error) {
      logger.error('Error generating executive summary:', error);
      throw error;
    }
  }

  /**
   * Get system-wide metrics
   */
  private static async getSystemMetrics() {
    try {
      const query = `
        SELECT
          ROUND(AVG(speed_kmh)) as avg_speed,
          MODE() WITHIN GROUP (ORDER BY congestion_level) as overall_congestion,
          COUNT(DISTINCT road_id) as total_roads
        FROM traffic_history
        WHERE time >= NOW() - INTERVAL '1 hour'
      `;

      const zonesQuery = `SELECT COUNT(*) as zone_count FROM zones`;

      const [trafficResult, zonesResult] = await Promise.all([
        pool.query(query),
        pool.query(zonesQuery)
      ]);

      const traffic = trafficResult.rows[0];
      const zones = zonesResult.rows[0];

      return {
        avg_speed_kmh: Number(traffic.avg_speed) || 0,
        overall_congestion_level: traffic.overall_congestion || 'low',
        total_active_roads: Number(traffic.total_roads) || 0,
        monitored_zones: Number(zones.zone_count) || 0
      };
    } catch (error) {
      logger.error('Error fetching system metrics:', error);
      throw error;
    }
  }

  /**
   * Get current traffic metrics with historical comparison
   */
  private static async getTrafficMetrics() {
    try {
      // Current traffic
      const currentQuery = `
        SELECT
          ROUND(AVG(speed_kmh)) as current_speed,
          COUNT(*) FILTER (WHERE congestion_level = 'low') as low_count,
          COUNT(*) FILTER (WHERE congestion_level = 'moderate') as moderate_count,
          COUNT(*) FILTER (WHERE congestion_level = 'high') as high_count,
          COUNT(*) FILTER (WHERE congestion_level = 'severe') as severe_count
        FROM traffic_history
        WHERE time >= NOW() - INTERVAL '1 hour'
      `;

      // Historical average for same hour/day
      const historicalQuery = `
        SELECT ROUND(AVG(speed_kmh)) as historical_speed
        FROM traffic_history
        WHERE hour_of_day = EXTRACT(HOUR FROM NOW())
          AND day_of_week = EXTRACT(DOW FROM NOW())
          AND time >= NOW() - INTERVAL '30 days'
          AND time < NOW() - INTERVAL '1 day'
      `;

      // Top congested roads
      const topCongestedQuery = `
        SELECT
          road_id,
          road_name,
          ROUND(AVG(speed_kmh)) as speed,
          MODE() WITHIN GROUP (ORDER BY congestion_level) as congestion
        FROM traffic_history
        WHERE time >= NOW() - INTERVAL '1 hour'
        GROUP BY road_id, road_name
        ORDER BY
          CASE
            WHEN MODE() WITHIN GROUP (ORDER BY congestion_level) = 'severe' THEN 1
            WHEN MODE() WITHIN GROUP (ORDER BY congestion_level) = 'high' THEN 2
            WHEN MODE() WITHIN GROUP (ORDER BY congestion_level) = 'moderate' THEN 3
            ELSE 4
          END,
          AVG(speed_kmh) ASC
        LIMIT 5
      `;

      const [currentResult, historicalResult, topCongestedResult] = await Promise.all([
        pool.query(currentQuery),
        pool.query(historicalQuery),
        pool.query(topCongestedQuery)
      ]);

      const current = currentResult.rows[0];
      const historical = historicalResult.rows[0];
      const topCongested = topCongestedResult.rows;

      const currentSpeed = Number(current.current_speed) || 0;
      const historicalSpeed = Number(historical.historical_speed) || currentSpeed;
      const speedChange = historicalSpeed !== 0
        ? Math.round(((currentSpeed - historicalSpeed) / historicalSpeed) * 100)
        : 0;

      return {
        current_avg_speed: currentSpeed,
        historical_avg_speed: historicalSpeed,
        speed_change_percentage: speedChange,
        congestion_breakdown: {
          low: Number(current.low_count) || 0,
          moderate: Number(current.moderate_count) || 0,
          high: Number(current.high_count) || 0,
          severe: Number(current.severe_count) || 0
        },
        top_congested_roads: topCongested.map(road => ({
          road_id: road.road_id,
          road_name: road.road_name,
          speed_kmh: Number(road.speed),
          congestion_level: road.congestion
        }))
      };
    } catch (error) {
      logger.error('Error fetching traffic metrics:', error);
      throw error;
    }
  }

  /**
   * Get weather metrics and impact assessment
   */
  private static async getWeatherMetrics() {
    try {
      const weather = await WeatherService.getCurrentWeather();

      // Calculate weather impact score (0-100)
      let impactScore = 0;

      // Rain probability impact (0-40 points)
      impactScore += Math.min(weather.rain_probability, 40);

      // Temperature impact (0-20 points) - extreme temps
      const tempDiff = Math.abs(weather.temperature - 28); // Optimal temp for Barranquilla
      impactScore += Math.min(tempDiff * 2, 20);

      // Wind speed impact (0-20 points)
      impactScore += Math.min(weather.wind_speed / 2, 20);

      // Condition impact (0-20 points)
      const severeConditions = ['Thunderstorm', 'Heavy Rain', 'Storm'];
      if (severeConditions.includes(weather.condition)) {
        impactScore += 20;
      }

      const isAffectingTraffic = impactScore > 30 || weather.rain_probability > 50;

      return {
        current_condition: weather.condition,
        temperature_celsius: weather.temperature,
        rain_probability: weather.rain_probability,
        is_affecting_traffic: isAffectingTraffic,
        weather_impact_score: Math.min(Math.round(impactScore), 100)
      };
    } catch (error) {
      logger.error('Error fetching weather metrics:', error);
      // Return default weather metrics on error
      return {
        current_condition: 'Unknown',
        temperature_celsius: 28,
        rain_probability: 0,
        is_affecting_traffic: false,
        weather_impact_score: 0
      };
    }
  }

  /**
   * Get alerts metrics summary
   */
  private static async getAlertsMetrics() {
    try {
      const allAlerts = await AlertService.detectActiveAlerts();
      const alerts = AlertService.getActiveAlerts(allAlerts);

      const byType = {
        arroyo_flood: alerts.filter(a => a.type === 'arroyo_flood_risk').length,
        severe_congestion: alerts.filter(a => a.type === 'severe_congestion').length,
        weather_traffic: alerts.filter(a => a.type === 'weather_traffic_impact').length,
        event_traffic: alerts.filter(a => a.type === 'event_traffic_impact').length
      };

      const bySeverity = {
        low: alerts.filter(a => a.severity === 'low').length,
        medium: alerts.filter(a => a.severity === 'medium').length,
        high: alerts.filter(a => a.severity === 'high').length,
        critical: alerts.filter(a => a.severity === 'critical').length
      };

      const criticalCount = bySeverity.critical;

      return {
        total_active: alerts.length,
        critical_count: criticalCount,
        by_type: byType,
        by_severity: bySeverity
      };
    } catch (error) {
      logger.error('Error fetching alerts metrics:', error);
      throw error;
    }
  }

  /**
   * Get arroyo zones metrics
   */
  private static async getArroyoMetrics() {
    try {
      const allArroyos = await GeoService.getArroyos();
      const highRiskArroyos = await GeoService.getArroyos('high');
      const mediumRiskArroyos = await GeoService.getArroyos('medium');

      // Get current weather to determine affected zones
      const weather = await WeatherService.getCurrentWeather();
      const affectedZones = weather.rain_probability > 50
        ? highRiskArroyos.slice(0, 3).map(arroyo => ({
            id: arroyo.id,
            name: arroyo.name,
            risk_level: arroyo.risk_level
          }))
        : [];

      return {
        total_zones: allArroyos.length,
        high_risk_count: highRiskArroyos.length,
        medium_risk_count: mediumRiskArroyos.length,
        affected_zones: affectedZones
      };
    } catch (error) {
      logger.error('Error fetching arroyo metrics:', error);
      throw error;
    }
  }

  /**
   * Get predictive metrics and trends
   */
  private static async getPredictiveMetrics() {
    try {
      // Analyze recent trend (last 2 hours)
      const trendQuery = `
        SELECT
          hour_of_day,
          ROUND(AVG(speed_kmh)) as avg_speed
        FROM traffic_history
        WHERE time >= NOW() - INTERVAL '2 hours'
        GROUP BY hour_of_day
        ORDER BY hour_of_day DESC
        LIMIT 2
      `;

      const trendResult = await pool.query(trendQuery);
      const trends = trendResult.rows;

      let nextHourTrend: 'improving' | 'stable' | 'worsening' = 'stable';

      if (trends.length >= 2) {
        const speedDiff = Number(trends[0].avg_speed) - Number(trends[1].avg_speed);
        if (speedDiff > 5) nextHourTrend = 'improving';
        else if (speedDiff < -5) nextHourTrend = 'worsening';
      }

      // Check if rush hour
      const currentHour = new Date().getHours();
      const isRushHour = (currentHour >= 7 && currentHour <= 9) ||
                         (currentHour >= 17 && currentHour <= 19);

      // Estimate average travel time
      const travelTimeQuery = `
        SELECT ROUND(AVG(travel_time_minutes)) as avg_time
        FROM traffic_history
        WHERE time >= NOW() - INTERVAL '1 hour'
      `;

      const travelTimeResult = await pool.query(travelTimeQuery);
      const avgTravelTime = Number(travelTimeResult.rows[0]?.avg_time) || 15;

      // Confidence score based on data availability
      const confidenceQuery = `
        SELECT COUNT(*) as sample_count
        FROM traffic_history
        WHERE time >= NOW() - INTERVAL '1 hour'
      `;

      const confidenceResult = await pool.query(confidenceQuery);
      const sampleCount = Number(confidenceResult.rows[0]?.sample_count) || 0;
      const confidenceScore = Math.min(Math.round((sampleCount / 50) * 100), 100);

      return {
        next_hour_trend: nextHourTrend,
        rush_hour_active: isRushHour,
        estimated_avg_travel_time_minutes: avgTravelTime,
        confidence_score: confidenceScore
      };
    } catch (error) {
      logger.error('Error fetching predictive metrics:', error);
      throw error;
    }
  }

  /**
   * Get zone-specific insights
   */
  static async getZoneInsights(zoneId?: number): Promise<ZoneInsights[]> {
    try {
      const query = `
        SELECT
          z.id as zone_id,
          z.name as zone_name,
          ROUND(AVG(th.speed_kmh)) as avg_speed,
          MODE() WITHIN GROUP (ORDER BY th.congestion_level) as congestion_level,
          COUNT(DISTINCT th.road_id) as total_roads,
          COALESCE(a.risk_level, 'none') as arroyo_risk_level
        FROM zones z
        LEFT JOIN traffic_history th ON ST_Contains(z.geom, th.location::geometry)
          AND th.time >= NOW() - INTERVAL '1 hour'
        LEFT JOIN arroyos a ON ST_Intersects(z.geom, a.geom)
        ${zoneId ? 'WHERE z.id = $1' : ''}
        GROUP BY z.id, z.name, a.risk_level
        ORDER BY z.id
      `;

      const result = zoneId
        ? await pool.query(query, [zoneId])
        : await pool.query(query);

      const insights: ZoneInsights[] = await Promise.all(
        result.rows.map(async (row) => {
          // For now, use mock data for alerts (will be integrated with AlertService)
          const activeAlerts = 0;

          // Calculate travel time impact
          const historicalSpeed = 45; // Average historical speed for zone
          const currentSpeed = Number(row.avg_speed) || historicalSpeed;
          const travelTimeImpact = Math.round(((historicalSpeed - currentSpeed) / historicalSpeed) * 100);

          return {
            zone_id: row.zone_id,
            zone_name: row.zone_name,
            avg_speed: Number(row.avg_speed) || 0,
            congestion_level: row.congestion_level || 'low',
            total_roads: Number(row.total_roads) || 0,
            active_alerts: activeAlerts,
            arroyo_risk_level: row.arroyo_risk_level !== 'none' ? row.arroyo_risk_level : null,
            travel_time_impact_percentage: Math.max(travelTimeImpact, 0)
          };
        })
      );

      logger.info(`Retrieved insights for ${insights.length} zone(s)`);
      return insights;
    } catch (error) {
      logger.error('Error fetching zone insights:', error);
      throw error;
    }
  }

  /**
   * Get comparative metrics (current vs historical)
   */
  static async getComparativeMetrics(days: number = 30): Promise<ComparativeMetrics[]> {
    try {
      const metrics: ComparativeMetrics[] = [];

      // Average Speed Comparison
      const speedQuery = `
        SELECT
          ROUND(AVG(speed_kmh)) as current_speed
        FROM traffic_history
        WHERE time >= NOW() - INTERVAL '1 hour'
      `;

      const historicalSpeedQuery = `
        SELECT ROUND(AVG(speed_kmh)) as historical_speed
        FROM traffic_history
        WHERE time >= NOW() - INTERVAL '${days} days'
          AND time < NOW() - INTERVAL '1 day'
      `;

      const [speedResult, historicalSpeedResult] = await Promise.all([
        pool.query(speedQuery),
        pool.query(historicalSpeedQuery)
      ]);

      const currentSpeed = Number(speedResult.rows[0]?.current_speed) || 0;
      const historicalSpeed = Number(historicalSpeedResult.rows[0]?.historical_speed) || 0;
      const speedDiff = currentSpeed - historicalSpeed;
      const speedChangePercent = historicalSpeed !== 0
        ? Math.round((speedDiff / historicalSpeed) * 100)
        : 0;

      metrics.push({
        metric_name: 'Average Speed (km/h)',
        current_value: currentSpeed,
        historical_value: historicalSpeed,
        difference: Math.round(speedDiff * 10) / 10,
        percentage_change: speedChangePercent,
        trend: speedDiff > 2 ? 'up' : speedDiff < -2 ? 'down' : 'stable',
        is_favorable: speedDiff > 0 // Higher speed is better
      });

      // Travel Time Comparison
      const travelTimeQuery = `
        SELECT ROUND(AVG(travel_time_minutes)) as current_time
        FROM traffic_history
        WHERE time >= NOW() - INTERVAL '1 hour'
      `;

      const historicalTravelTimeQuery = `
        SELECT ROUND(AVG(travel_time_minutes)) as historical_time
        FROM traffic_history
        WHERE time >= NOW() - INTERVAL '${days} days'
          AND time < NOW() - INTERVAL '1 day'
      `;

      const [travelTimeResult, historicalTravelTimeResult] = await Promise.all([
        pool.query(travelTimeQuery),
        pool.query(historicalTravelTimeQuery)
      ]);

      const currentTime = Number(travelTimeResult.rows[0]?.current_time) || 0;
      const historicalTime = Number(historicalTravelTimeResult.rows[0]?.historical_time) || 0;
      const timeDiff = currentTime - historicalTime;
      const timeChangePercent = historicalTime !== 0
        ? Math.round((timeDiff / historicalTime) * 100)
        : 0;

      metrics.push({
        metric_name: 'Average Travel Time (minutes)',
        current_value: currentTime,
        historical_value: historicalTime,
        difference: Math.round(timeDiff * 10) / 10,
        percentage_change: timeChangePercent,
        trend: timeDiff > 1 ? 'up' : timeDiff < -1 ? 'down' : 'stable',
        is_favorable: timeDiff < 0 // Lower travel time is better
      });

      logger.info(`Generated ${metrics.length} comparative metrics`);
      return metrics;
    } catch (error) {
      logger.error('Error fetching comparative metrics:', error);
      throw error;
    }
  }
}
