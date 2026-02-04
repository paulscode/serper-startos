/**
 * Search Routes
 * Implements the Serper-compatible API endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { searchService } from '../services';
import { logger } from '../logger';
import { SerperSearchRequest } from '../types';

const router = Router();

/**
 * Helper to extract search request from body or query params
 * Serper accepts both POST body and query parameters
 */
function extractSearchRequest(req: Request): SerperSearchRequest {
  // Prefer body for POST requests, fall back to query params
  const source = req.method === 'POST' && req.body?.q ? req.body : req.query;
  
  return {
    q: source.q as string,
    gl: source.gl as string | undefined,
    hl: source.hl as string | undefined,
    num: source.num ? parseInt(source.num as string, 10) : undefined,
    autocorrect: source.autocorrect === 'true' || source.autocorrect === true,
    page: source.page ? parseInt(source.page as string, 10) : undefined,
    tbs: source.tbs as string | undefined,
  };
}

/**
 * Validate search request
 */
function validateSearchRequest(req: SerperSearchRequest): string | null {
  if (!req.q || typeof req.q !== 'string' || req.q.trim() === '') {
    return 'Query parameter "q" is required';
  }
  return null;
}

/**
 * POST /search - General web search
 * This is the main endpoint that matches Serper's API
 */
router.post('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const searchRequest = extractSearchRequest(req);
    const validationError = validateSearchRequest(searchRequest);
    
    if (validationError) {
      res.status(400).json({ error: 'Bad Request', message: validationError });
      return;
    }

    logger.info(`Search request: "${searchRequest.q}"`);
    const result = await searchService.search(searchRequest);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /search - Alternative GET endpoint for web search
 */
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const searchRequest = extractSearchRequest(req);
    const validationError = validateSearchRequest(searchRequest);
    
    if (validationError) {
      res.status(400).json({ error: 'Bad Request', message: validationError });
      return;
    }

    logger.info(`Search request (GET): "${searchRequest.q}"`);
    const result = await searchService.search(searchRequest);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /news - News search
 */
router.post('/news', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const searchRequest = extractSearchRequest(req);
    const validationError = validateSearchRequest(searchRequest);
    
    if (validationError) {
      res.status(400).json({ error: 'Bad Request', message: validationError });
      return;
    }

    logger.info(`News search request: "${searchRequest.q}"`);
    const result = await searchService.searchNews(searchRequest);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /news - Alternative GET endpoint for news search
 */
router.get('/news', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const searchRequest = extractSearchRequest(req);
    const validationError = validateSearchRequest(searchRequest);
    
    if (validationError) {
      res.status(400).json({ error: 'Bad Request', message: validationError });
      return;
    }

    logger.info(`News search request (GET): "${searchRequest.q}"`);
    const result = await searchService.searchNews(searchRequest);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /images - Image search
 */
router.post('/images', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const searchRequest = extractSearchRequest(req);
    const validationError = validateSearchRequest(searchRequest);
    
    if (validationError) {
      res.status(400).json({ error: 'Bad Request', message: validationError });
      return;
    }

    logger.info(`Image search request: "${searchRequest.q}"`);
    const result = await searchService.searchImages(searchRequest);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /images - Alternative GET endpoint for image search
 */
router.get('/images', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const searchRequest = extractSearchRequest(req);
    const validationError = validateSearchRequest(searchRequest);
    
    if (validationError) {
      res.status(400).json({ error: 'Bad Request', message: validationError });
      return;
    }

    logger.info(`Image search request (GET): "${searchRequest.q}"`);
    const result = await searchService.searchImages(searchRequest);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /places - Places/Maps search
 */
router.post('/places', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const searchRequest = extractSearchRequest(req);
    const validationError = validateSearchRequest(searchRequest);
    
    if (validationError) {
      res.status(400).json({ error: 'Bad Request', message: validationError });
      return;
    }

    logger.info(`Places search request: "${searchRequest.q}"`);
    const result = await searchService.searchPlaces(searchRequest);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /places - Alternative GET endpoint for places search
 */
router.get('/places', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const searchRequest = extractSearchRequest(req);
    const validationError = validateSearchRequest(searchRequest);
    
    if (validationError) {
      res.status(400).json({ error: 'Bad Request', message: validationError });
      return;
    }

    logger.info(`Places search request (GET): "${searchRequest.q}"`);
    const result = await searchService.searchPlaces(searchRequest);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
