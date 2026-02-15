import { Router } from 'express';
import { InsightsController } from '@/controllers/insightsController.js';

const router = Router();

/**
 * Insights Routes
 * Sprint 6.1 - Dashboard Analytics
 *
 * GET    /api/v1/insights/summary           - Executive summary for dashboard
 * GET    /api/v1/insights/zones             - Insights for all zones
 * GET    /api/v1/insights/zones/:zone_id    - Insights for specific zone
 * GET    /api/v1/insights/comparative       - Comparative metrics (current vs historical)
 * POST   /api/v1/insights/clear-cache       - Clear insights cache
 */

// Executive summary endpoint
router.get('/summary', InsightsController.getExecutiveSummary);

// Zone insights endpoints
router.get('/zones', InsightsController.getZoneInsights);
router.get('/zones/:zone_id', InsightsController.getZoneInsights);

// Comparative metrics endpoint
router.get('/comparative', InsightsController.getComparativeMetrics);

// Cache management endpoint
router.post('/clear-cache', InsightsController.clearCache);

export default router;
