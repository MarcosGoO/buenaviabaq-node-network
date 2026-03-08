import { describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => ({
  pool: {
    query: vi.fn(),
  },
}));

vi.mock('@/services/trafficService.js', () => ({
  TrafficService: {
    getRealTimeTraffic: vi.fn(),
  },
}));

vi.mock('@/services/weatherService.js', () => ({
  WeatherService: {
    getCurrentWeather: vi.fn(),
  },
}));

vi.mock('@/services/eventsService.js', () => ({
  EventsService: {
    getUpcomingEvents: vi.fn(),
  },
}));

import { pool } from '@/db';
import { TrafficService } from '@/services/trafficService.js';
import { WeatherService } from '@/services/weatherService.js';
import { EventsService } from '@/services/eventsService.js';
import { TrafficHistoryService } from '@/services/trafficHistoryService.js';

describe('TrafficHistoryService', () => {
  it('skips insert query when traffic data is empty', async () => {
    vi.mocked(TrafficService.getRealTimeTraffic).mockResolvedValue([]);
    vi.mocked(WeatherService.getCurrentWeather).mockResolvedValue({
      condition: 'clear',
      temperature: 30,
      rain_probability: 0,
    } as never);
    vi.mocked(EventsService.getUpcomingEvents).mockResolvedValue([]);

    await TrafficHistoryService.storeTrafficSnapshot();

    expect(pool.query).not.toHaveBeenCalled();
  });
});

