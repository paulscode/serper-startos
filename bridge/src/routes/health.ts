/**
 * Health Check Routes
 * Provides health and status endpoints for the bridge
 */

import { Router, Request, Response } from 'express';
import { searxngClient } from '../services';
import { config } from '../config';

const router = Router();

/**
 * GET /health - Basic health check
 */
router.get('/health', async (req: Request, res: Response) => {
  const searxngHealthy = await searxngClient.healthCheck();

  const status = {
    status: searxngHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      bridge: 'up',
      searxng: searxngHealthy ? 'up' : 'down',
    },
    config: {
      searxngUrl: config.searxngBaseUrl,
      port: config.port,
    },
  };

  const httpStatus = searxngHealthy ? 200 : 503;
  res.status(httpStatus).json(status);
});

/**
 * GET /status - Detailed status information
 */
router.get('/status', async (req: Request, res: Response) => {
  const searxngHealthy = await searxngClient.healthCheck();
  const instanceInfo = await searxngClient.getInstanceInfo();

  res.json({
    bridge: {
      version: '1.0.0',
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    },
    searxng: {
      url: config.searxngBaseUrl,
      healthy: searxngHealthy,
      info: instanceInfo,
    },
    config: {
      defaultNumResults: config.defaultNumResults,
      defaultCountry: config.defaultCountry,
      defaultLanguage: config.defaultLanguage,
      requestTimeout: config.requestTimeout,
    },
  });
});

/**
 * GET / - Root endpoint with API info
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'SearXNG-Serper Bridge',
    version: '1.0.0',
    description: 'API bridge that exposes a Serper-compatible interface for SearXNG',
    endpoints: {
      search: {
        method: 'POST',
        path: '/search',
        description: 'General web search',
      },
      news: {
        method: 'POST',
        path: '/news',
        description: 'News search',
      },
      images: {
        method: 'POST',
        path: '/images',
        description: 'Image search',
      },
      places: {
        method: 'POST',
        path: '/places',
        description: 'Places/Maps search',
      },
      health: {
        method: 'GET',
        path: '/health',
        description: 'Health check',
      },
      status: {
        method: 'GET',
        path: '/status',
        description: 'Detailed status information',
      },
    },
    documentation: 'https://github.com/your-repo/searxng-serper-bridge',
  });
});

export default router;
