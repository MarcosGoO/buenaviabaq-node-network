import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * WeatherService Unit Tests
 *
 * Covers: getCurrentWeather (mock fallback, real API path, error handling),
 * getForecast (no key, API success, API failure), calculateRainProbability
 * (indirectly via getCurrentWeather with mocked fetch).
 */

// Mock logger
vi.mock('@/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mock CacheService — always executes callback (cache miss)
vi.mock('@/services/cacheService.js', () => ({
  CacheService: {
    getOrSet: vi.fn((_key: string, cb: () => unknown) => cb()),
    TTL: { SHORT: 60, MEDIUM: 300, LONG: 900 },
    Namespaces: { WEATHER: 'weather' },
  },
}));

// Mock config
vi.mock('@/config/index.js', () => ({
  config: { OPENWEATHER_API_KEY: undefined },
}));

// Mock AppError
vi.mock('@/middleware/errorHandler.js', () => ({
  AppError: class AppError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = 'AppError';
    }
  },
}));

import { WeatherService } from '@/services/weatherService.js';
import { config } from '@/config/index.js';
import { CacheService } from '@/services/cacheService.js';

// Helper to build a full OpenWeather API response
const buildOWResponse = (overrides = {}) => ({
  main: { temp: 32, feels_like: 35, humidity: 72, pressure: 1013 },
  weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
  wind: { speed: 5, deg: 90 },
  clouds: { all: 10 },
  dt: Math.floor(Date.now() / 1000),
  name: 'Barranquilla',
  ...overrides,
});

// Helper to build a forecast API response
const buildForecastResponse = (count = 3) => ({
  list: Array.from({ length: count }, (_, i) => ({
    dt: Math.floor(Date.now() / 1000) + i * 10800,
    main: { temp: 30 + i, humidity: 70 },
    weather: [{ main: 'Clear', description: 'clear sky' }],
    wind: { speed: 4 },
    clouds: { all: 20 },
  })),
});

