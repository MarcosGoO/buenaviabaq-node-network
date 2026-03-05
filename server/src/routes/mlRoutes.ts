import { Router } from 'express';
import { MLController } from '@/controllers/mlController.js';
import { requireAdminAuth } from '@/middleware/adminAuth.js';

const router = Router();

/**
 * ML Feature Store Routes
 * Base path: /api/v1/ml
 */

// GET /api/v1/ml/features - Get stored features
router.get('/features', MLController.getFeatures);

// GET /api/v1/ml/features/stats - Get feature statistics
router.get('/features/stats', MLController.getFeatureStats);

// POST /api/v1/ml/features/extract - Extract features for a road
router.post('/features/extract', MLController.extractFeatures);

// POST /api/v1/ml/features/store - Store features for a road
router.post('/features/store', MLController.storeFeatures);

// POST /api/v1/ml/features/batch - Batch extract features for all roads (admin)
router.post('/features/batch', requireAdminAuth, MLController.batchExtractFeatures);

//— Model Retraining & Versioning (admin-only) ─────────────────

// POST /api/v1/ml/retrain - Manually trigger model retraining
router.post('/retrain', requireAdminAuth, MLController.triggerRetrain);

// GET /api/v1/ml/model-history - List all saved model versions
router.get('/model-history', requireAdminAuth, MLController.getModelHistory);

// POST /api/v1/ml/rollback/:version - Roll back to a specific model version
router.post('/rollback/:version', requireAdminAuth, MLController.rollbackModel);

export default router;
