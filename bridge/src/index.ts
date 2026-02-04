/**
 * SearXNG-Serper Bridge
 * Main application entry point
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { config, validateConfig } from './config';
import { logger } from './logger';
import { authMiddleware, errorHandler, notFoundHandler } from './middleware';
import { searchRoutes, healthRoutes } from './routes';

// Validate configuration before starting
try {
  validateConfig();
} catch (error) {
  logger.error(`Configuration error: ${(error as Error).message}`);
  process.exit(1);
}

// Create Express app
const app = express();

// =============================================================================
// Middleware
// =============================================================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for API
}));

// CORS - allow all origins for API access
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Parse URL-encoded bodies (for form data)
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim()),
  },
}));

// =============================================================================
// Routes
// =============================================================================

// Health and status routes (no auth required)
app.use('/', healthRoutes);

// Search routes (with optional auth)
app.use('/', authMiddleware, searchRoutes);

// =============================================================================
// Error Handling
// =============================================================================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// =============================================================================
// Server Startup
// =============================================================================

const server = app.listen(config.port, () => {
  logger.info('='.repeat(60));
  logger.info('SearXNG-Serper Bridge started');
  logger.info('='.repeat(60));
  logger.info(`Server listening on port ${config.port}`);
  logger.info(`SearXNG backend: ${config.searxngBaseUrl}`);
  logger.info(`API authentication: ${config.bridgeApiKey ? 'enabled' : 'disabled'}`);
  logger.info(`Log level: ${config.logLevel}`);
  logger.info('='.repeat(60));
  logger.info('Available endpoints:');
  logger.info('  POST /search  - General web search');
  logger.info('  POST /news    - News search');
  logger.info('  POST /images  - Image search');
  logger.info('  POST /places  - Places search');
  logger.info('  GET  /health  - Health check');
  logger.info('  GET  /status  - Detailed status');
  logger.info('='.repeat(60));
});

// Graceful shutdown
const shutdown = () => {
  logger.info('Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;