describe('WeatherService', () => {
  beforeEach(() => {
    vi.mocked(CacheService.getOrSet).mockImplementation((_key, cb) => cb() as never);
    // Reset config key to undefined (no key by default)
    (config as { OPENWEATHER_API_KEY: string | undefined }).OPENWEATHER_API_KEY = undefined;
  });

  describe('getCurrentWeather — no API key (mock fallback)', () => {
    it('should return mock weather data when no API key', async () => {
      const data = await WeatherService.getCurrentWeather();
      expect(data.location).toBe('Barranquilla');
      expect(typeof data.temperature).toBe('number');
      expect(typeof data.humidity).toBe('number');
      expect(data.temperature).toBeGreaterThan(0);
    });

    it('mock data should have all required WeatherData fields', async () => {
      const data = await WeatherService.getCurrentWeather();
      const requiredFields = [
        'temperature', 'feels_like', 'humidity', 'wind_speed', 'wind_direction',
        'condition', 'description', 'icon', 'rain_probability', 'pressure',
        'cloudiness', 'location', 'timestamp',
      ] as const;
      requiredFields.forEach(field => {
        expect(data).toHaveProperty(field);
      });
    });

    it('mock timestamp should be a Date instance', async () => {
      const data = await WeatherService.getCurrentWeather();
      expect(data.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('getCurrentWeather — with API key (fetch path)', () => {
    beforeEach(() => {
      (config as { OPENWEATHER_API_KEY: string | undefined }).OPENWEATHER_API_KEY = 'test-api-key';
    });

    it('should map OpenWeather response correctly', async () => {
      const owData = buildOWResponse({ main: { temp: 28.7, feels_like: 31.2, humidity: 80, pressure: 1010 } });
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(owData),
      } as never);

      const data = await WeatherService.getCurrentWeather();
      expect(data.temperature).toBe(29); // Math.round(28.7)
      expect(data.humidity).toBe(80);
      expect(data.location).toBe('Barranquilla');
      expect(data.condition).toBe('Clear');
    });

    it('should convert wind speed from m/s to km/h', async () => {
      const owData = buildOWResponse({ wind: { speed: 10, deg: 180 } }); // 10 m/s = 36 km/h
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(owData),
      } as never);

      const data = await WeatherService.getCurrentWeather();
      expect(data.wind_speed).toBe(36);
      expect(data.wind_direction).toBe(180);
    });

    it('should include rain_1h when rain data present', async () => {
      const owData = buildOWResponse({ rain: { '1h': 2.5 } });
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(owData),
      } as never);

      const data = await WeatherService.getCurrentWeather();
      expect(data.rain_1h).toBe(2.5);
    });

    it('should throw AppError(500) on 401 API response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      } as never);

      await expect(WeatherService.getCurrentWeather()).rejects.toMatchObject({
        status: 500,
        message: 'Invalid OpenWeather API key',
      });
    });

    it('should throw AppError on non-401 API error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      } as never);

      await expect(WeatherService.getCurrentWeather()).rejects.toMatchObject({
        status: 503,
      });
    });

    it('should throw AppError(503) on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(WeatherService.getCurrentWeather()).rejects.toMatchObject({
        status: 503,
        message: 'Weather service unavailable',
      });
    });
  });

  describe('getForecast', () => {
    it('should return null when no API key configured', async () => {
      const result = await WeatherService.getForecast();
      expect(result).toBeNull();
    });

    it('should return forecast data when API key is set', async () => {
      (config as { OPENWEATHER_API_KEY: string | undefined }).OPENWEATHER_API_KEY = 'test-key';
      const forecastData = buildForecastResponse(5);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(forecastData),
      } as never);

      const result = await WeatherService.getForecast();
      expect(result).not.toBeNull();
      expect(result!.location).toBe('Barranquilla');
      expect(result!.forecast).toHaveLength(5);
    });

    it('forecast items should have required fields', async () => {
      (config as { OPENWEATHER_API_KEY: string | undefined }).OPENWEATHER_API_KEY = 'test-key';
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(buildForecastResponse(2)),
      } as never);

      const result = await WeatherService.getForecast();
      result!.forecast.forEach(item => {
        expect(item.timestamp).toBeInstanceOf(Date);
        expect(typeof item.temperature).toBe('number');
        expect(typeof item.condition).toBe('string');
        expect(typeof item.rain_probability).toBe('number');
        expect(item.rain_probability).toBeGreaterThanOrEqual(0);
        expect(item.rain_probability).toBeLessThanOrEqual(100);
        expect(typeof item.humidity).toBe('number');
        expect(typeof item.wind_speed).toBe('number');
      });
    });

    it('should return null on API failure', async () => {
      (config as { OPENWEATHER_API_KEY: string | undefined }).OPENWEATHER_API_KEY = 'test-key';
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as never);

      const result = await WeatherService.getForecast();
      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      (config as { OPENWEATHER_API_KEY: string | undefined }).OPENWEATHER_API_KEY = 'test-key';
      global.fetch = vi.fn().mockRejectedValue(new Error('Network failed'));

      const result = await WeatherService.getForecast();
      expect(result).toBeNull();
    });
  });

  describe('rain probability calculation (via getCurrentWeather)', () => {
    beforeEach(() => {
      (config as { OPENWEATHER_API_KEY: string | undefined }).OPENWEATHER_API_KEY = 'test-key';
    });

    it('should return 80-100 when condition is Rain', async () => {
      const owData = buildOWResponse({
        weather: [{ id: 500, main: 'Rain', description: 'light rain', icon: '10d' }],
        clouds: { all: 90 },
      });
      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(owData) } as never);

      const data = await WeatherService.getCurrentWeather();
      expect(data.rain_probability).toBeGreaterThanOrEqual(80);
      expect(data.rain_probability).toBeLessThanOrEqual(100);
    });

    it('should return 60-80 when condition is Drizzle', async () => {
      const owData = buildOWResponse({
        weather: [{ id: 300, main: 'Drizzle', description: 'light drizzle', icon: '09d' }],
        clouds: { all: 70 },
      });
      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(owData) } as never);

      const data = await WeatherService.getCurrentWeather();
      expect(data.rain_probability).toBeGreaterThanOrEqual(60);
      expect(data.rain_probability).toBeLessThanOrEqual(80);
    });

    it('should return 30-60 when cloudy with >70% cloudiness', async () => {
      const owData = buildOWResponse({
        weather: [{ id: 804, main: 'Clouds', description: 'overcast', icon: '04d' }],
        clouds: { all: 80 },
      });
      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(owData) } as never);

      const data = await WeatherService.getCurrentWeather();
      expect(data.rain_probability).toBeGreaterThanOrEqual(30);
      expect(data.rain_probability).toBeLessThanOrEqual(60);
    });

    it('should return 0-10 on clear sky', async () => {
      const owData = buildOWResponse({
        weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
        clouds: { all: 5 },
      });
      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(owData) } as never);

      const data = await WeatherService.getCurrentWeather();
      expect(data.rain_probability).toBeGreaterThanOrEqual(0);
      expect(data.rain_probability).toBeLessThanOrEqual(10);
    });

    it('should return 80-100 when rain object present with 1h>0', async () => {
      const owData = buildOWResponse({
        weather: [{ id: 800, main: 'Clear', description: 'clear', icon: '01d' }],
        clouds: { all: 5 },
        rain: { '1h': 1.0 },
      });
      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(owData) } as never);

      const data = await WeatherService.getCurrentWeather();
      expect(data.rain_probability).toBeGreaterThanOrEqual(80);
    });
  });
});
