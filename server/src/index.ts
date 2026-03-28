import express, { Application } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler.js';
import { testConnection } from '@/db/index.js';
import { RedisClient } from '@/lib/redis.js';
import { SocketService } from '@/lib/socket.js';
import { swaggerSpec } from '@/swagger.js';
import { cacheHeaders } from '@/middleware/cacheHeaders.js';
import { requestMetricsMiddleware } from '@/middleware/requestMetrics.js';
import {
  alertsLimiter,
  geoWeatherLimiter,
  globalApiLimiter,
  insightsLimiter,
  metricsLimiter,
  routingLimiter,
} from '@/middleware/rateLimiter.js';
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
import metricsRoutes from '@/routes/metricsRoutes.js';
import authRoutes from '@/routes/authRoutes.js';
import { CacheWarmupService } from '@/services/cacheWarmupService.js';
import { requestIdMiddleware } from '@/api/middleware/requestId.js';
import { ObservabilityService } from '@/services/observabilityService.js';

const app: Application = express();
const httpServer = createServer(app);
const isProduction = config.NODE_ENV === 'production';
const allowedOrigins = new Set<string>([
  config.FRONTEND_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://192.168.64.1:3000',
]);

const corsOriginValidator: cors.CorsOptions['origin'] = (origin, callback) => {
  if (!origin) {
    callback(null, true);
    return;
  }

  if (!isProduction) {
    callback(null, true);
    return;
  }

  callback(null, allowedOrigins.has(origin));
};

// Security middleware
app.use(helmet());
app.use(cors({
  origin: corsOriginValidator,
  credentials: true,
}));

app.use(`/api/${config.API_VERSION}`, globalApiLimiter);

// Body parsing & compression
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression({
  threshold: 1024, // 1kb explicit threshold
}));
app.use(requestIdMiddleware);
app.use(requestMetricsMiddleware);
app.use(cacheHeaders);

// Request logging
app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    logger.info(`${req.method} ${req.path}`, {
      requestId: res.getHeader('X-Request-ID'),
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  });

  next();
});

// Health check
app.get('/health', async (req, res) => {
  const dbConnected = await testConnection();
  const redisConnected = await RedisClient.healthCheck();
  const requestMetrics = ObservabilityService.getRequestMetrics();
  const socketMetrics = ObservabilityService.getSocketMetrics();
  const jobMetrics = ObservabilityService.getJobMetrics();

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
        connections: socketMetrics.connectedClients,
      },
    },
    observability: {
      requests_per_minute: requestMetrics.perMinute,
      request_latency_p95_ms: requestMetrics.latencyMs.p95,
      socket_clients: socketMetrics.connectedClients,
      scheduler_status: jobMetrics.scheduler.status,
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
app.use(`/api/${config.API_VERSION}/geo`, geoWeatherLimiter, geoRoutes);
app.use(`/api/${config.API_VERSION}/weather`, geoWeatherLimiter, weatherRoutes);
app.use(`/api/${config.API_VERSION}/traffic`, trafficRoutes);
app.use(`/api/${config.API_VERSION}/events`, eventsRoutes);
app.use(`/api/${config.API_VERSION}/analytics`, insightsLimiter, analyticsRoutes);
app.use(`/api/${config.API_VERSION}/ml`, mlRoutes);
app.use(`/api/${config.API_VERSION}/predictions`, predictionsRoutes);
app.use(`/api/${config.API_VERSION}/alerts`, alertsLimiter, alertsRoutes);
app.use(`/api/${config.API_VERSION}/insights`, insightsLimiter, insightsRoutes);
app.use(`/api/${config.API_VERSION}/routes`, routingLimiter, routingRoutes);
app.use(`/api/${config.API_VERSION}/metrics`, metricsLimiter, metricsRoutes);
app.use(`/api/${config.API_VERSION}/auth`, authRoutes);

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
    ObservabilityService.recordSchedulerError(error);
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

  // Warm frequently used cached endpoint
  void CacheWarmupService.warmInsightsSummaryCache();
});

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} signal received: closing server gracefully...`);
  ObservabilityService.recordSchedulerStopped();

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
