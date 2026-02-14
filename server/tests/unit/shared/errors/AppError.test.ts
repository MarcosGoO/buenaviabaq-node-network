import { describe, it, expect } from 'vitest';
import {
  AppError,
  NotFoundError,
  ValidationError,
  ServiceUnavailableError,
  BadRequestError,
  DatabaseError
} from '../../../../src/shared/errors/index.js';

describe('AppError Classes', () => {
  describe('AppError', () => {
    it('should create an error with correct properties', () => {
      const error = new AppError('Test error', 500);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
      expect(error.timestamp).toBeDefined();
    });

    it('should capture stack trace', () => {
      const error = new AppError('Test error', 500);

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AppError');
    });

    it('should convert to JSON correctly', () => {
      const error = new AppError('Test error', 500);
      const json = error.toJSON();

      expect(json).toHaveProperty('status', 'error');
      expect(json).toHaveProperty('statusCode', 500);
      expect(json).toHaveProperty('message', 'Test error');
      expect(json).toHaveProperty('timestamp');
    });

    it('should include stack trace in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new AppError('Test error', 500);
      const json = error.toJSON();

      expect(json).toHaveProperty('stack');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('NotFoundError', () => {
    it('should create a 404 error', () => {
      const error = new NotFoundError('User');

      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('User not found');
      expect(error.isOperational).toBe(true);
    });

    it('should work with instanceof', () => {
      const error = new NotFoundError('User');

      expect(error instanceof NotFoundError).toBe(true);
      expect(error instanceof AppError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('ValidationError', () => {
    it('should create a 422 error', () => {
      const error = new ValidationError('Invalid data');

      expect(error.statusCode).toBe(422);
      expect(error.message).toBe('Invalid data');
    });

    it('should include validation errors in JSON', () => {
      const validationErrors = [
        { field: 'email', message: 'Invalid email' },
        { field: 'password', message: 'Too short' }
      ];

      const error = new ValidationError('Validation failed', validationErrors);
      const json = error.toJSON();

      expect(json.errors).toEqual(validationErrors);
    });
  });

  describe('ServiceUnavailableError', () => {
    it('should create a 503 error', () => {
      const error = new ServiceUnavailableError('Weather API');

      expect(error.statusCode).toBe(503);
      expect(error.message).toBe('Weather API is currently unavailable');
      expect(error.isOperational).toBe(true);
    });
  });

  describe('BadRequestError', () => {
    it('should create a 400 error', () => {
      const error = new BadRequestError('Invalid request');

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Invalid request');
    });
  });

  describe('DatabaseError', () => {
    it('should create a 500 error', () => {
      const error = new DatabaseError('Query failed');

      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Query failed');
      expect(error.isOperational).toBe(false); // Not operational - programming error
    });

    it('should preserve original error stack in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const originalError = new Error('Original error');
      const dbError = new DatabaseError('Database error', originalError);

      expect(dbError.stack).toBe(originalError.stack);

      process.env.NODE_ENV = originalEnv;
    });
  });
});
