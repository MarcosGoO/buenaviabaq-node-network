import { pool } from '@/db/index.js';
import { logger } from '@/utils/logger.js';
import { WeatherService } from './weatherService.js';

export interface WeatherSnapshot {
  time: string;
  temperature: number;
  feels_like: number | null;
  humidity: number;
  pressure: number;
  wind_speed: number;
  wind_direction: number | null;
  condition: string;
  description: string | null;
  rain_1h: number;
  rain_probability: number;
  cloudiness: number;
  visibility: number | null;
}

export class WeatherHistoryService {
  /**
   * Store current weather snapshot in history
   */
  static async storeWeatherSnapshot(): Promise<void> {
    try {
      const weather = await WeatherService.getCurrentWeather();

      const query = `
        INSERT INTO weather_history (
          time,
          temperature,
          feels_like,
          humidity,
          pressure,
          wind_speed,
          wind_direction,
          condition,
          description,
          rain_1h,
          rain_probability,
          cloudiness,
          visibility
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (time) DO UPDATE SET
          temperature = EXCLUDED.temperature,
          feels_like = EXCLUDED.feels_like,
          humidity = EXCLUDED.humidity,
          pressure = EXCLUDED.pressure,
          wind_speed = EXCLUDED.wind_speed,
          wind_direction = EXCLUDED.wind_direction,
          condition = EXCLUDED.condition,
          description = EXCLUDED.description,
          rain_1h = EXCLUDED.rain_1h,
          rain_probability = EXCLUDED.rain_probability,
          cloudiness = EXCLUDED.cloudiness,
          visibility = EXCLUDED.visibility
      `;

      const values = [
        weather.timestamp.toISOString(),
        weather.temperature,
        weather.feels_like,
        weather.humidity,
        weather.pressure,
        weather.wind_speed,
        weather.wind_direction,
        weather.condition,
        weather.description,
        weather.rain_1h || 0,
        weather.rain_probability,
        weather.cloudiness,
        null, // visibility - not in current data model
      ];

      await pool.query(query, values);

      logger.info(`Stored weather snapshot at ${weather.timestamp.toISOString()}`);
    } catch (error) {
      logger.error('Error storing weather snapshot:', error);
      throw error;
    }
  }

  /**
   * Get weather history for a time range
   */
  static async getWeatherHistory(
    startTime: string,
    endTime: string
  ): Promise<WeatherSnapshot[]> {
    try {
      const query = `
        SELECT
          time,
          temperature,
          feels_like,
          humidity,
          pressure,
          wind_speed,
          wind_direction,
          condition,
          description,
          rain_1h,
          rain_probability,
          cloudiness,
          visibility
        FROM weather_history
        WHERE time >= $1 AND time <= $2
        ORDER BY time ASC
      `;

      const result = await pool.query(query, [startTime, endTime]);

      logger.info(`Retrieved ${result.rows.length} weather history records`);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching weather history:', error);
      throw error;
    }
  }

  /**
   * Get weather statistics for a time period
   */
  static async getWeatherStats(days: number = 7) {
    try {
      const query = `
        SELECT
          AVG(temperature) as avg_temp,
          MIN(temperature) as min_temp,
          MAX(temperature) as max_temp,
          AVG(humidity) as avg_humidity,
          AVG(wind_speed) as avg_wind_speed,
          SUM(rain_1h) as total_rainfall,
          COUNT(*) FILTER (WHERE rain_1h > 0) as rainy_hours,
          COUNT(*) as total_records
        FROM weather_history
        WHERE time >= NOW() - INTERVAL '${days} days'
      `;

      const result = await pool.query(query);

      logger.info(`Retrieved weather statistics for last ${days} days`);
      return result.rows[0];
    } catch (error) {
      logger.error('Error fetching weather stats:', error);
      throw error;
    }
  }

  /**
   * Get hourly weather pattern
   */
  static async getHourlyWeatherPattern(days: number = 30) {
    try {
      const query = `
        SELECT
          EXTRACT(HOUR FROM time) as hour,
          ROUND(AVG(temperature)) as avg_temp,
          ROUND(AVG(rain_probability)) as avg_rain_prob,
          COUNT(*) as sample_count
        FROM weather_history
        WHERE time >= NOW() - INTERVAL '${days} days'
        GROUP BY EXTRACT(HOUR FROM time)
        ORDER BY hour
      `;

      const result = await pool.query(query);

      logger.info('Retrieved hourly weather pattern');
      return result.rows;
    } catch (error) {
      logger.error('Error fetching hourly weather pattern:', error);
      throw error;
    }
  }
}
