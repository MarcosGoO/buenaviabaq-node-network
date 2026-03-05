import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from '@/services/analyticsService.js';
import { TrafficHistoryService } from '@/services/trafficHistoryService.js';
import { logger } from '@/utils/logger.js';
import type { ApiResponse } from '@/types';

export class AnalyticsController {
  private static parsePositiveInt(value: string | undefined, defaultValue: number): number | null {
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed <= 0) return null;
    return parsed;
  }

  // GET /api/v1/analytics/traffic-patterns?road_id=1&days=30
  static async getTrafficPatterns(req: Request, res: Response, next: NextFunction) {
    try {
      const roadId = req.query.road_id
        ? AnalyticsController.parsePositiveInt(req.query.road_id as string, 0)
        : undefined;
      const days = AnalyticsController.parsePositiveInt(req.query.days as string | undefined, 30);

      if (roadId === null || days === null) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid parameter: road_id and days must be positive integers',
          timestamp: new Date().toISOString(),
        });
      }

      const patterns = await AnalyticsService.getTrafficPatterns(roadId || undefined, days);

      const response: ApiResponse<typeof patterns> = {
        status: 'success',
        data: patterns,
        timestamp: new Date().toISOString(),
      };

      logger.info('Traffic patterns retrieved successfully');
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/analytics/hotspots?limit=10&days=7
  static async getHotspots(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = AnalyticsController.parsePositiveInt(req.query.limit as string | undefined, 10);
      const days = AnalyticsController.parsePositiveInt(req.query.days as string | undefined, 7);

      if (limit === null || days === null) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid parameter: limit and days must be positive integers',
          timestamp: new Date().toISOString(),
        });
      }

      const hotspots = await AnalyticsService.getHotspots(limit, days);

      const response: ApiResponse<typeof hotspots> = {
        status: 'success',
        data: hotspots,
        timestamp: new Date().toISOString(),
      };

      logger.info(`Retrieved top ${limit} traffic hotspots`);
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/analytics/hourly-pattern?road_id=1
  static async getHourlyPattern(req: Request, res: Response, next: NextFunction) {
    try {
      const roadId = req.query.road_id ? parseInt(req.query.road_id as string, 10) : undefined;

      if (roadId && isNaN(roadId)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid road_id parameter',
          timestamp: new Date().toISOString(),
        });
      }

      const pattern = await AnalyticsService.getTodayHourlyPattern(roadId);

      const response: ApiResponse<typeof pattern> = {
        status: 'success',
        data: pattern,
        timestamp: new Date().toISOString(),
      };

      logger.info('Hourly traffic pattern retrieved successfully');
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/analytics/compare/:road_id
  static async compareToHistorical(req: Request, res: Response, next: NextFunction) {
    try {
      const roadId = parseInt(String(req.params.road_id), 10);

      if (isNaN(roadId)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid road ID',
          timestamp: new Date().toISOString(),
        });
      }

      const comparison = await AnalyticsService.compareToHistorical(roadId);

      if (!comparison) {
        return res.status(404).json({
          status: 'error',
          message: 'Insufficient data for comparison',
          timestamp: new Date().toISOString(),
        });
      }

      const response: ApiResponse<typeof comparison> = {
        status: 'success',
        data: comparison,
        timestamp: new Date().toISOString(),
      };

      logger.info(`Traffic comparison for road ${roadId} retrieved successfully`);
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/analytics/weather-impact?days=30
  static async getWeatherImpact(req: Request, res: Response, next: NextFunction) {
    try {
      const days = AnalyticsController.parsePositiveInt(req.query.days as string | undefined, 30);

      if (days === null) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid parameter: days must be a positive integer',
          timestamp: new Date().toISOString(),
        });
      }

      const impact = await AnalyticsService.getWeatherImpact(days);

      const response: ApiResponse<typeof impact> = {
        status: 'success',
        data: impact,
        timestamp: new Date().toISOString(),
      };

      logger.info('Weather impact analysis retrieved successfully');
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/analytics/rush-hour?road_id=1&days=30
  static async getRushHourStats(req: Request, res: Response, next: NextFunction) {
    try {
      const roadId = req.query.road_id
        ? AnalyticsController.parsePositiveInt(req.query.road_id as string, 0)
        : undefined;
      const days = AnalyticsController.parsePositiveInt(req.query.days as string | undefined, 30);

      if (roadId === null || days === null) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid parameter: road_id and days must be positive integers',
          timestamp: new Date().toISOString(),
        });
      }

      const stats = await AnalyticsService.getRushHourStats(roadId || undefined, days);

      const response: ApiResponse<typeof stats> = {
        status: 'success',
        data: stats,
        timestamp: new Date().toISOString(),
      };

      logger.info('Rush hour statistics retrieved successfully');
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/analytics/road-history/:road_id?start=2026-02-01&end=2026-02-13
  static async getRoadHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const roadId = parseInt(String(req.params.road_id), 10);
      const startTime = req.query.start as string || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const endTime = req.query.end as string || new Date().toISOString();

      if (isNaN(roadId)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid road ID',
          timestamp: new Date().toISOString(),
        });
      }

      const history = await TrafficHistoryService.getTrafficHistory(roadId, startTime, endTime);

      const response: ApiResponse<typeof history> = {
        status: 'success',
        data: history,
        timestamp: new Date().toISOString(),
      };

      logger.info(`Traffic history for road ${roadId} retrieved successfully`);
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/analytics/road-stats/:road_id?days=7
  static async getRoadStats(req: Request, res: Response, next: NextFunction) {
    try {
      const roadId = parseInt(String(req.params.road_id), 10);
      const days = req.query.days ? parseInt(req.query.days as string, 10) : 7;

      if (isNaN(roadId)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid road ID',
          timestamp: new Date().toISOString(),
        });
      }

      const stats = await TrafficHistoryService.getTrafficStats(roadId, days);

      const response: ApiResponse<typeof stats> = {
        status: 'success',
        data: stats,
        timestamp: new Date().toISOString(),
      };

      logger.info(`Traffic statistics for road ${roadId} retrieved successfully`);
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}
