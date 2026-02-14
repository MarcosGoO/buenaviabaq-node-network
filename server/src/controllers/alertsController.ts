import { Request, Response } from 'express';
import { AlertService, AlertType, AlertSeverity } from '@/services/alertService.js';
import { logger } from '@/utils/logger.js';
import { CacheService } from '@/services/cacheService.js';

export class AlertsController {
  /**
   * GET /api/v1/alerts/active
   * Get all active alerts
   */
  static async getActiveAlerts(req: Request, res: Response) {
    try {
      const cacheKey = 'alerts:active';
      const cached = await CacheService.get<unknown>(cacheKey, CacheService.Namespaces.ALERTS);

      if (cached) {
        logger.debug('Returning cached active alerts');
        return res.json(cached);
      }

      const allAlerts = await AlertService.detectActiveAlerts();
      const activeAlerts = AlertService.getActiveAlerts(allAlerts);

      const response = {
        success: true,
        timestamp: new Date().toISOString(),
        count: activeAlerts.length,
        alerts: activeAlerts,
      };

      // Cache for 2 minutes (alerts are time-sensitive)
      await CacheService.set(cacheKey, response, 120, CacheService.Namespaces.ALERTS);

      res.json(response);
    } catch (error) {
      logger.error('Error getting active alerts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch active alerts',
      });
    }
  }

  /**
   * GET /api/v1/alerts/by-severity/:severity
   * Get alerts filtered by severity
   */
  static async getAlertsBySeverity(req: Request, res: Response) {
    try {
      const { severity } = req.params;

      // Validate severity
      if (!Object.values(AlertSeverity).includes(severity as AlertSeverity)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid severity. Must be one of: low, medium, high, critical',
        });
      }

      const cacheKey = `alerts:severity:${severity}`;
      const cached = await CacheService.get<unknown>(cacheKey, CacheService.Namespaces.ALERTS);

      if (cached) {
        logger.debug(`Returning cached alerts for severity: ${severity}`);
        return res.json(cached);
      }

      const allAlerts = await AlertService.detectActiveAlerts();
      const activeAlerts = AlertService.getActiveAlerts(allAlerts);
      const filteredAlerts = AlertService.filterBySeverity(
        activeAlerts,
        severity as AlertSeverity
      );

      const response = {
        success: true,
        timestamp: new Date().toISOString(),
        severity,
        count: filteredAlerts.length,
        alerts: filteredAlerts,
      };

      await CacheService.set(cacheKey, response, 120, CacheService.Namespaces.ALERTS);

      res.json(response);
    } catch (error) {
      logger.error('Error getting alerts by severity:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch alerts',
      });
    }
  }

  /**
   * GET /api/v1/alerts/by-type/:type
   * Get alerts filtered by type
   */
  static async getAlertsByType(req: Request, res: Response) {
    try {
      const { type } = req.params;

      // Validate type
      if (!Object.values(AlertType).includes(type as AlertType)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid alert type. Must be one of: arroyo_flood_risk, severe_congestion, weather_traffic_impact, event_traffic_impact',
        });
      }

      const cacheKey = `alerts:type:${type}`;
      const cached = await CacheService.get<unknown>(cacheKey, CacheService.Namespaces.ALERTS);

      if (cached) {
        logger.debug(`Returning cached alerts for type: ${type}`);
        return res.json(cached);
      }

      const allAlerts = await AlertService.detectActiveAlerts();
      const activeAlerts = AlertService.getActiveAlerts(allAlerts);
      const filteredAlerts = AlertService.filterByType(activeAlerts, type as AlertType);

      const response = {
        success: true,
        timestamp: new Date().toISOString(),
        type,
        count: filteredAlerts.length,
        alerts: filteredAlerts,
      };

      await CacheService.set(cacheKey, response, 120, CacheService.Namespaces.ALERTS);

      res.json(response);
    } catch (error) {
      logger.error('Error getting alerts by type:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch alerts',
      });
    }
  }

  /**
   * GET /api/v1/alerts/critical
   * Get only critical alerts (shortcut endpoint)
   */
  static async getCriticalAlerts(req: Request, res: Response) {
    try {
      const cacheKey = 'alerts:critical';
      const cached = await CacheService.get<unknown>(cacheKey, CacheService.Namespaces.ALERTS);

      if (cached) {
        logger.debug('Returning cached critical alerts');
        return res.json(cached);
      }

      const allAlerts = await AlertService.detectActiveAlerts();
      const activeAlerts = AlertService.getActiveAlerts(allAlerts);
      const criticalAlerts = AlertService.filterBySeverity(activeAlerts, AlertSeverity.CRITICAL);

      const response = {
        success: true,
        timestamp: new Date().toISOString(),
        count: criticalAlerts.length,
        alerts: criticalAlerts,
      };

      await CacheService.set(cacheKey, response, 60, CacheService.Namespaces.ALERTS);

      res.json(response);
    } catch (error) {
      logger.error('Error getting critical alerts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch critical alerts',
      });
    }
  }

  /**
   * GET /api/v1/alerts/summary
   * Get alert summary statistics
   */
  static async getAlertsSummary(req: Request, res: Response) {
    try {
      const cacheKey = 'alerts:summary';
      const cached = await CacheService.get<unknown>(cacheKey, CacheService.Namespaces.ALERTS);

      if (cached) {
        logger.debug('Returning cached alerts summary');
        return res.json(cached);
      }

      const allAlerts = await AlertService.detectActiveAlerts();
      const activeAlerts = AlertService.getActiveAlerts(allAlerts);

      const summary = {
        total: activeAlerts.length,
        bySeverity: {
          critical: AlertService.filterBySeverity(activeAlerts, AlertSeverity.CRITICAL).length,
          high: AlertService.filterBySeverity(activeAlerts, AlertSeverity.HIGH).length,
          medium: AlertService.filterBySeverity(activeAlerts, AlertSeverity.MEDIUM).length,
          low: AlertService.filterBySeverity(activeAlerts, AlertSeverity.LOW).length,
        },
        byType: {
          arroyo_flood_risk: AlertService.filterByType(activeAlerts, AlertType.ARROYO_FLOOD_RISK).length,
          severe_congestion: AlertService.filterByType(activeAlerts, AlertType.SEVERE_CONGESTION).length,
          weather_traffic_impact: AlertService.filterByType(activeAlerts, AlertType.WEATHER_TRAFFIC_IMPACT).length,
          event_traffic_impact: AlertService.filterByType(activeAlerts, AlertType.EVENT_TRAFFIC_IMPACT).length,
        },
      };

      const response = {
        success: true,
        timestamp: new Date().toISOString(),
        summary,
      };

      await CacheService.set(cacheKey, response, 120, CacheService.Namespaces.ALERTS);

      res.json(response);
    } catch (error) {
      logger.error('Error getting alerts summary:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch alerts summary',
      });
    }
  }
}
