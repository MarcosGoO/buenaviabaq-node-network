import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { redis } from './redis.js';
import { logger } from '@/utils/logger.js';
import Redis from 'ioredis';
import { config } from '@/config/index.js';
import { ObservabilityService } from '@/services/observabilityService.js';

export class SocketService {
  private static io: SocketIOServer | null = null;
  private static pubClient: Redis | null = null;
  private static subClient: Redis | null = null;

  static initialize(httpServer: HTTPServer): SocketIOServer {
    if (this.io) {
      return this.io;
    }

    const isProduction = config.NODE_ENV === 'production';
    const allowedOrigins = new Set<string>([
      config.FRONTEND_URL,
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://192.168.64.1:3000',
    ]);

    // Create Socket.IO server
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: (origin, callback) => {
          if (!origin) {
            callback(null, true);
            return;
          }
          if (!isProduction) {
            callback(null, true);
            return;
          }
          callback(null, allowedOrigins.has(origin));
        },
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    // Add authentication middleware
    this.io.use((socket, next) => {
      const expectedToken = config.SOCKET_AUTH_TOKEN?.trim();
      if (!expectedToken) {
        next();
        return;
      }

      const rawToken = socket.handshake.auth.token || socket.handshake.headers['authorization'];
      const normalizedToken = typeof rawToken === 'string'
        ? rawToken.replace(/^Bearer\s+/i, '').trim()
        : '';

      if (normalizedToken !== expectedToken) {
        ObservabilityService.recordSocketAuthFailure();
        logger.warn(`Connection rejected: Invalid or missing token for socket ${socket.id}`);
        return next(new Error('Authentication error'));
      }

      next();
    });

    // Setup Redis adapter for scalability (optional but recommended)
    this.setupRedisAdapter();

    // Setup connection handlers
    this.setupConnectionHandlers();

    logger.info('Socket.IO server initialized successfully');

    return this.io;
  }

  private static setupRedisAdapter() {
    if (!this.io) return;

    try {
      // Create separate Redis clients for pub/sub
      this.pubClient = redis.duplicate();
      this.subClient = redis.duplicate();

      // Create adapter
      this.io.adapter(createAdapter(this.pubClient, this.subClient));

      logger.info('Socket.IO Redis adapter configured');
    } catch (error) {
      logger.error('Failed to setup Redis adapter:', error);
      // Continue without Redis adapter - single instance mode
    }
  }

  private static setupConnectionHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      ObservabilityService.recordSocketConnection(socket.id);
      logger.info(`Client connected: ${socket.id}`);

      // Handle client subscribing to specific zones
      socket.on('subscribe:zone', (zoneId: unknown) => {
        if (!Number.isInteger(zoneId) || (zoneId as number) <= 0) {
          socket.emit('error', { message: 'Invalid zone ID' });
          return;
        }
        void socket.join(`zone:${zoneId}`);
        ObservabilityService.recordSocketSubscription(socket.id, 'zone');
        logger.debug(`Client ${socket.id} subscribed to zone:${zoneId}`);
      });

      // Handle client unsubscribing from zones
      socket.on('unsubscribe:zone', (zoneId: unknown) => {
        if (!Number.isInteger(zoneId) || (zoneId as number) <= 0) {
          socket.emit('error', { message: 'Invalid zone ID' });
          return;
        }
        void socket.leave(`zone:${zoneId}`);
        ObservabilityService.recordSocketUnsubscription(socket.id, 'zone');
        logger.debug(`Client ${socket.id} unsubscribed from zone:${zoneId}`);
      });

      // Handle client subscribing to traffic updates
      socket.on('subscribe:traffic', () => {
        void socket.join('traffic');
        ObservabilityService.recordSocketSubscription(socket.id, 'traffic');
        logger.debug(`Client ${socket.id} subscribed to traffic updates`);
      });
      socket.on('unsubscribe:traffic', () => {
        void socket.leave('traffic');
        ObservabilityService.recordSocketUnsubscription(socket.id, 'traffic');
      });

