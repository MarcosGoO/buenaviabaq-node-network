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

// GET /api/v1/ml/evaluation - Temporal prediction quality metrics
router.get('/evaluation', MLController.getEvaluation);

// POST /api/v1/ml/evaluation/sync-actuals - Match predictions with observed values (admin)
router.post('/evaluation/sync-actuals', requireAdminAuth, MLController.syncEvaluationActuals);

// GET /api/v1/ml/drift-status - Model drift status (recent vs baseline performance)
router.get('/drift-status', MLController.getDriftStatus);

// POST /api/v1/ml/drift-status/check - Force drift check now (admin)
router.post('/drift-status/check', requireAdminAuth, MLController.checkDriftNow);

// GET /api/v1/ml/reliability/overview?days=30 - RCC overview
router.get('/reliability/overview', MLController.getReliabilityOverview);

// GET /api/v1/ml/reliability/incidents?status=open|closed|all&limit=50 - RCC incidents
router.get('/reliability/incidents', MLController.getReliabilityIncidents);

// GET /api/v1/ml/reliability/decisions?days=30 - RCC decisions
router.get('/reliability/decisions', MLController.getReliabilityDecisions);

// POST /api/v1/ml/reliability/check-now - Force reliability check now (admin)
router.post('/reliability/check-now', requireAdminAuth, MLController.checkReliabilityNow);

// POST /api/v1/ml/reliability/execute-decision - Execute decision/manual override (admin)
router.post('/reliability/execute-decision', requireAdminAuth, MLController.executeReliabilityDecision);

export default router;
