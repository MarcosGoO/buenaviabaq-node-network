import { pool } from '@/db';
import { logger } from '@/utils/logger';
import { TrafficService } from './trafficService.js';
import { WeatherService } from './weatherService.js';
import { EventsService } from './eventsService.js';

export interface TrafficSnapshot {
  time: string;
  road_id: number;
  road_name: string;
  zone_id: number | null;
  congestion_level: 'low' | 'moderate' | 'high' | 'severe';
  speed_kmh: number;
  travel_time_minutes: number;
  vehicles_count: number | null;
  weather_condition: string | null;
  temperature: number | null;
  is_raining: boolean;
  event_nearby: boolean;
  day_of_week: number;
  hour_of_day: number;
  is_rush_hour: boolean;
}

export class TrafficHistoryService {
  // Store a traffic snapshot - called every 5-15 minutes by a background job
  static async storeTrafficSnapshot(): Promise<void> {
    try {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const hourOfDay = now.getHours();
      const isRushHour =
        (dayOfWeek >= 1 && dayOfWeek <= 5) &&
        ((hourOfDay >= 6 && hourOfDay <= 9) || (hourOfDay >= 17 && hourOfDay <= 20));

      // Get current traffic data
      const trafficData = await TrafficService.getRealTimeTraffic();

      // Get current weather
      const weather = await WeatherService.getCurrentWeather();

      // Get nearby events (simplified - check if any events are ongoing)
      const events = await EventsService.getUpcomingEvents();
      const hasNearbyEvent = events.some(e => e.status === 'ongoing');

      // Insert snapshot for each road
      const values = trafficData.map(road => [
        now.toISOString(),
        road.road_id,
        road.road_name,
        null, // zone_id - TODO: map roads to zones
        road.congestion_level,
        road.speed_kmh,
        road.travel_time_minutes,
        null, // vehicles_count - TODO: integrate with real data
        weather.condition,
        weather.temperature,
        weather.rain_probability > 50,
        hasNearbyEvent,
        dayOfWeek,
        hourOfDay,
        isRushHour,
      ]);

      const query = `
        INSERT INTO traffic_history (
          time, road_id, road_name, zone_id, congestion_level,
          speed_kmh, travel_time_minutes, vehicles_count,
          weather_condition, temperature, is_raining, event_nearby,
          day_of_week, hour_of_day, is_rush_hour
        ) VALUES ${values.map((_, i) => `($${i * 15 + 1}, $${i * 15 + 2}, $${i * 15 + 3}, $${i * 15 + 4}, $${i * 15 + 5}, $${i * 15 + 6}, $${i * 15 + 7}, $${i * 15 + 8}, $${i * 15 + 9}, $${i * 15 + 10}, $${i * 15 + 11}, $${i * 15 + 12}, $${i * 15 + 13}, $${i * 15 + 14}, $${i * 15 + 15})`).join(', ')}
        ON CONFLICT (time, road_id) DO NOTHING
      `;

      await pool.query(query, values.flat());

      logger.info(`Stored traffic snapshot for ${trafficData.length} roads at ${now.toISOString()}`);
    } catch (error) {
      logger.error('Error storing traffic snapshot:', error);
      throw error;
    }
  }

  // Get traffic history for a specific road
  static async getTrafficHistory(
    roadId: number,
    startTime: string,
    endTime: string
  ): Promise<TrafficSnapshot[]> {
    try {
      const query = `
        SELECT
          time,
          road_id,
          road_name,
          zone_id,
          congestion_level,
          speed_kmh,
          travel_time_minutes,
          vehicles_count,
          weather_condition,
          temperature,
          is_raining,
          event_nearby,
          day_of_week,
          hour_of_day,
          is_rush_hour
        FROM traffic_history
        WHERE road_id = $1
          AND time >= $2
          AND time <= $3
        ORDER BY time ASC
      `;

      const result = await pool.query(query, [roadId, startTime, endTime]);

      logger.info(`Retrieved ${result.rows.length} historical records for road ${roadId}`);
      return result.rows;
    } catch (error) {
      logger.error(`Error fetching traffic history for road ${roadId}:`, error);
      throw error;
    }
  }

  // Get aggregated statistics
  static async getTrafficStats(roadId: number, days: number = 7) {
    try {
      const query = `
        SELECT
          AVG(speed_kmh) as avg_speed,
          MIN(speed_kmh) as min_speed,
          MAX(speed_kmh) as max_speed,
          AVG(travel_time_minutes) as avg_travel_time,
          COUNT(*) as total_snapshots,
          COUNT(*) FILTER (WHERE congestion_level = 'severe') as severe_count,
          COUNT(*) FILTER (WHERE congestion_level = 'high') as high_count,
          COUNT(*) FILTER (WHERE is_raining = TRUE) as rainy_snapshots
        FROM traffic_history
        WHERE road_id = $1
          AND time >= NOW() - INTERVAL '${days} days'
      `;

      const result = await pool.query(query, [roadId]);

      logger.info(`Retrieved traffic statistics for road ${roadId}`);
      return result.rows[0];
    } catch (error) {
      logger.error(`Error fetching traffic stats for road ${roadId}:`, error);
      throw error;
    }
  }
}
