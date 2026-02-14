import { logger } from '@/utils/logger.js';
import { CacheService } from './cacheService.js';

export interface TrafficData {
  road_id: number;
  road_name: string;
  congestion_level: 'low' | 'moderate' | 'high' | 'severe';
  speed_kmh: number;
  travel_time_minutes: number;
  last_updated: string;
}

export interface TrafficSummary {
  total_roads: number;
  average_speed: number;
  congested_roads: number;
  status: 'clear' | 'moderate' | 'congested';
}

export class TrafficService {
  private static readonly BARRANQUILLA_LAT = 10.9639;
  private static readonly BARRANQUILLA_LON = -74.7964;

  // TODO: Replace with real API integration (Google Traffic, TomTom, HERE, or Waze)
  // For now, we generate mock data based on time of day and weather conditions
  static async getRealTimeTraffic(): Promise<TrafficData[]> {
    try {
      // Try to get from cache first (5 minute TTL)
      return await CacheService.getOrSet(
        'realtime-traffic',
        async () => {
          // In production, integrate with traffic API
          // const apiKey = config.TRAFFIC_API_KEY;
          // if (apiKey) {
          //   return await this.fetchFromTrafficAPI(apiKey);
          // }

          logger.info('Generating mock traffic data');
          return this.generateMockTrafficData();
        },
        {
          ttl: CacheService.TTL.MEDIUM, // 5 minutes
          namespace: CacheService.Namespaces.TRAFFIC,
        }
      );
    } catch (error) {
      logger.error('Error fetching traffic data:', error);
      throw error;
    }
  }

  static async getTrafficSummary(): Promise<TrafficSummary> {
    const trafficData = await this.getRealTimeTraffic();

    const totalRoads = trafficData.length;
    const averageSpeed = Math.round(
      trafficData.reduce((sum, road) => sum + road.speed_kmh, 0) / totalRoads
    );
    const congestedRoads = trafficData.filter(
      (road) => road.congestion_level === 'high' || road.congestion_level === 'severe'
    ).length;

    let status: 'clear' | 'moderate' | 'congested' = 'clear';
    if (congestedRoads > totalRoads * 0.5) {
      status = 'congested';
    } else if (congestedRoads > totalRoads * 0.2) {
      status = 'moderate';
    }

    return {
      total_roads: totalRoads,
      average_speed: averageSpeed,
      congested_roads: congestedRoads,
      status,
    };
  }

  static async getTrafficByRoadId(roadId: number): Promise<TrafficData | null> {
    const trafficData = await this.getRealTimeTraffic();
    return trafficData.find((road) => road.road_id === roadId) || null;
  }

  // Mock data generator based on time of day
  private static generateMockTrafficData(): TrafficData[] {
    const currentHour = new Date().getHours();
    const isPeakHour =
      (currentHour >= 6 && currentHour <= 9) || (currentHour >= 17 && currentHour <= 20);

    const roads = [
      { id: 1, name: 'Vía 40' },
      { id: 2, name: 'Calle 30' },
      { id: 3, name: 'Calle 72' },
      { id: 4, name: 'Circunvalar' },
      { id: 5, name: 'Carrera 38' },
      { id: 6, name: 'Cordialidad' },
    ];

    return roads.map((road) => {
      const baseSpeed = isPeakHour ? 20 : 45;
      const speedVariation = Math.random() * 20;
      const speed = Math.round(baseSpeed + speedVariation);

      let congestionLevel: 'low' | 'moderate' | 'high' | 'severe';
      if (speed > 50) congestionLevel = 'low';
      else if (speed > 35) congestionLevel = 'moderate';
      else if (speed > 20) congestionLevel = 'high';
      else congestionLevel = 'severe';

      // Assume 10km distance for travel time calculation
      const travelTime = Math.round((10 / speed) * 60);

      return {
        road_id: road.id,
        road_name: road.name,
        congestion_level: congestionLevel,
        speed_kmh: speed,
        travel_time_minutes: travelTime,
        last_updated: new Date().toISOString(),
      };
    });
  }

  // TODO: Implement real API integration
  // private static async fetchFromTrafficAPI(apiKey: string): Promise<TrafficData[]> {
  //   // Example with Google Traffic API or TomTom
  //   const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${this.BARRANQUILLA_LAT},${this.BARRANQUILLA_LON}&key=${apiKey}`;
  //   const response = await fetch(url);
  //   const data = await response.json();
  //   // Transform API response to our format
  //   return this.transformAPIResponse(data);
  // }
}