import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * GeoService Unit Tests
 *
 * Covers: getZones, getZoneById, getArroyoZones, getRoads, getPOIs,
 * getZonesInBounds, getArroyos alias, getRoadZones, getRoadsZones.
 * All DB queries are mocked via the `query` function from @/db.
 */

// Mock the query function from @/db
vi.mock('@/db', () => ({
  query: vi.fn(),
  pool: { query: vi.fn() },
}));

import { GeoService } from '@/services/geoService.js';
import { query } from '@/db';

const mockQuery = vi.mocked(query);

// ── Sample fixture data ────────────────────────────────────────────────────

const makeZone = (id: number) => ({
  id,
  name: `Zone ${id}`,
  zone_type: 'neighborhood',
  parent_id: null,
  geometry: { type: 'Polygon', coordinates: [] },
  population: 5000,
  area_km2: 2.5,
  metadata: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

const makeArroyo = (id: number, riskLevel = 'medium') => ({
  id,
  name: `Arroyo ${id}`,
  zone_id: id,
  geometry: { type: 'LineString', coordinates: [] },
  risk_level: riskLevel,
  drainage_capacity_m3: 1000,
  last_incident_date: null,
  avg_flood_depth_cm: 30,
  metadata: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

const makeRoad = (id: number, roadType = 'primary') => ({
  id,
  name: `Road ${id}`,
  road_type: roadType,
  geometry: { type: 'LineString', coordinates: [] },
  lanes: 2,
  max_speed_kmh: 60,
  length_km: 3.5,
  one_way: false,
  metadata: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

const makePOI = (id: number, category = 'hospital') => ({
  id,
  name: `POI ${id}`,
  category,
  geometry: { type: 'Point', coordinates: [-74.8, 10.96] },
  zone_id: 1,
  address: `Address ${id}`,
  capacity: 200,
  metadata: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

describe('GeoService', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  // ─── getZones ─────────────────────────────────────────────────────────────

  describe('getZones', () => {
    it('should return all zones', async () => {
      const zones = [makeZone(1), makeZone(2), makeZone(3)];
      mockQuery.mockResolvedValue({ rows: zones } as never);

      const result = await GeoService.getZones();
      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('Zone 1');
    });

    it('should return empty array when no zones exist', async () => {
      mockQuery.mockResolvedValue({ rows: [] } as never);
      const result = await GeoService.getZones();
      expect(result).toEqual([]);
    });

    it('should propagate DB errors', async () => {
      mockQuery.mockRejectedValue(new Error('DB error'));
      await expect(GeoService.getZones()).rejects.toThrow('DB error');
    });
  });

  // ─── getZoneById ──────────────────────────────────────────────────────────

  describe('getZoneById', () => {
    it('should return zone when found', async () => {
      const zone = makeZone(5);
      mockQuery.mockResolvedValue({ rows: [zone] } as never);

      const result = await GeoService.getZoneById(5);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(5);
    });

    it('should return null when zone not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] } as never);
      const result = await GeoService.getZoneById(999);
      expect(result).toBeNull();
    });

    it('should pass id as query param', async () => {
      mockQuery.mockResolvedValue({ rows: [makeZone(7)] } as never);
      await GeoService.getZoneById(7);
      expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [7]);
    });
  });

  // ─── getArroyoZones ───────────────────────────────────────────────────────

  describe('getArroyoZones', () => {
    it('should return all arroyo zones without filter', async () => {
      const arroyos = [makeArroyo(1, 'high'), makeArroyo(2, 'medium'), makeArroyo(3, 'low')];
      mockQuery.mockResolvedValue({ rows: arroyos } as never);

      const result = await GeoService.getArroyoZones();
      expect(result).toHaveLength(3);
    });

    it('should filter by risk_level when provided', async () => {
      const highRisk = [makeArroyo(1, 'high')];
      mockQuery.mockResolvedValue({ rows: highRisk } as never);

      const result = await GeoService.getArroyoZones('high');
      expect(result).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('risk_level'),
        expect.arrayContaining(['high'])
      );
    });

    it('should not pass params when no riskLevel', async () => {
      mockQuery.mockResolvedValue({ rows: [] } as never);
      await GeoService.getArroyoZones();
      expect(mockQuery).toHaveBeenCalledWith(expect.any(String), []);
    });

    it('should propagate DB errors', async () => {
      mockQuery.mockRejectedValue(new Error('PostGIS error'));
      await expect(GeoService.getArroyoZones()).rejects.toThrow('PostGIS error');
    });
  });

  // ─── getArroyos alias ─────────────────────────────────────────────────────

  describe('getArroyos (alias)', () => {
    it('should delegate to getArroyoZones', async () => {
      const arroyos = [makeArroyo(1, 'critical')];
      mockQuery.mockResolvedValue({ rows: arroyos } as never);

      const result = await GeoService.getArroyos('critical');
      expect(result).toHaveLength(1);
      expect(result[0].risk_level).toBe('critical');
    });
  });

  // ─── getRoads ─────────────────────────────────────────────────────────────

  describe('getRoads', () => {
    it('should return all roads without filter', async () => {
      const roads = [makeRoad(1, 'highway'), makeRoad(2, 'primary'), makeRoad(3, 'secondary')];
      mockQuery.mockResolvedValue({ rows: roads } as never);

      const result = await GeoService.getRoads();
      expect(result).toHaveLength(3);
    });

    it('should filter by road_type when provided', async () => {
      const highways = [makeRoad(1, 'highway')];
      mockQuery.mockResolvedValue({ rows: highways } as never);

      const result = await GeoService.getRoads('highway');
      expect(result).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('road_type'),
        expect.arrayContaining(['highway'])
      );
    });

    it('should not pass params when no roadType', async () => {
      mockQuery.mockResolvedValue({ rows: [] } as never);
      await GeoService.getRoads();
      expect(mockQuery).toHaveBeenCalledWith(expect.any(String), []);
    });

    it('should propagate DB errors', async () => {
      mockQuery.mockRejectedValue(new Error('Spatial index error'));
      await expect(GeoService.getRoads()).rejects.toThrow('Spatial index error');
    });
  });

  // ─── getPOIs ──────────────────────────────────────────────────────────────

  describe('getPOIs', () => {
    it('should return all POIs without filter', async () => {
      const pois = [makePOI(1, 'hospital'), makePOI(2, 'school'), makePOI(3, 'park')];
      mockQuery.mockResolvedValue({ rows: pois } as never);

      const result = await GeoService.getPOIs();
      expect(result).toHaveLength(3);
    });

    it('should filter by category when provided', async () => {
      const hospitals = [makePOI(1, 'hospital')];
      mockQuery.mockResolvedValue({ rows: hospitals } as never);

      const result = await GeoService.getPOIs('hospital');
      expect(result).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('category'),
        expect.arrayContaining(['hospital'])
      );
    });

    it('should not pass params when no category', async () => {
      mockQuery.mockResolvedValue({ rows: [] } as never);
      await GeoService.getPOIs();
      expect(mockQuery).toHaveBeenCalledWith(expect.any(String), []);
    });
  });

  // ─── getZonesInBounds ────────────────────────────────────────────────────

  describe('getZonesInBounds', () => {
    it('should return zones within bounding box', async () => {
      const zones = [makeZone(1), makeZone(2)];
      mockQuery.mockResolvedValue({ rows: zones } as never);

      const result = await GeoService.getZonesInBounds(-74.9, 10.9, -74.7, 11.0);
      expect(result).toHaveLength(2);
    });

    it('should pass all four bounding box coords', async () => {
      mockQuery.mockResolvedValue({ rows: [] } as never);

      await GeoService.getZonesInBounds(-74.85, 10.92, -74.75, 10.98);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ST_MakeEnvelope'),
        [-74.85, 10.92, -74.75, 10.98]
      );
    });

    it('should return empty array when no zones in bounds', async () => {
      mockQuery.mockResolvedValue({ rows: [] } as never);

      const result = await GeoService.getZonesInBounds(0, 0, 1, 1);
      expect(result).toEqual([]);
    });

    it('should propagate DB errors', async () => {
      mockQuery.mockRejectedValue(new Error('Bounds query failed'));
      await expect(GeoService.getZonesInBounds(-74.9, 10.9, -74.7, 11.0)).rejects.toThrow('Bounds query failed');
    });
  });

  // ─── getRoadZones ─────────────────────────────────────────────────────────

  describe('getRoadZones', () => {
    it('should return zone IDs for a road', async () => {
      mockQuery.mockResolvedValue({ rows: [{ id: 1 }, { id: 3 }, { id: 5 }] } as never);

      const result = await GeoService.getRoadZones(2);
      expect(result).toEqual([1, 3, 5]);
    });

    it('should return empty array when road has no zones', async () => {
      mockQuery.mockResolvedValue({ rows: [] } as never);

      const result = await GeoService.getRoadZones(99);
      expect(result).toEqual([]);
    });

    it('should pass roadId to query', async () => {
      mockQuery.mockResolvedValue({ rows: [] } as never);

      await GeoService.getRoadZones(7);
      expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [7]);
    });
  });

  // ─── getRoadsZones ────────────────────────────────────────────────────────

  describe('getRoadsZones', () => {
    it('should return empty Map for empty roadIds array', async () => {
      const result = await GeoService.getRoadsZones([]);
      expect(result.size).toBe(0);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should return a Map with zone arrays for each road', async () => {
      // Each road gets a separate query call
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 10 }, { id: 11 }] } as never) // road 1
        .mockResolvedValueOnce({ rows: [{ id: 12 }] } as never)              // road 2
        .mockResolvedValueOnce({ rows: [] } as never);                        // road 3

      const result = await GeoService.getRoadsZones([1, 2, 3]);
      expect(result.size).toBe(3);
      expect(result.get(1)).toEqual([10, 11]);
      expect(result.get(2)).toEqual([12]);
      expect(result.get(3)).toEqual([]);
    });

    it('should call query once per road', async () => {
      mockQuery.mockResolvedValue({ rows: [] } as never);

      await GeoService.getRoadsZones([1, 2, 3, 4]);
      expect(mockQuery).toHaveBeenCalledTimes(4);
    });
  });
});
