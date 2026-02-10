import { Router } from 'express';
import { WeatherController } from '@/controllers/weatherController';

const router = Router();

// Current weather
router.get('/current', WeatherController.getCurrentWeather);

// Forecast
router.get('/forecast', WeatherController.getForecast);

export default router;