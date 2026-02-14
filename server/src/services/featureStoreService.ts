import { pool } from '@/db/index.js';
import { logger } from '@/utils/logger.js';
import { WeatherService } from './weatherService.js';
import type { MLFeature, FeatureVector, FeatureExtractionOptions } from '@/types/index.js';

/**
 * FeatureStoreService - Extrae y almacena features para modelos ML
 *
 * Features incluidas:
 * - Temporales: hora, día de semana, rush hour, fin de semana
 * - Tráfico histórico: velocidad promedio, nivel de congestión, desviación estándar
 * - Clima: temperatura, humedad, viento, probabilidad de lluvia, condición
 * - Eventos: proximidad, tipo, distancia
 * - Geografía: zona, tipo de vía, carriles, velocidad máxima
 * - Arroyos: proximidad, nivel de riesgo, distancia
 */
export class FeatureStoreService {
  // Weather condition encoding
  private static readonly WEATHER_ENCODING: Record<string, number> = {
    'Clear': 0,
    'Clouds': 1,
    'Rain': 2,
    'Drizzle': 3,
    'Thunderstorm': 4,
    'Mist': 5,
    'Fog': 5,
    'Haze': 5,
  };

  // Event type encoding
  private static readonly EVENT_ENCODING: Record<string, number> = {
    'none': 0,
    'concert': 1,
    'festival': 2,
    'sports': 3,
    'maintenance': 4,
    'parade': 5,
    'protest': 6,
    'accident': 7,
  };

  // Road type encoding (based on common patterns in Barranquilla)
  private static readonly ROAD_TYPE_ENCODING: Record<string, number> = {
    'highway': 0,
    'autopista': 0,
    'avenue': 1,
    'avenida': 1,
    'street': 2,
    'calle': 2,
    'transversal': 3,
    'diagonal': 4,
    'carrera': 1,
  };

  // Congestion level encoding
  private static readonly CONGESTION_ENCODING: Record<string, number> = {
    'low': 0,
    'moderate': 0.33,
    'high': 0.66,
    'severe': 1,
  };

  // Arroyo risk level encoding
  private static readonly ARROYO_RISK_ENCODING: Record<string, number> = {
    'none': 0,
    'low': 0.25,
    'medium': 0.5,
    'high': 0.75,
    'critical': 1,
  };

  /**
   * Extract features for a specific road at a given timestamp
   */
  static async extractFeatures(options: FeatureExtractionOptions): Promise<FeatureVector> {
    const { roadId, timestamp = new Date() } = options;

    try {
      // Extract all feature groups in parallel
      const [temporal, traffic, weather, events, geography, arroyo] = await Promise.all([
        this.extractTemporalFeatures(timestamp),
        this.extractTrafficFeatures(roadId, timestamp),
        this.extractWeatherFeatures(),
        this.extractEventFeatures(roadId),
        this.extractGeographyFeatures(roadId),
        this.extractArroyoFeatures(roadId),
      ]);

      return {
        road_id: roadId,
        timestamp,
        features: {
          temporal,
          traffic,
          weather,
          events,
          geography,
          arroyo,
        },
      };
    } catch (error) {
      logger.error(`Failed to extract features for road ${roadId}:`, error);
      throw error;
    }
  }

  /**
   * Store features in the database for future training
   */
  static async storeFeatures(
    roadId: number,
    timestamp: Date,
    targetSpeed?: number,
    targetCongestion?: string
  ): Promise<void> {
    try {
      const features = await this.extractFeatures({ roadId, timestamp, includeTarget: true });

      const query = `
        INSERT INTO ml_features (
          road_id, timestamp,
          hour_of_day, day_of_week, day_of_month, month, is_rush_hour, is_weekend,
          avg_speed_historical, avg_congestion_level_encoded, traffic_std_deviation,
          temperature, humidity, wind_speed, rain_probability, weather_condition_encoded, is_raining,
          event_nearby, event_type_encoded, event_distance_km,
          zone_id, road_type_encoded, lanes, max_speed_kmh,
          arroyo_nearby, arroyo_risk_level_encoded, arroyo_distance_km,
          target_speed_kmh, target_congestion_level
        ) VALUES (
          $1, $2,
          $3, $4, $5, $6, $7, $8,
          $9, $10, $11,
          $12, $13, $14, $15, $16, $17,
          $18, $19, $20,
          $21, $22, $23, $24,
          $25, $26, $27,
          $28, $29
        )
        ON CONFLICT (road_id, timestamp) DO UPDATE SET
          target_speed_kmh = EXCLUDED.target_speed_kmh,
          target_congestion_level = EXCLUDED.target_congestion_level
      `;

      const { temporal, traffic, weather, events, geography, arroyo } = features.features;

      await pool.query(query, [
        roadId,
        timestamp,
        temporal.hour_of_day,
        temporal.day_of_week,
        temporal.day_of_month,
        temporal.month,
        temporal.is_rush_hour,
        temporal.is_weekend,
        traffic.avg_speed_historical,
        traffic.avg_congestion_encoded,
        traffic.std_deviation,
        weather.temperature,
        weather.humidity,
        weather.wind_speed,
        weather.rain_probability,
        weather.condition_encoded,
        weather.is_raining,
        events.nearby,
        events.type_encoded,
        events.distance_km,
        geography.zone_id,
        geography.road_type_encoded,
        geography.lanes,
        geography.max_speed,
        arroyo.nearby,
        arroyo.risk_encoded,
        arroyo.distance_km,
        targetSpeed,
        targetCongestion,
      ]);

      logger.info(`Stored features for road ${roadId} at ${timestamp.toISOString()}`);
    } catch (error) {
      logger.error(`Failed to store features for road ${roadId}:`, error);
      throw error;
    }
  }

