/**
 * Result Transformer
 * Converts SearXNG response format to Serper response format
 * Applies prompt injection sanitization to all text fields.
 */

import {
  SearxngSearchResponse,
  SearxngResult,
  SearxngInfobox,
  SerperSearchResponse,
  SerperNewsResponse,
  SerperImagesResponse,
  SerperPlacesResponse,
  SerperScholarResponse,
  SerperShoppingResponse,
  SerperOrganicResult,
  SerperNewsResult,
  SerperImageResult,
  SerperPlaceResult,
  SerperScholarResult,
  SerperShoppingResult,
  SerperKnowledgeGraph,
  SerperAnswerBox,
  SerperPeopleAlsoAsk,
  SerperRelatedSearch,
  SerperSearchRequest,
  SerperResponseMeta,
} from '../types';
import { config } from '../config';
import { logger } from '../logger';
import {
  sanitizeTitle,
  sanitizeSnippet,
  sanitizeAnswer,
  sanitizeAttribute,
  sanitizeSuggestion,
  wrapWithMarkers,
  SanitizationResult,
} from './sanitizer';

/**
 * Accumulates sanitization flags across all results in a response.
 */
class FlagTracker {
  totalFlags = 0;
  flaggedResults = 0;
  private currentResultFlagged = false;

  track(result: SanitizationResult): string {
    if (result.flagCount > 0) {
      this.totalFlags += result.flagCount;
      if (!this.currentResultFlagged) {
        this.flaggedResults++;
        this.currentResultFlagged = true;
      }
    }
    return result.text;
  }

  startResult(): void {
    this.currentResultFlagged = false;
  }

  buildMeta(): SerperResponseMeta | undefined {
    if (!config.includeResponseMeta) return undefined;
    return {
      contentTrust: 'untrusted',
      source: 'web-search',
      sanitized: config.sanitizeResults,
      flaggedResults: this.flaggedResults,
    };
  }
}

/**
 * Apply sanitization to a text field if enabled, otherwise just return it.
 */
function san(text: string, sanitize: (t: string) => SanitizationResult, tracker: FlagTracker): string {
  if (!config.sanitizeResults) return text;
  return tracker.track(sanitize(text));
}

/**
 * Transform a SearXNG result to a Serper organic result
 */
function transformToOrganicResult(
  result: SearxngResult,
  position: number,
  tracker: FlagTracker
): SerperOrganicResult {
  tracker.startResult();
  const organicResult: SerperOrganicResult = {
    title: san(result.title || '', sanitizeTitle, tracker),
    link: result.url || '',
    snippet: wrapWithMarkers(san(result.content || '', sanitizeSnippet, tracker)),
    position,
  };

  // Add date if available
  if (result.publishedDate) {
    organicResult.date = result.publishedDate;
  }

  // Transform attributes if available
  if (result.attributes && result.attributes.length > 0) {
    organicResult.attributes = {};
    for (const attr of result.attributes) {
      organicResult.attributes[san(attr.label, sanitizeAttribute, tracker)] =
        san(attr.value, sanitizeAttribute, tracker);
    }
  }

  return organicResult;
}

/**
 * Transform a SearXNG result to a Serper news result
 */
function transformToNewsResult(
  result: SearxngResult,
  position: number,
  tracker: FlagTracker
): SerperNewsResult {
  tracker.startResult();
  return {
    title: san(result.title || '', sanitizeTitle, tracker),
    link: result.url || '',
    snippet: wrapWithMarkers(san(result.content || '', sanitizeSnippet, tracker)),
    date: result.publishedDate || '',
    source: extractDomain(result.url) || result.engine || '',
    imageUrl: result.thumbnail || result.img_src,
    position,
  };
}

/**
 * Transform a SearXNG result to a Serper image result
 */
