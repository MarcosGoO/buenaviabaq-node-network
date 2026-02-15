import { pool } from '@/db';
import { logger } from '@/utils/logger';
import { WeatherService } from './weatherService.js';
import { GeoService } from './geoService.js';
import { EventsService } from './eventsService.js';

/**
 * Route segment interface
 */
export interface RouteSegment {
  road_id: number;
  road_name: string;
  road_type: string;
  distance_km: number;
  estimated_time_minutes: number;
  current_speed_kmh: number;
  congestion_level: string;
  geometry: any;
}

/**
 * Complete route interface
 */
export interface Route {
  route_id: string;
  segments: RouteSegment[];
  total_distance_km: number;
  estimated_time_minutes: number;
  average_speed_kmh: number;
  overall_score: number; // 0-100 (higher is better)
  score_breakdown: {
    traffic_score: number; // 0-100
    weather_score: number; // 0-100
    safety_score: number; // 0-100 (arroyos, events)
    distance_score: number; // 0-100 (shorter is better)
  };
  warnings: string[];
  metadata: {
    total_roads: number;
    congested_segments: number;
    weather_affected: boolean;
    arroyo_risk: boolean;
    event_nearby: boolean;
  };
}

/**
 * Route request parameters
 */
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
    max_routes?: number; // Number of alternative routes (1-5, default 3)
  };
}

/**
 * RoutingService
 * Intelligent routing considering traffic, weather, arroyos, and events
 * Sprint 6.2 - Intelligent Routing
 */
export class RoutingService {
  /**
   * Calculate optimal routes from origin to destination
   * Returns multiple route alternatives sorted by score
   */
  static async calculateRoutes(request: RouteRequest): Promise<Route[]> {
    try {
      logger.info('Calculating optimal routes...', {
        origin: request.origin,
        destination: request.destination
      });

      // Validate coordinates
      this.validateCoordinates(request.origin);
      this.validateCoordinates(request.destination);

      // Get available roads in the area
      const roads = await this.getRoadsInArea(request.origin, request.destination);

      if (roads.length === 0) {
        logger.warn('No roads found in the specified area');
        return [];
      }

      // Get current conditions
      const [weather, events, arroyos] = await Promise.all([
        WeatherService.getCurrentWeather(),
        EventsService.getUpcomingEvents(),
        GeoService.getArroyos('high')
      ]);

      // Generate route alternatives
      const maxRoutes = request.preferences?.max_routes || 3;
      const routes = await this.generateRouteAlternatives(
        request.origin,
        request.destination,
        roads,
        maxRoutes
      );

      // Score each route
      const scoredRoutes = await Promise.all(
        routes.map(route => this.scoreRoute(route, weather, events, arroyos, request.preferences))
      );

      // Sort by score (highest first)
      scoredRoutes.sort((a, b) => b.overall_score - a.overall_score);

      logger.info(`Generated ${scoredRoutes.length} route alternatives`);
      return scoredRoutes;
    } catch (error) {
      logger.error('Error calculating routes:', error);
      throw error;
    }
  }

  /**
   * Get the single best route (highest score)
   */
  static async getOptimalRoute(request: RouteRequest): Promise<Route | null> {
    const routes = await this.calculateRoutes(request);
    return routes.length > 0 ? routes[0] : null;
  }

  /**
   * Validate coordinate object
   */
  private static validateCoordinates(coord: { lat: number; lng: number }): void {
    if (!coord.lat || !coord.lng) {
      throw new Error('Invalid coordinates: lat and lng are required');
    }

    // Barranquilla bounds (approximate)
    const BOUNDS = {
      lat_min: 10.9,
      lat_max: 11.1,
      lng_min: -74.9,
      lng_max: -74.7
    };

    if (
      coord.lat < BOUNDS.lat_min || coord.lat > BOUNDS.lat_max ||
      coord.lng < BOUNDS.lng_min || coord.lng > BOUNDS.lng_max
    ) {
      throw new Error('Coordinates outside Barranquilla bounds');
    }
  }

  /**
   * Get roads within the bounding box of origin and destination
   */
  private static async getRoadsInArea(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
  ) {
    try {
      // Create bounding box with some buffer (0.01 degrees ~ 1km)
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
            AND time >= NOW() - INTERVAL '30 minutes'
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
      return result.rows;
    } catch (error) {
      logger.error('Error fetching roads in area:', error);
      throw error;
    }
  }

