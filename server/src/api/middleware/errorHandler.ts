import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../../utils/logger.js';
import {
  AppError,
  DatabaseError
} from '../../shared/errors/index.js';

interface PostgresError extends Error {
  code?: string;
  detail?: string;
  constraint?: string;
}

interface RequestWithId extends Request {
  id?: string;
}

/**
 * Global Error Handler Middleware
 * Catches all errors and formats them consistently
 */
export const errorHandler = (
  err: Error | AppError | ZodError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) => {
  // Add request context to logger
  const requestContext = {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    requestId: (req as RequestWithId).id || 'unknown'
  };

  // Zod validation errors
  if (err instanceof ZodError) {
    const validationErrors = err.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
      code: e.code
    }));

    logger.warn('Zod validation error', {
      ...requestContext,
      errors: validationErrors
    });

    return res.status(400).json({
      status: 'error',
      statusCode: 400,
      message: 'Validation failed',
      errors: validationErrors,
      timestamp: new Date().toISOString()
    });
  }

  // Custom AppError instances
  if (err instanceof AppError) {
    // Log based on error type
    if (err.isOperational) {
      logger.warn('Operational error', {
        ...requestContext,
        statusCode: err.statusCode,
        message: err.message,
        errorType: err.constructor.name
      });
    } else {
      logger.error('Non-operational error', {
        ...requestContext,
        statusCode: err.statusCode,
        message: err.message,
        stack: err.stack,
        errorType: err.constructor.name
      });
    }

    return res.status(err.statusCode).json(err.toJSON());
  }

  // PostgreSQL errors
  const pgError = err as PostgresError;
  if (pgError.code && pgError.code.startsWith('23')) {
    logger.error('Database constraint violation', {
      ...requestContext,
      code: pgError.code,
      detail: pgError.detail,
      constraint: pgError.constraint
    });

    const dbError = new DatabaseError('Database constraint violation');
    return res.status(500).json(dbError.toJSON());
  }

  // Unexpected/Programming errors
  logger.error('Unexpected error', {
    ...requestContext,
    error: err.message,
    stack: err.stack,
    name: err.name
  });

  // Never leak error details in production for unknown errors
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  return res.status(500).json({
    status: 'error',
    statusCode: 500,
    message,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      name: err.name
    })
  });
};

/**
 * 404 Not Found Handler
 * Catches all requests to undefined routes
 */
export const notFoundHandler = (req: Request, res: Response) => {
  logger.warn('Route not found', {
    method: req.method,
    path: req.originalUrl,
    ip: req.ip
  });

  res.status(404).json({
    status: 'error',
    statusCode: 404,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
};

/**
 * Async Error Wrapper
 * Wraps async route handlers to catch errors automatically
 */
type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export const asyncHandler = (fn: AsyncRouteHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Process-level Error Handlers
 * Handle uncaught exceptions and unhandled rejections
 */
export const setupProcessErrorHandlers = () => {
  // Uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception - shutting down gracefully', {
      error: error.message,
      stack: error.stack
    });

    // Give ongoing requests time to complete
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  // Unhandled promise rejections
  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled Rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined
    });

    // Don't exit immediately - log and monitor
    // In production, you might want to restart the process
  });

  // SIGTERM signal
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');

    // Graceful shutdown logic here
    setTimeout(() => {
      process.exit(0);
    }, 5000);
  });

  // SIGINT signal (Ctrl+C)
  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
  });
};
