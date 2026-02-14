import { logger } from '@/utils/logger.js';
import { CacheService } from './cacheService.js';
import { FeatureStoreService } from './featureStoreService.js';
import type { FeatureVector } from '@/types/index.js';

interface MLServiceConfig {
  baseUrl: string;
  timeout: number;
}

interface PredictionResponse {
  road_id: number;
  timestamp: string;
  predicted_speed_kmh: number;
  predicted_congestion_level: string;
  confidence_score: number | null;
  model_version: string;
}

interface MLHealthResponse {
  status: string;
  model_loaded: boolean;
  database_connected: boolean;
}

/**
 * Service to communicate with Python ML microservice
 */
export class MLPredictionService {
  private static config: MLServiceConfig = {
    baseUrl: process.env.ML_SERVICE_URL || 'http://localhost:8000',
    timeout: 5000, // 5 seconds
  };

  /**
   * Check if ML service is healthy and ready
   */
  static async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json() as MLHealthResponse;
      return data.status === 'healthy' && data.model_loaded;
    } catch (error) {
      logger.error('ML service health check failed:', error);
      return false;
    }
  }

  /**
   * Get traffic prediction for a specific road
   */
  static async predictTraffic(
    roadId: number,
    timestamp?: Date
  ): Promise<PredictionResponse | null> {
    const cacheKey = `ml-prediction:${roadId}:${timestamp?.toISOString() || 'now'}`;

    return await CacheService.getOrSet(
      cacheKey,
      async () => {
        try {
          // Extract features
          const featureVector = await FeatureStoreService.extractFeatures({
            roadId,
            timestamp,
          });

          // Convert to flat structure expected by ML service
          const features = this.flattenFeatures(featureVector);

          // Call ML service
          const response = await fetch(`${this.config.baseUrl}/predict`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ features }),
            signal: AbortSignal.timeout(this.config.timeout),
          });

          if (!response.ok) {
            const error = await response.text();
            throw new Error(`ML service error: ${response.status} - ${error}`);
          }

          const prediction = await response.json() as PredictionResponse;
          return prediction;
        } catch (error) {
          logger.error(`Failed to get prediction for road ${roadId}:`, error);
          return null;
        }
      },
      {
        ttl: CacheService.TTL.LONG, // 15 minutes
        namespace: CacheService.Namespaces.PREDICTIONS,
      }
    );
  }

  /**
   * Get predictions for multiple roads
   */
  static async predictBatch(
    roadIds: number[],
    timestamp?: Date
  ): Promise<PredictionResponse[]> {
    try {
      // Extract features for all roads
      const featuresPromises = roadIds.map(roadId =>
        FeatureStoreService.extractFeatures({ roadId, timestamp })
      );

      const featureVectors = await Promise.all(featuresPromises);

      // Convert to flat structures
      const featuresList = featureVectors.map(fv => this.flattenFeatures(fv));

      // Call ML service batch endpoint
      const response = await fetch(`${this.config.baseUrl}/predict/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ features_list: featuresList }),
        signal: AbortSignal.timeout(this.config.timeout * 2), // Double timeout for batch
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`ML service batch error: ${response.status} - ${error}`);
      }

      const data = await response.json() as { predictions: PredictionResponse[] };
      return data.predictions;
    } catch (error) {
      logger.error('Batch prediction failed:', error);
      return [];
    }
  }

  /**
   * Get predictions for all roads in the system
   */
  static async predictAllRoads(timestamp?: Date): Promise<Record<number, PredictionResponse>> {
    const { pool } = await import('@/db/index.js');

    try {
      // Get all road IDs
      const result = await pool.query('SELECT id FROM geo.roads');
      const roadIds = result.rows.map(r => r.id as number);

      logger.info(`Generating predictions for ${roadIds.length} roads`);

      // Get batch predictions
      const predictions = await this.predictBatch(roadIds, timestamp);

      // Convert to map
      const predictionsMap: Record<number, PredictionResponse> = {};
      predictions.forEach(pred => {
        predictionsMap[pred.road_id] = pred;
      });

      return predictionsMap;
    } catch (error) {
      logger.error('Failed to predict all roads:', error);
      return {};
    }
  }

  /**
   * Convert FeatureVector to flat object expected by ML service
   */
  private static flattenFeatures(featureVector: FeatureVector): Record<string, unknown> {
    const { features, road_id, timestamp } = featureVector;

    return {
      road_id,
      timestamp: timestamp.toISOString(),

      // Temporal
      hour_of_day: features.temporal.hour_of_day,
      day_of_week: features.temporal.day_of_week,
      day_of_month: features.temporal.day_of_month,
      month: features.temporal.month,
      is_rush_hour: features.temporal.is_rush_hour,
      is_weekend: features.temporal.is_weekend,

      // Traffic
      avg_speed_historical: features.traffic.avg_speed_historical,
      avg_congestion_level_encoded: features.traffic.avg_congestion_encoded,
      traffic_std_deviation: features.traffic.std_deviation,

      // Weather
      temperature: features.weather.temperature,
      humidity: features.weather.humidity,
      wind_speed: features.weather.wind_speed,
      rain_probability: features.weather.rain_probability,
      weather_condition_encoded: features.weather.condition_encoded,
      is_raining: features.weather.is_raining,

      // Events
      event_nearby: features.events.nearby,
      event_type_encoded: features.events.type_encoded,
      event_distance_km: features.events.distance_km,

      // Geography
      zone_id: features.geography.zone_id,
      road_type_encoded: features.geography.road_type_encoded,
      lanes: features.geography.lanes,
      max_speed_kmh: features.geography.max_speed,

      // Arroyo
      arroyo_nearby: features.arroyo.nearby,
      arroyo_risk_level_encoded: features.arroyo.risk_encoded,
      arroyo_distance_km: features.arroyo.distance_km,
    };
  }
}
