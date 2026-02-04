/**
 * Search Service
 * Orchestrates the search flow: receive Serper request -> query SearXNG -> transform response
 */

import { searxngClient } from './searxng-client';
import { transformSearchResponse } from './transformer';
import { config } from '../config';
import { logger } from '../logger';
import {
  SerperSearchRequest,
  SerperSearchResponse,
  SerperNewsResponse,
  SerperImagesResponse,
  SerperPlacesResponse,
  SerperScholarResponse,
  SerperShoppingResponse,
  SearxngSearchParams,
} from '../types';

export type SearchType = 'search' | 'news' | 'images' | 'places' | 'scholar' | 'shopping';

/**
 * Map Serper time-based search (tbs) to SearXNG time_range
 */
function mapTimeRange(tbs?: string): SearxngSearchParams['time_range'] | undefined {
  if (!tbs) return undefined;

  // Serper uses Google's tbs format: qdr:h (hour), qdr:d (day), qdr:w (week), qdr:m (month), qdr:y (year)
  const mapping: Record<string, SearxngSearchParams['time_range']> = {
    'qdr:d': 'day',
    'qdr:w': 'week',
    'qdr:m': 'month',
    'qdr:y': 'year',
  };

  // Extract the time range from tbs parameter
  for (const [pattern, range] of Object.entries(mapping)) {
    if (tbs.includes(pattern)) {
      return range;
    }
  }

  return undefined;
}

/**
 * Map search type to SearXNG categories
 */
function mapSearchTypeToCategories(searchType: SearchType): string | undefined {
  const mapping: Record<SearchType, string | undefined> = {
    search: 'general',
    news: 'news',
    images: 'images',
    places: 'map',
    scholar: 'science',
    shopping: 'shopping',  // Native SearXNG shopping category (requires enabled shopping engines)
  };
  return mapping[searchType];
}

/**
 * Map language codes - SearXNG uses different format than Serper/Google
 */
function mapLanguage(hl?: string, gl?: string): string {
  // SearXNG expects language codes like 'en-US', 'de-DE', etc.
  // Serper uses 'en', 'de', etc. for hl and country codes for gl
  if (hl && gl) {
    return `${hl}-${gl.toUpperCase()}`;
  }
  if (hl) {
    return hl;
  }
  return `${config.defaultLanguage}-${config.defaultCountry.toUpperCase()}`;
}

/**
 * Perform a search through the bridge
 */
export async function performSearch(
  request: SerperSearchRequest,
  searchType: SearchType = 'search'
): Promise<SerperSearchResponse | SerperNewsResponse | SerperImagesResponse | SerperPlacesResponse | SerperScholarResponse | SerperShoppingResponse> {
  
  logger.info(`Performing ${searchType} search for query: "${request.q}"`);

  // Build SearXNG request parameters
  const searxngParams: SearxngSearchParams = {
    q: request.q,
    language: mapLanguage(request.hl, request.gl),
    pageno: request.page || 1,
    time_range: mapTimeRange(request.tbs),
    categories: mapSearchTypeToCategories(searchType),
    format: 'json',
  };

  logger.debug(`SearXNG params: ${JSON.stringify(searxngParams)}`);

  // Perform the search
  const searxngResponse = await searxngClient.search(searxngParams);

  logger.debug(`SearXNG returned ${searxngResponse.results.length} results`);

  // Transform to Serper format
  const serperResponse = transformSearchResponse(searxngResponse, request, searchType);

  return serperResponse;
}

/**
 * Perform a general web search
 */
export async function search(request: SerperSearchRequest): Promise<SerperSearchResponse> {
  return performSearch(request, 'search') as Promise<SerperSearchResponse>;
}

/**
 * Perform a news search
 */
export async function searchNews(request: SerperSearchRequest): Promise<SerperNewsResponse> {
  return performSearch(request, 'news') as Promise<SerperNewsResponse>;
}

/**
 * Perform an image search
 */
export async function searchImages(request: SerperSearchRequest): Promise<SerperImagesResponse> {
  return performSearch(request, 'images') as Promise<SerperImagesResponse>;
}

/**
 * Perform a places/maps search
 */
export async function searchPlaces(request: SerperSearchRequest): Promise<SerperPlacesResponse> {
  return performSearch(request, 'places') as Promise<SerperPlacesResponse>;
}

/**
 * Perform a scholar/academic search
 */
export async function searchScholar(request: SerperSearchRequest): Promise<SerperScholarResponse> {
  return performSearch(request, 'scholar') as Promise<SerperScholarResponse>;
}

/**
 * Perform a shopping/product search
 * Uses native SearXNG shopping category with enabled shopping engines (eBay, Geizhals, etc.)
 * Falls back to general search with price extraction if shopping engines return no results
 */
export async function searchShopping(request: SerperSearchRequest): Promise<SerperShoppingResponse> {
  // First try native shopping category
  const shoppingResult = await performSearch(request, 'shopping') as SerperShoppingResponse;
  
  // If we got results, return them
  if (shoppingResult.shopping && shoppingResult.shopping.length > 0) {
    return shoppingResult;
  }
  
  // Fallback: Use general search and extract prices from results
  logger.info(`Shopping engines returned no results, falling back to general search for: "${request.q}"`);
  
  const searxngParams: SearxngSearchParams = {
    q: request.q,
    language: `${request.hl || config.defaultLanguage}-${(request.gl || config.defaultCountry).toUpperCase()}`,
    pageno: request.page || 1,
    time_range: mapTimeRange(request.tbs),
    categories: 'general',
    format: 'json',
  };
  
  const searxngResponse = await searxngClient.search(searxngParams);
  
  // Transform using shopping transformer (it will extract prices from snippets)
  const serperResponse = transformSearchResponse(searxngResponse, request, 'shopping');
  
  return serperResponse as SerperShoppingResponse;
}

export const searchService = {
  search,
  searchNews,
  searchImages,
  searchPlaces,
  searchScholar,
  searchShopping,
  performSearch,
};
