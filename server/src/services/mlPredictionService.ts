import { logger } from '@/utils/logger.js';
import { CacheService } from './cacheService.js';
import { FeatureStoreService } from './featureStoreService.js';
import { GeoService } from './geoService.js';
import { WeatherService } from './weatherService.js';
import { PredictionEvaluationService } from './predictionEvaluationService.js';
import type { FeatureVector } from '@/types/index.js';

interface MLServiceConfig {
  baseUrl: string;
  timeout: number;
}

interface PredictionResponse {
  road_id: number;
  timestamp: string;
  predicted_speed_kmh: number;
  predicted_speed_lower: number | null;
  predicted_speed_upper: number | null;
  predicted_congestion_level: string;
  confidence_score: number | null;
  model_version: string;
  shap_values?: Record<string, number> | null;
}

interface ExplanationFeature {
  feature_name: string;
  shap_value: number;
  contribution: 'positive' | 'negative' | 'neutral';
}

export interface ExplanationResponse {
  road_id: number;
  timestamp: string;
  top_features: ExplanationFeature[];
  model_version: string;
}

interface ArroyoRiskEntry {
  arroyo_id: number;
  zone_name: string;
  activation_probability: number;
  risk_level: string;
}

export interface ArroyoRiskResponse {
  timestamp: string;
  weather_summary: Record<string, unknown>;
  arroyos: ArroyoRiskEntry[];
}

export interface ModelVersionEntry {
  version: string;
  model_type: string;
  metrics: Record<string, number> | null;
  trained_at: string | null;
  training_samples: number;
  file: string;
}

export interface ModelHistoryResponse {
  versions: ModelVersionEntry[];
  count: number;
  active_model_version: string | null;
}

interface MLHealthResponse {
  status: string;
  model_loaded: boolean;
  database_connected: boolean;
}

