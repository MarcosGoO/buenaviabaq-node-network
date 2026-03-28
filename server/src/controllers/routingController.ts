import { Request, Response, NextFunction } from 'express';
import { RoutingService, RouteRequest } from '@/services/routingService.js';
import { CacheService } from '@/services/cacheService.js';
import { logger } from '@/utils/logger.js';
import type { ApiResponse } from '@/types';

/**
 * RoutingController
 * Handles endpoints for intelligent routing
 */
export class RoutingController {
  private static isValidCoordinate(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
  }

  private static hasValidCoordinates(routeRequest: RouteRequest): boolean {
    return RoutingController.isValidCoordinate(routeRequest.origin?.lat) &&
      RoutingController.isValidCoordinate(routeRequest.origin?.lng) &&
      RoutingController.isValidCoordinate(routeRequest.destination?.lat) &&
      RoutingController.isValidCoordinate(routeRequest.destination?.lng);
  }

  private static buildCacheKey(prefix: string, routeRequest: RouteRequest): string {
    const preferences = {
      avoid_arroyos: routeRequest.preferences?.avoid_arroyos ?? false,
      avoid_congestion: routeRequest.preferences?.avoid_congestion ?? false,
      avoid_events: routeRequest.preferences?.avoid_events ?? false,
      max_routes: routeRequest.preferences?.max_routes ?? 3,
    };

    return [
      prefix,
      `${routeRequest.origin.lat},${routeRequest.origin.lng}`,
      `${routeRequest.destination.lat},${routeRequest.destination.lng}`,
      JSON.stringify(preferences),
    ].join(':');
  }

  /**
   * POST /api/v1/routes/calculate
   * Calculate multiple route alternatives
   */
  static async calculateRoutes(req: Request, res: Response, next: NextFunction) {
    try {
      const routeRequest: RouteRequest = req.body;

      // Validate request
      if (!routeRequest.origin || !routeRequest.destination) {
        return res.status(400).json({
          status: 'error',
          message: 'Origin and destination are required',
          timestamp: new Date().toISOString(),
        });
      }

      if (!RoutingController.hasValidCoordinates(routeRequest)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid coordinates. lat and lng are required for origin and destination',
          timestamp: new Date().toISOString(),
        });
      }

      // Generate cache key based on coordinates
      const cacheKey = RoutingController.buildCacheKey('routes', routeRequest);
      const cacheTTL = 600;

      // Calculate routes (used to type the cache hit as well)
      type RouteList = Awaited<ReturnType<typeof RoutingService.calculateRoutes>>;

      const cached = await CacheService.get<RouteList>(cacheKey, CacheService.Namespaces.ROUTES);
      if (cached) {
        res.locals.cacheHit = true;
        res.locals.cacheTTL = cacheTTL;
        logger.info('Routes retrieved from cache');
        const response: ApiResponse<RouteList> = {
          status: 'success',
          data: cached,
          timestamp: new Date().toISOString(),
          cached: true
        };
        return res.json(response);
      }

      // Calculate routes
      const routes = await RoutingService.calculateRoutes(routeRequest);

      if (routes.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'No routes found for the specified origin and destination',
          timestamp: new Date().toISOString(),
        });
      }

      // Cache for 10 minutes (routes can change with traffic)
      await CacheService.set(cacheKey, routes, cacheTTL, CacheService.Namespaces.ROUTES);
      res.locals.cacheHit = false;
      res.locals.cacheTTL = cacheTTL;

      const response: ApiResponse<typeof routes> = {
        status: 'success',
        data: routes,
        timestamp: new Date().toISOString(),
      };

      logger.info(`Calculated ${routes.length} route alternatives`);
      res.json(response);
    } catch (error) {
      logger.error('Error calculating routes:', error);
      next(error);
    }
  }

  /**
   * POST /api/v1/routes/optimal
   * Get single best route (highest score)
   */
  static async getOptimalRoute(req: Request, res: Response, next: NextFunction) {
    try {
      const routeRequest: RouteRequest = req.body;

      // Validate request
      if (!routeRequest.origin || !routeRequest.destination) {
        return res.status(400).json({
          status: 'error',
          message: 'Origin and destination are required',
          timestamp: new Date().toISOString(),
        });
      }

      if (!RoutingController.hasValidCoordinates(routeRequest)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid coordinates. lat and lng are required for origin and destination',
          timestamp: new Date().toISOString(),
        });
      }

      // Generate cache key
      const cacheKey = RoutingController.buildCacheKey('optimal', routeRequest);
      const cacheTTL = 600;

      // Check cache
      type OptimalRoute = Awaited<ReturnType<typeof RoutingService.getOptimalRoute>>;
      const cached = await CacheService.get<OptimalRoute>(cacheKey, CacheService.Namespaces.ROUTES);
      if (cached) {
        res.locals.cacheHit = true;
        res.locals.cacheTTL = cacheTTL;
        logger.info('Optimal route retrieved from cache');
        const response: ApiResponse<OptimalRoute> = {
          status: 'success',
          data: cached,
          timestamp: new Date().toISOString(),
          cached: true
        };
        return res.json(response);
      }

      // Get optimal route
      const route = await RoutingService.getOptimalRoute(routeRequest);

      if (!route) {
        return res.status(404).json({
          status: 'error',
          message: 'No route found for the specified origin and destination',
          timestamp: new Date().toISOString(),
        });
      }

      // Cache for 10 minutes
      await CacheService.set(cacheKey, route, cacheTTL, CacheService.Namespaces.ROUTES);
      res.locals.cacheHit = false;
      res.locals.cacheTTL = cacheTTL;

      const response: ApiResponse<typeof route> = {
        status: 'success',
        data: route,
        timestamp: new Date().toISOString(),
      };

      logger.info(`Optimal route calculated with score: ${route.overall_score}`);
      res.json(response);
    } catch (error) {
      logger.error('Error getting optimal route:', error);
      next(error);
    }
  }

  /**
   * GET /api/v1/routes/example
   * Get example route request for testing
   */
  static async getExampleRoute(req: Request, res: Response, next: NextFunction) {
    try {
      // Example: From Centro to Norte Centro (Barranquilla)
      const exampleRequest: RouteRequest = {
        origin: {
          lat: 10.9878,
          lng: -74.7889
        },
        destination: {
          lat: 11.0189,
          lng: -74.8063
        },
        preferences: {
          avoid_arroyos: false,
          avoid_congestion: true,
          avoid_events: false,
          max_routes: 3
        }
      };

      const routes = await RoutingService.calculateRoutes(exampleRequest);

      const response: ApiResponse<{ request: RouteRequest; routes: typeof routes }> = {
        status: 'success',
        data: {
          request: exampleRequest,
          routes
        },
        timestamp: new Date().toISOString(),
      };

      logger.info('Example route generated');
      res.json(response);
    } catch (error) {
      logger.error('Error generating example route:', error);
      next(error);
    }
  }

  /**
   * POST /api/v1/routes/clear-cache
   * Clear routes cache
   */
  static async clearCache(req: Request, res: Response, next: NextFunction) {
    try {
      await CacheService.invalidateNamespace(CacheService.Namespaces.ROUTES);

      const response: ApiResponse<{ cleared: boolean }> = {
        status: 'success',
        data: { cleared: true },
        timestamp: new Date().toISOString(),
      };

      logger.info('Routes cache cleared successfully');
      res.json(response);
    } catch (error) {
      logger.error('Error clearing routes cache:', error);
      next(error);
    }
  }
}
