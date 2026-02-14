import { Router } from 'express';
import { PredictionsController } from '@/controllers/predictionsController.js';

const router = Router();

/**
 * Traffic Prediction Routes
 * Base path: /api/v1/predictions
 */

// GET /api/v1/predictions/health - Check ML service health
router.get('/health', PredictionsController.checkMLServiceHealth);

// GET /api/v1/predictions/all - Get predictions for all roads
router.get('/all', PredictionsController.getAllPredictions);

// GET /api/v1/predictions/road/:id - Get prediction for specific road
router.get('/road/:id', PredictionsController.getPredictionForRoad);

// POST /api/v1/predictions/batch - Get batch predictions
router.post('/batch', PredictionsController.getBatchPredictions);

export default router;
