import { pool } from '@/db';
import { logger } from '@/utils/logger';
import { WeatherService, type WeatherData } from './weatherService.js';
import { GeoService } from './geoService.js';
import { EventsService } from './eventsService.js';
import { TrafficService, type TrafficData } from './trafficService.js';
import type { Event } from './eventsService.js';
import type { ArroyoZone } from '@/types';

type TrafficSource = 'historical' | 'mock' | 'tomtom';
type RoutingStrategy = 'balanced' | 'fastest' | 'resilient' | 'shortest' | 'low-risk';
type MatchQuality = 'exact' | 'alias' | 'partial' | 'historical';
type ProviderMode = 'mock' | 'tomtom';

interface TrafficProviderStatus {
  configured: boolean;
  active: ProviderMode;
  liveData: boolean;
  reason: string;
}

interface RoadMatchResult {
  traffic: TrafficData;
  quality: MatchQuality;
}

const STRATEGY_LABELS: Record<RoutingStrategy, string> = {
  balanced: 'Balanceada',
  fastest: 'Mas rapida',
  resilient: 'Trafico en vivo',
  shortest: 'Mas corta',
  'low-risk': 'Menor riesgo',
};

const ROAD_ALIASES: Record<string, string[]> = {
  'via 40': ['via 40', 'via40', 'avenida del rio'],
  'calle 30': ['calle 30', 'avenida murillo', 'murillo'],
  'calle 72': ['calle 72'],
  circunvalar: ['circunvalar', 'avenida circunvalar'],
  'carrera 38': ['carrera 38', 'cra 38', '38'],
  cordialidad: ['cordialidad', 'avenida cordialidad'],
};

export interface RoadData {
  road_id: number;
  road_name: string;
  road_type: string;
  lanes: number;
  max_speed_kmh: number;
  length_km: number;
  geometry: Record<string, unknown>;
  current_speed: number;
  congestion_level: string;
  traffic_source?: TrafficSource;
  live_data?: boolean;
  traffic_confidence?: number | null;
  road_closure?: boolean;
  traffic_updated_at?: string | null;
  match_quality?: MatchQuality;
  free_flow_speed_kmh?: number | null;
}

export interface RouteSegment {
  road_id: number;
  road_name: string;
  road_type: string;
  distance_km: number;
  estimated_time_minutes: number;
  current_speed_kmh: number;
  congestion_level: string;
  geometry: Record<string, unknown>;
  traffic_source?: TrafficSource;
  live_data?: boolean;
  road_closure?: boolean;
  traffic_confidence?: number | null;
  traffic_updated_at?: string | null;
}

export interface Route {
  route_id: string;
  segments: RouteSegment[];
  total_distance_km: number;
  estimated_time_minutes: number;
  average_speed_kmh: number;
  overall_score: number;
  score_breakdown: {
    traffic_score: number;
    weather_score: number;
    safety_score: number;
    distance_score: number;
  };
  warnings: string[];
  metadata: {
    total_roads: number;
    congested_segments: number;
    weather_affected: boolean;
    arroyo_risk: boolean;
    event_nearby: boolean;
    strategy?: RoutingStrategy;
    strategy_label?: string;
    live_traffic?: boolean;
    traffic_source?: TrafficSource;
    closure_segments?: number;
    low_confidence_segments?: number;
    provider_mode?: ProviderMode;
    live_reason?: string;
    last_live_update?: string | null;
  };
}

export interface RouteRequest {
  origin: {
    lat: number;
    lng: number;
  };
  destination: {
    lat: number;
    lng: number;
  };
  preferences?: {
    avoid_arroyos?: boolean;
    avoid_congestion?: boolean;
    avoid_events?: boolean;
    max_routes?: number;
  };
}

