/**
 * Rate Limiting Middleware
 * Simple in-memory sliding window rate limiter — no external dependencies.
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { logger } from '../logger';

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Clean up stale entries every 5 minutes
const cleanupInterval = setInterval(() => {
  const cutoff = Date.now() - 60_000;
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}, 5 * 60_000);
cleanupInterval.unref();

/**
 * Rate limiter middleware.
 * Limits requests per IP using a sliding window of 1 minute.
 * Disabled when RATE_LIMIT_PER_MINUTE is 0.
 */
export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  if (config.rateLimitPerMinute <= 0) {
    return next();
  }

  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60_000;

  let entry = store.get(ip);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(ip, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => t > now - windowMs);

  if (entry.timestamps.length >= config.rateLimitPerMinute) {
    logger.warn(`Rate limit exceeded for ${ip}`);
    res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit of ${config.rateLimitPerMinute} requests per minute exceeded`,
    });
    return;
  }

  entry.timestamps.push(now);
  next();
}
