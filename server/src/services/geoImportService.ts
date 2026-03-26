import { pool } from '@/db';
import { CacheService } from './cacheService.js';
import { RoadZoneMappingService } from './roadZoneMappingService.js';
import { logger } from '@/utils/logger.js';

interface GeoJSONGeometry {
  type: string;
  coordinates: unknown;
}

interface GeoJSONFeature {
  type: 'Feature';
  id?: string | number;
  properties?: Record<string, unknown>;
  geometry?: GeoJSONGeometry | null;
}

interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

export interface ImportGeoResult {
  inserted: number;
  updated: number;
  skipped: number;
  totalProcessed: number;
}

export class GeoImportService {
  static async importRoadsFromGeoJSON(
    featureCollection: GeoJSONFeatureCollection,
    source: string = 'osm',
    datasetVersion?: string
  ): Promise<ImportGeoResult> {
    if (!featureCollection || featureCollection.type !== 'FeatureCollection') {
      throw new Error('Invalid GeoJSON payload: expected FeatureCollection');
    }

    const client = await pool.connect();
    const dataset = datasetVersion ?? new Date().toISOString().slice(0, 10);
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    try {
      await client.query('BEGIN');
      for (const feature of featureCollection.features) {
        const name = this.getName(feature.properties);
        const geometry = feature.geometry;
        if (!name || !geometry || geometry.type !== 'LineString') {
          skipped += 1;
          continue;
        }

        const metadata = {
          ...(feature.properties ?? {}),
          source,
          dataset_version: dataset,
          source_id: feature.id ?? feature.properties?.id ?? null,
          imported_at: new Date().toISOString(),
        };

        const roadType = this.pickRoadType(feature.properties);
        const upsert = await client.query(
          `
            INSERT INTO geo.roads (name, road_type, geometry, metadata, lanes, max_speed_kmh, length_km)
            VALUES (
              $1,
              $2,
              ST_SetSRID(ST_GeomFromGeoJSON($3), 4326),
              $4::jsonb,
              $5,
              $6,
              ROUND((ST_Length(ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)::geography) / 1000.0)::numeric, 4)
            )
            ON CONFLICT (name)
            DO UPDATE SET
              road_type = EXCLUDED.road_type,
              geometry = EXCLUDED.geometry,
              metadata = COALESCE(geo.roads.metadata, '{}'::jsonb) || EXCLUDED.metadata,
              lanes = EXCLUDED.lanes,
              max_speed_kmh = EXCLUDED.max_speed_kmh,
              length_km = EXCLUDED.length_km,
              updated_at = NOW()
            RETURNING (xmax = 0) AS inserted
          `,
          [
            name,
            roadType,
            JSON.stringify(geometry),
            JSON.stringify(metadata),
            this.pickLanes(feature.properties),
            this.pickMaxSpeed(feature.properties),
          ]
        );

        if (upsert.rows[0]?.inserted) inserted += 1;
        else updated += 1;
      }

      await client.query('COMMIT');
      await Promise.all([
        CacheService.invalidateNamespace(CacheService.Namespaces.GEO),
        RoadZoneMappingService.invalidateCache(),
      ]);
      return { inserted, updated, skipped, totalProcessed: featureCollection.features.length };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error importing roads from GeoJSON', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async importArroyosFromGeoJSON(
    featureCollection: GeoJSONFeatureCollection,
    source: string = 'official',
    datasetVersion?: string
  ): Promise<ImportGeoResult> {
    if (!featureCollection || featureCollection.type !== 'FeatureCollection') {
      throw new Error('Invalid GeoJSON payload: expected FeatureCollection');
    }

    const client = await pool.connect();
    const dataset = datasetVersion ?? new Date().toISOString().slice(0, 10);
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    try {
      await client.query('BEGIN');
      for (const feature of featureCollection.features) {
        const name = this.getName(feature.properties);
        const geometry = feature.geometry;
        if (!name || !geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) {
          skipped += 1;
          continue;
        }

        const zoneName = this.pickZoneName(feature.properties);
        const zoneRes = zoneName
          ? await client.query(`SELECT id FROM geo.zones WHERE LOWER(name) = LOWER($1) LIMIT 1`, [zoneName])
          : { rows: [] as Array<{ id: number }> };
        const zoneId = zoneRes.rows[0]?.id ?? null;

        const metadata = {
          ...(feature.properties ?? {}),
          source,
          dataset_version: dataset,
          source_id: feature.id ?? feature.properties?.id ?? null,
          imported_at: new Date().toISOString(),
        };

        const riskLevel = this.pickRiskLevel(feature.properties);
        const upsert = await client.query(
          `
            INSERT INTO geo.arroyo_zones (name, zone_id, geometry, risk_level, metadata)
            VALUES (
              $1,
              $2,
              ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)),
              $4,
              $5::jsonb
            )
            ON CONFLICT (name)
            DO UPDATE SET
              zone_id = EXCLUDED.zone_id,
              geometry = EXCLUDED.geometry,
              risk_level = EXCLUDED.risk_level,
              metadata = COALESCE(geo.arroyo_zones.metadata, '{}'::jsonb) || EXCLUDED.metadata,
              updated_at = NOW()
            RETURNING (xmax = 0) AS inserted
          `,
          [name, zoneId, JSON.stringify(geometry), riskLevel, JSON.stringify(metadata)]
        );

        if (upsert.rows[0]?.inserted) inserted += 1;
        else updated += 1;
      }

      await client.query('COMMIT');
      await CacheService.invalidateNamespace(CacheService.Namespaces.GEO);
      return { inserted, updated, skipped, totalProcessed: featureCollection.features.length };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error importing arroyos from GeoJSON', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private static getName(properties?: Record<string, unknown>): string | null {
    if (!properties) return null;
    const candidates = [properties.name, properties.name_es, properties.NOMBRE, properties.locality];
    for (const value of candidates) {
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return null;
  }

  private static pickRoadType(properties?: Record<string, unknown>): string {
    const value = properties?.road_type ?? properties?.highway ?? properties?.type;
    if (typeof value !== 'string') return 'avenue';
    if (['highway', 'avenue', 'street', 'transversal', 'carrera', 'calle'].includes(value)) {
      return value;
    }
    return 'avenue';
  }

  private static pickLanes(properties?: Record<string, unknown>): number | null {
    const value = properties?.lanes;
    if (typeof value === 'number' && Number.isFinite(value)) return Math.max(1, Math.round(value));
    if (typeof value === 'string' && /^\d+$/.test(value)) return Math.max(1, parseInt(value, 10));
    return null;
  }

  private static pickMaxSpeed(properties?: Record<string, unknown>): number | null {
    const value = properties?.maxspeed ?? properties?.max_speed_kmh;
    if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
    if (typeof value === 'string') {
      const parsed = value.match(/\d+/);
      if (parsed) return parseInt(parsed[0], 10);
    }
    return null;
  }

  private static pickRiskLevel(properties?: Record<string, unknown>): 'low' | 'medium' | 'high' | 'critical' {
    const value = typeof properties?.risk_level === 'string' ? properties.risk_level.toLowerCase() : 'medium';
    if (value === 'low' || value === 'medium' || value === 'high' || value === 'critical') {
      return value;
    }
    return 'medium';
  }

  private static pickZoneName(properties?: Record<string, unknown>): string | null {
    const value = properties?.zone_name ?? properties?.localidad ?? properties?.zone;
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }
}

