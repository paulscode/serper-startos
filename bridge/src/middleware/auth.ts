/**
 * Authentication Middleware
 * Validates API keys to mimic Serper's authentication model
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { logger } from '../logger';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // If no API key is configured, allow all requests
  if (!config.bridgeApiKey) {
    return next();
  }

  // Check for API key in header (Serper uses X-API-KEY)
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    logger.warn(`Unauthorized request: Missing API key from ${req.ip}`);
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing X-API-KEY header',
    });
    return;
  }

  if (apiKey !== config.bridgeApiKey) {
    logger.warn(`Unauthorized request: Invalid API key from ${req.ip}`);
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key',
    });
    return;
  }

  next();
}