function transformToImageResult(
  result: SearxngResult,
  position: number,
  tracker: FlagTracker
): SerperImageResult {
  tracker.startResult();
  // Parse resolution if available
  let width = 0;
  let height = 0;
  if (result.resolution) {
    const match = result.resolution.match(/(\d+)\s*[xX×]\s*(\d+)/);
    if (match) {
      width = parseInt(match[1], 10);
      height = parseInt(match[2], 10);
    }
  }

  return {
    title: san(result.title || '', sanitizeTitle, tracker),
    imageUrl: result.img_src || result.url || '',
    imageWidth: width,
    imageHeight: height,
    thumbnailUrl: result.thumbnail_src || result.thumbnail || result.img_src || '',
    thumbnailWidth: Math.min(width, 200),
    thumbnailHeight: Math.min(height, 200),
    source: san(result.title || '', sanitizeTitle, tracker),
    domain: extractDomain(result.url) || '',
    link: result.url || '',
    googleUrl: result.url || '',
    position,
  };
}

/**
 * Transform a SearXNG result to a Serper place result
 */
function transformToPlaceResult(
  result: SearxngResult,
  position: number,
  tracker: FlagTracker
): SerperPlaceResult {
  tracker.startResult();
  // SearXNG doesn't have a direct equivalent to Google Places
  // We do our best to map available fields
  return {
    title: san(result.title || '', sanitizeTitle, tracker),
    address: san(result.content || '', sanitizeSnippet, tracker),
    position,
    // These would need to be extracted from content or other fields if available
    category: result.engine || undefined,
  };
}

/**
 * Transform a SearXNG result to a Serper scholar result
 */
function transformToScholarResult(
  result: SearxngResult,
  position: number,
  tracker: FlagTracker
): SerperScholarResult {
  tracker.startResult();
  const scholarResult: SerperScholarResult = {
    title: san(result.title || '', sanitizeTitle, tracker),
    link: result.url || '',
    snippet: wrapWithMarkers(san(result.content || '', sanitizeSnippet, tracker)),
    position,
  };

  // Extract publication year from publishedDate if available
  if (result.publishedDate) {
    const yearMatch = result.publishedDate.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      scholarResult.year = yearMatch[0];
    }
  }

  // Source engine can indicate publication source (arxiv, pubmed, semantic scholar, etc.)
  if (result.engine) {
    scholarResult.publication = result.engine;
  }

  // Check for PDF links in the URL
  if (result.url && result.url.toLowerCase().includes('.pdf')) {
    scholarResult.pdfUrl = result.url;
  }

  return scholarResult;
}

/**
 * Transform SearXNG infobox to Serper knowledge graph
 */
function transformToKnowledgeGraph(
  infobox: SearxngInfobox,
  tracker: FlagTracker
): SerperKnowledgeGraph {
  tracker.startResult();
  const kg: SerperKnowledgeGraph = {
    title: san(infobox.infobox, sanitizeTitle, tracker),
    description: infobox.content ? wrapWithMarkers(san(infobox.content, sanitizeSnippet, tracker)) : undefined,
    imageUrl: infobox.img_src,
  };

  // Transform URLs to website
  if (infobox.urls && infobox.urls.length > 0) {
    kg.website = infobox.urls[0].url;
  }

  // Transform attributes
  if (infobox.attributes && infobox.attributes.length > 0) {
    kg.attributes = {};
    for (const attr of infobox.attributes) {
      kg.attributes[san(attr.label, sanitizeAttribute, tracker)] =
        san(attr.value, sanitizeAttribute, tracker);
    }
  }

  return kg;
}

/**
 * Transform SearXNG suggestions to Serper related searches
 */
function transformToRelatedSearches(suggestions: string[], tracker: FlagTracker): SerperRelatedSearch[] {
  return suggestions.map((suggestion) => {
    tracker.startResult();
    return {
      query: san(suggestion, sanitizeSuggestion, tracker),
    };
  });
}

/**
 * Transform SearXNG answers to Serper answer box
 */
function transformToAnswerBox(answers: string[], tracker: FlagTracker): SerperAnswerBox | undefined {
  if (answers.length === 0) {
    return undefined;
  }

  tracker.startResult();
  return {
    answer: wrapWithMarkers(san(answers[0], sanitizeAnswer, tracker)),
    snippet: wrapWithMarkers(san(answers.join(' '), sanitizeSnippet, tracker)),
  };
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return '';
  }
}

