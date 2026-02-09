import { query } from '@/db';
import type { GeoZone, ArroyoZone, Road, POI } from '@/types';

export class GeoService {
  // Get all zones
  static async getZones(): Promise<GeoZone[]> {
    const result = await query(`
      SELECT
        id, name, zone_type, parent_id,
        ST_AsGeoJSON(geometry)::json as geometry,
        population, area_km2, metadata,
        created_at, updated_at
      FROM geo.zones
      ORDER BY name
    `);
    return result.rows;
  }

  // Get zone by ID
  static async getZoneById(id: number): Promise<GeoZone | null> {
    const result = await query(`
      SELECT
        id, name, zone_type, parent_id,
        ST_AsGeoJSON(geometry)::json as geometry,
        population, area_km2, metadata,
        created_at, updated_at
      FROM geo.zones
      WHERE id = $1
    `, [id]);
    return result.rows[0] || null;
  }

  // Get arroyo zones with risk levels
  static async getArroyoZones(riskLevel?: string): Promise<ArroyoZone[]> {
    let queryText = `
      SELECT
        id, name, zone_id,
        ST_AsGeoJSON(geometry)::json as geometry,
        risk_level, drainage_capacity_m3,
        last_incident_date, avg_flood_depth_cm,
        metadata, created_at, updated_at
      FROM geo.arroyo_zones
    `;

    const params: any[] = [];
    if (riskLevel) {
      queryText += ' WHERE risk_level = $1';
      params.push(riskLevel);
    }

    queryText += ' ORDER BY risk_level DESC, name';

    const result = await query(queryText, params);
    return result.rows;
  }

  // Get roads
  static async getRoads(roadType?: string): Promise<Road[]> {
    let queryText = `
      SELECT
        id, name, road_type,
        ST_AsGeoJSON(geometry)::json as geometry,
        lanes, max_speed_kmh, length_km, one_way,
        metadata, created_at, updated_at
      FROM geo.roads
    `;

    const params: any[] = [];
    if (roadType) {
      queryText += ' WHERE road_type = $1';
      params.push(roadType);
    }

    queryText += ' ORDER BY name';

    const result = await query(queryText, params);
    return result.rows;
  }

  // Get POIs by category
  static async getPOIs(category?: string): Promise<POI[]> {
    let queryText = `
      SELECT
        id, name, category,
        ST_AsGeoJSON(geometry)::json as geometry,
        zone_id, address, capacity,
        metadata, created_at, updated_at
      FROM geo.pois
    `;

    const params: any[] = [];
    if (category) {
      queryText += ' WHERE category = $1';
      params.push(category);
    }

    queryText += ' ORDER BY category, name';

    const result = await query(queryText, params);
    return result.rows;
  }

  // Get zones within a bounding box (for map viewport)
  static async getZonesInBounds(
    swLng: number,
    swLat: number,
    neLng: number,
    neLat: number
  ): Promise<GeoZone[]> {
    const result = await query(`
      SELECT
        id, name, zone_type, parent_id,
        ST_AsGeoJSON(geometry)::json as geometry,
        population, area_km2, metadata,
        created_at, updated_at
      FROM geo.zones
      WHERE ST_Intersects(
        geometry,
        ST_MakeEnvelope($1, $2, $3, $4, 4326)
      )
      ORDER BY name
    `, [swLng, swLat, neLng, neLat]);
    return result.rows;
  }
}