export class RoutingService {
  static async calculateRoutes(request: RouteRequest): Promise<Route[]> {
    try {
      logger.info('Calculating optimal routes...', {
        origin: request.origin,
        destination: request.destination,
        preferences: request.preferences,
      });

      this.validateCoordinates(request.origin);
      this.validateCoordinates(request.destination);

      const [weather, events, arroyos, roadsInArea, liveTraffic] = await Promise.all([
        WeatherService.getCurrentWeather(),
        EventsService.getUpcomingEvents(),
        GeoService.getArroyos('high'),
        this.getRoadsInArea(request.origin, request.destination),
        TrafficService.getRealTimeTraffic().catch((error) => {
          logger.warn('Live traffic unavailable for routing enrichment, using historical data only.', { error });
          return [];
        }),
      ]);

      if (roadsInArea.length === 0) {
        logger.warn('No roads found in the specified area');
        return [];
      }

      const providerStatus = TrafficService.getProviderStatus() as TrafficProviderStatus;
      const roads = this.enrichRoadsWithLiveTraffic(roadsInArea, liveTraffic, providerStatus);

      const maxRoutes = request.preferences?.max_routes || 3;
      const routes = await this.generateRouteAlternatives(
        request.origin,
        request.destination,
        roads,
        maxRoutes,
        request.preferences,
        providerStatus
      );

      const scoredRoutes = await Promise.all(
        routes.map(route =>
          this.scoreRoute(route, weather, events, arroyos, request.preferences, providerStatus)
        )
      );

      scoredRoutes.sort((a, b) => b.overall_score - a.overall_score);

      logger.info(`Generated ${scoredRoutes.length} route alternatives`, {
        liveTraffic: providerStatus.liveData,
        provider: providerStatus.active,
      });
      return scoredRoutes;
    } catch (error) {
      logger.error('Error calculating routes:', error);
      throw error;
    }
  }

  static async getOptimalRoute(request: RouteRequest): Promise<Route | null> {
    const routes = await this.calculateRoutes(request);
    return routes.length > 0 ? routes[0] : null;
  }

  private static validateCoordinates(coord: { lat: number; lng: number }): void {
    if (!coord.lat || !coord.lng) {
      throw new Error('Invalid coordinates: lat and lng are required');
    }

    const BOUNDS = {
      lat_min: 10.9,
      lat_max: 11.1,
      lng_min: -74.9,
      lng_max: -74.7,
    };

    if (
      coord.lat < BOUNDS.lat_min || coord.lat > BOUNDS.lat_max ||
      coord.lng < BOUNDS.lng_min || coord.lng > BOUNDS.lng_max
    ) {
      throw new Error('Coordinates outside Barranquilla bounds');
    }
  }

  private static async getRoadsInArea(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
  ): Promise<RoadData[]> {
    try {
      const buffer = 0.01;
      const minLat = Math.min(origin.lat, destination.lat) - buffer;
      const maxLat = Math.max(origin.lat, destination.lat) + buffer;
      const minLng = Math.min(origin.lng, destination.lng) - buffer;
      const maxLng = Math.max(origin.lng, destination.lng) + buffer;

      const query = `
        SELECT
          r.id as road_id,
          r.name as road_name,
          r.road_type,
          r.lanes,
          r.max_speed_kmh,
          r.length_km,
          ST_AsGeoJSON(r.geometry)::json as geometry,
          COALESCE(th.speed_kmh, r.max_speed_kmh) as current_speed,
          COALESCE(th.congestion_level, 'low') as congestion_level
        FROM geo.roads r
        LEFT JOIN LATERAL (
          SELECT speed_kmh, congestion_level
          FROM traffic_history
          WHERE road_id = r.id
            AND time >= NOW() - INTERVAL '15 minutes'
          ORDER BY time DESC
          LIMIT 1
        ) th ON true
        WHERE ST_Intersects(
          r.geometry,
          ST_MakeEnvelope($1, $2, $3, $4, 4326)
        )
        ORDER BY r.road_type, r.name
      `;

      const result = await pool.query(query, [minLng, minLat, maxLng, maxLat]);

      logger.info(`Found ${result.rows.length} roads in area`);
      return result.rows.map((road: RoadData) => ({
        ...road,
        traffic_source: 'historical',
        live_data: false,
        traffic_confidence: null,
        road_closure: false,
        traffic_updated_at: null,
        match_quality: 'historical',
        free_flow_speed_kmh: Number(road.max_speed_kmh) || null,
      }));
    } catch (error) {
      logger.error('Error fetching roads in area:', error);
      throw error;
    }
  }

