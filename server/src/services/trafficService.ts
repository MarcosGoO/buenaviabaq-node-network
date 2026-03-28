import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';
import { CacheService } from './cacheService.js';
import { WeatherService } from './weatherService.js';
import { EventsService } from './eventsService.js';

export interface TrafficData {
  road_id: number;
  road_name: string;
  congestion_level: 'low' | 'moderate' | 'high' | 'severe';
  speed_kmh: number;
  travel_time_minutes: number;
  last_updated: string;
  source?: 'mock' | 'tomtom';
  metadata?: Record<string, unknown>;
}

export interface TrafficSummary {
  total_roads: number;
  average_speed: number;
  congested_roads: number;
  status: 'clear' | 'moderate' | 'congested';
  source?: 'mock' | 'tomtom';
  provider_mode?: 'mock' | 'tomtom';
  live_data?: boolean;
}

interface TrafficProviderResult {
  source: 'mock' | 'tomtom';
  roads: TrafficData[];
  liveData: boolean;
}

interface TrafficProviderStatus {
  configured: boolean;
  active: 'mock' | 'tomtom';
  liveData: boolean;
  reason: string;
}

interface TomTomFlowResponse {
  flowSegmentData?: {
    currentSpeed?: number;
    freeFlowSpeed?: number;
    currentTravelTime?: number;
    freeFlowTravelTime?: number;
    confidence?: number;
    roadClosure?: boolean;
    coordinates?: {
      coordinate?: Array<{
        latitude: number;
        longitude: number;
      }>;
    };
  };
}

interface MonitoredRoad {
  id: number;
  name: string;
  lat: number;
  lon: number;
  distanceKm: number;
}

const MONITORED_ROADS: MonitoredRoad[] = [
  { id: 1, name: 'Via 40', lat: 10.9879, lon: -74.7815, distanceKm: 6.5 },
  { id: 2, name: 'Calle 30', lat: 10.9795, lon: -74.7787, distanceKm: 8.2 },
  { id: 3, name: 'Calle 72', lat: 11.0048, lon: -74.8211, distanceKm: 5.4 },
  { id: 4, name: 'Circunvalar', lat: 11.0015, lon: -74.8358, distanceKm: 12.1 },
  { id: 5, name: 'Carrera 38', lat: 10.9949, lon: -74.7962, distanceKm: 4.6 },
  { id: 6, name: 'Cordialidad', lat: 10.9708, lon: -74.8441, distanceKm: 9.8 },
];

export class TrafficService {
  private static readonly TOMTOM_FLOW_BASE_URL = 'https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json';
  private static hasLoggedMockMode = false;
  private static lastProviderStatus: TrafficProviderStatus = {
    configured: false,
    active: 'mock',
    liveData: false,
    reason: 'Traffic provider has not been initialized yet.',
  };

  static async getRealTimeTraffic(): Promise<TrafficData[]> {
    try {
      const result = await CacheService.getOrSet(
        'realtime-traffic',
        async () => this.fetchFromSelectedProvider(),
        {
          ttl: CacheService.TTL.MEDIUM,
          namespace: CacheService.Namespaces.TRAFFIC,
        }
      );

      return Array.isArray(result)
        ? result
        : (result as TrafficProviderResult).roads;
    } catch (error) {
      logger.error('Error fetching traffic data:', error);
      throw error;
    }
  }

  static async getTrafficSummary(): Promise<TrafficSummary> {
    const trafficData = await this.getRealTimeTraffic();
    const providerStatus = this.getProviderStatus();
    const totalRoads = trafficData.length;
    const averageSpeed = totalRoads === 0
      ? 0
      : Math.round(trafficData.reduce((sum, road) => sum + road.speed_kmh, 0) / totalRoads);
    const congestedRoads = trafficData.filter(
      (road) => road.congestion_level === 'high' || road.congestion_level === 'severe'
    ).length;

    let status: 'clear' | 'moderate' | 'congested' = 'clear';
    if (totalRoads > 0 && congestedRoads > totalRoads * 0.5) {
      status = 'congested';
    } else if (totalRoads > 0 && congestedRoads > totalRoads * 0.2) {
      status = 'moderate';
    }

    return {
      total_roads: totalRoads,
      average_speed: averageSpeed,
      congested_roads: congestedRoads,
      status,
      source: providerStatus.active,
      provider_mode: providerStatus.active,
      live_data: providerStatus.liveData,
    };
  }

  static async getTrafficByRoadId(roadId: number): Promise<TrafficData | null> {
    const trafficData = await this.getRealTimeTraffic();
    return trafficData.find((road) => road.road_id === roadId) || null;
  }

  static getProviderStatus(): TrafficProviderStatus {
    return this.lastProviderStatus;
  }

  private static async fetchFromSelectedProvider(): Promise<TrafficProviderResult> {
    const mode = this.resolveProviderMode();

    if (mode === 'tomtom') {
      try {
        const result = await this.fetchFromTomTom();
        this.lastProviderStatus = {
          configured: true,
          active: 'tomtom',
          liveData: true,
          reason: 'TomTom traffic flow API is active.',
        };
        return result;
      } catch (error) {
        logger.error('TomTom provider failed, falling back to simulated traffic.', { error });
        const fallback = await this.fetchMockTrafficData();
        this.lastProviderStatus = {
          configured: true,
          active: 'mock',
          liveData: false,
          reason: error instanceof Error ? error.message : 'TomTom provider failed.',
        };
        return fallback;
      }
    }

    const mock = await this.fetchMockTrafficData();
    this.lastProviderStatus = {
      configured: Boolean(config.TOMTOM_API_KEY),
      active: 'mock',
      liveData: false,
      reason: config.TOMTOM_API_KEY
        ? 'Traffic provider forced to mock mode.'
        : 'No TomTom API key configured; using simulated traffic data.',
    };
    return mock;
  }

