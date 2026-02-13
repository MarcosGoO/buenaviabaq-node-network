import { dataCollectionEvents } from './queues.js';
import { SocketService } from '@/lib/socket.js';
import { TrafficService } from '@/services/trafficService.js';
import { WeatherService } from '@/services/weatherService.js';
import { logger } from '@/utils/logger.js';
import { JobTypes } from './queues.js';

/**
 * Setup event handlers to emit Socket.IO events when jobs complete
 */
export function setupJobEventHandlers() {
  // Handle job completion
  dataCollectionEvents.on('completed', async ({ jobId, returnvalue }) => {
    try {
      if (!returnvalue || !returnvalue.success) {
        return;
      }

      logger.info(`Job ${jobId} completed, emitting real-time updates...`);

      // Emit updates based on job type
      switch (returnvalue.type) {
        case JobTypes.COLLECT_TRAFFIC:
          await emitTrafficUpdate();
          break;

        case JobTypes.COLLECT_WEATHER:
          await emitWeatherUpdate();
          break;

        case JobTypes.COLLECT_ALL:
          await emitTrafficUpdate();
          await emitWeatherUpdate();
          break;
      }
    } catch (error) {
      logger.error('Error in job completion handler:', error);
    }
  });

  logger.info('Job event handlers configured');
}

/**
 * Emit traffic update via Socket.IO
 */
async function emitTrafficUpdate() {
  try {
    const trafficData = await TrafficService.getRealTimeTraffic();
    const summary = await TrafficService.getTrafficSummary();

    SocketService.emitTrafficUpdate({
      roads: trafficData,
      summary,
    });

    logger.debug('Emitted traffic update via Socket.IO');
  } catch (error) {
    logger.error('Error emitting traffic update:', error);
  }
}

/**
 * Emit weather update via Socket.IO
 */
async function emitWeatherUpdate() {
  try {
    const weather = await WeatherService.getCurrentWeather();

    SocketService.emitWeatherUpdate(weather);

    logger.debug('Emitted weather update via Socket.IO');
  } catch (error) {
    logger.error('Error emitting weather update:', error);
  }
}