/**
 * Main transformer: Convert SearXNG response to Serper search response
 */
export function transformSearchResponse(
  searxngResponse: SearxngSearchResponse,
  request: SerperSearchRequest,
  searchType: 'search' | 'news' | 'images' | 'places' | 'scholar' | 'shopping' = 'search'
): SerperSearchResponse | SerperNewsResponse | SerperImagesResponse | SerperPlacesResponse | SerperScholarResponse | SerperShoppingResponse {
  
  const searchParameters = {
    q: request.q,
    gl: request.gl || config.defaultCountry,
    hl: request.hl || config.defaultLanguage,
    num: request.num || config.defaultNumResults,
    type: searchType,
  };

  logger.debug(`Transforming ${searxngResponse.results.length} results for ${searchType} search`);

  switch (searchType) {
    case 'news':
      return transformToNewsResponse(searxngResponse, searchParameters);
    case 'images':
      return transformToImagesResponse(searxngResponse, searchParameters);
    case 'places':
      return transformToPlacesResponse(searxngResponse, searchParameters);
    case 'scholar':
      return transformToScholarResponse(searxngResponse, searchParameters);
    case 'shopping':
      return transformToShoppingResponse(searxngResponse, searchParameters);
    default:
      return transformToSearchResponse(searxngResponse, searchParameters);
  }
}

function transformToSearchResponse(
  searxngResponse: SearxngSearchResponse,
  searchParameters: SerperSearchResponse['searchParameters']
): SerperSearchResponse {
  const tracker = new FlagTracker();

  // Filter for general/web results
  const webResults = searxngResponse.results.filter(
    (r) => r.category === 'general' || !r.category
  );

  const response: SerperSearchResponse = {
    searchParameters,
    organic: webResults.slice(0, searchParameters.num).map((result, index) =>
      transformToOrganicResult(result, index + 1, tracker)
    ),
  };

  // Add knowledge graph from infoboxes
  if (searxngResponse.infoboxes && searxngResponse.infoboxes.length > 0) {
    response.knowledgeGraph = transformToKnowledgeGraph(searxngResponse.infoboxes[0], tracker);
  }

  // Add answer box from answers
  if (searxngResponse.answers && searxngResponse.answers.length > 0) {
    response.answerBox = transformToAnswerBox(searxngResponse.answers, tracker);
  }

  // Add related searches from suggestions
  if (searxngResponse.suggestions && searxngResponse.suggestions.length > 0) {
    response.relatedSearches = transformToRelatedSearches(searxngResponse.suggestions, tracker);
  }

  // Credits are always 0 since we're using self-hosted SearXNG
  response.credits = 0;

  // Add response metadata if enabled
  response._meta = tracker.buildMeta();

  return response;
}

function transformToNewsResponse(
  searxngResponse: SearxngSearchResponse,
  searchParameters: SerperNewsResponse['searchParameters']
): SerperNewsResponse {
  const tracker = new FlagTracker();

  // Filter for news results
  const newsResults = searxngResponse.results.filter(
    (r) => r.category === 'news' || r.publishedDate
  );

  // If no news-specific results, use all results
  const results = newsResults.length > 0 ? newsResults : searxngResponse.results;

  return {
    searchParameters,
    news: results.slice(0, searchParameters.num).map((result, index) =>
      transformToNewsResult(result, index + 1, tracker)
    ),
    credits: 0,
    _meta: tracker.buildMeta(),
  };
}

function transformToImagesResponse(
  searxngResponse: SearxngSearchResponse,
  searchParameters: SerperImagesResponse['searchParameters']
): SerperImagesResponse {
  const tracker = new FlagTracker();

  // Filter for image results
  const imageResults = searxngResponse.results.filter(
    (r) => r.category === 'images' || r.img_src
  );

  return {
    searchParameters,
    images: imageResults.slice(0, searchParameters.num).map((result, index) =>
      transformToImageResult(result, index + 1, tracker)
    ),
    credits: 0,
    _meta: tracker.buildMeta(),
  };
}

