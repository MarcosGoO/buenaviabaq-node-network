import { Request, Response, NextFunction } from 'express';
import {
  InsightsService,
  ExecutiveSummary,
  ZoneInsights,
  ComparativeMetrics,
  DepartureAdvice,
} from '@/services/insightsService.js';
import { CacheService } from '@/services/cacheService.js';
import { logger } from '@/utils/logger.js';
import type { ApiResponse } from '@/types';

/**
 * InsightsController
 * Handles endpoints for dashboard analytics and insights
 * Dashboard Analytics
 */
export class InsightsController {
  /**
   * GET /api/v1/insights/summary
   * Get comprehensive executive summary for dashboard
   * Cached for 5 minutes
   */
  static async getExecutiveSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const cacheKey = 'executive-summary';
      const cacheTTL = 300;

      // Try to get from cache first
      const cached = await CacheService.get<ExecutiveSummary>(
        cacheKey,
        CacheService.Namespaces.INSIGHTS
      );
      if (cached) {
        res.locals.cacheHit = true;
        res.locals.cacheTTL = cacheTTL;
        logger.info('Executive summary retrieved from cache');
        const response: ApiResponse<ExecutiveSummary> = {
          status: 'success',
          data: cached,
          timestamp: new Date().toISOString(),
          cached: true
        };
        return res.json(response);
      }

      // Generate fresh summary
      const summary = await InsightsService.getExecutiveSummary();

      // Cache for 5 minutes (300 seconds)
      await CacheService.set(cacheKey, summary, cacheTTL, CacheService.Namespaces.INSIGHTS);
      res.locals.cacheHit = false;
      res.locals.cacheTTL = cacheTTL;

      const response: ApiResponse<typeof summary> = {
        status: 'success',
        data: summary,
        timestamp: new Date().toISOString(),
      };

