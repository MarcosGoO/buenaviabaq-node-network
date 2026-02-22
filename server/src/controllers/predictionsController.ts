import { Request, Response, NextFunction } from 'express';
import { MLPredictionService } from '@/services/mlPredictionService.js';
import { AppError } from '@/middleware/errorHandler.js';

export class PredictionsController {
  /**
   * GET /api/v1/predictions/road/:id
   * Get traffic prediction for a specific road
   */
  static async getPredictionForRoad(req: Request, res: Response, next: NextFunction) {
    try {
      const idParam = req.params.id;
      if (typeof idParam !== 'string') {
        throw new AppError(400, 'Invalid road ID parameter');
      }

      const roadId = parseInt(idParam, 10);

      if (isNaN(roadId) || roadId <= 0) {
        throw new AppError(400, 'Invalid road ID');
      }

      const timestampParam = req.query.timestamp;
      const timestamp = timestampParam && typeof timestampParam === 'string'
        ? new Date(timestampParam)
        : undefined;

      const horizonParam = req.query.horizon;
      const horizon = horizonParam && typeof horizonParam === 'string'
        ? parseInt(horizonParam, 10)
        : undefined;

      // Check ML service health
      const isHealthy = await MLPredictionService.healthCheck();
      if (!isHealthy) {
        throw new AppError(503, 'ML service is unavailable');
      }

      const prediction = await MLPredictionService.predictTraffic(roadId, timestamp, horizon);

      if (!prediction) {
        throw new AppError(500, 'Failed to generate prediction');
      }

      res.json({
        status: 'success',
        data: prediction,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/predictions/road/:id/timeline
   * Get traffic prediction timeline for a specific road at different horizons
   */
  static async getPredictionTimelineForRoad(req: Request, res: Response, next: NextFunction) {
    try {
      const idParam = req.params.id;
      if (typeof idParam !== 'string') {
        throw new AppError(400, 'Invalid road ID parameter');
      }

      const roadId = parseInt(idParam, 10);

      if (isNaN(roadId) || roadId <= 0) {
        throw new AppError(400, 'Invalid road ID');
      }

      const timestampParam = req.query.timestamp;
      const timestamp = timestampParam && typeof timestampParam === 'string'
        ? new Date(timestampParam)
        : undefined;

      // Check ML service health
      const isHealthy = await MLPredictionService.healthCheck();
      if (!isHealthy) {
        throw new AppError(503, 'ML service is unavailable');
      }

      const horizons = [15, 30, 60, 120];
      const promises = horizons.map(h => MLPredictionService.predictTraffic(roadId, timestamp, h));
      const results = await Promise.all(promises);

      const timeline = horizons.map((h, index) => ({
        horizon_minutes: h,
        prediction: results[index]
      }));

      res.json({
        status: 'success',
        data: {
          road_id: roadId,
          timeline
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/predictions/batch
   * Get predictions for multiple roads
   *
   * Body:
   * - road_ids: array of road IDs
   * - timestamp (optional): prediction timestamp
   */
  static async getBatchPredictions(req: Request, res: Response, next: NextFunction) {
    try {
      const { road_ids, timestamp } = req.body;

      if (!Array.isArray(road_ids) || road_ids.length === 0) {
        throw new AppError(400, 'road_ids must be a non-empty array');
      }

      if (road_ids.length > 50) {
        throw new AppError(400, 'Maximum 50 roads per batch request');
      }

      // Validate road IDs
      const validRoadIds = road_ids
        .map(id => parseInt(id, 10))
        .filter(id => !isNaN(id) && id > 0);

      if (validRoadIds.length === 0) {
        throw new AppError(400, 'No valid road IDs provided');
      }

      const targetTime = timestamp ? new Date(timestamp) : undefined;

      // Check ML service health
      const isHealthy = await MLPredictionService.healthCheck();
      if (!isHealthy) {
        throw new AppError(503, 'ML service is unavailable');
      }

      const predictions = await MLPredictionService.predictBatch(validRoadIds, targetTime);

      res.json({
        status: 'success',
        data: {
          predictions,
          count: predictions.length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/predictions/all
   * Get predictions for all roads
   */
  static async getAllPredictions(req: Request, res: Response, next: NextFunction) {
    try {
      const timestampParam = req.query.timestamp;
      const timestamp = timestampParam && typeof timestampParam === 'string'
        ? new Date(timestampParam)
        : undefined;

      // Check ML service health
      const isHealthy = await MLPredictionService.healthCheck();
      if (!isHealthy) {
        throw new AppError(503, 'ML service is unavailable');
      }

      const predictions = await MLPredictionService.predictAllRoads(timestamp);

      res.json({
        status: 'success',
        data: {
          predictions,
          count: Object.keys(predictions).length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/predictions/health
   * Check ML service health
   */
  static async checkMLServiceHealth(req: Request, res: Response, next: NextFunction) {
    try {
      const isHealthy = await MLPredictionService.healthCheck();

      res.json({
        status: 'success',
        data: {
          ml_service_available: isHealthy,
          checked_at: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/predictions/road/:id/explanation
   * Get SHAP feature explanations for a road prediction
   */
  static async getExplanationForRoad(req: Request, res: Response, next: NextFunction) {
    try {
      const idParam = req.params.id;
      if (typeof idParam !== 'string') {
        throw new AppError(400, 'Invalid road ID parameter');
      }

      const roadId = parseInt(idParam, 10);
      if (isNaN(roadId) || roadId <= 0) {
        throw new AppError(400, 'Invalid road ID');
      }

      const timestampParam = req.query.timestamp;
      const timestamp = timestampParam && typeof timestampParam === 'string'
        ? new Date(timestampParam)
        : undefined;

      const isHealthy = await MLPredictionService.healthCheck();
      if (!isHealthy) {
        throw new AppError(503, 'ML service is unavailable');
      }

      const explanation = await MLPredictionService.getExplanation(roadId, timestamp);
      if (!explanation) {
        throw new AppError(500, 'Failed to generate SHAP explanation');
      }

      res.json({
        status: 'success',
        data: explanation,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/predictions/arroyo-risk
   * Get arroyo flood activation probability based on current weather forecast
   */
  static async getArroyoRisk(req: Request, res: Response, next: NextFunction) {
    try {
      const isHealthy = await MLPredictionService.healthCheck();
      if (!isHealthy) {
        throw new AppError(503, 'ML service is unavailable');
      }

      const riskData = await MLPredictionService.getArroyoRisk();
      if (!riskData) {
        throw new AppError(500, 'Failed to compute arroyo risk');
      }

      res.json({
        status: 'success',
        data: riskData,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
}