  private static enrichRoadsWithLiveTraffic(
    roads: RoadData[],
    liveTraffic: TrafficData[],
    providerStatus: TrafficProviderStatus
  ): RoadData[] {
    if (liveTraffic.length === 0) {
      return roads.map(road => ({
        ...road,
        traffic_source: road.traffic_source ?? 'historical',
        live_data: false,
        match_quality: 'historical',
      }));
    }

    return roads.map((road) => {
      const match = this.findLiveTrafficMatch(road.road_name, liveTraffic);
      if (!match) {
        return {
          ...road,
          traffic_source: road.traffic_source ?? 'historical',
          live_data: false,
          match_quality: 'historical',
        };
      }

      const confidence =
        typeof match.traffic.metadata?.confidence === 'number'
          ? (match.traffic.metadata.confidence as number)
          : null;
      const freeFlow =
        typeof match.traffic.metadata?.free_flow_speed_kmh === 'number'
          ? Number(match.traffic.metadata.free_flow_speed_kmh)
          : Number(road.max_speed_kmh) || null;
      const closure = Boolean(match.traffic.metadata?.road_closure);

      return {
        ...road,
        current_speed: match.traffic.speed_kmh,
        congestion_level: match.traffic.congestion_level,
        traffic_source: match.traffic.source ?? providerStatus.active,
        live_data: providerStatus.liveData || match.traffic.source === 'tomtom',
        traffic_confidence: confidence,
        road_closure: closure,
        traffic_updated_at: match.traffic.last_updated,
        match_quality: match.quality,
        free_flow_speed_kmh: freeFlow,
      };
    });
  }

  private static findLiveTrafficMatch(roadName: string, liveTraffic: TrafficData[]): RoadMatchResult | null {
    const normalizedRoadName = this.normalizeRoadName(roadName);
    if (!normalizedRoadName) {
      return null;
    }

    const aliases = new Set([normalizedRoadName]);
    for (const [key, candidates] of Object.entries(ROAD_ALIASES)) {
      if (normalizedRoadName.includes(key) || candidates.some(alias => normalizedRoadName.includes(alias))) {
        aliases.add(key);
        candidates.forEach(alias => aliases.add(alias));
      }
    }

    let partialMatch: RoadMatchResult | null = null;

    for (const traffic of liveTraffic) {
      const normalizedTrafficName = this.normalizeRoadName(traffic.road_name);
      if (aliases.has(normalizedTrafficName) || normalizedTrafficName === normalizedRoadName) {
        return { traffic, quality: normalizedTrafficName === normalizedRoadName ? 'exact' : 'alias' };
      }

      if (
        normalizedRoadName.includes(normalizedTrafficName) ||
        normalizedTrafficName.includes(normalizedRoadName) ||
        [...aliases].some(alias => normalizedTrafficName.includes(alias) || alias.includes(normalizedTrafficName))
      ) {
        partialMatch = { traffic, quality: 'partial' };
      }
    }

    return partialMatch;
  }

  private static async generateRouteAlternatives(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    roads: RoadData[],
    maxRoutes: number,
    preferences: RouteRequest['preferences'] | undefined,
    providerStatus: TrafficProviderStatus
  ): Promise<Route[]> {
    const strategies: RoutingStrategy[] = [
      'balanced',
      'fastest',
      preferences?.avoid_congestion ? 'resilient' : 'shortest',
      preferences?.avoid_arroyos || preferences?.avoid_events ? 'low-risk' : 'resilient',
      'shortest',
    ];

    const uniqueStrategies = [...new Set(strategies)].slice(0, Math.max(maxRoutes, 3));
    const routes: Route[] = [];

    for (const strategy of uniqueStrategies) {
      const prioritizedRoads = [...roads].sort((a, b) => {
        const scoreDiff =
          this.scoreRoadForStrategy(b, strategy, preferences) -
          this.scoreRoadForStrategy(a, strategy, preferences);

        if (scoreDiff !== 0) {
          return scoreDiff;
        }

        return this.distanceToDestinationWeight(a, origin, destination) -
          this.distanceToDestinationWeight(b, origin, destination);
      });

      const route = this.createRoute(prioritizedRoads, roads, strategy, providerStatus);
      if (route && !this.isDuplicateRoute(route, routes)) {
        routes.push(route);
      }
    }

    return routes.slice(0, maxRoutes);
  }

