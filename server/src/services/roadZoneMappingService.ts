import { pool } from '@/db';
import { CacheService } from './cacheService.js';
import { logger } from '@/utils/logger.js';

interface CachedRoadZoneMap {
  version: number;
  zonesByRoadId: Record<string, number | null>;
}

export class RoadZoneMappingService {
  private static readonly CACHE_KEY = 'road-zone-map:v1';
  private static readonly MEMORY_TTL_MS = 10 * 60 * 1000;
  private static readonly REDIS_TTL_SECONDS = CacheService.TTL.HOUR;
  private static memoryCache: {
    expiresAt: number;
    zonesByRoadId: Map<number, number | null>;
  } | null = null;

  static async getZonesForRoads(roadIds: number[]): Promise<Map<number, number | null>> {
    if (roadIds.length === 0) return new Map();

    const uniqueRoadIds = Array.from(new Set(roadIds.filter((id) => Number.isFinite(id))));
    if (uniqueRoadIds.length === 0) return new Map();

    const cachedMap = await this.getFullMapFromCaches();
    const missingIds = uniqueRoadIds.filter((roadId) => !cachedMap.has(roadId));

    if (missingIds.length > 0) {
      const resolved = await this.resolveZonesForRoadIds(missingIds);
      for (const [roadId, zoneId] of resolved.entries()) {
        cachedMap.set(roadId, zoneId);
      }
      await this.storeFullMapInCaches(cachedMap);
    }

    const result = new Map<number, number | null>();
    for (const roadId of uniqueRoadIds) {
      result.set(roadId, cachedMap.get(roadId) ?? null);
    }

    return result;
  }

  static async invalidateCache(): Promise<void> {
    this.memoryCache = null;
    await CacheService.delete(this.CACHE_KEY, { namespace: CacheService.Namespaces.GEO });
  }

  private static async getFullMapFromCaches(): Promise<Map<number, number | null>> {
    const now = Date.now();
    if (this.memoryCache && this.memoryCache.expiresAt > now) {
      return new Map(this.memoryCache.zonesByRoadId);
    }

    const redisPayload = await CacheService.get<CachedRoadZoneMap>(
      this.CACHE_KEY,
      CacheService.Namespaces.GEO
    );

    if (redisPayload?.version === 1 && redisPayload.zonesByRoadId) {
      const zonesByRoadId = new Map<number, number | null>();
      for (const [roadIdRaw, zoneId] of Object.entries(redisPayload.zonesByRoadId)) {
        const roadId = Number(roadIdRaw);
        if (Number.isFinite(roadId)) {
          zonesByRoadId.set(roadId, zoneId === null ? null : Number(zoneId));
        }
      }
      this.memoryCache = {
        expiresAt: now + this.MEMORY_TTL_MS,
        zonesByRoadId,
      };
      return new Map(zonesByRoadId);
    }

    return new Map();
  }

  private static async storeFullMapInCaches(
    zonesByRoadId: Map<number, number | null>
  ): Promise<void> {
    this.memoryCache = {
      expiresAt: Date.now() + this.MEMORY_TTL_MS,
      zonesByRoadId: new Map(zonesByRoadId),
    };

    const payload: CachedRoadZoneMap = {
      version: 1,
      zonesByRoadId: Object.fromEntries(Array.from(zonesByRoadId.entries()).map(([k, v]) => [String(k), v])),
    };

    const saved = await CacheService.set(
      this.CACHE_KEY,
      payload,
      this.REDIS_TTL_SECONDS,
      CacheService.Namespaces.GEO
    );

    if (!saved) {
      logger.warn('Road-zone map was updated in memory but failed to persist to Redis cache');
    }
  }

  private static async resolveZonesForRoadIds(roadIds: number[]): Promise<Map<number, number | null>> {
    const query = `
      SELECT
        r.id AS road_id,
        COALESCE(
          CASE
            WHEN (r.metadata ->> 'zone_id') ~ '^[0-9]+$'
            THEN (r.metadata ->> 'zone_id')::int
            ELSE NULL
          END,
          zone_hit.zone_id,
          nearest.zone_id
        ) AS zone_id
      FROM geo.roads r
      LEFT JOIN LATERAL (
        SELECT z.id AS zone_id
        FROM geo.zones z
        WHERE ST_Intersects(z.geometry, r.geometry)
        ORDER BY ST_Length(ST_Intersection(z.geometry, r.geometry)::geography) DESC NULLS LAST
        LIMIT 1
      ) zone_hit ON true
      LEFT JOIN LATERAL (
        SELECT z.id AS zone_id
        FROM geo.zones z
        ORDER BY ST_Distance(ST_Centroid(z.geometry)::geography, ST_Centroid(r.geometry)::geography) ASC
        LIMIT 1
      ) nearest ON true
      WHERE r.id = ANY($1::int[])
    `;

    const result = await pool.query(query, [roadIds]);
    const map = new Map<number, number | null>();

    for (const row of result.rows) {
      const roadId = Number(row.road_id);
      const zoneId = row.zone_id === null ? null : Number(row.zone_id);
      if (Number.isFinite(roadId)) {
        map.set(roadId, Number.isFinite(zoneId as number) ? zoneId : null);
      }
    }

    return map;
  }
}

