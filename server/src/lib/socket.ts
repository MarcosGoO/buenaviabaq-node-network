import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { redis } from './redis.js';
import { logger } from '@/utils/logger.js';
import Redis from 'ioredis';

export class SocketService {
  private static io: SocketIOServer | null = null;
  private static pubClient: Redis | null = null;
  private static subClient: Redis | null = null;

  static initialize(httpServer: HTTPServer): SocketIOServer {
    if (this.io) {
      return this.io;
    }

    // Create Socket.IO server
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
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
      logger.info(`Client connected: ${socket.id}`);

      // Handle client subscribing to specific zones
      socket.on('subscribe:zone', (zoneId: number) => {
        socket.join(`zone:${zoneId}`);
        logger.debug(`Client ${socket.id} subscribed to zone:${zoneId}`);
      });

      // Handle client unsubscribing from zones
      socket.on('unsubscribe:zone', (zoneId: number) => {
        socket.leave(`zone:${zoneId}`);
        logger.debug(`Client ${socket.id} unsubscribed from zone:${zoneId}`);
      });

      // Handle client subscribing to traffic updates
      socket.on('subscribe:traffic', () => {
        socket.join('traffic');
        logger.debug(`Client ${socket.id} subscribed to traffic updates`);
      });

      // Handle client subscribing to weather updates
      socket.on('subscribe:weather', () => {
        socket.join('weather');
        logger.debug(`Client ${socket.id} subscribed to weather updates`);
      });

      // Handle client subscribing to event updates
      socket.on('subscribe:events', () => {
        socket.join('events');
        logger.debug(`Client ${socket.id} subscribed to event updates`);
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`);
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error(`Socket error for client ${socket.id}:`, error);
      });
    });
  }

  /**
   * Emit traffic update to all subscribed clients
   */
  static emitTrafficUpdate(data: any) {
    if (!this.io) {
      logger.warn('Socket.IO not initialized');
      return;
    }

    this.io.to('traffic').emit('traffic:update', {
      timestamp: new Date().toISOString(),
      data,
    });

    logger.debug('Emitted traffic update to subscribers');
  }

  /**
   * Emit weather update to all subscribed clients
   */
  static emitWeatherUpdate(data: any) {
    if (!this.io) {
      logger.warn('Socket.IO not initialized');
      return;
    }

    this.io.to('weather').emit('weather:update', {
      timestamp: new Date().toISOString(),
      data,
    });

    logger.debug('Emitted weather update to subscribers');
  }

  /**
   * Emit event notification to all subscribed clients
   */
  static emitEventNotification(event: any) {
    if (!this.io) {
      logger.warn('Socket.IO not initialized');
      return;
    }

    this.io.to('events').emit('event:notification', {
      timestamp: new Date().toISOString(),
      event,
    });

    logger.debug('Emitted event notification to subscribers');
  }

  /**
   * Emit zone-specific alert
   */
  static emitZoneAlert(zoneId: number, alert: any) {
    if (!this.io) {
      logger.warn('Socket.IO not initialized');
      return;
    }

    this.io.to(`zone:${zoneId}`).emit('zone:alert', {
      timestamp: new Date().toISOString(),
      zoneId,
      alert,
    });

    logger.debug(`Emitted alert to zone:${zoneId}`);
  }

  /**
   * Broadcast message to all connected clients
   */
  static broadcast(event: string, data: any) {
    if (!this.io) {
      logger.warn('Socket.IO not initialized');
      return;
    }

    this.io.emit(event, data);
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
      this.io.close();
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