  private static createRoute(
    priorityRoads: RoadData[],
    allRoads: RoadData[],
    strategy: RoutingStrategy,
    providerStatus: TrafficProviderStatus
  ): Route | null {
    if (priorityRoads.length === 0 && allRoads.length === 0) {
      return null;
    }

    const targetSegments = this.getSegmentTarget(strategy, priorityRoads.length || allRoads.length);
    const preferred = priorityRoads.filter(road => !road.road_closure);
    const candidatePool = preferred.length > 0 ? preferred : priorityRoads.length > 0 ? priorityRoads : allRoads;

    const selectedRoads: RoadData[] = [];
    for (const road of candidatePool) {
      if (selectedRoads.some(existing => existing.road_id === road.road_id)) {
        continue;
      }
      selectedRoads.push(road);
      if (selectedRoads.length >= targetSegments) {
        break;
      }
    }

    for (const road of allRoads) {
      if (selectedRoads.length >= targetSegments) {
        break;
      }
      if (!selectedRoads.some(existing => existing.road_id === road.road_id) && !road.road_closure) {
        selectedRoads.push(road);
      }
    }

    for (const road of allRoads) {
      if (selectedRoads.length >= targetSegments) {
        break;
      }
      if (!selectedRoads.some(existing => existing.road_id === road.road_id)) {
        selectedRoads.push(road);
      }
    }

    if (selectedRoads.length === 0) {
      return null;
    }

    const segments: RouteSegment[] = selectedRoads.map((road) => {
      const speed = Math.max(5, Number(road.current_speed) || 40);
      const distance = Math.max(0.2, Number(road.length_km) || 1);
      const time = (distance / speed) * 60;

      return {
        road_id: road.road_id,
        road_name: road.road_name,
        road_type: road.road_type,
        distance_km: distance,
        estimated_time_minutes: Math.round(time * 10) / 10,
        current_speed_kmh: speed,
        congestion_level: road.congestion_level || 'low',
        geometry: road.geometry,
        traffic_source: road.traffic_source,
        live_data: road.live_data,
        road_closure: road.road_closure,
        traffic_confidence: road.traffic_confidence ?? null,
        traffic_updated_at: road.traffic_updated_at ?? null,
      };
    });

    const totalDistance = segments.reduce((sum, seg) => sum + seg.distance_km, 0);
    const totalTime = segments.reduce((sum, seg) => sum + seg.estimated_time_minutes, 0);
    const avgSpeed = totalDistance > 0 ? (totalDistance / Math.max(totalTime / 60, 0.1)) : 40;
    const closureSegments = segments.filter(segment => segment.road_closure).length;
    const lowConfidenceSegments = segments.filter(
      segment => typeof segment.traffic_confidence === 'number' && segment.traffic_confidence < 0.7
    ).length;
    const dominantTrafficSource = this.getDominantTrafficSource(segments);

    return {
      route_id: `route-${strategy}-${selectedRoads.map(road => road.road_id).join('-')}`,
      segments,
      total_distance_km: Math.round(totalDistance * 10) / 10,
      estimated_time_minutes: Math.round(totalTime),
      average_speed_kmh: Math.round(avgSpeed),
      overall_score: 0,
      score_breakdown: {
        traffic_score: 0,
        weather_score: 0,
        safety_score: 0,
        distance_score: 0,
      },
      warnings: [],
      metadata: {
        total_roads: segments.length,
        congested_segments: segments.filter(
          segment => segment.congestion_level === 'high' || segment.congestion_level === 'severe'
        ).length,
        weather_affected: false,
        arroyo_risk: false,
        event_nearby: false,
        strategy,
        strategy_label: STRATEGY_LABELS[strategy],
        live_traffic: segments.some(segment => segment.live_data),
        traffic_source: dominantTrafficSource,
        closure_segments: closureSegments,
        low_confidence_segments: lowConfidenceSegments,
        provider_mode: providerStatus.active,
        live_reason: providerStatus.reason,
        last_live_update: this.getLastLiveUpdate(segments),
      },
    };
  }

