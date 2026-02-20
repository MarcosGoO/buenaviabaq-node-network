import { logger } from '@/utils/logger.js';
import { CacheService } from './cacheService.js';
import { AppError } from '@/middleware/errorHandler.js';

export interface IdeamData {
  station: string;
  department: string;
  municipality: string;
  temperature: number;
  precipitation_mm: number;
  relative_humidity: number;
  wind_speed_ms: number;
  wind_direction: string;
  solar_radiation: number;
  alert_level: 'green' | 'yellow' | 'orange' | 'red';
  timestamp: Date;
}

export class IdeamService {
  /**
   * Fetch current weather data from IDEAM (Mock implementation for now)
   * Future implementation: Web scraping or API integration
   */
  static async getCurrentData(): Promise<IdeamData> {
    return await CacheService.getOrSet(
      'ideam-current',
      async () => {
        logger.info('Fetching data from IDEAM (Mock)...');
        // Simulated network delay
        await new Promise((resolve) => setTimeout(resolve, 800));

        return this.getMockIdeamData();
      },
      {
        ttl: CacheService.TTL.SHORT, // 1 minute
        namespace: CacheService.Namespaces.WEATHER,
      }
    );
  }

  // Mock IDEAM data tailored for Barranquilla
  private static getMockIdeamData(): IdeamData {
    const isRaining = Math.random() > 0.7;
    const isAlert = isRaining && Math.random() > 0.5;

    return {
      station: 'ERNESTO CORTISSOZ [11045010]',
      department: 'ATLANTICO',
      municipality: 'SOLEDAD',
      temperature: 28 + Math.round(Math.random() * 5), // 28 - 33
      precipitation_mm: isRaining ? Math.round(Math.random() * 20) : 0,
      relative_humidity: 65 + Math.round(Math.random() * 25), // 65 - 90
      wind_speed_ms: 2 + Math.round(Math.random() * 8), // 2 - 10
      wind_direction: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][
        Math.floor(Math.random() * 8)
      ],
      solar_radiation: isRaining ? 100 + Math.random() * 200 : 500 + Math.random() * 400,
      alert_level: isAlert ? 'orange' : (isRaining ? 'yellow' : 'green'),
      timestamp: new Date(),
    };
  }
}
