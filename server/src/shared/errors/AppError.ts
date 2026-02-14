/**
 * Base Error Class for Application
 * All custom errors should extend this class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly timestamp: string;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);

    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    Error.captureStackTrace(this, this.constructor);

    // Set the prototype explicitly to maintain instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON() {
    return {
      status: 'error',
      statusCode: this.statusCode,
      message: this.message,
      timestamp: this.timestamp,
      ...(process.env.NODE_ENV === 'development' && { stack: this.stack })
    };
  }
}

/**
 * 400 Bad Request
 * Used for validation errors or malformed requests
 */
export class BadRequestError extends AppError {
  constructor(message: string = 'Bad Request') {
    super(message, 400);
    Object.setPrototypeOf(this, BadRequestError.prototype);
  }
}

/**
 * 401 Unauthorized
 * Used when authentication is required but not provided or invalid
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

/**
 * 403 Forbidden
 * Used when user is authenticated but doesn't have permission
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

/**
 * 404 Not Found
 * Used when a requested resource doesn't exist
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * 409 Conflict
 * Used when there's a conflict with current state (e.g., duplicate entry)
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, 409);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * 422 Unprocessable Entity
 * Used for semantic validation errors
 */
export class ValidationError extends AppError {
  public readonly errors?: any[];

  constructor(message: string = 'Validation failed', errors?: any[]) {
    super(message, 422);
    this.errors = errors;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      ...(this.errors && { errors: this.errors })
    };
  }
}

/**
 * 500 Internal Server Error
 * Used for unexpected server errors
 */
export class InternalServerError extends AppError {
  constructor(message: string = 'Internal Server Error') {
    super(message, 500, false); // Not operational - programming error
    Object.setPrototypeOf(this, InternalServerError.prototype);
  }
}

/**
 * 503 Service Unavailable
 * Used when an external service is down
 */
export class ServiceUnavailableError extends AppError {
  constructor(service: string = 'Service') {
    super(`${service} is currently unavailable`, 503);
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
  }
}

/**
 * Database Error
 * Used for database-related errors
 */
export class DatabaseError extends AppError {
  constructor(message: string = 'Database error occurred', originalError?: Error) {
    super(message, 500, false);

    if (originalError && process.env.NODE_ENV === 'development') {
      this.stack = originalError.stack;
    }

    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

/**
 * Cache Error
 * Used for cache-related errors (Redis)
 */
export class CacheError extends AppError {
  constructor(message: string = 'Cache error occurred', originalError?: Error) {
    super(message, 500, true); // Operational - cache can be unavailable temporarily

    if (originalError && process.env.NODE_ENV === 'development') {
      this.stack = originalError.stack;
    }

    Object.setPrototypeOf(this, CacheError.prototype);
  }
}

/**
 * External API Error
 * Used when external APIs fail
 */
export class ExternalAPIError extends AppError {
  public readonly apiName: string;

  constructor(apiName: string, message?: string, originalError?: Error) {
    super(
      message || `Failed to fetch data from ${apiName}`,
      503,
      true // Operational - external APIs can fail
    );

    this.apiName = apiName;

    if (originalError && process.env.NODE_ENV === 'development') {
      this.stack = originalError.stack;
    }

    Object.setPrototypeOf(this, ExternalAPIError.prototype);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      apiName: this.apiName
    };
  }
}
