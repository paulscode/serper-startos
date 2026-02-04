/**
 * Result Transformer
 * Converts SearXNG response format to Serper response format
 */

import {
  SearxngSearchResponse,
  SearxngResult,
  SearxngInfobox,
  SerperSearchResponse,
  SerperNewsResponse,
  SerperImagesResponse,
  SerperPlacesResponse,
  SerperOrganicResult,
  SerperNewsResult,
  SerperImageResult,
  SerperPlaceResult,
  SerperKnowledgeGraph,
  SerperAnswerBox,
  SerperPeopleAlsoAsk,
  SerperRelatedSearch,
  SerperSearchRequest,
} from '../types';
import { config } from '../config';
import { logger } from '../logger';

/**
 * Transform a SearXNG result to a Serper organic result
 */
function transformToOrganicResult(
  result: SearxngResult,
  position: number
): SerperOrganicResult {
  const organicResult: SerperOrganicResult = {
    title: result.title || '',
    link: result.url || '',
    snippet: result.content || '',
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
      organicResult.attributes[attr.label] = attr.value;
    }
  }

  return organicResult;
}

/**
 * Transform a SearXNG result to a Serper news result
 */
function transformToNewsResult(
  result: SearxngResult,
  position: number
): SerperNewsResult {
  return {
    title: result.title || '',
    link: result.url || '',
    snippet: result.content || '',
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
  position: number
): SerperImageResult {
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
    title: result.title || '',
    imageUrl: result.img_src || result.url || '',
    imageWidth: width,
    imageHeight: height,
    thumbnailUrl: result.thumbnail_src || result.thumbnail || result.img_src || '',
    thumbnailWidth: Math.min(width, 200),
    thumbnailHeight: Math.min(height, 200),
    source: result.title || '',
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
  position: number
): SerperPlaceResult {
  // SearXNG doesn't have a direct equivalent to Google Places
  // We do our best to map available fields
  return {
    title: result.title || '',
    address: result.content || '',
    position,
    // These would need to be extracted from content or other fields if available
    category: result.engine || undefined,
  };
}

/**
 * Transform SearXNG infobox to Serper knowledge graph
 */
function transformToKnowledgeGraph(
  infobox: SearxngInfobox
): SerperKnowledgeGraph {
  const kg: SerperKnowledgeGraph = {
    title: infobox.infobox,
    description: infobox.content,
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
      kg.attributes[attr.label] = attr.value;
    }
  }

  return kg;
}

/**
 * Transform SearXNG suggestions to Serper related searches
 */
function transformToRelatedSearches(suggestions: string[]): SerperRelatedSearch[] {
  return suggestions.map((suggestion) => ({
    query: suggestion,
  }));
}

/**
 * Transform SearXNG answers to Serper answer box
 */
function transformToAnswerBox(answers: string[]): SerperAnswerBox | undefined {
  if (answers.length === 0) {
    return undefined;
  }

  return {
    answer: answers[0],
    snippet: answers.join(' '),
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
  searchType: 'search' | 'news' | 'images' | 'places' = 'search'
): SerperSearchResponse | SerperNewsResponse | SerperImagesResponse | SerperPlacesResponse {
  
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
    default:
      return transformToSearchResponse(searxngResponse, searchParameters);
  }
}

function transformToSearchResponse(
  searxngResponse: SearxngSearchResponse,
  searchParameters: SerperSearchResponse['searchParameters']
): SerperSearchResponse {
  // Filter for general/web results
  const webResults = searxngResponse.results.filter(
    (r) => r.category === 'general' || !r.category
  );

  const response: SerperSearchResponse = {
    searchParameters,
    organic: webResults.slice(0, searchParameters.num).map((result, index) =>
      transformToOrganicResult(result, index + 1)
    ),
  };

  // Add knowledge graph from infoboxes
  if (searxngResponse.infoboxes && searxngResponse.infoboxes.length > 0) {
    response.knowledgeGraph = transformToKnowledgeGraph(searxngResponse.infoboxes[0]);
  }

  // Add answer box from answers
  if (searxngResponse.answers && searxngResponse.answers.length > 0) {
    response.answerBox = transformToAnswerBox(searxngResponse.answers);
  }

  // Add related searches from suggestions
  if (searxngResponse.suggestions && searxngResponse.suggestions.length > 0) {
    response.relatedSearches = transformToRelatedSearches(searxngResponse.suggestions);
  }

  // Credits are always 0 since we're using self-hosted SearXNG
  response.credits = 0;

  return response;
}

function transformToNewsResponse(
  searxngResponse: SearxngSearchResponse,
  searchParameters: SerperNewsResponse['searchParameters']
): SerperNewsResponse {
  // Filter for news results
  const newsResults = searxngResponse.results.filter(
    (r) => r.category === 'news' || r.publishedDate
  );

  // If no news-specific results, use all results
  const results = newsResults.length > 0 ? newsResults : searxngResponse.results;

  return {
    searchParameters,
    news: results.slice(0, searchParameters.num).map((result, index) =>
      transformToNewsResult(result, index + 1)
    ),
    credits: 0,
  };
}

function transformToImagesResponse(
  searxngResponse: SearxngSearchResponse,
  searchParameters: SerperImagesResponse['searchParameters']
): SerperImagesResponse {
  // Filter for image results
  const imageResults = searxngResponse.results.filter(
    (r) => r.category === 'images' || r.img_src
  );

  return {
    searchParameters,
    images: imageResults.slice(0, searchParameters.num).map((result, index) =>
      transformToImageResult(result, index + 1)
    ),
    credits: 0,
  };
}

function transformToPlacesResponse(
  searxngResponse: SearxngSearchResponse,
  searchParameters: SerperPlacesResponse['searchParameters']
): SerperPlacesResponse {
  // Filter for map/places results
  const placeResults = searxngResponse.results.filter(
    (r) => r.category === 'map'
  );

  // If no map results, use general results
  const results = placeResults.length > 0 ? placeResults : searxngResponse.results;

  return {
    searchParameters,
    places: results.slice(0, searchParameters.num).map((result, index) =>
      transformToPlaceResult(result, index + 1)
    ),
    credits: 0,
  };
}
