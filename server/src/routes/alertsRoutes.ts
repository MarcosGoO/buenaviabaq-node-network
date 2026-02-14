import { Router } from 'express';
import { AlertsController } from '@/controllers/alertsController.js';

const router = Router();

/**
 * GET /api/v1/alerts/active
 * Get all active alerts
 */
router.get('/active', AlertsController.getActiveAlerts);

/**
 * GET /api/v1/alerts/critical
 * Get only critical alerts
 */
router.get('/critical', AlertsController.getCriticalAlerts);

/**
 * GET /api/v1/alerts/summary
 * Get alert summary statistics
 */
router.get('/summary', AlertsController.getAlertsSummary);

/**
 * GET /api/v1/alerts/by-severity/:severity
 * Get alerts filtered by severity (low, medium, high, critical)
 */
router.get('/by-severity/:severity', AlertsController.getAlertsBySeverity);

/**
 * GET /api/v1/alerts/by-type/:type
 * Get alerts filtered by type
 */
router.get('/by-type/:type', AlertsController.getAlertsByType);

export default router;
