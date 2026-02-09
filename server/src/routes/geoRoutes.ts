import { Router } from 'express';
import { GeoController } from '@/controllers/geoController';

const router = Router();

// Zones
router.get('/zones', GeoController.getZones);
router.get('/zones/bounds', GeoController.getZonesInBounds);
router.get('/zones/:id', GeoController.getZoneById);

// Arroyo zones (flood-prone areas)
router.get('/arroyos', GeoController.getArroyoZones);

// Roads
router.get('/roads', GeoController.getRoads);

// Points of Interest
router.get('/pois', GeoController.getPOIs);

export default router;
