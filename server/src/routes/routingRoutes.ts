import { Router } from 'express';
import { RoutingController } from '@/controllers/routingController.js';

const router = Router();

/**
 * Routing Routes
 * Sprint 6.2 - Intelligent Routing
 *
 * POST   /api/v1/routes/calculate      - Calculate multiple route alternatives
 * POST   /api/v1/routes/optimal        - Get single best route
 * GET    /api/v1/routes/example        - Get example route for testing
 * POST   /api/v1/routes/clear-cache    - Clear routes cache
 */

// Route calculation endpoints
router.post('/calculate', RoutingController.calculateRoutes);
router.post('/optimal', RoutingController.getOptimalRoute);

// Example/testing endpoints
router.get('/example', RoutingController.getExampleRoute);

// Cache management
router.post('/clear-cache', RoutingController.clearCache);

export default router;