      logger.info('Executive summary generated and cached successfully');
      res.json(response);
    } catch (error) {
      logger.error('Error generating executive summary:', error);
      next(error);
    }
  }

  /**
   * GET /api/v1/insights/zones/:zone_id?
   * Get zone-specific insights
   * If zone_id is provided, returns insights for that zone only
   * Otherwise returns insights for all zones
   * Cached for 5 minutes
   */
  static async getZoneInsights(req: Request, res: Response, next: NextFunction) {
    try {
      const zoneIdParam = req.params.zone_id;
      const zoneId = zoneIdParam && typeof zoneIdParam === 'string'
        ? parseInt(zoneIdParam, 10)
        : undefined;

      if (zoneId !== undefined && isNaN(zoneId)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid zone ID',
          timestamp: new Date().toISOString(),
        });
      }

      const cacheKey = zoneId
        ? `zone:${zoneId}`
        : 'zones:all';
      const cacheTTL = 300;

      // Try to get from cache first
      const cached = await CacheService.get<ZoneInsights[]>(
        cacheKey,
        CacheService.Namespaces.INSIGHTS
      );
      if (cached) {
        res.locals.cacheHit = true;
        res.locals.cacheTTL = cacheTTL;
        logger.info(`Zone insights retrieved from cache (zone_id: ${zoneId || 'all'})`);
        const response: ApiResponse<ZoneInsights[]> = {
          status: 'success',
          data: cached,
          timestamp: new Date().toISOString(),
          cached: true
        };
        return res.json(response);
      }

      // Generate fresh insights
      const insights = await InsightsService.getZoneInsights(zoneId);

      // Cache for 5 minutes
      await CacheService.set(cacheKey, insights, cacheTTL, CacheService.Namespaces.INSIGHTS);
      res.locals.cacheHit = false;
      res.locals.cacheTTL = cacheTTL;

      const response: ApiResponse<typeof insights> = {
        status: 'success',
        data: insights,
        timestamp: new Date().toISOString(),
      };

      logger.info(`Zone insights generated for ${insights.length} zone(s)`);
      res.json(response);
    } catch (error) {
      logger.error('Error fetching zone insights:', error);
      next(error);
    }
  }

  /**
   * GET /api/v1/insights/comparative?days=30
   * Get comparative metrics (current vs historical)
   * Cached for 10 minutes
   */
  static async getComparativeMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;

      if (isNaN(days) || days < 1 || days > 90) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid days parameter. Must be between 1 and 90',
          timestamp: new Date().toISOString(),
        });
      }

      const cacheKey = `comparative:days-${days}`;
      const cacheTTL = 600;

      // Try to get from cache first
      const cached = await CacheService.get<ComparativeMetrics[]>(
        cacheKey,
        CacheService.Namespaces.INSIGHTS
      );
      if (cached) {
        res.locals.cacheHit = true;
        res.locals.cacheTTL = cacheTTL;
        logger.info(`Comparative metrics retrieved from cache (days: ${days})`);
        const response: ApiResponse<ComparativeMetrics[]> = {
          status: 'success',
          data: cached,
          timestamp: new Date().toISOString(),
          cached: true
        };
        return res.json(response);
      }

      // Generate fresh metrics
      const metrics = await InsightsService.getComparativeMetrics(days);

      // Cache for 10 minutes (600 seconds)
      await CacheService.set(cacheKey, metrics, cacheTTL, CacheService.Namespaces.INSIGHTS);
      res.locals.cacheHit = false;
      res.locals.cacheTTL = cacheTTL;

      const response: ApiResponse<typeof metrics> = {
        status: 'success',
        data: metrics,
        timestamp: new Date().toISOString(),
      };

      logger.info(`Comparative metrics generated for ${days} days`);
      res.json(response);
    } catch (error) {
      logger.error('Error fetching comparative metrics:', error);
      next(error);
    }
  }

  /**
   * POST /api/v1/insights/clear-cache
   * Clear insights cache
   * Useful for testing or forcing fresh data
   */
  static async clearCache(req: Request, res: Response, next: NextFunction) {
    try {
      await CacheService.invalidateNamespace(CacheService.Namespaces.INSIGHTS);

      const response: ApiResponse<{ cleared: boolean }> = {
        status: 'success',
        data: { cleared: true },
        timestamp: new Date().toISOString(),
      };

      logger.info('Insights cache cleared successfully');
      res.json(response);
    } catch (error) {
      logger.error('Error clearing insights cache:', error);
      next(error);
    }
  }

  /**
   * GET /api/v1/insights/departure-advice?hours=3&interval=30
   * Recommend best departure window based on traffic/weather/alerts
   * Cached for 2 minutes
   */
  static async getDepartureAdvice(req: Request, res: Response, next: NextFunction) {
    try {
      const hours = req.query.hours ? parseInt(req.query.hours as string, 10) : 3;
      const interval = req.query.interval ? parseInt(req.query.interval as string, 10) : 30;

      if (isNaN(hours) || hours < 1 || hours > 12) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid hours parameter. Must be between 1 and 12',
          timestamp: new Date().toISOString(),
        });
      }

      if (isNaN(interval) || ![15, 30, 60].includes(interval)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid interval parameter. Must be one of: 15, 30, 60',
          timestamp: new Date().toISOString(),
        });
      }

      const cacheTTL = 120;
      const cacheKey = `departure-advice:h${hours}:i${interval}`;
      const cached = await CacheService.get<DepartureAdvice>(
        cacheKey,
        CacheService.Namespaces.INSIGHTS
      );

      if (cached) {
        res.locals.cacheHit = true;
        res.locals.cacheTTL = cacheTTL;
        const response: ApiResponse<DepartureAdvice> = {
          status: 'success',
          data: cached,
          timestamp: new Date().toISOString(),
          cached: true,
        };
        return res.json(response);
      }

      const advice = await InsightsService.getDepartureAdvice(hours, interval);
      await CacheService.set(cacheKey, advice, cacheTTL, CacheService.Namespaces.INSIGHTS);
      res.locals.cacheHit = false;
      res.locals.cacheTTL = cacheTTL;

      const response: ApiResponse<DepartureAdvice> = {
        status: 'success',
        data: advice,
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error) {
      logger.error('Error generating departure advice:', error);
      next(error);
    }
  }
}