  private static resolveProviderMode(): 'mock' | 'tomtom' {
    if (config.TRAFFIC_PROVIDER === 'mock') {
      return 'mock';
    }

    if (config.TRAFFIC_PROVIDER === 'tomtom') {
      return config.TOMTOM_API_KEY ? 'tomtom' : 'mock';
    }

    return config.TOMTOM_API_KEY ? 'tomtom' : 'mock';
  }

  private static async fetchFromTomTom(): Promise<TrafficProviderResult> {
    const apiKey = config.TOMTOM_API_KEY;
    if (!apiKey) {
      throw new Error('TomTom API key is not configured.');
    }

    const responses = await Promise.all(
      MONITORED_ROADS.map(async (road) => {
        const url = `${this.TOMTOM_FLOW_BASE_URL}?point=${road.lat},${road.lon}&unit=KMPH&openLr=false&key=${apiKey}`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`TomTom Flow API returned HTTP ${response.status}`);
        }

        const payload = await response.json() as TomTomFlowResponse;
        return this.mapTomTomFlowToTrafficData(road, payload);
      })
    );

    return {
      source: 'tomtom',
      liveData: true,
      roads: responses,
    };
  }

  private static mapTomTomFlowToTrafficData(road: MonitoredRoad, payload: TomTomFlowResponse): TrafficData {
    const flow = payload.flowSegmentData;
    if (!flow || !flow.currentSpeed || !flow.freeFlowSpeed) {
      throw new Error(`TomTom flow payload missing speed data for ${road.name}`);
    }

    const speed = Math.max(5, Math.round(flow.currentSpeed));
    const freeFlowSpeed = Math.max(speed, Math.round(flow.freeFlowSpeed));
    const travelTime = flow.currentTravelTime
      ? Math.max(1, Math.round(flow.currentTravelTime / 60))
      : Math.max(1, Math.round((road.distanceKm / speed) * 60));
    const congestionLevel = this.getCongestionLevelFromTomTom(speed, freeFlowSpeed, flow.roadClosure === true);

    return {
      road_id: road.id,
      road_name: road.name,
      congestion_level: congestionLevel,
      speed_kmh: speed,
      travel_time_minutes: travelTime,
      last_updated: new Date().toISOString(),
      source: 'tomtom',
      metadata: {
        free_flow_speed_kmh: freeFlowSpeed,
        confidence: flow.confidence ?? null,
        road_closure: flow.roadClosure ?? false,
        sampled_point: { lat: road.lat, lon: road.lon },
        distance_km: road.distanceKm,
      },
    };
  }

  private static getCongestionLevelFromTomTom(
    speedKmh: number,
    freeFlowSpeedKmh: number,
    isClosed: boolean
  ): 'low' | 'moderate' | 'high' | 'severe' {
    if (isClosed || speedKmh <= 5) {
      return 'severe';
    }

    const ratio = freeFlowSpeedKmh <= 0 ? 1 : speedKmh / freeFlowSpeedKmh;
    if (ratio >= 0.8) return 'low';
    if (ratio >= 0.6) return 'moderate';
    if (ratio >= 0.4) return 'high';
    return 'severe';
  }

  private static async fetchMockTrafficData(): Promise<TrafficProviderResult> {
    if (!this.hasLoggedMockMode) {
      logger.warn('TrafficService is using simulated traffic data. Connect a traffic provider for live road speeds.');
      this.hasLoggedMockMode = true;
    }

    return {
      source: 'mock',
      liveData: false,
      roads: await this.generateMockTrafficData(),
    };
  }

  private static async generateMockTrafficData(): Promise<TrafficData[]> {
    const currentHour = new Date().getHours();
    const isPeakHour =
      (currentHour >= 6 && currentHour <= 9) || (currentHour >= 17 && currentHour <= 20);

    const [weather, upcomingEvents] = await Promise.all([
      WeatherService.getCurrentWeather().catch(() => null),
      EventsService.getUpcomingEvents().catch(() => []),
    ]);

    const rainIntensity = weather?.rain?.['1h'] || weather?.rain_1h || 0;
    const isRaining = rainIntensity > 0;
    const isHeavyRain = rainIntensity > 5;
    const hasEvents = upcomingEvents.length > 0;

    return MONITORED_ROADS.map((road) => {
      let baseSpeed = isPeakHour ? 20 : 45;

      if (isHeavyRain) {
        baseSpeed *= 0.6;
      } else if (isRaining) {
        baseSpeed *= 0.8;
      }

      if (hasEvents && Math.random() > 0.5) {
        baseSpeed *= 0.7;
      }

      const speedVariation = Math.random() * (isPeakHour ? 10 : 20);
      const speed = Math.max(5, Math.round(baseSpeed + speedVariation - 10));

      let congestionLevel: 'low' | 'moderate' | 'high' | 'severe';
      if (speed > 50) congestionLevel = 'low';
      else if (speed > 35) congestionLevel = 'moderate';
      else if (speed > 20) congestionLevel = 'high';
      else congestionLevel = 'severe';

      const travelTime = Math.round((road.distanceKm / speed) * 60);

      return {
        road_id: road.id,
        road_name: road.name,
        congestion_level: congestionLevel,
        speed_kmh: speed,
        travel_time_minutes: travelTime,
        last_updated: new Date().toISOString(),
        source: 'mock',
        metadata: {
          distance_km: road.distanceKm,
          peak_hour: isPeakHour,
          rain_intensity_mm_h: rainIntensity,
          event_impact_applied: hasEvents,
        },
      };
    });
  }
}