  private static scoreRoadForStrategy(
    road: RoadData,
    strategy: RoutingStrategy,
    preferences?: RouteRequest['preferences']
  ): number {
    const speedRatio = road.max_speed_kmh > 0
      ? Math.min(Number(road.current_speed) / Number(road.max_speed_kmh), 1.2)
      : 0.5;
    const congestionPenalty = this.getCongestionPenalty(road.congestion_level);
    const liveBonus = road.live_data ? 8 : 0;
    const confidenceBonus =
      typeof road.traffic_confidence === 'number' ? Math.round(road.traffic_confidence * 8) : 2;
    const closurePenalty = road.road_closure ? 60 : 0;
    const roadTypeBonus = this.getRoadTypeBonus(road.road_type);
    const lanesBonus = Math.min(Number(road.lanes) || 1, 4) * 2;
    const distancePenalty = Math.min(Number(road.length_km) || 1, 8) * 3;

    let score = speedRatio * 45 + roadTypeBonus + lanesBonus + liveBonus + confidenceBonus;

    if (strategy === 'fastest') {
      score += speedRatio * 25 - congestionPenalty * 0.7;
    } else if (strategy === 'shortest') {
      score += 30 - distancePenalty * 1.3 - congestionPenalty * 0.4;
    } else if (strategy === 'resilient') {
      score += liveBonus * 2 + confidenceBonus * 1.5 - congestionPenalty - closurePenalty * 0.6;
    } else if (strategy === 'low-risk') {
      score += 18 - congestionPenalty * 0.8 - closurePenalty * 0.8;
    } else {
      score += 15 - congestionPenalty * 0.6 - distancePenalty * 0.5;
    }

    if (preferences?.avoid_congestion) {
      score -= congestionPenalty * 0.6;
    }
    if (preferences?.avoid_arroyos || preferences?.avoid_events) {
      score -= road.road_type === 'highway' ? 0 : 4;
    }

    return score - closurePenalty;
  }

  private static getRoadTypeBonus(roadType: string): number {
    const bonuses: Record<string, number> = {
      highway: 18,
      primary: 12,
      secondary: 8,
      tertiary: 5,
      residential: 2,
    };

    return bonuses[roadType] ?? 4;
  }

  private static getCongestionPenalty(level: string): number {
    const penalties: Record<string, number> = {
      low: 5,
      moderate: 18,
      high: 35,
      severe: 55,
    };

    return penalties[level] ?? 20;
  }

  private static getSegmentTarget(strategy: RoutingStrategy, availableRoads: number): number {
    const base = strategy === 'shortest' ? 3 : strategy === 'fastest' ? 4 : 5;
    return Math.max(2, Math.min(base, availableRoads));
  }

  private static distanceToDestinationWeight(
    road: RoadData,
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
  ): number {
    const points = this.extractGeometryPoints(road.geometry);
    if (points.length === 0) {
      return this.haversineDistance(origin, destination);
    }

    const destinationWeight = points.reduce((best, point) => {
      return Math.min(best, this.haversineDistance({ lat: point[1], lng: point[0] }, destination));
    }, Number.POSITIVE_INFINITY);

    return destinationWeight;
  }

  private static extractGeometryPoints(geometry: Record<string, unknown>): number[][] {
    if (!geometry || typeof geometry !== 'object') {
      return [];
    }

    const coordinates = geometry.coordinates;
    if (!Array.isArray(coordinates)) {
      return [];
    }

    if (coordinates.length > 0 && Array.isArray(coordinates[0]) && typeof coordinates[0][0] === 'number') {
      return coordinates as number[][];
    }

    return [];
  }

