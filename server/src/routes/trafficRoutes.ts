import { Router } from 'express';
import { TrafficController } from '@/controllers/trafficController';

const router = Router();

// Real-time traffic
router.get('/realtime', TrafficController.getRealTimeTraffic);

// Traffic summary
router.get('/summary', TrafficController.getTrafficSummary);

// Traffic by road ID
router.get('/road/:id', TrafficController.getTrafficByRoadId);

export default router;