      // Handle client subscribing to weather updates
      socket.on('subscribe:weather', () => {
        void socket.join('weather');
        ObservabilityService.recordSocketSubscription(socket.id, 'weather');
        logger.debug(`Client ${socket.id} subscribed to weather updates`);
      });
      socket.on('unsubscribe:weather', () => {
        void socket.leave('weather');
        ObservabilityService.recordSocketUnsubscription(socket.id, 'weather');
      });

      // Handle client subscribing to event updates
      socket.on('subscribe:events', () => {
        void socket.join('events');
        ObservabilityService.recordSocketSubscription(socket.id, 'events');
        logger.debug(`Client ${socket.id} subscribed to event updates`);
      });
      socket.on('unsubscribe:events', () => {
        void socket.leave('events');
        ObservabilityService.recordSocketUnsubscription(socket.id, 'events');
      });

      // Handle client subscribing to alert updates
      socket.on('subscribe:alerts', () => {
        void socket.join('alerts');
        ObservabilityService.recordSocketSubscription(socket.id, 'alerts');
        logger.debug(`Client ${socket.id} subscribed to alert updates`);
      });
      socket.on('unsubscribe:alerts', () => {
        void socket.leave('alerts');
        ObservabilityService.recordSocketUnsubscription(socket.id, 'alerts');
      });

      // Handle client subscribing to prediction updates
      socket.on('subscribe:predictions', () => {
        void socket.join('predictions');
        ObservabilityService.recordSocketSubscription(socket.id, 'predictions');
        logger.debug(`Client ${socket.id} subscribed to prediction updates`);
      });
      socket.on('unsubscribe:predictions', () => {
        void socket.leave('predictions');
        ObservabilityService.recordSocketUnsubscription(socket.id, 'predictions');
      });