  private static haversineDistance(
    pointA: { lat: number; lng: number },
    pointB: { lat: number; lng: number }
  ): number {
    const earthRadiusKm = 6371;
    const dLat = this.toRadians(pointB.lat - pointA.lat);
    const dLng = this.toRadians(pointB.lng - pointA.lng);
    const lat1 = this.toRadians(pointA.lat);
    const lat2 = this.toRadians(pointB.lat);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  }

  private static toRadians(value: number): number {
    return value * (Math.PI / 180);
  }

  private static isDuplicateRoute(route: Route, existingRoutes: Route[]): boolean {
    for (const existing of existingRoutes) {
      const routeRoads = route.segments.map(segment => segment.road_id).sort().join(',');
      const existingRoads = existing.segments.map(segment => segment.road_id).sort().join(',');

      if (routeRoads === existingRoads) {
        return true;
      }
    }
    return false;
  }

  private static async scoreRoute(
    route: Route,
    weather: WeatherData,
    events: Event[],
    arroyos: ArroyoZone[],
    preferences: RouteRequest['preferences'] | undefined,
    providerStatus: TrafficProviderStatus
  ): Promise<Route> {
    const trafficScore = this.calculateTrafficScore(route, preferences);
    const weatherScore = this.calculateWeatherScore(route, weather);
    const safetyScore = this.calculateSafetyScore(route, arroyos, events, preferences);
    const distanceScore = this.calculateDistanceScore(route);

    const weights = {
      traffic: 0.35,
      weather: 0.20,
      safety: 0.30,
      distance: 0.15,
    };

    if (preferences?.avoid_congestion) weights.traffic += 0.15;
    if (preferences?.avoid_arroyos) weights.safety += 0.15;
    if (preferences?.avoid_events) weights.safety += 0.10;

    const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    Object.keys(weights).forEach((key) => {
      weights[key as keyof typeof weights] /= totalWeight;
    });

    const liveBoost =
      route.metadata.live_traffic && providerStatus.liveData && route.metadata.traffic_source === 'tomtom'
        ? 3
        : 0;
    const overallScore = Math.round(
      trafficScore * weights.traffic +
      weatherScore * weights.weather +
      safetyScore * weights.safety +
      distanceScore * weights.distance +
      liveBoost
    );

    route.overall_score = Math.max(0, Math.min(100, overallScore));
    route.score_breakdown = {
      traffic_score: trafficScore,
      weather_score: weatherScore,
      safety_score: safetyScore,
      distance_score: distanceScore,
    };
    route.warnings = this.generateWarnings(route, weather, arroyos, events, providerStatus);

    return route;
  }

  private static calculateTrafficScore(route: Route, preferences?: RouteRequest['preferences']): number {
    const congestionScores = {
      low: 100,
      moderate: 72,
      high: 42,
      severe: 12,
    };

    const baseScore = route.segments.reduce((sum, segment) => {
      const congestionScore = congestionScores[segment.congestion_level as keyof typeof congestionScores] || 50;
      const liveBonus = segment.live_data ? 4 : 0;
      const closurePenalty = segment.road_closure ? 55 : 0;
      const confidencePenalty =
        typeof segment.traffic_confidence === 'number' && segment.traffic_confidence < 0.7 ? 8 : 0;

      return sum + congestionScore + liveBonus - closurePenalty - confidencePenalty;
    }, 0) / route.segments.length;

    let finalScore = baseScore;

    if (route.metadata.congested_segments > 0) {
      finalScore -= route.metadata.congested_segments * 5;
    }
    if (route.metadata.closure_segments) {
      finalScore -= route.metadata.closure_segments * 12;
    }
    if (preferences?.avoid_congestion) {
      finalScore -= route.metadata.congested_segments * 8;
    }

    return Math.max(Math.round(finalScore), 0);
  }