  /**
   * Get stored features for training/evaluation
   */
  static async getFeatures(
    roadId?: number,
    startTime?: Date,
    endTime?: Date,
    limit: number = 1000
  ): Promise<MLFeature[]> {
    try {
      let query = 'SELECT * FROM ml_features WHERE 1=1';
      const params: unknown[] = [];

      if (roadId) {
        params.push(roadId);
        query += ` AND road_id = $${params.length}`;
      }

      if (startTime) {
        params.push(startTime);
        query += ` AND timestamp >= $${params.length}`;
      }

      if (endTime) {
        params.push(endTime);
        query += ` AND timestamp <= $${params.length}`;
      }

      query += ' ORDER BY timestamp DESC';

      params.push(limit);
      query += ` LIMIT $${params.length}`;

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get features:', error);
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE FEATURE EXTRACTION METHODS
  // ============================================================================

  /**
   * Extract temporal features from timestamp
   */
  private static extractTemporalFeatures(timestamp: Date) {
    const hour = timestamp.getHours();
    const dayOfWeek = timestamp.getDay(); // 0=Sunday, 6=Saturday
    const dayOfMonth = timestamp.getDate();
    const month = timestamp.getMonth() + 1; // 1-12
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Rush hour: weekdays 6-9am and 5-8pm
    const isRushHour =
      !isWeekend && ((hour >= 6 && hour <= 9) || (hour >= 17 && hour <= 20));

    return {
      hour_of_day: hour,
      day_of_week: dayOfWeek,
      day_of_month: dayOfMonth,
      month,
      is_rush_hour: isRushHour,
      is_weekend: isWeekend,
    };
  }

  /**
   * Extract historical traffic features for a road
   */
  private static async extractTrafficFeatures(roadId: number, timestamp: Date) {
    try {
      const hour = timestamp.getHours();
      const dayOfWeek = timestamp.getDay();

      // Get historical average for same hour and day of week (last 30 days)
      const query = `
        SELECT
          AVG(speed_kmh) as avg_speed,
          AVG(CASE
            WHEN congestion_level = 'low' THEN 0
            WHEN congestion_level = 'moderate' THEN 0.33
            WHEN congestion_level = 'high' THEN 0.66
            WHEN congestion_level = 'severe' THEN 1
          END) as avg_congestion,
          STDDEV(speed_kmh) as std_dev
        FROM traffic_history
        WHERE road_id = $1
          AND hour_of_day = $2
          AND day_of_week = $3
          AND time >= NOW() - INTERVAL '30 days'
          AND time < $4
      `;

      const result = await pool.query(query, [roadId, hour, dayOfWeek, timestamp]);
      const data = result.rows[0];

      return {
        avg_speed_historical: data.avg_speed ? parseFloat(data.avg_speed) : null,
        avg_congestion_encoded: data.avg_congestion ? parseFloat(data.avg_congestion) : null,
        std_deviation: data.std_dev ? parseFloat(data.std_dev) : null,
      };
    } catch (error) {
      logger.error(`Failed to extract traffic features for road ${roadId}:`, error);
      return {
        avg_speed_historical: null,
        avg_congestion_encoded: null,
        std_deviation: null,
      };
    }
  }

  /**
   * Extract current weather features
   */
  private static async extractWeatherFeatures() {
    try {
      const weather = await WeatherService.getCurrentWeather();

      return {
        temperature: weather.temperature,
        humidity: weather.humidity,
        wind_speed: weather.wind_speed,
        rain_probability: weather.rain_probability,
        condition_encoded: this.WEATHER_ENCODING[weather.condition] ?? 0,
        is_raining: weather.rain_probability > 50,
      };
    } catch (error) {
      logger.error('Failed to extract weather features:', error);
      return {
        temperature: null,
        humidity: null,
        wind_speed: null,
        rain_probability: null,
        condition_encoded: null,
        is_raining: false,
      };
    }
  }

  /**
   * Extract event features for a road
   */
  private static async extractEventFeatures(roadId: number) {
    try {
      // Get road geometry
      const roadQuery = 'SELECT ST_AsGeoJSON(geometry) as geom FROM geo.roads WHERE id = $1';
      const roadResult = await pool.query(roadQuery, [roadId]);

      if (roadResult.rows.length === 0) {
        return { nearby: false, type_encoded: 0, distance_km: null };
      }

      const roadGeom = roadResult.rows[0].geom;

      // Find nearest ongoing event
      const eventQuery = `
        SELECT
          event_type,
          ST_Distance(
            ST_Transform(geometry, 4326)::geography,
            ST_GeomFromGeoJSON($1)::geography
          ) / 1000 as distance_km
        FROM events
        WHERE status = 'ongoing'
          AND ST_DWithin(
            ST_Transform(geometry, 4326)::geography,
            ST_GeomFromGeoJSON($1)::geography,
            5000
          )
        ORDER BY distance_km ASC
        LIMIT 1
      `;

      const eventResult = await pool.query(eventQuery, [roadGeom]);

      if (eventResult.rows.length > 0) {
        const event = eventResult.rows[0];
        return {
          nearby: true,
          type_encoded: this.EVENT_ENCODING[event.event_type] ?? 0,
          distance_km: parseFloat(event.distance_km),
        };
      }

      return { nearby: false, type_encoded: 0, distance_km: null };
    } catch (error) {
      logger.error(`Failed to extract event features for road ${roadId}:`, error);
      return { nearby: false, type_encoded: 0, distance_km: null };
    }
  }

  /**
   * Extract geographic features for a road
   */
  private static async extractGeographyFeatures(roadId: number) {
    try {
      const query = `
        SELECT
          name,
          road_type,
          lanes,
          max_speed_kmh,
          metadata
        FROM geo.roads
        WHERE id = $1
      `;

      const result = await pool.query(query, [roadId]);

      if (result.rows.length === 0) {
        return {
          zone_id: null,
          road_type_encoded: null,
          lanes: null,
          max_speed: null,
        };
      }

      const road = result.rows[0];

      // Encode road type
      let roadTypeEncoded = 2; // default to 'street'
      const roadNameLower = road.name.toLowerCase();
      for (const [type, code] of Object.entries(this.ROAD_TYPE_ENCODING)) {
        if (roadNameLower.includes(type)) {
          roadTypeEncoded = code;
          break;
        }
      }

      return {
        zone_id: road.metadata?.zone_id ?? null,
        road_type_encoded: roadTypeEncoded,
        lanes: road.lanes,
        max_speed: road.max_speed_kmh,
      };
    } catch (error) {
      logger.error(`Failed to extract geography features for road ${roadId}:`, error);
      return {
        zone_id: null,
        road_type_encoded: null,
        lanes: null,
        max_speed: null,
      };
    }
  }

  /**
   * Extract arroyo proximity and risk features
   */
  private static async extractArroyoFeatures(roadId: number) {
    try {
      // Get road geometry
      const roadQuery = 'SELECT ST_AsGeoJSON(geometry) as geom FROM geo.roads WHERE id = $1';
      const roadResult = await pool.query(roadQuery, [roadId]);

      if (roadResult.rows.length === 0) {
        return { nearby: false, risk_encoded: 0, distance_km: null };
      }

      const roadGeom = roadResult.rows[0].geom;

      // Find nearest arroyo within 2km
      const arroyoQuery = `
        SELECT
          risk_level,
          ST_Distance(
            ST_Transform(geometry, 4326)::geography,
            ST_GeomFromGeoJSON($1)::geography
          ) / 1000 as distance_km
        FROM geo.arroyo_zones
        WHERE ST_DWithin(
          ST_Transform(geometry, 4326)::geography,
          ST_GeomFromGeoJSON($1)::geography,
          2000
        )
        ORDER BY distance_km ASC
        LIMIT 1
      `;

      const arroyoResult = await pool.query(arroyoQuery, [roadGeom]);

      if (arroyoResult.rows.length > 0) {
        const arroyo = arroyoResult.rows[0];
        return {
          nearby: true,
          risk_encoded: this.ARROYO_RISK_ENCODING[arroyo.risk_level] ?? 0,
          distance_km: parseFloat(arroyo.distance_km),
        };
      }

      return { nearby: false, risk_encoded: 0, distance_km: null };
    } catch (error) {
      logger.error(`Failed to extract arroyo features for road ${roadId}:`, error);
      return { nearby: false, risk_encoded: 0, distance_km: null };
    }
  }

  /**
   * Batch extract and store features for all roads
   */
  static async batchExtractFeatures(timestamp?: Date): Promise<void> {
    try {
      const targetTime = timestamp ?? new Date();

      // Get all roads
      const roadsResult = await pool.query('SELECT id FROM geo.roads');
      const roadIds = roadsResult.rows.map(r => r.id);

      logger.info(`Starting batch feature extraction for ${roadIds.length} roads`);

      // Extract features for each road (can be parallelized in production)
      for (const roadId of roadIds) {
        try {
          await this.storeFeatures(roadId, targetTime);
        } catch (error) {
          logger.error(`Failed to extract features for road ${roadId}:`, error);
          // Continue with next road
        }
      }

      logger.info(`Completed batch feature extraction for ${roadIds.length} roads`);
    } catch (error) {
      logger.error('Failed to batch extract features:', error);
      throw error;
    }
  }
}