      // Handle client subscribing to ML reliability updates
      socket.on('subscribe:ml-reliability', () => {
        void socket.join('ml-reliability');
        ObservabilityService.recordSocketSubscription(socket.id, 'ml-reliability');
        logger.debug(`Client ${socket.id} subscribed to ML reliability updates`);
      });
      socket.on('unsubscribe:ml-reliability', () => {
        void socket.leave('ml-reliability');
        ObservabilityService.recordSocketUnsubscription(socket.id, 'ml-reliability');
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        ObservabilityService.recordSocketDisconnection(socket.id);
        logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`);
      });

      // Handle errors
      socket.on('error', (error) => {
        ObservabilityService.recordSocketError();
        logger.error(`Socket error for client ${socket.id}:`, error);
      });
    });
  }

  /**
   * Emit traffic update to all subscribed clients
   */
  static emitTrafficUpdate(data: Record<string, unknown>) {
    if (!this.io) {
      logger.warn('Socket.IO not initialized');
      return;
    }

    this.io.to('traffic').emit('traffic:update', {
      timestamp: new Date().toISOString(),
      data,
    });
    ObservabilityService.recordSocketEmission('traffic:update');

    logger.debug('Emitted traffic update to subscribers');
  }

  /**
   * Emit weather update to all subscribed clients
   */
  static emitWeatherUpdate(data: Record<string, unknown>) {
    if (!this.io) {
      logger.warn('Socket.IO not initialized');
      return;
    }

    this.io.to('weather').emit('weather:update', {
      timestamp: new Date().toISOString(),
      data,
    });
    ObservabilityService.recordSocketEmission('weather:update');

    logger.debug('Emitted weather update to subscribers');
  }

  /**
   * Emit event notification to all subscribed clients
   */
  static emitEventNotification(event: Record<string, unknown>) {
    if (!this.io) {
      logger.warn('Socket.IO not initialized');
      return;
    }

    this.io.to('events').emit('event:notification', {
      timestamp: new Date().toISOString(),
      event,
    });
    ObservabilityService.recordSocketEmission('event:notification');

    logger.debug('Emitted event notification to subscribers');
  }

  /**
   * Emit zone-specific alert
   */
  static emitZoneAlert(zoneId: number, alert: Record<string, unknown>) {
    if (!this.io) {
      logger.warn('Socket.IO not initialized');
      return;
    }

    this.io.to(`zone:${zoneId}`).emit('zone:alert', {
      timestamp: new Date().toISOString(),
      zoneId,
      alert,
    });
    ObservabilityService.recordSocketEmission('zone:alert');

    logger.debug(`Emitted alert to zone:${zoneId}`);
  }

  /**
   * Emit alert notification to all subscribed clients
   */
  static emitAlertNotification(alert: Record<string, unknown>) {
    if (!this.io) {
      logger.warn('Socket.IO not initialized');
      return;
    }

    this.io.to('alerts').emit('alert:notification', {
      timestamp: new Date().toISOString(),
      alert,
    });
    ObservabilityService.recordSocketEmission('alert:notification');

    logger.debug('Emitted alert notification to subscribers');
  }

  /**
   * Emit prediction update to all subscribed clients
   */
  static emitPredictionUpdate(predictions: Record<string, unknown>) {
    if (!this.io) {
      logger.warn('Socket.IO not initialized');
      return;
    }

    this.io.to('predictions').emit('prediction:update', {
      timestamp: new Date().toISOString(),
      predictions,
    });
    ObservabilityService.recordSocketEmission('prediction:update');

    logger.debug('Emitted prediction update to subscribers');
  }

  /**
   * Emit ML reliability aggregate update
   */
  static emitReliabilityUpdate(payload: Record<string, unknown>) {
    if (!this.io) {
      logger.warn('Socket.IO not initialized');
      return;
    }

    this.io.to('ml-reliability').emit('ml:reliability:update', payload);
    ObservabilityService.recordSocketEmission('ml:reliability:update');
    logger.debug('Emitted ml:reliability:update');
  }

  /**
   * Emit drift incident opened event
   */
  static emitReliabilityIncidentOpened(payload: Record<string, unknown>) {
    if (!this.io) {
      logger.warn('Socket.IO not initialized');
      return;
    }

    this.io.to('ml-reliability').emit('ml:incident:opened', payload);
    ObservabilityService.recordSocketEmission('ml:incident:opened');
    logger.debug('Emitted ml:incident:opened');
  }

  /**
   * Emit drift incident resolved event
   */
  static emitReliabilityIncidentResolved(payload: Record<string, unknown>) {
    if (!this.io) {
      logger.warn('Socket.IO not initialized');
      return;
    }

    this.io.to('ml-reliability').emit('ml:incident:resolved', payload);
    ObservabilityService.recordSocketEmission('ml:incident:resolved');
    logger.debug('Emitted ml:incident:resolved');
  }

  /**
   * Emit governance recommendation event
   */
  static emitReliabilityDecisionRecommended(payload: Record<string, unknown>) {
    if (!this.io) {
      logger.warn('Socket.IO not initialized');
      return;
    }

    this.io.to('ml-reliability').emit('ml:decision:recommended', payload);
    ObservabilityService.recordSocketEmission('ml:decision:recommended');
    logger.debug('Emitted ml:decision:recommended');
  }

  /**
   * Broadcast message to all connected clients
   */
  static broadcast(event: string, data: Record<string, unknown>) {
    if (!this.io) {
      logger.warn('Socket.IO not initialized');
      return;
    }

    this.io.emit(event, data);
    ObservabilityService.recordSocketEmission(event);
    logger.debug(`Broadcasted event: ${event}`);
  }

  /**
   * Get number of connected clients
   */
  static async getConnectedClientsCount(): Promise<number> {
    if (!this.io) {
      return 0;
    }

    const sockets = await this.io.fetchSockets();
    return sockets.length;
  }

  /**
   * Disconnect all clients and close server
   */
  static async close() {
    if (this.io) {
      void this.io.close();
      this.io = null;
    }

    if (this.pubClient) {
      await this.pubClient.quit();
      this.pubClient = null;
    }

    if (this.subClient) {
      await this.subClient.quit();
      this.subClient = null;
    }

    logger.info('Socket.IO server closed');
  }

  static getIO(): SocketIOServer | null {
    return this.io;
  }
}
