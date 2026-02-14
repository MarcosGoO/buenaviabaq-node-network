import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../../shared/errors/index.js';

/**
 * Request Validation Middleware Factory
 * Creates a middleware that validates request data against a Zod schema
 */
export const validateRequest = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request data
      const validated = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params
      });

      // Replace request data with validated data (ensures type safety)
      req.body = validated.body || req.body;
      req.query = validated.query || req.query;
      req.params = validated.params || req.params;

      next();
    } catch (error) {
      // ZodError will be caught by error handler
      next(error);
    }
  };
};

/**
 * Validate Body Only
 * Simpler validation for body-only requests
 */
export const validateBody = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Validate Query Only
 * Simpler validation for query-only requests
 */
export const validateQuery = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = await schema.parseAsync(req.query);
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Validate Params Only
 * Simpler validation for params-only requests
 */
export const validateParams = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = await schema.parseAsync(req.params);
      next();
    } catch (error) {
      next(error);
    }
  };
};
