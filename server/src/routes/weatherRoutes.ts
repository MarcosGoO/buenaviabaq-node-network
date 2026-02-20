import { Router } from 'express';
import { WeatherController } from '@/controllers/weatherController.js';

const router = Router();

// Current weather
router.get('/current', WeatherController.getCurrentWeather);

// Forecast
router.get('/forecast', WeatherController.getForecast);

// IDEAM data
router.get('/ideam', WeatherController.getIdeamData);

export default router;