// Risk level to numeric encoding (mirrors Python feature store)
const ARROYO_RISK_ENCODED: Record<string, number> = {
  none: 0,
  low: 0.25,
  medium: 0.5,
  high: 0.75,
  critical: 1.0,
};

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
    timestamp?: Date,
    horizon?: number
  ): Promise<PredictionResponse | null> {
    const cacheKey = `ml-prediction:${roadId}:${timestamp?.toISOString() || 'now'}:h${horizon || 0}`;

    return await CacheService.getOrSet(
      cacheKey,
      async () => {
        try {
          const predictedAt = new Date();

          // Extract features
          const featureVector = await FeatureStoreService.extractFeatures({
            roadId,
            timestamp,
          });

          // Convert to flat structure expected by ML service
          const features = this.flattenFeatures(featureVector);
          if (horizon !== undefined) {
            features.horizon_minutes = horizon;
          }

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
          const zoneId = Number(featureVector.features.geography.zone_id);
          const safeZoneId = Number.isFinite(zoneId) ? zoneId : null;
          const horizonMinutes = typeof horizon === 'number' && Number.isFinite(horizon) ? horizon : null;
          const targetTime = horizonMinutes !== null
            ? new Date(predictedAt.getTime() + horizonMinutes * 60_000)
            : this.getPredictionTargetTime(prediction, predictedAt);

          void PredictionEvaluationService.recordPrediction({
            road_id: prediction.road_id,
            zone_id: safeZoneId,
            predicted_at: predictedAt,
            target_time: targetTime,
            horizon_minutes: horizonMinutes,
            predicted_speed_kmh: prediction.predicted_speed_kmh,
            model_version: prediction.model_version,
          });

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
      const predictedAt = new Date();

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

      const zoneByRoad = new Map<number, number | null>();
      for (const fv of featureVectors) {
        const zoneId = Number(fv.features.geography.zone_id);
        zoneByRoad.set(fv.road_id, Number.isFinite(zoneId) ? zoneId : null);
      }

      for (const pred of data.predictions) {
        const targetTime = this.getPredictionTargetTime(pred, predictedAt);
        void PredictionEvaluationService.recordPrediction({
          road_id: pred.road_id,
          zone_id: zoneByRoad.get(pred.road_id) ?? null,
          predicted_at: predictedAt,
          target_time: targetTime,
          horizon_minutes: null,
          predicted_speed_kmh: pred.predicted_speed_kmh,
          model_version: pred.model_version,
        });
      }

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
   * Get SHAP explanations for a specific road prediction
   */
  static async getExplanation(
    roadId: number,
    timestamp?: Date
  ): Promise<ExplanationResponse | null> {
    const cacheKey = `ml-explanation:${roadId}:${timestamp?.toISOString() || 'now'}`;

    return await CacheService.getOrSet(
      cacheKey,
      async () => {
        try {
          const featureVector = await FeatureStoreService.extractFeatures({ roadId, timestamp });
          const features = this.flattenFeatures(featureVector);

          const response = await fetch(`${this.config.baseUrl}/predict/explanation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ road_id: roadId, features }),
            signal: AbortSignal.timeout(this.config.timeout),
          });

          if (!response.ok) {
            const error = await response.text();
            throw new Error(`ML explanation error: ${response.status} - ${error}`);
          }

          return await response.json() as ExplanationResponse;
        } catch (error) {
          logger.error(`Failed to get explanation for road ${roadId}:`, error);
          return null;
        }
      },
      {
        ttl: CacheService.TTL.LONG,
        namespace: CacheService.Namespaces.PREDICTIONS,
      }
    );
  }

  /**
   * Get arroyo activation risk based on current weather forecast
   */
  static async getArroyoRisk(): Promise<ArroyoRiskResponse | null> {
    try {
      // Fetch weather forecast and arroyo zones in parallel
      const [forecast, arroyos] = await Promise.all([
        WeatherService.getForecast(),
        GeoService.getArroyoZones(),
      ]);

      // Extract next forecast item weather data
      const nextForecast = forecast?.forecast?.[0];
      const rainProb = nextForecast?.rain_probability ?? 0;
      const windSpeed = nextForecast?.wind_speed ?? 0;
      const humidity = nextForecast?.humidity ?? 50;
      const temperature = nextForecast?.temperature ?? null;

      const arroyoInputs = arroyos.map(a => ({
        arroyo_id: a.id,
        zone_name: a.name,
        base_risk_encoded: ARROYO_RISK_ENCODED[a.risk_level] ?? 0,
      }));

      const response = await fetch(`${this.config.baseUrl}/predict/arroyo-risk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rain_probability: rainProb,
          wind_speed: windSpeed,
          humidity,
          temperature,
          arroyos: arroyoInputs,
        }),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Arroyo risk error: ${response.status} - ${error}`);
      }

      return await response.json() as ArroyoRiskResponse;
    } catch (error) {
      logger.error('Failed to get arroyo risk:', error);
      return null;
    }
  }

  /**
   * Get model version history from ML service
   */
  static async getModelHistory(): Promise<ModelHistoryResponse | null> {
    try {
      const response = await fetch(`${this.config.baseUrl}/models/history`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Model history error: ${response.status} - ${error}`);
      }

      return await response.json() as ModelHistoryResponse;
    } catch (error) {
      logger.error('Failed to get model history:', error);
      return null;
    }
  }

  /**
   * Roll back the active model to a previous version
   */
  static async rollbackModel(version: string): Promise<{ status: string; message: string } | null> {
    try {
      const response = await fetch(`${this.config.baseUrl}/models/rollback/${encodeURIComponent(version)}`, {
        method: 'POST',
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Rollback error: ${response.status} - ${error}`);
      }

      return await response.json() as { status: string; message: string };
    } catch (error) {
      logger.error(`Failed to rollback model to version ${version}:`, error);
      return null;
    }
  }

  /**
   * Trigger model retraining
   * Returns metrics comparison: previous vs new model.
   */
  static async retrainModel(modelType = 'lightgbm'): Promise<{
    previous_metrics: Record<string, number> | null;
    new_metrics: Record<string, number> | null;
    model_version: string | null;
    action_taken: string;
  } | null> {
    try {
      // Fetch current model info first
      const infoRes = await fetch(`${this.config.baseUrl}/model/info`, {
        signal: AbortSignal.timeout(this.config.timeout),
      });
      const previousMetrics = infoRes.ok
        ? ((await infoRes.json() as { metrics?: { mae?: number; rmse?: number; r2?: number; mape?: number } }).metrics as Record<string, number> | null) ?? null
        : null;

      // Trigger retraining
      const trainRes = await fetch(`${this.config.baseUrl}/train`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_type: modelType, force_retrain: true }),
        signal: AbortSignal.timeout(60_000), // 60s for training
      });

      if (!trainRes.ok) {
        const error = await trainRes.text();
        throw new Error(`Retraining error: ${trainRes.status} - ${error}`);
      }

      const trainData = await trainRes.json() as {
        metrics?: Record<string, number>;
        model_version?: string;
      };

      const newMetrics = trainData.metrics ?? null;
      let actionTaken = 'swapped';

      // Evaluate improvement: if new MAE is >5% worse, rollback automatically
      if (previousMetrics?.mae && newMetrics?.mae) {
        const previousMae = previousMetrics.mae;
        const newMae = newMetrics.mae;
        if (newMae > previousMae * 1.05) {
          logger.warn(`New model MAE (${newMae}) is >5% worse than previous (${previousMae}). Rolling back.`);
          // Get latest versioned model (second newest = the previous one)
          const historyData = await this.getModelHistory();
          const previousVersion = historyData?.versions?.[1]?.version;
          if (previousVersion) {
            await this.rollbackModel(previousVersion);
            actionTaken = 'rolled_back';
          } else {
            actionTaken = 'kept_current';
          }
        } else if (newMae < previousMae * 0.98) {
          actionTaken = 'swapped'; // improvement > 2%
        } else {
          actionTaken = 'kept_current'; // marginal change
        }
      }

      return {
        previous_metrics: previousMetrics,
        new_metrics: newMetrics,
        model_version: trainData.model_version ?? null,
        action_taken: actionTaken,
      };
    } catch (error) {
      logger.error('Model retraining failed:', error);
      return null;
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

  private static getPredictionTargetTime(prediction: PredictionResponse, fallback: Date): Date {
    const parsed = new Date(prediction.timestamp);
    if (Number.isNaN(parsed.getTime())) {
      return fallback;
    }
    return parsed;
  }
}
