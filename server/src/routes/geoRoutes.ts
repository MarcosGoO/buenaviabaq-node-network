import { Router } from 'express';
import { GeoController } from '@/controllers/geoController';
import { requireAdminAuth } from '@/middleware/adminAuth.js';

const router = Router();

// Zones
router.get('/zones', GeoController.getZones);
router.get('/zones/bounds', GeoController.getZonesInBounds);
router.get('/zones/:id', GeoController.getZoneById);

// Arroyo zones (flood-prone areas)
router.get('/arroyos', GeoController.getArroyoZones);

// Roads
router.get('/roads', GeoController.getRoads);
router.get('/roads/flow', GeoController.getRoadsFlow);

// Points of Interest
router.get('/pois', GeoController.getPOIs);

// Admin-only geospatial data import
router.post('/import-zones', requireAdminAuth, GeoController.importZones);

export default router;
