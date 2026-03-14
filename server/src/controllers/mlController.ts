import { Request, Response, NextFunction } from 'express';
import { FeatureStoreService } from '@/services/featureStoreService.js';
import { MLPredictionService } from '@/services/mlPredictionService.js';
import { PredictionEvaluationService } from '@/services/predictionEvaluationService.js';
import { PredictionDriftService } from '@/services/predictionDriftService.js';
import { ModelReliabilityService } from '@/services/modelReliabilityService.js';
import { ModelGovernanceService, type OperationalDecisionType } from '@/services/modelGovernanceService.js';
import { JobScheduler } from '@/jobs/scheduler.js';
import { logger } from '@/utils/logger.js';
import { AppError } from '@/middleware/errorHandler.js';

function parseIntInRange(value: unknown, fallback: number, min: number, max: number, field: string): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new AppError(400, `${field} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

function parseBooleanStrict(value: unknown, fallback = false): boolean {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  throw new AppError(400, 'force must be a boolean');
}

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

  /**
   * POST /api/v1/ml/retrain
   * Manually trigger model retraining
   */
  static async triggerRetrain(req: Request, res: Response, next: NextFunction) {
    try {
      const jobId = await JobScheduler.scheduleModelRetraining();
      logger.info(`Manual model retraining triggered, job: ${jobId}`);

      res.status(202).json({
        status: 'success',
        message: 'Model retraining job queued',
        data: {
          job_id: jobId,
          status: 'queued',
          note: 'Retraining runs asynchronously. Check model-history for results.',
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/ml/model-history
   * List all saved model versions with metrics
   */
  static async getModelHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const history = await MLPredictionService.getModelHistory();
      if (!history) {
        throw new AppError(503, 'ML service is unavailable');
      }

      res.json({
        status: 'success',
        data: history,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/ml/rollback/:version
   * Rollback the active model to a specific version
   */
  static async rollbackModel(req: Request, res: Response, next: NextFunction) {
    try {
      const { version } = req.params;
      if (!version || typeof version !== 'string') {
        throw new AppError(400, 'version parameter is required');
      }

      // Validate version format: YYYYMMDD_HHMMSS
      if (!/^\d{8}_\d{6}$/.test(version)) {
        throw new AppError(400, 'Invalid version format. Expected YYYYMMDD_HHMMSS (e.g. 20260221_030000)');
      }

      const result = await MLPredictionService.rollbackModel(version);
      if (!result) {
        throw new AppError(404, `Model version '${version}' not found or rollback failed`);
      }

      logger.info(`Model rolled back to version ${version}`);

      res.json({
        status: 'success',
        data: {
          version,
          ...result,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/ml/evaluation
   * Get temporal prediction quality metrics.
   */
  static async getEvaluation(req: Request, res: Response, next: NextFunction) {
    try {
      const daysRaw = typeof req.query.days === 'string' ? Number.parseInt(req.query.days, 10) : 14;
      const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(daysRaw, 90) : 14;

      const evaluation = await PredictionEvaluationService.getTemporalEvaluation(days);

      res.json({
        status: 'success',
        data: evaluation,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/ml/evaluation/sync-actuals
   * Sync observed speed values to compute error metrics.
   */
  static async syncEvaluationActuals(req: Request, res: Response, next: NextFunction) {
    try {
      const lookbackRaw = req.body?.lookback_hours !== undefined
        ? Number.parseInt(String(req.body.lookback_hours), 10)
        : 72;
      const toleranceRaw = req.body?.tolerance_minutes !== undefined
        ? Number.parseInt(String(req.body.tolerance_minutes), 10)
        : 30;

      if (!Number.isFinite(lookbackRaw) || lookbackRaw <= 0 || lookbackRaw > 24 * 30) {
        throw new AppError(400, 'lookback_hours must be an integer between 1 and 720');
      }

      if (!Number.isFinite(toleranceRaw) || toleranceRaw <= 0 || toleranceRaw > 180) {
        throw new AppError(400, 'tolerance_minutes must be an integer between 1 and 180');
      }

      const result = await PredictionEvaluationService.syncActualValues(lookbackRaw, toleranceRaw);

      res.json({
        status: 'success',
        data: {
          ...result,
          lookback_hours: lookbackRaw,
          tolerance_minutes: toleranceRaw,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/ml/drift-status
   * Get model drift status comparing recent vs baseline prediction quality.
   */
  static async getDriftStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const recentHoursRaw = typeof req.query.recent_hours === 'string'
        ? Number.parseInt(req.query.recent_hours, 10)
        : 24;
      const baselineDaysRaw = typeof req.query.baseline_days === 'string'
        ? Number.parseInt(req.query.baseline_days, 10)
        : 30;
      const minSamplesRaw = typeof req.query.min_samples === 'string'
        ? Number.parseInt(req.query.min_samples, 10)
        : 40;

      if (!Number.isFinite(recentHoursRaw) || recentHoursRaw < 1 || recentHoursRaw > 24 * 14) {
        throw new AppError(400, 'recent_hours must be an integer between 1 and 336');
      }
      if (!Number.isFinite(baselineDaysRaw) || baselineDaysRaw < 1 || baselineDaysRaw > 365) {
        throw new AppError(400, 'baseline_days must be an integer between 1 and 365');
      }
      if (!Number.isFinite(minSamplesRaw) || minSamplesRaw < 1 || minSamplesRaw > 10000) {
        throw new AppError(400, 'min_samples must be an integer between 1 and 10000');
      }

      const driftStatus = await PredictionDriftService.getDriftStatus(
        recentHoursRaw,
        baselineDaysRaw,
        minSamplesRaw
      );

      res.json({
        status: 'success',
        data: driftStatus,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/ml/drift-status/check
   * Force sync + drift evaluation immediately (admin only).
   */
  static async checkDriftNow(req: Request, res: Response, next: NextFunction) {
    try {
      const recentHoursRaw = req.body?.recent_hours !== undefined
        ? Number.parseInt(String(req.body.recent_hours), 10)
        : 24;
      const baselineDaysRaw = req.body?.baseline_days !== undefined
        ? Number.parseInt(String(req.body.baseline_days), 10)
        : 30;
      const minSamplesRaw = req.body?.min_samples !== undefined
        ? Number.parseInt(String(req.body.min_samples), 10)
        : 40;
      const lookbackHoursRaw = req.body?.lookback_hours !== undefined
        ? Number.parseInt(String(req.body.lookback_hours), 10)
        : 72;
      const toleranceMinutesRaw = req.body?.tolerance_minutes !== undefined
        ? Number.parseInt(String(req.body.tolerance_minutes), 10)
        : 30;

      if (!Number.isFinite(recentHoursRaw) || recentHoursRaw < 1 || recentHoursRaw > 24 * 14) {
        throw new AppError(400, 'recent_hours must be an integer between 1 and 336');
      }
      if (!Number.isFinite(baselineDaysRaw) || baselineDaysRaw < 1 || baselineDaysRaw > 365) {
        throw new AppError(400, 'baseline_days must be an integer between 1 and 365');
      }
      if (!Number.isFinite(minSamplesRaw) || minSamplesRaw < 1 || minSamplesRaw > 10000) {
        throw new AppError(400, 'min_samples must be an integer between 1 and 10000');
      }
      if (!Number.isFinite(lookbackHoursRaw) || lookbackHoursRaw < 1 || lookbackHoursRaw > 720) {
        throw new AppError(400, 'lookback_hours must be an integer between 1 and 720');
      }
      if (!Number.isFinite(toleranceMinutesRaw) || toleranceMinutesRaw < 1 || toleranceMinutesRaw > 180) {
        throw new AppError(400, 'tolerance_minutes must be an integer between 1 and 180');
      }

      const sync = await PredictionEvaluationService.syncActualValues(lookbackHoursRaw, toleranceMinutesRaw);
      const drift = await PredictionDriftService.getDriftStatus(
        recentHoursRaw,
        baselineDaysRaw,
        minSamplesRaw
      );

      res.json({
        status: 'success',
        data: {
          forced_check: true,
          sync,
          drift,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/ml/reliability/overview
   * Operational reliability aggregate for recent days.
   */
  static async getReliabilityOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const days = parseIntInRange(req.query.days, 30, 1, 90, 'days');
      const overview = await ModelReliabilityService.getOverview(days);

      res.json({
        status: 'success',
        data: overview,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/ml/reliability/incidents
   * List drift incidents (open/closed/all).
   */
  static async getReliabilityIncidents(req: Request, res: Response, next: NextFunction) {
    try {
      const statusRaw = typeof req.query.status === 'string' ? req.query.status : 'open';
      const status = ['open', 'closed', 'all'].includes(statusRaw) ? statusRaw as 'open' | 'closed' | 'all' : null;
      if (!status) {
        throw new AppError(400, 'status must be one of: open, closed, all');
      }

      const limit = parseIntInRange(req.query.limit, 50, 1, 200, 'limit');
      const incidents = await ModelReliabilityService.getIncidents({ status, limit });

      res.json({
        status: 'success',
        data: {
          count: incidents.length,
          incidents,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/ml/reliability/decisions
   * List governance decisions in a bounded window.
   */
  static async getReliabilityDecisions(req: Request, res: Response, next: NextFunction) {
    try {
      const days = parseIntInRange(req.query.days, 30, 1, 90, 'days');
      const decisions = await ModelReliabilityService.getDecisions(days);

      res.json({
        status: 'success',
        data: {
          count: decisions.length,
          decisions,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/ml/reliability/check-now
   * Force sync + drift + governance recommendation + incident upsert.
   */
  static async checkReliabilityNow(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ModelReliabilityService.runReliabilityCheckNow({
        lookbackHours: parseIntInRange(req.body?.lookback_hours, 72, 1, 720, 'lookback_hours'),
        toleranceMinutes: parseIntInRange(req.body?.tolerance_minutes, 30, 1, 180, 'tolerance_minutes'),
        recentHours: parseIntInRange(req.body?.recent_hours, 24, 1, 336, 'recent_hours'),
        baselineDays: parseIntInRange(req.body?.baseline_days, 30, 1, 365, 'baseline_days'),
        minSamples: parseIntInRange(req.body?.min_samples, 40, 1, 10000, 'min_samples'),
        governanceDays: parseIntInRange(req.body?.governance_days, 30, 7, 90, 'governance_days'),
      });

      res.json({
        status: 'success',
        data: {
          forced_check: true,
          ...result,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/ml/reliability/execute-decision
   * Execute persisted decision or manual override decision.
   */
  static async executeReliabilityDecision(req: Request, res: Response, next: NextFunction) {
    try {
      const decisionId = req.body?.decision_id !== undefined
        ? parseIntInRange(req.body.decision_id, 0, 1, Number.MAX_SAFE_INTEGER, 'decision_id')
        : undefined;
      const decisionTypeRaw = req.body?.decision_type as string | undefined;
      const modelVersion = req.body?.model_version as string | undefined;
      const force = parseBooleanStrict(req.body?.force, false);

      const validTypes: OperationalDecisionType[] = ['keep', 'watch', 'retrain', 'rollback'];
      const decisionType = decisionTypeRaw
        ? (validTypes.includes(decisionTypeRaw as OperationalDecisionType)
            ? decisionTypeRaw as OperationalDecisionType
            : null)
        : undefined;

      if (decisionTypeRaw && !decisionType) {
        throw new AppError(400, 'decision_type must be one of: keep, watch, retrain, rollback');
      }
      if (decisionId === undefined && decisionType === undefined) {
        throw new AppError(400, 'decision_id or decision_type is required');
      }

      const execution = await ModelGovernanceService.executeDecision({
        decisionId,
        decisionType,
        modelVersion,
        force,
      });

      if (!execution.executed) {
        if (execution.action === 'blocked_by_policy') {
          throw new AppError(403, String(execution.details.message ?? 'Decision execution blocked by policy'));
        }
        if (execution.action === 'decision_not_found') {
          throw new AppError(404, 'Decision not found');
        }
        throw new AppError(400, `Decision could not be executed: ${execution.action}`);
      }

      res.json({
        status: 'success',
        data: execution,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
}
