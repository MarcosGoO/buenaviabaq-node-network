import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';
import { AppError } from '@/middleware/errorHandler.js';
import { CacheService } from './cacheService.js';

// Barranquilla coordinates
const BARRANQUILLA_LAT = 10.9639;
const BARRANQUILLA_LON = -74.7964;

interface OpenWeatherResponse {
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
    pressure: number;
  };
  weather: Array<{
    id: number;
    main: string;
    description: string;
    icon: string;
  }>;
  wind: {
    speed: number;
    deg: number;
  };
  clouds: {
    all: number;
  };
  rain?: {
    '1h': number;
  };
  dt: number;
  name: string;
}

interface WeatherData {
  temperature: number;
  feels_like: number;
  humidity: number;
  wind_speed: number;
  wind_direction: number;
  condition: string;
  description: string;
  icon: string;
  rain_probability: number;
  rain_1h?: number;
  pressure: number;
  cloudiness: number;
  location: string;
  timestamp: Date;
}

interface ForecastItem {
  dt: number;
  main: {
    temp: number;
    humidity: number;
  };
  weather: Array<{
    main: string;
    description: string;
  }>;
  wind: {
    speed: number;
  };
  clouds: {
    all: number;
  };
  rain?: {
    '1h': number;
  };
}

interface ForecastData {
  location: string;
  forecast: Array<{
    timestamp: Date;
    temperature: number;
    condition: string;
    description: string;
    rain_probability: number;
    humidity: number;
    wind_speed: number;
  }>;
}

interface OpenWeatherForecastResponse {
  list: ForecastItem[];
}

export class WeatherService {
  private static readonly OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';

  // Get current weather for Barranquilla
  static async getCurrentWeather(): Promise<WeatherData> {
    return await CacheService.getOrSet(
      'current-weather',
      async () => {
        const apiKey = config.OPENWEATHER_API_KEY;

        if (!apiKey) {
      logger.warn('OpenWeather API key not configured, returning mock data');
      return this.getMockWeather();
    }

    try {
      const url = `${this.OPENWEATHER_BASE_URL}/weather?lat=${BARRANQUILLA_LAT}&lon=${BARRANQUILLA_LON}&appid=${apiKey}&units=metric&lang=es`;

      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 401) {
          throw new AppError(500, 'Invalid OpenWeather API key');
        }
        throw new AppError(response.status, `OpenWeather API error: ${response.statusText}`);
      }

      const data = await response.json() as OpenWeatherResponse;

      return {
        temperature: Math.round(data.main.temp),
        feels_like: Math.round(data.main.feels_like),
        humidity: data.main.humidity,
        wind_speed: Math.round(data.wind.speed * 3.6), // m/s to km/h
        wind_direction: data.wind.deg,
        condition: data.weather[0].main,
        description: data.weather[0].description,
        icon: data.weather[0].icon,
        rain_probability: this.calculateRainProbability(data),
        rain_1h: data.rain?.['1h'],
        pressure: data.main.pressure,
        cloudiness: data.clouds.all,
        location: 'Barranquilla',
        timestamp: new Date(data.dt * 1000),
      };
    } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        logger.error('Failed to fetch weather data', { error });
        throw new AppError(503, 'Weather service unavailable');
      }
    },
    {
      ttl: CacheService.TTL.MEDIUM, // 5 minutes
      namespace: CacheService.Namespaces.WEATHER,
    }
    );
  }

  // Get weather forecast for next 5 days
  static async getForecast(): Promise<ForecastData | null> {
    const apiKey = config.OPENWEATHER_API_KEY;

    if (!apiKey) {
      logger.warn('OpenWeather API key not configured');
      return null;
    }

    try {
      const url = `${this.OPENWEATHER_BASE_URL}/forecast?lat=${BARRANQUILLA_LAT}&lon=${BARRANQUILLA_LON}&appid=${apiKey}&units=metric&lang=es`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new AppError(response.status, 'Failed to fetch forecast');
      }

      const data = await response.json() as OpenWeatherForecastResponse;

      // Process and return simplified forecast
      return {
        location: 'Barranquilla',
        forecast: data.list.map((item: ForecastItem) => ({
          timestamp: new Date(item.dt * 1000),
          temperature: Math.round(item.main.temp),
          condition: item.weather[0].main,
          description: item.weather[0].description,
          rain_probability: this.calculateRainProbability(item),
          humidity: item.main.humidity,
          wind_speed: Math.round(item.wind.speed * 3.6),
        })),
      };
    } catch (error) {
      logger.error('Failed to fetch forecast', { error });
      return null;
    }
  }

  // Calculate rain probability based on weather data
  private static calculateRainProbability(data: ForecastItem): number {
    const condition = data.weather[0].main.toLowerCase();
    const cloudiness = data.clouds.all;
    const hasRain = data.rain && data.rain['1h'] > 0;

    if (hasRain || condition.includes('rain')) {
      return 80 + Math.round(Math.random() * 20); // 80-100%
    } else if (condition.includes('drizzle')) {
      return 60 + Math.round(Math.random() * 20); // 60-80%
    } else if (condition.includes('cloud') && cloudiness > 70) {
      return 30 + Math.round(Math.random() * 30); // 30-60%
    } else if (cloudiness > 50) {
      return 10 + Math.round(Math.random() * 20); // 10-30%
    }

    return Math.round(Math.random() * 10); // 0-10%
  }

  // Mock weather data for development/testing
  private static getMockWeather(): WeatherData {
    return {
      temperature: 32,
      feels_like: 35,
      humidity: 72,
      wind_speed: 18,
      wind_direction: 90,
      condition: 'Clouds',
      description: 'parcialmente nublado',
      icon: '02d',
      rain_probability: 40,
      pressure: 1013,
      cloudiness: 40,
      location: 'Barranquilla',
      timestamp: new Date(),
    };
  }
}