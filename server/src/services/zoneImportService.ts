import { pool } from '@/db';
import { logger } from '@/utils/logger.js';
import { CacheService } from './cacheService.js';
import { RoadZoneMappingService } from './roadZoneMappingService.js';

interface GeoJSONGeometry {
  type: string;
  coordinates: unknown;
}

interface GeoJSONFeature {
  type: 'Feature';
  properties?: Record<string, unknown>;
  geometry?: GeoJSONGeometry | null;
}

interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

export interface ImportZonesOptions {
  source?: string;
  datasetVersion?: string;
  zoneType?: string;
}

export interface ImportZonesResult {
  inserted: number;
  updated: number;
  skipped: number;
  totalProcessed: number;
}

export class ZoneImportService {
  private static readonly BARRANQUILLA_BOUNDS = {
    swLng: -74.92,
    swLat: 10.84,
    neLng: -74.67,
    neLat: 11.10,
  };

  static async importLocalitiesFromGeoJSON(
    featureCollection: GeoJSONFeatureCollection,
    options: ImportZonesOptions = {}
  ): Promise<ImportZonesResult> {
    if (!featureCollection || featureCollection.type !== 'FeatureCollection') {
      throw new Error('Invalid GeoJSON payload: expected FeatureCollection');
    }

    const source = options.source ?? 'osm';
    const zoneType = options.zoneType ?? 'locality';
    const datasetVersion = options.datasetVersion ?? new Date().toISOString().slice(0, 10);

    const client = await pool.connect();
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    try {
      await client.query('BEGIN');

      for (const feature of featureCollection.features) {
        const zoneName = this.getZoneName(feature.properties);
        if (!zoneName || !feature.geometry) {
          skipped += 1;
          continue;
        }

        const geometry = JSON.stringify(feature.geometry);
        const validation = await client.query(
          `
            WITH geom AS (
              SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS g
            )
            SELECT
              ST_IsValid(g) AS is_valid,
              ST_GeometryType(g) AS geometry_type,
              ST_Intersects(
                g,
                ST_MakeEnvelope($2, $3, $4, $5, 4326)
              ) AS inside_bounds
            FROM geom
          `,
          [
            geometry,
            this.BARRANQUILLA_BOUNDS.swLng,
            this.BARRANQUILLA_BOUNDS.swLat,
            this.BARRANQUILLA_BOUNDS.neLng,
            this.BARRANQUILLA_BOUNDS.neLat,
          ]
        );

        const row = validation.rows[0];
        const isValid = row?.is_valid === true;
        const geometryType = String(row?.geometry_type ?? '');
        const insideBounds = row?.inside_bounds === true;

        if (!isValid || !insideBounds || !geometryType.includes('Polygon')) {
          skipped += 1;
          continue;
        }

        const metadata = {
          ...(feature.properties ?? {}),
          source,
          dataset_version: datasetVersion,
          imported_at: new Date().toISOString(),
        };

        const upsert = await client.query(
          `
            INSERT INTO geo.zones (name, zone_type, geometry, metadata, area_km2)
            VALUES (
              $1,
              $2,
              ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)),
              $4::jsonb,
              ROUND((ST_Area(ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($3), 4326))::geography) / 1000000.0)::numeric, 4)
            )
            ON CONFLICT (name)
            DO UPDATE SET
              zone_type = EXCLUDED.zone_type,
              geometry = EXCLUDED.geometry,
              metadata = COALESCE(geo.zones.metadata, '{}'::jsonb) || EXCLUDED.metadata,
              area_km2 = EXCLUDED.area_km2,
              updated_at = NOW()
            RETURNING (xmax = 0) AS inserted
          `,
          [zoneName, zoneType, geometry, JSON.stringify(metadata)]
        );

        const wasInserted = upsert.rows[0]?.inserted === true;
        if (wasInserted) inserted += 1;
        else updated += 1;
      }

      await client.query('COMMIT');

      await Promise.all([
        CacheService.invalidateNamespace(CacheService.Namespaces.GEO),
        RoadZoneMappingService.invalidateCache(),
      ]);

      logger.info('Localities import completed', {
        inserted,
        updated,
        skipped,
        totalProcessed: featureCollection.features.length,
      });

      return {
        inserted,
        updated,
        skipped,
        totalProcessed: featureCollection.features.length,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to import localities GeoJSON', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private static getZoneName(properties?: Record<string, unknown>): string | null {
    if (!properties) return null;

    const candidates = [
      properties.name,
      properties.name_es,
      properties.NOMBRE,
      properties.locality,
    ];

    for (const value of candidates) {
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }

    return null;
  }
}

