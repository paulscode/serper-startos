/**
 * Error Handling Middleware
 * Provides consistent error responses
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log the error
  logger.error(`Error handling ${req.method} ${req.path}: ${err.message}`, {
    stack: err.stack,
    code: err.code,
  });

  // Determine status code
  const statusCode = err.statusCode || 500;

  // Send error response
  res.status(statusCode).json({
    error: err.name || 'Error',
    message: err.message || 'An unexpected error occurred',
    code: err.code,
  });
}

/**
 * Not Found Handler
 * Handles 404 errors for unknown routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  logger.warn(`Route not found: ${req.method} ${req.path}`);
  
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    hint: 'Available endpoints: POST /search, POST /news, POST /images, POST /places, GET /health',
  });
}