  /**
   * Generate multiple route alternatives
   * Simplified implementation - creates route variants by selecting different road priorities
   */
  private static async generateRouteAlternatives(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    roads: any[],
    maxRoutes: number
  ): Promise<Route[]> {
    const routes: Route[] = [];

    // Strategy 1: Fastest route (prefer highways and high-speed roads)
    const fastestRoute = this.createRoute(
      roads.filter(r => r.road_type === 'highway' || r.current_speed > 50),
      roads,
      'fastest',
      origin,
      destination
    );
    if (fastestRoute) routes.push(fastestRoute);

    // Strategy 2: Shortest distance route (prefer most direct path)
    const shortestRoute = this.createRoute(
      roads.sort((a, b) => a.length_km - b.length_km),
      roads,
      'shortest',
      origin,
      destination
    );
    if (shortestRoute && !this.isDuplicateRoute(shortestRoute, routes)) {
      routes.push(shortestRoute);
    }

    // Strategy 3: Avoid congestion route (prefer low congestion roads)
    const lowCongestionRoads = roads.filter(r =>
      r.congestion_level === 'low' || r.congestion_level === 'moderate'
    );
    const avoidCongestionRoute = this.createRoute(
      lowCongestionRoads,
      roads,
      'avoid-congestion',
      origin,
      destination
    );
    if (avoidCongestionRoute && !this.isDuplicateRoute(avoidCongestionRoute, routes)) {
      routes.push(avoidCongestionRoute);
    }

    // Return up to maxRoutes
    return routes.slice(0, maxRoutes);
  }

  /**
   * Create a single route from a prioritized list of roads
   */
  private static createRoute(
    priorityRoads: any[],
    allRoads: any[],
    strategy: string,
    _origin: { lat: number; lng: number },
    _destination: { lat: number; lng: number }
  ): Route | null {
    if (priorityRoads.length === 0 && allRoads.length === 0) {
      return null;
    }

    // Use priority roads if available, otherwise use all roads
    const roadsToUse = priorityRoads.length > 0 ? priorityRoads : allRoads;

    // Take top 3-5 roads as route segments (simplified routing)
    const numSegments = Math.min(Math.max(roadsToUse.length, 2), 5);
    const selectedRoads = roadsToUse.slice(0, numSegments);

    const segments: RouteSegment[] = selectedRoads.map(road => {
      const speed = Number(road.current_speed) || 40;
      const distance = Number(road.length_km) || 1;
      const time = (distance / speed) * 60; // Convert to minutes

      return {
        road_id: road.road_id,
        road_name: road.road_name,
        road_type: road.road_type,
        distance_km: distance,
        estimated_time_minutes: Math.round(time * 10) / 10,
        current_speed_kmh: speed,
        congestion_level: road.congestion_level || 'low',
        geometry: road.geometry
      };
    });

    const totalDistance = segments.reduce((sum, seg) => sum + seg.distance_km, 0);
    const totalTime = segments.reduce((sum, seg) => sum + seg.estimated_time_minutes, 0);
    const avgSpeed = totalDistance > 0 ? (totalDistance / (totalTime / 60)) : 40;

    return {
      route_id: `route-${strategy}-${Date.now()}`,
      segments,
      total_distance_km: Math.round(totalDistance * 10) / 10,
      estimated_time_minutes: Math.round(totalTime),
      average_speed_kmh: Math.round(avgSpeed),
      overall_score: 0, // Will be calculated in scoreRoute
      score_breakdown: {
        traffic_score: 0,
        weather_score: 0,
        safety_score: 0,
        distance_score: 0
      },
      warnings: [],
      metadata: {
        total_roads: segments.length,
        congested_segments: segments.filter(s => s.congestion_level === 'high' || s.congestion_level === 'severe').length,
        weather_affected: false,
        arroyo_risk: false,
        event_nearby: false
      }
    };
  }

  /**
   * Check if route is duplicate (same roads in similar order)
   */
  private static isDuplicateRoute(route: Route, existingRoutes: Route[]): boolean {
    for (const existing of existingRoutes) {
      const routeRoads = route.segments.map(s => s.road_id).sort().join(',');
      const existingRoads = existing.segments.map(s => s.road_id).sort().join(',');

      if (routeRoads === existingRoads) {
        return true;
      }
    }
    return false;
  }

