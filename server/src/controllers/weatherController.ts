import { Request, Response, NextFunction } from 'express';
import { WeatherService } from '@/services/weatherService';
import { logger } from '@/utils/logger';
import type { ApiResponse } from '@/types';

export class WeatherController {
  // GET /api/v1/weather/current
  static async getCurrentWeather(req: Request, res: Response, next: NextFunction) {
    try {
      const weather = await WeatherService.getCurrentWeather();

      const response: ApiResponse<typeof weather> = {
        status: 'success',
        data: weather,
        timestamp: new Date().toISOString(),
      };

      logger.info('Weather data retrieved successfully');
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/weather/forecast
  static async getForecast(req: Request, res: Response, next: NextFunction) {
    try {
      const forecast = await WeatherService.getForecast();

      const response: ApiResponse<typeof forecast> = {
        status: 'success',
        data: forecast,
        timestamp: new Date().toISOString(),
      };

      logger.info('Forecast data retrieved successfully');
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}