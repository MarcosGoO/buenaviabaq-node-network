import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => ({
  pool: { query: vi.fn() },
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/services/weatherService.js', () => ({
  WeatherService: {
    getCurrentWeather: vi.fn(),
    getForecast: vi.fn(),
  },
}));

vi.mock('@/services/alertService.js', () => ({
  AlertService: {
    detectActiveAlerts: vi.fn(),
    getActiveAlerts: vi.fn(),
  },
}));

import { pool } from '@/db';
import { InsightsService } from '@/services/insightsService.js';
import { WeatherService } from '@/services/weatherService.js';
import { AlertService } from '@/services/alertService.js';

describe('InsightsService.getDepartureAdvice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds advice windows and best departure', async () => {
    vi.mocked(pool.query).mockResolvedValue({
      rows: [
        { hour_of_day: 8, avg_speed: 18, avg_travel_time: 32 },
        { hour_of_day: 9, avg_speed: 30, avg_travel_time: 22 },
        { hour_of_day: 10, avg_speed: 38, avg_travel_time: 16 },
      ],
    } as never);

    vi.mocked(WeatherService.getCurrentWeather).mockResolvedValue({
      rain_probability: 40,
      temperature: 30,
      wind_speed: 10,
      condition: 'Clouds',
      description: 'cloudy',
      feels_like: 33,
      humidity: 70,
      pressure: 1000,
      wind_direction: 120,
      icon: '01d',
      cloudiness: 40,
      location: 'Barranquilla',
      timestamp: new Date(),
    } as never);

    vi.mocked(WeatherService.getForecast).mockResolvedValue({
      location: 'Barranquilla',
      forecast: [
        {
          timestamp: new Date(),
          temperature: 30,
          condition: 'Rain',
          description: 'rain',
          rain_probability: 65,
          humidity: 80,
          wind_speed: 12,
        },
      ],
    } as never);

    vi.mocked(AlertService.detectActiveAlerts).mockResolvedValue([] as never);
    vi.mocked(AlertService.getActiveAlerts).mockReturnValue([] as never);

    const advice = await InsightsService.getDepartureAdvice(2, 60);

    expect(advice.windows.length).toBeGreaterThanOrEqual(2);
    expect(advice.best_departure).toBeDefined();
    expect(advice.parameters.hours_ahead).toBe(2);
    expect(advice.parameters.interval_minutes).toBe(60);
    advice.windows.forEach((window) => {
      expect(window.risk_score).toBeGreaterThanOrEqual(0);
      expect(window.risk_score).toBeLessThanOrEqual(100);
    });
  });
});