  /**
   * Score a route based on multiple factors
   */
  private static async scoreRoute(
    route: Route,
    weather: any,
    events: any[],
    arroyos: any[],
    preferences?: RouteRequest['preferences']
  ): Promise<Route> {
    // Traffic Score (0-100, higher is better)
    const trafficScore = this.calculateTrafficScore(route);

    // Weather Score (0-100, higher is better)
    const weatherScore = this.calculateWeatherScore(route, weather);

    // Safety Score (0-100, higher is better - considers arroyos and events)
    const safetyScore = this.calculateSafetyScore(route, arroyos, events);

    // Distance Score (0-100, shorter distance is better)
    const distanceScore = this.calculateDistanceScore(route);

    // Overall score (weighted average)
    const weights = {
      traffic: 0.35,
      weather: 0.20,
      safety: 0.30,
      distance: 0.15
    };

    // Apply preference weights
    if (preferences?.avoid_congestion) weights.traffic += 0.15;
    if (preferences?.avoid_arroyos) weights.safety += 0.15;
    if (preferences?.avoid_events) weights.safety += 0.10;

    // Normalize weights
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    Object.keys(weights).forEach(key => {
      weights[key as keyof typeof weights] /= totalWeight;
    });

    const overallScore = Math.round(
      trafficScore * weights.traffic +
      weatherScore * weights.weather +
      safetyScore * weights.safety +
      distanceScore * weights.distance
    );

    // Update route with scores
    route.overall_score = overallScore;
    route.score_breakdown = {
      traffic_score: trafficScore,
      weather_score: weatherScore,
      safety_score: safetyScore,
      distance_score: distanceScore
    };

    // Add warnings
    route.warnings = this.generateWarnings(route, weather, arroyos, events);

    return route;
  }

  /**
   * Calculate traffic score (0-100)
   * Higher score = less congestion
   */
  private static calculateTrafficScore(route: Route): number {
    const congestionScores = {
      low: 100,
      moderate: 70,
      high: 40,
      severe: 10
    };

    // Average congestion score across all segments
    const avgScore = route.segments.reduce((sum, segment) => {
      const score = congestionScores[segment.congestion_level as keyof typeof congestionScores] || 50;
      return sum + score;
    }, 0) / route.segments.length;

    return Math.round(avgScore);
  }

  /**
   * Calculate weather score (0-100)
   * Higher score = better weather conditions
   */
  private static calculateWeatherScore(route: Route, weather: any): number {
    let score = 100;

    // Rain probability impact
    score -= weather.rain_probability * 0.5; // Max -50 points

    // Temperature impact (extreme heat)
    if (weather.temperature > 35) {
      score -= (weather.temperature - 35) * 2; // Max -20 points
    }

    // Wind speed impact
    if (weather.wind_speed > 30) {
      score -= (weather.wind_speed - 30); // Max -20 points
    }

    // Severe conditions
    const severeConditions = ['Thunderstorm', 'Heavy Rain', 'Storm'];
    if (severeConditions.includes(weather.condition)) {
      score -= 30;
    }

    route.metadata.weather_affected = score < 70;

    return Math.max(Math.round(score), 0);
  }

  /**
   * Calculate safety score (0-100)
   * Higher score = safer route (fewer arroyos and events)
   */
  private static calculateSafetyScore(route: Route, arroyos: any[], events: any[]): number {
    let score = 100;

    // Penalize if high-risk arroyos nearby (simplified check)
    if (arroyos.length > 0) {
      score -= arroyos.length * 10; // -10 points per high-risk arroyo
      route.metadata.arroyo_risk = true;
    }

    // Penalize if events nearby (simplified check)
    if (events.length > 0) {
      score -= events.length * 5; // -5 points per event
      route.metadata.event_nearby = true;
    }

    return Math.max(Math.round(score), 0);
  }

  /**
   * Calculate distance score (0-100)
   * Shorter distances get higher scores
   */
  private static calculateDistanceScore(route: Route): number {
    // Assume max reasonable distance in Barranquilla is ~30km
    const maxDistance = 30;
    const normalizedDistance = Math.min(route.total_distance_km / maxDistance, 1);

    // Invert: shorter distance = higher score
    const score = (1 - normalizedDistance) * 100;

    return Math.round(score);
  }

  /**
   * Generate route warnings
   */
  private static generateWarnings(
    route: Route,
    weather: any,
    arroyos: any[],
    events: any[]
  ): string[] {
    const warnings: string[] = [];

    // Congestion warnings
    if (route.metadata.congested_segments > 0) {
      warnings.push(`${route.metadata.congested_segments} segment(s) with heavy traffic`);
    }

    // Weather warnings
    if (weather.rain_probability > 50) {
      warnings.push(`High probability of rain (${weather.rain_probability}%)`);
    }

    // Arroyo warnings
    if (arroyos.length > 0) {
      warnings.push(`Route near ${arroyos.length} high-risk arroyo zone(s)`);
    }

    // Event warnings
    if (events.length > 0) {
      warnings.push(`${events.length} event(s) in the area may cause delays`);
    }

    // Speed warnings
    if (route.average_speed_kmh < 25) {
      warnings.push('Expect slow travel due to congestion');
    }

    return warnings;
  }
}
