import { pool } from '@/db';
import { logger } from '@/utils/logger';

export interface TrafficPattern {
  hour_of_day: number;
  day_of_week: number;
  avg_speed: number;
  avg_congestion_level: string;
  sample_count: number;
}

export interface Hotspot {
  road_id: number;
  road_name: string;
  congestion_frequency: number;
  avg_speed: number;
  peak_hour: number;
  total_incidents: number;
}

export interface HourlyPattern {
  hour: number;
  avg_speed: number;
  congestion_level: string;
  traffic_volume: number;
}

export interface DailyComparison {
  current_avg_speed: number;
  historical_avg_speed: number;
  speed_difference: number;
  percentage_change: number;
  current_congestion_level: string;
  historical_congestion_level: string;
}

export class AnalyticsService {
  // Get traffic patterns by hour and day of week
  static async getTrafficPatterns(roadId?: number, days: number = 30) {
    try {
      const query = `
        SELECT
          hour_of_day,
          day_of_week,
          ROUND(AVG(speed_kmh)) as avg_speed,
          MODE() WITHIN GROUP (ORDER BY congestion_level) as avg_congestion_level,
          COUNT(*) as sample_count
        FROM traffic_history
        WHERE time >= NOW() - INTERVAL '${days} days'
          ${roadId ? 'AND road_id = $1' : ''}
        GROUP BY hour_of_day, day_of_week
        ORDER BY day_of_week, hour_of_day
      `;

      const result = roadId
        ? await pool.query(query, [roadId])
        : await pool.query(query);

      logger.info(`Retrieved traffic patterns for ${days} days`);
      return result.rows as TrafficPattern[];
    } catch (error) {
      logger.error('Error fetching traffic patterns:', error);
      throw error;
    }
  }

  // Get hotspots - roads with frequent congestion
  static async getHotspots(limit: number = 10, days: number = 7) {
    try {
      const query = `
        SELECT
          road_id,
          road_name,
          ROUND(
            (COUNT(*) FILTER (WHERE congestion_level IN ('high', 'severe'))::FLOAT /
            NULLIF(COUNT(*), 0)) * 100
          ) as congestion_frequency,
          ROUND(AVG(speed_kmh)) as avg_speed,
          MODE() WITHIN GROUP (ORDER BY hour_of_day) as peak_hour,
          COUNT(*) FILTER (WHERE congestion_level = 'severe') as total_incidents
        FROM traffic_history
        WHERE time >= NOW() - INTERVAL '${days} days'
        GROUP BY road_id, road_name
        ORDER BY congestion_frequency DESC
        LIMIT $1
      `;

      const result = await pool.query(query, [limit]);

      logger.info(`Retrieved top ${limit} traffic hotspots`);
      return result.rows as Hotspot[];
    } catch (error) {
      logger.error('Error fetching traffic hotspots:', error);
      throw error;
    }
  }

  // Get hourly traffic pattern for today
  static async getTodayHourlyPattern(roadId?: number) {
    try {
      const query = `
        SELECT
          hour_of_day as hour,
          ROUND(AVG(speed_kmh)) as avg_speed,
          MODE() WITHIN GROUP (ORDER BY congestion_level) as congestion_level,
          COUNT(*) as traffic_volume
        FROM traffic_history
        WHERE DATE(time) = CURRENT_DATE
          ${roadId ? 'AND road_id = $1' : ''}
        GROUP BY hour_of_day
        ORDER BY hour_of_day
      `;

      const result = roadId
        ? await pool.query(query, [roadId])
        : await pool.query(query);

      logger.info('Retrieved today\'s hourly traffic pattern');
      return result.rows as HourlyPattern[];
    } catch (error) {
      logger.error('Error fetching hourly pattern:', error);
      throw error;
    }
  }

  // Compare current traffic to historical average
  static async compareToHistorical(roadId: number) {
    try {
      const currentQuery = `
        SELECT
          ROUND(AVG(speed_kmh)) as current_avg_speed,
          MODE() WITHIN GROUP (ORDER BY congestion_level) as current_congestion_level
        FROM traffic_history
        WHERE road_id = $1
          AND time >= NOW() - INTERVAL '1 hour'
      `;

      const historicalQuery = `
        SELECT
          ROUND(AVG(speed_kmh)) as historical_avg_speed,
          MODE() WITHIN GROUP (ORDER BY congestion_level) as historical_congestion_level
        FROM traffic_history
        WHERE road_id = $1
          AND hour_of_day = EXTRACT(HOUR FROM NOW())
          AND day_of_week = EXTRACT(DOW FROM NOW())
          AND time >= NOW() - INTERVAL '30 days'
          AND time < NOW() - INTERVAL '1 day'
      `;

      const [currentResult, historicalResult] = await Promise.all([
        pool.query(currentQuery, [roadId]),
        pool.query(historicalQuery, [roadId]),
      ]);

      const current = currentResult.rows[0];
      const historical = historicalResult.rows[0];

      if (!current || !historical) {
        return null;
      }

      const speedDiff = current.current_avg_speed - historical.historical_avg_speed;
      const percentageChange = Math.round(
        (speedDiff / historical.historical_avg_speed) * 100
      );

      const comparison: DailyComparison = {
        current_avg_speed: current.current_avg_speed,
        historical_avg_speed: historical.historical_avg_speed,
        speed_difference: speedDiff,
        percentage_change: percentageChange,
        current_congestion_level: current.current_congestion_level,
        historical_congestion_level: historical.historical_congestion_level,
      };

      logger.info(`Compared current vs historical traffic for road ${roadId}`);
      return comparison;
    } catch (error) {
      logger.error(`Error comparing traffic for road ${roadId}:`, error);
      throw error;
    }
  }

  // Get weather impact on traffic
  static async getWeatherImpact(days: number = 30) {
    try {
      const query = `
        SELECT
          is_raining,
          ROUND(AVG(speed_kmh)) as avg_speed,
          MODE() WITHIN GROUP (ORDER BY congestion_level) as typical_congestion,
          COUNT(*) as sample_count,
          ROUND(AVG(travel_time_minutes)) as avg_travel_time
        FROM traffic_history
        WHERE time >= NOW() - INTERVAL '${days} days'
        GROUP BY is_raining
        ORDER BY is_raining
      `;

      const result = await pool.query(query);

      logger.info('Retrieved weather impact analysis');
      return result.rows;
    } catch (error) {
      logger.error('Error analyzing weather impact:', error);
      throw error;
    }
  }

  // Get rush hour statistics
  static async getRushHourStats(roadId?: number, days: number = 30) {
    try {
      const query = `
        SELECT
          is_rush_hour,
          ROUND(AVG(speed_kmh)) as avg_speed,
          ROUND(AVG(travel_time_minutes)) as avg_travel_time,
          MODE() WITHIN GROUP (ORDER BY congestion_level) as typical_congestion,
          COUNT(*) as sample_count
        FROM traffic_history
        WHERE time >= NOW() - INTERVAL '${days} days'
          ${roadId ? 'AND road_id = $1' : ''}
        GROUP BY is_rush_hour
        ORDER BY is_rush_hour DESC
      `;

      const result = roadId
        ? await pool.query(query, [roadId])
        : await pool.query(query);

      logger.info('Retrieved rush hour statistics');
      return result.rows;
    } catch (error) {
      logger.error('Error fetching rush hour stats:', error);
      throw error;
    }
  }
}
