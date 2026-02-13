import { Router } from 'express';
import { AnalyticsController } from '@/controllers/analyticsController.js';

const router = Router();

// Traffic patterns by hour/day
router.get('/traffic-patterns', AnalyticsController.getTrafficPatterns);

// Traffic hotspots
router.get('/hotspots', AnalyticsController.getHotspots);

// Today's hourly pattern
router.get('/hourly-pattern', AnalyticsController.getHourlyPattern);

// Compare current vs historical
router.get('/compare/:road_id', AnalyticsController.compareToHistorical);

// Weather impact analysis
router.get('/weather-impact', AnalyticsController.getWeatherImpact);

// Rush hour statistics
router.get('/rush-hour', AnalyticsController.getRushHourStats);

// Road traffic history
router.get('/road-history/:road_id', AnalyticsController.getRoadHistory);

// Road statistics
router.get('/road-stats/:road_id', AnalyticsController.getRoadStats);

export default router;
