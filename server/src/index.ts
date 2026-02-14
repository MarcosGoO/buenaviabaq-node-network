import express, { Application } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler.js';
import { testConnection } from '@/db/index.js';
import { RedisClient } from '@/lib/redis.js';
import { SocketService } from '@/lib/socket.js';
import geoRoutes from '@/routes/geoRoutes.js';
import weatherRoutes from '@/routes/weatherRoutes.js';
import trafficRoutes from '@/routes/trafficRoutes.js';
import eventsRoutes from '@/routes/eventsRoutes.js';
import analyticsRoutes from '@/routes/analyticsRoutes.js';
import mlRoutes from '@/routes/mlRoutes.js';

const app: Application = express();
const httpServer = createServer(app);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  message: 'Too many requests from this IP, please try again later.',
});
app.use(`/api/${config.API_VERSION}`, limiter);

// Body parsing & compression
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

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

// API Routes
app.use(`/api/${config.API_VERSION}/geo`, geoRoutes);
app.use(`/api/${config.API_VERSION}/weather`, weatherRoutes);
app.use(`/api/${config.API_VERSION}/traffic`, trafficRoutes);
app.use(`/api/${config.API_VERSION}/events`, eventsRoutes);
app.use(`/api/${config.API_VERSION}/analytics`, analyticsRoutes);
app.use(`/api/${config.API_VERSION}/ml`, mlRoutes);

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
