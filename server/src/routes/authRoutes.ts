import { Router } from 'express';
import { AuthController } from '@/controllers/authController.js';

const router = Router();

// POST /api/v1/auth/admin/login
router.post('/admin/login', AuthController.adminLogin);

// POST /api/v1/auth/admin/logout
router.post('/admin/logout', AuthController.adminLogout);

// GET /api/v1/auth/admin/session
router.get('/admin/session', AuthController.adminSession);

export default router;

