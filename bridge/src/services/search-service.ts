/**
 * Search Service
 * Orchestrates the search flow: receive Serper request -> query SearXNG -> transform response
 */

import { searxngClient } from './searxng-client';
import { transformSearchResponse } from './transformer';
import { scanTexts, isMlScannerReady } from './ml-scanner';
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
  SerperResponseMeta,
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
 * Run ML-based prompt injection scanning on response text fields.
 * Collects all scannable text from the response, runs them through the
 * ML classifier in batch, and flags any detected injections in the
 * existing _meta field (or creates one if includeResponseMeta is enabled).
 */
async function mlScanResponse(
  response: SerperSearchResponse | SerperNewsResponse | SerperImagesResponse | SerperPlacesResponse | SerperScholarResponse | SerperShoppingResponse,
  searchType: string
): Promise<void> {
  if (!isMlScannerReady()) return;

  // Collect text fields and their locations for post-scan processing
  const entries: Array<{
    text: string;
    ref: { obj: any; key: string };
    arrayRef?: { array: any[]; item: any };
    fieldRef?: { obj: any; key: string };
  }> = [];

  const addFromArray = (item: any, key: string, array: any[]) => {
    const val = item?.[key];
    if (typeof val === 'string' && val.length > 0) {
      entries.push({ text: val, ref: { obj: item, key }, arrayRef: { array, item } });
    }
  };

  const addFromField = (obj: any, key: string, parentObj: any, parentKey: string) => {
    const val = obj?.[key];
    if (typeof val === 'string' && val.length > 0) {
      entries.push({ text: val, ref: { obj, key }, fieldRef: { obj: parentObj, key: parentKey } });
    }
  };

  // Extract snippet/content fields only — these are the primary injection
  // vectors. Titles are short, low-risk, and scanning them doubles inference
  // time for minimal security benefit.
  if ('organic' in response) {
    for (const r of response.organic) {
      addFromArray(r, 'snippet', response.organic);
    }
    if (response.answerBox) {
      addFromField(response.answerBox, 'answer', response, 'answerBox');
      addFromField(response.answerBox, 'snippet', response, 'answerBox');
    }
    if (response.knowledgeGraph) {
      addFromField(response.knowledgeGraph, 'description', response, 'knowledgeGraph');
    }
  }
  if ('news' in response) {
    for (const r of response.news) {
      addFromArray(r, 'snippet', response.news);
    }
  }
  if ('images' in response) {
    // images only have titles — skip ML scan (regex sanitizer still applies)
  }
  if ('places' in response) {
    // places have short structured text — skip ML scan
  }
  if ('scholar' in response) {
    for (const r of response.scholar) {
      addFromArray(r, 'snippet', response.scholar);
    }
  }
  if ('shopping' in response) {
    for (const r of response.shopping) {
      addFromArray(r, 'snippet', response.shopping);
    }
  }

  if (entries.length === 0) return;

  // Batch scan all texts
  const texts = entries.map((e) => e.text);
  const results = await scanTexts(texts);

  // Process flagged items according to configured redact mode
  const redactMode = config.mlRedactMode;
  let mlFlaggedResults = 0;
  const flaggedPositions = new Set<number>();
  const itemsToRemove = new Set<any>();
  const fieldsToRemove = new Set<string>();

  for (let i = 0; i < results.length; i++) {
    if (results[i].isInjection) {
      const entry = entries[i];
      flaggedPositions.add(i);
      logger.warn(
        `ML scanner flagged (score=${results[i].score.toFixed(3)}, action=${redactMode}): "${entry.text.substring(0, 80)}..."`
      );

      if (redactMode === 'drop') {
        // Mark parent for removal
        if (entry.arrayRef) {
          itemsToRemove.add(entry.arrayRef.item);
        } else if (entry.fieldRef) {
          fieldsToRemove.add(entry.fieldRef.key);
        }
      } else if (redactMode === 'redact') {
        // Replace text with redaction notice
        entry.ref.obj[entry.ref.key] =
          `[REDACTED: potential prompt injection detected (score=${results[i].score.toFixed(3)})]`;
      } else {
        // tag mode — prefix with warning, preserve original text
        const currentText = entry.ref.obj[entry.ref.key] as string;
        if (!currentText.startsWith('[ML-FLAGGED:')) {
          entry.ref.obj[entry.ref.key] = `[ML-FLAGGED: score=${results[i].score.toFixed(3)}] ${currentText}`;
        }
      }
    }
  }

  // For drop mode, remove flagged results from arrays and singular fields
  if (redactMode === 'drop' && (itemsToRemove.size > 0 || fieldsToRemove.size > 0)) {
    if (itemsToRemove.size > 0) {
      const filter = (arr: any[]) => arr.filter((r) => !itemsToRemove.has(r));
      if ('organic' in response) (response as any).organic = filter(response.organic);
      if ('news' in response) (response as any).news = filter(response.news);
      if ('images' in response) (response as any).images = filter(response.images);
      if ('places' in response) (response as any).places = filter(response.places);
      if ('scholar' in response) (response as any).scholar = filter(response.scholar);
      if ('shopping' in response) (response as any).shopping = filter(response.shopping);
    }
    for (const key of fieldsToRemove) {
      delete (response as any)[key];
    }
  }

  mlFlaggedResults = flaggedPositions.size;

  // Update _meta if metadata is enabled or if we found ML flags
  if (config.includeResponseMeta || mlFlaggedResults > 0) {
    const existing: SerperResponseMeta = (response as any)._meta || {
      contentTrust: 'untrusted',
      source: 'web-search',
      sanitized: config.sanitizeResults,
      flaggedResults: 0,
    };
    existing.mlScanEnabled = true;
    existing.mlFlaggedResults = mlFlaggedResults;
    existing.mlRedactMode = redactMode;
    (response as any)._meta = existing;
  }
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

  // Run ML-based prompt injection scanning on response text fields
  await mlScanResponse(serperResponse, searchType);

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
