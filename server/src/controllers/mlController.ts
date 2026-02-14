import { Request, Response, NextFunction } from 'express';
import { FeatureStoreService } from '@/services/featureStoreService.js';
import { logger } from '@/utils/logger.js';
import { AppError } from '@/middleware/errorHandler.js';

export class MLController {
  /**
   * GET /api/ml/features
   * Get stored features for training/evaluation
   *
   * Query params:
   * - road_id (optional): Filter by road ID
   * - start_time (optional): Start timestamp (ISO 8601)
   * - end_time (optional): End timestamp (ISO 8601)
   * - limit (optional): Max records to return (default: 1000, max: 10000)
   */
  static async getFeatures(req: Request, res: Response, next: NextFunction) {
    try {
      const roadId = req.query.road_id ? parseInt(req.query.road_id as string, 10) : undefined;
      const startTime = req.query.start_time ? new Date(req.query.start_time as string) : undefined;
      const endTime = req.query.end_time ? new Date(req.query.end_time as string) : undefined;
      const limit = Math.min(
        parseInt(req.query.limit as string, 10) || 1000,
        10000
      );

      // Validate road_id if provided
      if (roadId !== undefined && (isNaN(roadId) || roadId <= 0)) {
        throw new AppError(400, 'Invalid road_id parameter');
      }

      // Validate timestamps if provided
      if (startTime && isNaN(startTime.getTime())) {
        throw new AppError(400, 'Invalid start_time parameter');
      }
      if (endTime && isNaN(endTime.getTime())) {
        throw new AppError(400, 'Invalid end_time parameter');
      }

      const features = await FeatureStoreService.getFeatures(roadId, startTime, endTime, limit);

      res.json({
        status: 'success',
        data: {
          count: features.length,
          features,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/ml/features/extract
   * Extract features for a specific road at a given timestamp
   *
   * Body:
   * - road_id (required): Road ID
   * - timestamp (optional): Target timestamp (default: now)
   */
  static async extractFeatures(req: Request, res: Response, next: NextFunction) {
    try {
      const { road_id, timestamp } = req.body;

      if (!road_id) {
        throw new AppError(400, 'road_id is required');
      }

      const roadId = parseInt(road_id, 10);
      if (isNaN(roadId) || roadId <= 0) {
        throw new AppError(400, 'Invalid road_id');
      }

      const targetTime = timestamp ? new Date(timestamp) : new Date();
      if (isNaN(targetTime.getTime())) {
        throw new AppError(400, 'Invalid timestamp format');
      }

      const features = await FeatureStoreService.extractFeatures({
        roadId,
        timestamp: targetTime,
      });

      res.json({
        status: 'success',
        data: features,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/ml/features/store
   * Extract and store features for a road (for training data collection)
   *
   * Body:
   * - road_id (required): Road ID
   * - timestamp (optional): Target timestamp (default: now)
   * - target_speed (optional): Actual speed (for supervised learning)
   * - target_congestion (optional): Actual congestion level
   */
  static async storeFeatures(req: Request, res: Response, next: NextFunction) {
    try {
      const { road_id, timestamp, target_speed, target_congestion } = req.body;

      if (!road_id) {
        throw new AppError(400, 'road_id is required');
      }

      const roadId = parseInt(road_id, 10);
      if (isNaN(roadId) || roadId <= 0) {
        throw new AppError(400, 'Invalid road_id');
      }

      const targetTime = timestamp ? new Date(timestamp) : new Date();
      if (isNaN(targetTime.getTime())) {
        throw new AppError(400, 'Invalid timestamp format');
      }

      const targetSpeed = target_speed ? parseInt(target_speed, 10) : undefined;
      if (targetSpeed !== undefined && (isNaN(targetSpeed) || targetSpeed < 0)) {
        throw new AppError(400, 'Invalid target_speed');
      }

      await FeatureStoreService.storeFeatures(
        roadId,
        targetTime,
        targetSpeed,
        target_congestion
      );

      res.json({
        status: 'success',
        message: 'Features stored successfully',
        data: {
          road_id: roadId,
          timestamp: targetTime.toISOString(),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/ml/features/batch
   * Batch extract and store features for all roads
   *
   * Body:
   * - timestamp (optional): Target timestamp (default: now)
   */
  static async batchExtractFeatures(req: Request, res: Response, next: NextFunction) {
    try {
      const { timestamp } = req.body;

      const targetTime = timestamp ? new Date(timestamp) : undefined;
      if (targetTime && isNaN(targetTime.getTime())) {
        throw new AppError(400, 'Invalid timestamp format');
      }

      // Run batch extraction asynchronously
      FeatureStoreService.batchExtractFeatures(targetTime).catch(error => {
        logger.error('Batch feature extraction failed:', error);
      });

      res.json({
        status: 'success',
        message: 'Batch feature extraction started',
        data: {
          timestamp: (targetTime ?? new Date()).toISOString(),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/ml/features/stats
   * Get statistics about stored features
   */
  static async getFeatureStats(req: Request, res: Response, next: NextFunction) {
    try {
      const statsQuery = `
        SELECT
          COUNT(*) as total_records,
          COUNT(DISTINCT road_id) as unique_roads,
          MIN(timestamp) as earliest_record,
          MAX(timestamp) as latest_record,
          COUNT(*) FILTER (WHERE target_speed_kmh IS NOT NULL) as labeled_records,
          AVG(target_speed_kmh) as avg_speed,
          COUNT(*) FILTER (WHERE is_raining = TRUE) as rainy_records,
          COUNT(*) FILTER (WHERE event_nearby = TRUE) as event_records,
          COUNT(*) FILTER (WHERE arroyo_nearby = TRUE) as arroyo_records
        FROM ml_features
      `;

      const { pool } = await import('@/db/index.js');
      const result = await pool.query(statsQuery);
      const stats = result.rows[0];

      res.json({
        status: 'success',
        data: {
          total_records: parseInt(stats.total_records, 10),
          unique_roads: parseInt(stats.unique_roads, 10),
          earliest_record: stats.earliest_record,
          latest_record: stats.latest_record,
          labeled_records: parseInt(stats.labeled_records, 10),
          labeling_percentage: stats.total_records > 0
            ? ((parseInt(stats.labeled_records, 10) / parseInt(stats.total_records, 10)) * 100).toFixed(2)
            : 0,
          avg_speed: stats.avg_speed ? parseFloat(stats.avg_speed).toFixed(2) : null,
          rainy_records: parseInt(stats.rainy_records, 10),
          event_records: parseInt(stats.event_records, 10),
          arroyo_records: parseInt(stats.arroyo_records, 10),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
}