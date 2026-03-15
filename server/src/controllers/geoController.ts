import { Request, Response, NextFunction } from 'express';
import { GeoService } from '@/services/geoService';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import type { ApiResponse } from '@/types';
import { ZoneImportService } from '@/services/zoneImportService.js';

export class GeoController {
  // GET /api/v1/geo/zones
  static async getZones(req: Request, res: Response, next: NextFunction) {
    try {
      const zones = await GeoService.getZones();

      const response: ApiResponse<typeof zones> = {
        status: 'success',
        data: zones,
        timestamp: new Date().toISOString(),
      };

      logger.info(`Retrieved ${zones.length} zones`);
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/geo/zones/:id
  static async getZoneById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(String(req.params.id), 10);

      if (isNaN(id)) {
        throw new AppError(400, 'Invalid zone ID');
      }

      const zone = await GeoService.getZoneById(id);

      if (!zone) {
        throw new AppError(404, `Zone with ID ${id} not found`);
      }

      const response: ApiResponse<typeof zone> = {
        status: 'success',
        data: zone,
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/geo/arroyos
  static async getArroyoZones(req: Request, res: Response, next: NextFunction) {
    try {
      const riskLevel = req.query.risk_level as string | undefined;

      if (riskLevel && !['low', 'medium', 'high', 'critical'].includes(riskLevel)) {
        throw new AppError(400, 'Invalid risk level. Must be: low, medium, high, or critical');
      }

      const arroyos = await GeoService.getArroyoZones(riskLevel);

      const response: ApiResponse<typeof arroyos> = {
        status: 'success',
        data: arroyos,
        timestamp: new Date().toISOString(),
      };

      logger.info(`Retrieved ${arroyos.length} arroyo zones`, { riskLevel });
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/geo/roads
  static async getRoads(req: Request, res: Response, next: NextFunction) {
    try {
      const roadType = req.query.type as string | undefined;
      const roads = await GeoService.getRoads(roadType);

      const response: ApiResponse<typeof roads> = {
        status: 'success',
        data: roads,
        timestamp: new Date().toISOString(),
      };

      logger.info(`Retrieved ${roads.length} roads`, { roadType });
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/geo/roads/flow
  static async getRoadsFlow(req: Request, res: Response, next: NextFunction) {
    try {
      const roadType = req.query.type as string | undefined;
      const roads = await GeoService.getRoadsFlow(roadType);

      const response: ApiResponse<typeof roads> = {
        status: 'success',
        data: roads,
        timestamp: new Date().toISOString(),
      };

      logger.info(`Retrieved ${roads.length} road flow segments`, { roadType });
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/geo/pois
  static async getPOIs(req: Request, res: Response, next: NextFunction) {
    try {
      const category = req.query.category as string | undefined;
      const pois = await GeoService.getPOIs(category);

      const response: ApiResponse<typeof pois> = {
        status: 'success',
        data: pois,
        timestamp: new Date().toISOString(),
      };

      logger.info(`Retrieved ${pois.length} POIs`, { category });
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/geo/zones/bounds
  static async getZonesInBounds(req: Request, res: Response, next: NextFunction) {
    try {
      const { sw_lng, sw_lat, ne_lng, ne_lat } = req.query;

      if (!sw_lng || !sw_lat || !ne_lng || !ne_lat) {
        throw new AppError(400, 'Missing bounding box parameters: sw_lng, sw_lat, ne_lng, ne_lat');
      }

      const swLng = parseFloat(sw_lng as string);
      const swLat = parseFloat(sw_lat as string);
      const neLng = parseFloat(ne_lng as string);
      const neLat = parseFloat(ne_lat as string);

      if (isNaN(swLng) || isNaN(swLat) || isNaN(neLng) || isNaN(neLat)) {
        throw new AppError(400, 'Invalid coordinates');
      }

      const zones = await GeoService.getZonesInBounds(swLng, swLat, neLng, neLat);

      const response: ApiResponse<typeof zones> = {
        status: 'success',
        data: zones,
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/geo/import-zones
  static async importZones(req: Request, res: Response, next: NextFunction) {
    try {
      const geojson = req.body?.geojson;
      const source = typeof req.body?.source === 'string' ? req.body.source : 'osm';
      const datasetVersion =
        typeof req.body?.dataset_version === 'string' ? req.body.dataset_version : undefined;

      if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
        throw new AppError(400, 'Invalid payload. Expected { geojson: FeatureCollection }');
      }

      const result = await ZoneImportService.importLocalitiesFromGeoJSON(geojson, {
        source,
        datasetVersion,
        zoneType: 'locality',
      });

      const response: ApiResponse<typeof result> = {
        status: 'success',
        data: result,
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}
