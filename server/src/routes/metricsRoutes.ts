import { Router } from 'express';
import { MetricsController } from '@/controllers/metricsController.js';

const router = Router();

/**
 * GET /api/v1/metrics
 * Public runtime metrics endpoint
 */
router.get('/', MetricsController.getMetrics);

export default router;