  private static calculateWeatherScore(route: Route, weather: WeatherData): number {
    let score = 100;

    score -= weather.rain_probability * 0.5;

    if (weather.temperature > 35) {
      score -= (weather.temperature - 35) * 2;
    }

    if (weather.wind_speed > 30) {
      score -= (weather.wind_speed - 30);
    }

    const severeConditions = ['Thunderstorm', 'Heavy Rain', 'Storm'];
    if (severeConditions.includes(weather.condition)) {
      score -= 30;
    }

    if (route.metadata.live_traffic && weather.rain_probability > 55) {
      score -= 8;
    }

    route.metadata.weather_affected = score < 70;

    return Math.max(Math.round(score), 0);
  }

  private static calculateSafetyScore(
    route: Route,
    arroyos: ArroyoZone[],
    events: Event[],
    preferences?: RouteRequest['preferences']
  ): number {
    let score = 100;

    if (arroyos.length > 0) {
      score -= arroyos.length * 10;
      route.metadata.arroyo_risk = true;
    }

    if (events.length > 0) {
      score -= events.length * 5;
      route.metadata.event_nearby = true;
    }

    if (route.metadata.closure_segments) {
      score -= route.metadata.closure_segments * 10;
    }

    if (preferences?.avoid_arroyos && route.metadata.arroyo_risk) {
      score -= 8;
    }
    if (preferences?.avoid_events && route.metadata.event_nearby) {
      score -= 6;
    }

    return Math.max(Math.round(score), 0);
  }

  private static calculateDistanceScore(route: Route): number {
    const maxDistance = 30;
    const normalizedDistance = Math.min(route.total_distance_km / maxDistance, 1);
    const score = (1 - normalizedDistance) * 100;

    return Math.round(score);
  }

  private static generateWarnings(
    route: Route,
    weather: WeatherData,
    arroyos: ArroyoZone[],
    events: Event[],
    providerStatus: TrafficProviderStatus
  ): string[] {
    const warnings: string[] = [];

    if (route.metadata.live_traffic && route.metadata.traffic_source === 'tomtom') {
      warnings.push(`Ruta evaluada con trafico en vivo (${route.metadata.strategy_label?.toLowerCase() ?? 'prioridad actual'}).`);
    }

    if (route.metadata.closure_segments && route.metadata.closure_segments > 0) {
      warnings.push(`${route.metadata.closure_segments} tramo(s) presentan cierre o bloqueo reportado.`);
    }

    if (route.metadata.congested_segments > 0) {
      warnings.push(`${route.metadata.congested_segments} tramo(s) con congestion alta o severa.`);
    }

    if (route.metadata.low_confidence_segments && route.metadata.low_confidence_segments > 0) {
      warnings.push('Algunos segmentos tienen confianza limitada en el dato de trafico.');
    }

    if (weather.rain_probability > 50) {
      warnings.push(`Alta probabilidad de lluvia (${weather.rain_probability}%).`);
    }

    if (arroyos.length > 0) {
      warnings.push(`Ruta cercana a ${arroyos.length} zona(s) de arroyo de riesgo alto.`);
    }

    if (events.length > 0) {
      warnings.push(`${events.length} evento(s) cercanos pueden generar demoras adicionales.`);
    }

    if (route.average_speed_kmh < 25) {
      warnings.push('Tiempo de viaje lento esperado por condiciones actuales.');
    }

    if (!providerStatus.liveData && providerStatus.active === 'mock') {
      warnings.push('Sin proveedor live disponible; se combinaron historicos y simulacion.');
    }

    return [...new Set(warnings)];
  }

  private static getDominantTrafficSource(segments: RouteSegment[]): TrafficSource {
    const counts = segments.reduce<Record<string, number>>((acc, segment) => {
      const source = segment.traffic_source ?? 'historical';
      acc[source] = (acc[source] ?? 0) + 1;
      return acc;
    }, {});

    if ((counts.tomtom ?? 0) >= (counts.historical ?? 0) && (counts.tomtom ?? 0) >= (counts.mock ?? 0)) {
      return 'tomtom';
    }
    if ((counts.mock ?? 0) > (counts.historical ?? 0)) {
      return 'mock';
    }
    return 'historical';
  }

  private static getLastLiveUpdate(segments: RouteSegment[]): string | null {
    const values = segments
      .map(segment => segment.traffic_updated_at)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    return values[0] ?? null;
  }

  private static normalizeRoadName(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
