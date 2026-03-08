import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * EventsService Unit Tests
 *
 * Covers: getAllEvents (filters), getEventById, getUpcomingEvents,
 * getEventsNearLocation, createEvent, updateEvent, deleteEvent.
 * All DB interactions are mocked via pool.
 */

// Mock DB pool
vi.mock('@/db', () => ({
  pool: { query: vi.fn() },
}));

// Mock logger
vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { EventsService } from '@/services/eventsService.js';
import type { CreateEventDTO, UpdateEventDTO } from '@/services/eventsService.js';
import { pool } from '@/db';

const mockPool = vi.mocked(pool);

// ── Fixture helpers ────────────────────────────────────────────────────────

const makeEvent = (id: number, overrides = {}) => ({
  id,
  title: `Event ${id}`,
  description: `Description ${id}`,
  event_type: 'concert',
  location_name: 'Centro',
  location: { type: 'Point' as const, coordinates: [-74.8, 10.96] as [number, number] },
  start_time: new Date(Date.now() + 3600_000).toISOString(),
  end_time: new Date(Date.now() + 7200_000).toISOString(),
  expected_attendance: 5000,
  traffic_impact: 'high' as const,
  status: 'scheduled' as const,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

const createDTO: CreateEventDTO = {
  title: 'New Concert',
  description: 'A big concert',
  event_type: 'concert',
  location_name: 'Estadio Metropolitano',
  latitude: 10.963,
  longitude: -74.803,
  start_time: new Date(Date.now() + 3600_000).toISOString(),
  end_time: new Date(Date.now() + 7200_000).toISOString(),
  expected_attendance: 30000,
  traffic_impact: 'severe',
  status: 'scheduled',
};

describe('EventsService', () => {
  beforeEach(() => {
    mockPool.query.mockReset();
  });

  // ─── getAllEvents ──────────────────────────────────────────────────────────

  describe('getAllEvents', () => {
    it('should return all events with no filters', async () => {
      const events = [makeEvent(1), makeEvent(2)];
      mockPool.query.mockResolvedValue({ rows: events } as never);

      const result = await EventsService.getAllEvents();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
    });

    it('should return empty array when no events', async () => {
      mockPool.query.mockResolvedValue({ rows: [] } as never);
      const result = await EventsService.getAllEvents();
      expect(result).toEqual([]);
    });

    it('should apply status filter in query', async () => {
      mockPool.query.mockResolvedValue({ rows: [] } as never);

      await EventsService.getAllEvents({ status: 'ongoing' });
      const [queryStr, params] = mockPool.query.mock.calls[0];
      expect(queryStr).toContain('status');
      expect(params).toContain('ongoing');
    });

    it('should apply event_type filter', async () => {
      mockPool.query.mockResolvedValue({ rows: [] } as never);

      await EventsService.getAllEvents({ event_type: 'concert' });
      const [, params] = mockPool.query.mock.calls[0];
      expect(params).toContain('concert');
    });

    it('should apply traffic_impact filter', async () => {
      mockPool.query.mockResolvedValue({ rows: [] } as never);

      await EventsService.getAllEvents({ traffic_impact: 'severe' });
      const [, params] = mockPool.query.mock.calls[0];
      expect(params).toContain('severe');
    });

    it('should apply start_date and end_date filters', async () => {
      mockPool.query.mockResolvedValue({ rows: [] } as never);
      const start = '2026-01-01';
      const end = '2026-12-31';

      await EventsService.getAllEvents({ start_date: start, end_date: end });
      const [, params] = mockPool.query.mock.calls[0];
      expect(params).toContain(start);
      expect(params).toContain(end);
    });

    it('should apply multiple filters simultaneously', async () => {
      mockPool.query.mockResolvedValue({ rows: [] } as never);

      await EventsService.getAllEvents({ status: 'scheduled', event_type: 'festival', traffic_impact: 'high' });
      const [, params] = mockPool.query.mock.calls[0];
      expect(params).toContain('scheduled');
      expect(params).toContain('festival');
      expect(params).toContain('high');
    });

    it('should throw on DB error', async () => {
      mockPool.query.mockRejectedValue(new Error('DB error'));
      await expect(EventsService.getAllEvents()).rejects.toThrow('DB error');
    });
  });

  // ─── getEventById ─────────────────────────────────────────────────────────

  describe('getEventById', () => {
    it('should return event when found', async () => {
      mockPool.query.mockResolvedValue({ rows: [makeEvent(5)] } as never);

      const result = await EventsService.getEventById(5);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(5);
      expect(result!.title).toBe('Event 5');
    });

    it('should return null when event not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] } as never);
      const result = await EventsService.getEventById(999);
      expect(result).toBeNull();
    });

    it('should pass id as query param', async () => {
      mockPool.query.mockResolvedValue({ rows: [makeEvent(3)] } as never);

      await EventsService.getEventById(3);
      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [3]);
    });

    it('should throw on DB error', async () => {
      mockPool.query.mockRejectedValue(new Error('Query failed'));
      await expect(EventsService.getEventById(1)).rejects.toThrow('Query failed');
    });
  });

  // ─── getUpcomingEvents ────────────────────────────────────────────────────

  describe('getUpcomingEvents', () => {
    it('should return scheduled and ongoing events', async () => {
      const events = [
        makeEvent(1, { status: 'scheduled' }),
        makeEvent(2, { status: 'ongoing' }),
      ];
      mockPool.query.mockResolvedValue({ rows: events } as never);

      const result = await EventsService.getUpcomingEvents();
      expect(result).toHaveLength(2);
    });

    it('should query for scheduled and ongoing statuses', async () => {
      mockPool.query.mockResolvedValue({ rows: [] } as never);

      await EventsService.getUpcomingEvents();
      const [queryStr] = mockPool.query.mock.calls[0];
      expect(queryStr).toContain('scheduled');
      expect(queryStr).toContain('ongoing');
    });

    it('should include end_time >= NOW() condition', async () => {
      mockPool.query.mockResolvedValue({ rows: [] } as never);

      await EventsService.getUpcomingEvents();
      const [queryStr] = mockPool.query.mock.calls[0];
      expect(queryStr).toContain('end_time');
      expect(queryStr).toContain('NOW()');
    });

    it('should return empty array when no upcoming events', async () => {
      mockPool.query.mockResolvedValue({ rows: [] } as never);
      expect(await EventsService.getUpcomingEvents()).toEqual([]);
    });

    it('should throw on DB error', async () => {
      mockPool.query.mockRejectedValue(new Error('Upcoming events failed'));
      await expect(EventsService.getUpcomingEvents()).rejects.toThrow('Upcoming events failed');
    });
  });

  // ─── getEventsNearLocation ────────────────────────────────────────────────

  describe('getEventsNearLocation', () => {
    it('should return events sorted by distance', async () => {
      const events = [makeEvent(1), makeEvent(2)];
      mockPool.query.mockResolvedValue({ rows: events } as never);

      const result = await EventsService.getEventsNearLocation(10.96, -74.8);
      expect(result).toHaveLength(2);
    });

    it('should pass lat, lng, radius to query', async () => {
      mockPool.query.mockResolvedValue({ rows: [] } as never);

      await EventsService.getEventsNearLocation(10.96, -74.8, 3000);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        [10.96, -74.8, 3000]
      );
    });

    it('should use default radius of 5000m', async () => {
      mockPool.query.mockResolvedValue({ rows: [] } as never);

      await EventsService.getEventsNearLocation(10.96, -74.8);
      const [, params] = mockPool.query.mock.calls[0];
      expect(params).toContain(5000);
    });

    it('should throw on DB error', async () => {
      mockPool.query.mockRejectedValue(new Error('Geo query error'));
      await expect(EventsService.getEventsNearLocation(10.96, -74.8)).rejects.toThrow('Geo query error');
    });
  });

  // ─── createEvent ──────────────────────────────────────────────────────────

  describe('createEvent', () => {
    it('should return the created event', async () => {
      const created = makeEvent(10, { title: 'New Concert' });
      mockPool.query.mockResolvedValue({ rows: [created] } as never);

      const result = await EventsService.createEvent(createDTO);
      expect(result.title).toBe('New Concert');
      expect(result.id).toBe(10);
    });

    it('should pass all required fields to query', async () => {
      mockPool.query.mockResolvedValue({ rows: [makeEvent(1)] } as never);

      await EventsService.createEvent(createDTO);
      const [, params] = mockPool.query.mock.calls[0];
      expect(params).toContain('New Concert');
      expect(params).toContain('concert');
      expect(params).toContain('Estadio Metropolitano');
    });

    it('should use default traffic_impact="moderate" when not provided', async () => {
      mockPool.query.mockResolvedValue({ rows: [makeEvent(1)] } as never);

      const minimalDTO: CreateEventDTO = { ...createDTO };
      delete (minimalDTO as Partial<CreateEventDTO>).traffic_impact;

      await EventsService.createEvent(minimalDTO);
      const [, params] = mockPool.query.mock.calls[0];
      expect(params).toContain('moderate');
    });

    it('should use default status="scheduled" when not provided', async () => {
      mockPool.query.mockResolvedValue({ rows: [makeEvent(1)] } as never);

      const minimalDTO: CreateEventDTO = { ...createDTO };
      delete (minimalDTO as Partial<CreateEventDTO>).status;

      await EventsService.createEvent(minimalDTO);
      const [, params] = mockPool.query.mock.calls[0];
      expect(params).toContain('scheduled');
    });

    it('should pass null for missing optional description', async () => {
      mockPool.query.mockResolvedValue({ rows: [makeEvent(1)] } as never);

      const dto: CreateEventDTO = { ...createDTO };
      delete (dto as Partial<CreateEventDTO>).description;

      await EventsService.createEvent(dto);
      const [, params] = mockPool.query.mock.calls[0];
      expect(params).toContain(null);
    });

    it('should throw on DB error', async () => {
      mockPool.query.mockRejectedValue(new Error('Insert failed'));
      await expect(EventsService.createEvent(createDTO)).rejects.toThrow('Insert failed');
    });
  });

  // ─── updateEvent ──────────────────────────────────────────────────────────

  describe('updateEvent', () => {
    it('should return updated event', async () => {
      const updated = makeEvent(1, { title: 'Updated Title', status: 'ongoing' });
      mockPool.query.mockResolvedValue({ rows: [updated] } as never);

      const result = await EventsService.updateEvent(1, { title: 'Updated Title', status: 'ongoing' });
      expect(result).not.toBeNull();
      expect(result!.title).toBe('Updated Title');
    });

    it('should return null when event not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] } as never);
      const result = await EventsService.updateEvent(999, { title: 'Ghost' });
      expect(result).toBeNull();
    });

    it('should call getEventById when no fields to update', async () => {
      // Spy on getEventById
      const spy = vi.spyOn(EventsService, 'getEventById').mockResolvedValue(makeEvent(1));

      const result = await EventsService.updateEvent(1, {});
      expect(spy).toHaveBeenCalledWith(1);
      expect(result).not.toBeNull();

      spy.mockRestore();
    });

    it('should update traffic_impact field', async () => {
      mockPool.query.mockResolvedValue({ rows: [makeEvent(1)] } as never);

      await EventsService.updateEvent(1, { traffic_impact: 'low' });
      const [queryStr, params] = mockPool.query.mock.calls[0];
      expect(queryStr).toContain('traffic_impact');
      expect(params).toContain('low');
    });

    it('should update location when lat and lng are both provided', async () => {
      mockPool.query.mockResolvedValue({ rows: [makeEvent(1)] } as never);

      const dto: UpdateEventDTO = { latitude: 10.97, longitude: -74.79 };
      await EventsService.updateEvent(1, dto);
      const [queryStr] = mockPool.query.mock.calls[0];
      expect(queryStr).toContain('location_point');
    });

    it('should throw on DB error', async () => {
      mockPool.query.mockRejectedValue(new Error('Update failed'));
      await expect(EventsService.updateEvent(1, { title: 'Boom' })).rejects.toThrow('Update failed');
    });
  });

  // ─── deleteEvent ──────────────────────────────────────────────────────────

  describe('deleteEvent', () => {
    it('should return true when event is deleted', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 1 }] } as never);
      const result = await EventsService.deleteEvent(1);
      expect(result).toBe(true);
    });

    it('should return false when event not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] } as never);
      const result = await EventsService.deleteEvent(999);
      expect(result).toBe(false);
    });

    it('should pass id to DELETE query', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 5 }] } as never);

      await EventsService.deleteEvent(5);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE'),
        [5]
      );
    });

    it('should throw on DB error', async () => {
      mockPool.query.mockRejectedValue(new Error('Delete failed'));
      await expect(EventsService.deleteEvent(1)).rejects.toThrow('Delete failed');
    });
  });
});
