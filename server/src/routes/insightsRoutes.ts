import { Router } from 'express';
import { InsightsController } from '@/controllers/insightsController.js';

const router = Router();

/**
 * Insights Routes
 *
 * GET    /api/v1/insights/summary           - Executive summary for dashboard
 * GET    /api/v1/insights/zones             - Insights for all zones
 * GET    /api/v1/insights/zones/:zone_id    - Insights for specific zone
 * GET    /api/v1/insights/comparative       - Comparative metrics (current vs historical)
 * GET    /api/v1/insights/departure-advice  - Best departure window advice
 * POST   /api/v1/insights/clear-cache       - Clear insights cache
 */

// Executive summary endpoint
router.get('/summary', InsightsController.getExecutiveSummary);

// Zone insights endpoints
router.get('/zones', InsightsController.getZoneInsights);
router.get('/zones/:zone_id', InsightsController.getZoneInsights);

// Comparative metrics endpoint
router.get('/comparative', InsightsController.getComparativeMetrics);

// Departure advice endpoint
router.get('/departure-advice', InsightsController.getDepartureAdvice);

// Cache management endpoint
router.post('/clear-cache', InsightsController.clearCache);

export default router;