function transformToPlacesResponse(
  searxngResponse: SearxngSearchResponse,
  searchParameters: SerperPlacesResponse['searchParameters']
): SerperPlacesResponse {
  const tracker = new FlagTracker();

  // Filter for map/places results
  const placeResults = searxngResponse.results.filter(
    (r) => r.category === 'map'
  );

  // If no map results, use general results
  const results = placeResults.length > 0 ? placeResults : searxngResponse.results;

  return {
    searchParameters,
    places: results.slice(0, searchParameters.num).map((result, index) =>
      transformToPlaceResult(result, index + 1, tracker)
    ),
    credits: 0,
    _meta: tracker.buildMeta(),
  };
}

function transformToScholarResponse(
  searxngResponse: SearxngSearchResponse,
  searchParameters: SerperScholarResponse['searchParameters']
): SerperScholarResponse {
  const tracker = new FlagTracker();

  // Filter for science/academic results
  const scholarResults = searxngResponse.results.filter(
    (r) => r.category === 'science' || r.category === 'scientific_publications'
  );

  // If no science-specific results, use all results
  const results = scholarResults.length > 0 ? scholarResults : searxngResponse.results;

  return {
    searchParameters,
    scholar: results.slice(0, searchParameters.num).map((result, index) =>
      transformToScholarResult(result, index + 1, tracker)
    ),
    credits: 0,
    _meta: tracker.buildMeta(),
  };
}

/**
 * Transform a SearXNG result to a Serper shopping result
 * Handles results from native shopping engines (eBay, Geizhals, etc.)
 */
function transformToShoppingResult(
  result: SearxngResult,
  position: number,
  tracker: FlagTracker
): SerperShoppingResult {
  tracker.startResult();
  const shoppingResult: SerperShoppingResult = {
    title: san(result.title || '', sanitizeTitle, tracker),
    link: result.url || '',
    source: extractDomain(result.url) || result.engine || '',
    snippet: wrapWithMarkers(san(result.content || '', sanitizeSnippet, tracker)),
    position,
  };

  // Use native price field from shopping engines if available
  if (result.price) {
    shoppingResult.price = result.price;
  } else if (result.content) {
    // Fallback: Try to extract price from content (common patterns: $XX.XX, €XX.XX, £XX.XX)
    const priceMatch = result.content.match(/[\$€£]\s*\d+(?:[.,]\d{2})?/);
    if (priceMatch) {
      shoppingResult.price = priceMatch[0].trim();
      // Determine currency from symbol
      if (priceMatch[0].includes('$')) shoppingResult.currency = 'USD';
      else if (priceMatch[0].includes('€')) shoppingResult.currency = 'EUR';
      else if (priceMatch[0].includes('£')) shoppingResult.currency = 'GBP';
    }
  }

  // Use shipping info if available from shopping engines
  if (result.shipping) {
    shoppingResult.delivery = result.shipping;
  }

  // Use thumbnail if available
  if (result.thumbnail || result.img_src) {
    shoppingResult.thumbnail = result.thumbnail || result.img_src;
  }

  return shoppingResult;
}

function transformToShoppingResponse(
  searxngResponse: SearxngSearchResponse,
  searchParameters: SerperShoppingResponse['searchParameters']
): SerperShoppingResponse {
  const tracker = new FlagTracker();

  // Filter for shopping results from shopping engines
  const shoppingEngines = ['ebay', 'ebay de', 'ebay uk', 'geizhals', 'openfoodfacts'];
  
  const shoppingResults = searxngResponse.results.filter(
    (r) => r.category === 'shopping' || 
           (r.engine && shoppingEngines.some(eng => r.engine?.toLowerCase().includes(eng)))
  );

  // If no shopping-specific results, use all results
  const results = shoppingResults.length > 0 ? shoppingResults : searxngResponse.results;

  return {
    searchParameters,
    shopping: results.slice(0, searchParameters.num).map((result, index) =>
      transformToShoppingResult(result, index + 1, tracker)
    ),
    credits: 0,
    _meta: tracker.buildMeta(),
  };
}
