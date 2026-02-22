import express, { Application } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler.js';
import { testConnection } from '@/db/index.js';
import { RedisStore } from 'rate-limit-redis';
import { RedisClient, redis } from '@/lib/redis.js';
import { SocketService } from '@/lib/socket.js';
import { swaggerSpec } from '@/swagger.js';
import geoRoutes from '@/routes/geoRoutes.js';
import weatherRoutes from '@/routes/weatherRoutes.js';
import trafficRoutes from '@/routes/trafficRoutes.js';
import eventsRoutes from '@/routes/eventsRoutes.js';
import analyticsRoutes from '@/routes/analyticsRoutes.js';
import mlRoutes from '@/routes/mlRoutes.js';
import predictionsRoutes from '@/routes/predictionsRoutes.js';
import alertsRoutes from '@/routes/alertsRoutes.js';
import insightsRoutes from '@/routes/insightsRoutes.js';
import routingRoutes from '@/routes/routingRoutes.js';

const app: Application = express();
const httpServer = createServer(app);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Rate limiting - more permissive in development for hot-reload
const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.NODE_ENV === 'development' ? 500 : config.RATE_LIMIT_MAX_REQUESTS, // 500 in dev, 100 in prod
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    // @ts-expect-error - ioredis and rate-limit-redis type mismatch
    sendCommand: (...args: string[]) => redis.call(...args),
  }),
});
app.use(`/api/${config.API_VERSION}`, limiter);

// Granular limiters
const routingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30, // 30 req/min
  message: 'Too many routing requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    // @ts-expect-error - ioredis and rate-limit-redis type mismatch
    sendCommand: (...args: string[]) => redis.call(...args),
  }),
});

const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60, // 60 req/min
  message: 'Too many analytics requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    // @ts-expect-error - ioredis and rate-limit-redis type mismatch
    sendCommand: (...args: string[]) => redis.call(...args),
  }),
});

// Body parsing & compression
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression({
  threshold: 1024, // 1kb explicit threshold
}));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// Health check
app.get('/health', async (req, res) => {
  const dbConnected = await testConnection();
  const redisConnected = await RedisClient.healthCheck();
  const socketConnections = await SocketService.getConnectedClientsCount();

  res.json({
    status: (dbConnected && redisConnected) ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.NODE_ENV,
    services: {
      database: dbConnected ? 'connected' : 'disconnected',
      redis: redisConnected ? 'connected' : 'disconnected',
      socket: {
        status: 'active',
        connections: socketConnections,
      },
    },
  });
});

// Swagger UI — API Documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'VíaBaq API Docs',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
  },
}));

// Raw OpenAPI spec (JSON)
app.get('/api/docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// API Routes
app.use(`/api/${config.API_VERSION}/geo`, geoRoutes);
app.use(`/api/${config.API_VERSION}/weather`, weatherRoutes);
app.use(`/api/${config.API_VERSION}/traffic`, trafficRoutes);
app.use(`/api/${config.API_VERSION}/events`, eventsRoutes);
app.use(`/api/${config.API_VERSION}/analytics`, analyticsLimiter, analyticsRoutes);
app.use(`/api/${config.API_VERSION}/ml`, mlRoutes);
app.use(`/api/${config.API_VERSION}/predictions`, predictionsRoutes);
app.use(`/api/${config.API_VERSION}/alerts`, alertsRoutes);
app.use(`/api/${config.API_VERSION}/insights`, insightsRoutes);
app.use(`/api/${config.API_VERSION}/routes`, routingLimiter, routingRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize Socket.IO
SocketService.initialize(httpServer);

// Start background workers and scheduler
async function startBackgroundJobs() {
  try {
    // Import workers dynamically to avoid circular dependencies
    await import('@/jobs/workers/dataCollectionWorker.js');
    const { JobScheduler } = await import('@/jobs/scheduler.js');
    const { setupJobEventHandlers } = await import('@/jobs/eventHandlers.js');

    // Setup event handlers for Socket.IO integration
    setupJobEventHandlers();

    // Start job scheduler
    await JobScheduler.start();

    logger.info('✅ Background jobs and scheduler started successfully');
  } catch (error) {
    logger.error('Failed to start background jobs:', error);
  }
}

// Start server
const PORT = config.PORT;
httpServer.listen(PORT, async () => {
  logger.info(`🚀 VíaBaq Backend running on port ${PORT}`);
  logger.info(`📊 Environment: ${config.NODE_ENV}`);
  logger.info(`🔗 API Version: ${config.API_VERSION}`);
  logger.info(`🔌 Socket.IO ready for real-time connections`);

  // Start background jobs after server is running
  await startBackgroundJobs();
});

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} signal received: closing server gracefully...`);

  try {
    // Stop accepting new connections
    httpServer.close(async () => {
      logger.info('HTTP server closed');

      // Close Socket.IO
      await SocketService.close();

      // Close Redis connection
      await RedisClient.disconnect();

      logger.info('All connections closed gracefully');
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
