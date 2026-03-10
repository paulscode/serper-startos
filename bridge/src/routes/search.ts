/**
 * Search Routes
 * Implements the Serper-compatible API endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { searchService } from '../services';
import { logger } from '../logger';
import { config } from '../config';
import { SerperSearchRequest } from '../types';

const router = Router();

/**
 * Regex for valid country/language codes.
 * Accepts 2-letter codes (en, us) and composite codes (en-GB, pt-BR).
 */
const LOCALE_CODE_REGEX = /^[a-zA-Z]{2}(-[a-zA-Z]{2,4})?$/;

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
 * Validate search request with hardened input checks
 */
function validateSearchRequest(req: SerperSearchRequest): string | null {
  if (!req.q || typeof req.q !== 'string' || req.q.trim() === '') {
    return 'Query parameter "q" is required';
  }

  // Enforce query length limit
  if (req.q.length > config.maxQueryLength) {
    return `Query exceeds maximum length of ${config.maxQueryLength} characters`;
  }

  // Validate num parameter bounds
  if (req.num !== undefined) {
    if (!Number.isFinite(req.num) || req.num < 1 || req.num > 100) {
      return 'Parameter "num" must be between 1 and 100';
    }
  }

  // Validate page parameter bounds
  if (req.page !== undefined) {
    if (!Number.isFinite(req.page) || req.page < 1 || req.page > 100) {
      return 'Parameter "page" must be between 1 and 100';
    }
  }

  // Validate gl (country code) format
  if (req.gl !== undefined && !LOCALE_CODE_REGEX.test(req.gl)) {
    return 'Parameter "gl" must be a valid locale code (e.g., "us" or "en-US")';
  }

  // Validate hl (language code) format
  if (req.hl !== undefined && !LOCALE_CODE_REGEX.test(req.hl)) {
    return 'Parameter "hl" must be a valid locale code (e.g., "en" or "en-GB")';
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

/**
 * POST /scholar - Scholar/Academic search
 */
router.post('/scholar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const searchRequest = extractSearchRequest(req);
    const validationError = validateSearchRequest(searchRequest);
    
    if (validationError) {
      res.status(400).json({ error: 'Bad Request', message: validationError });
      return;
    }

    logger.info(`Scholar search request: "${searchRequest.q}"`);
    const result = await searchService.searchScholar(searchRequest);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /scholar - Alternative GET endpoint for scholar search
 */
router.get('/scholar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const searchRequest = extractSearchRequest(req);
    const validationError = validateSearchRequest(searchRequest);
    
    if (validationError) {
      res.status(400).json({ error: 'Bad Request', message: validationError });
      return;
    }

    logger.info(`Scholar search request (GET): "${searchRequest.q}"`);
    const result = await searchService.searchScholar(searchRequest);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /shopping - Shopping/Product search
 * Uses native SearXNG shopping category (requires enabled shopping engines like eBay, Geizhals)
 */
router.post('/shopping', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const searchRequest = extractSearchRequest(req);
    const validationError = validateSearchRequest(searchRequest);
    
    if (validationError) {
      res.status(400).json({ error: 'Bad Request', message: validationError });
      return;
    }

    logger.info(`Shopping search request: "${searchRequest.q}"`);
    const result = await searchService.searchShopping(searchRequest);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /shopping - Alternative GET endpoint for shopping search
 */
router.get('/shopping', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const searchRequest = extractSearchRequest(req);
    const validationError = validateSearchRequest(searchRequest);
    
    if (validationError) {
      res.status(400).json({ error: 'Bad Request', message: validationError });
      return;
    }

    logger.info(`Shopping search request (GET): "${searchRequest.q}"`);
    const result = await searchService.searchShopping(searchRequest);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
