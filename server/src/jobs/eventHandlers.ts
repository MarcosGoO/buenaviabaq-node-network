import { dataCollectionEvents } from './queues.js';
import { SocketService } from '@/lib/socket.js';
import { TrafficService } from '@/services/trafficService.js';
import { WeatherService } from '@/services/weatherService.js';
import { AlertService } from '@/services/alertService.js';
import { logger } from '@/utils/logger.js';
import { JobTypes, type JobType } from './queues.js';

/**
 * Job result interface
 */
interface JobResult {
  success: boolean;
  type: JobType;
  timestamp: string;
  recordsProcessed: number;
}

/**
 * Setup event handlers to emit Socket.IO events when jobs complete
 */
export function setupJobEventHandlers() {
  // Handle job completion
  dataCollectionEvents.on('completed', async ({ jobId, returnvalue }) => {
    try {
      // Parse the returnvalue (BullMQ serializes it as string)
      const result: JobResult = typeof returnvalue === 'string'
        ? JSON.parse(returnvalue)
        : returnvalue as JobResult;

      if (!result || !result.success) {
        return;
      }

      logger.info(`Job ${jobId} completed, emitting real-time updates...`);

      // Emit updates based on job type
      switch (result.type) {
        case JobTypes.COLLECT_TRAFFIC:
          await emitTrafficUpdate();
          break;

        case JobTypes.COLLECT_WEATHER:
          await emitWeatherUpdate();
          break;

        case JobTypes.COLLECT_ALL:
          await emitTrafficUpdate();
          await emitWeatherUpdate();
          await emitAlertUpdate(); // Check for new alerts after data collection
          break;
      }
    } catch (error) {
      logger.error('Error in job completion handler:', error);
    }
  });

  logger.info('Job event handlers configured');
}

/**
 * Emit alert update via Socket.IO
 */
async function emitAlertUpdate() {
  try {
    const alerts = await AlertService.detectActiveAlerts();
    const activeAlerts = AlertService.getActiveAlerts(alerts);

    // Emit all active alerts
    if (activeAlerts.length > 0) {
      for (const alert of activeAlerts) {
        // Emit global alert notification
        SocketService.emitAlertNotification(alert as unknown as Record<string, unknown>);

        // Also emit zone-specific alerts
        if (alert.affectedZones && alert.affectedZones.length > 0) {
          for (const zoneId of alert.affectedZones) {
            SocketService.emitZoneAlert(zoneId, alert as unknown as Record<string, unknown>);
          }
        }
      }

      logger.debug(`Emitted ${activeAlerts.length} alert(s) via Socket.IO`);
    }
  } catch (error) {
    logger.error('Error emitting alert update:', error);
  }
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

    SocketService.emitWeatherUpdate(weather as unknown as Record<string, unknown>);

    logger.debug('Emitted weather update via Socket.IO');
  } catch (error) {
    logger.error('Error emitting weather update:', error);
  }
}
