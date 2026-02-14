import { Request, Response, NextFunction } from 'express';
import { TrafficService } from '@/services/trafficService';
import { logger } from '@/utils/logger';
import type { ApiResponse } from '@/types';

export class TrafficController {
  // GET /api/v1/traffic/realtime
  static async getRealTimeTraffic(req: Request, res: Response, next: NextFunction) {
    try {
      const traffic = await TrafficService.getRealTimeTraffic();

      const response: ApiResponse<typeof traffic> = {
        status: 'success',
        data: traffic,
        timestamp: new Date().toISOString(),
      };

      logger.info('Real-time traffic data retrieved successfully');
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/traffic/summary
  static async getTrafficSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await TrafficService.getTrafficSummary();

      const response: ApiResponse<typeof summary> = {
        status: 'success',
        data: summary,
        timestamp: new Date().toISOString(),
      };

      logger.info('Traffic summary retrieved successfully');
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/traffic/road/:id
  static async getTrafficByRoadId(req: Request, res: Response, next: NextFunction) {
    try {
      const roadId = parseInt(String(req.params.id), 10);

      if (isNaN(roadId)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid road ID',
          timestamp: new Date().toISOString(),
        });
      }

      const traffic = await TrafficService.getTrafficByRoadId(roadId);

      if (!traffic) {
        return res.status(404).json({
          status: 'error',
          message: `No traffic data found for road ID ${roadId}`,
          timestamp: new Date().toISOString(),
        });
      }

      const response: ApiResponse<typeof traffic> = {
        status: 'success',
        data: traffic,
        timestamp: new Date().toISOString(),
      };

      logger.info(`Traffic data for road ${roadId} retrieved successfully`);
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}