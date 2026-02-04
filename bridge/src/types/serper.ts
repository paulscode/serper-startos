/**
 * Type definitions for Serper API request/response formats
 * These types define the interface that this bridge exposes to clients
 */

// =============================================================================
// Serper Request Types
// =============================================================================

export interface SerperSearchRequest {
  q: string;                    // Search query
  gl?: string;                  // Country code (e.g., 'us', 'uk')
  hl?: string;                  // Language code (e.g., 'en', 'es')
  num?: number;                 // Number of results (default: 10)
  autocorrect?: boolean;        // Enable autocorrect
  page?: number;                // Page number (default: 1)
  tbs?: string;                 // Time-based search filter (qdr:h, qdr:d, qdr:w, qdr:m, qdr:y)
}

export interface SerperNewsRequest extends SerperSearchRequest {
  // News-specific parameters inherit from search
}

export interface SerperImagesRequest extends SerperSearchRequest {
  // Images-specific parameters inherit from search
}

export interface SerperPlacesRequest extends SerperSearchRequest {
  // Places-specific parameters inherit from search
}

// =============================================================================
// Serper Response Types
// =============================================================================

export interface SerperOrganicResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
  date?: string;
  sitelinks?: Array<{
    title: string;
    link: string;
  }>;
  attributes?: Record<string, string>;
}

export interface SerperKnowledgeGraph {
  title?: string;
  type?: string;
  website?: string;
  imageUrl?: string;
  description?: string;
  descriptionSource?: string;
  descriptionLink?: string;
  attributes?: Record<string, string>;
}

export interface SerperAnswerBox {
  snippet?: string;
  snippetHighlighted?: string[];
  title?: string;
  link?: string;
  answer?: string;
}

export interface SerperPeopleAlsoAsk {
  question: string;
  snippet: string;
  title: string;
  link: string;
}

export interface SerperRelatedSearch {
  query: string;
}

export interface SerperNewsResult {
  title: string;
  link: string;
  snippet: string;
  date: string;
  source: string;
  imageUrl?: string;
  position: number;
}

export interface SerperImageResult {
  title: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  thumbnailUrl: string;
  thumbnailWidth: number;
  thumbnailHeight: number;
  source: string;
  domain: string;
  link: string;
  googleUrl: string;
  position: number;
}

export interface SerperPlaceResult {
  title: string;
  address: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  ratingCount?: number;
  category?: string;
  phoneNumber?: string;
  website?: string;
  cid?: string;
  position: number;
}

export interface SerperScholarResult {
  title: string;
  link: string;
  snippet: string;
  publication?: string;     // Journal, conference, or source name
  authors?: string[];       // List of authors
  citedBy?: number;         // Citation count
  year?: string;            // Publication year
  pdfUrl?: string;          // Direct PDF link if available
  position: number;
}

export interface SerperShoppingResult {
  title: string;
  link: string;
  source: string;           // Store name
  price?: string;           // Formatted price (e.g., "$29.99")
  currency?: string;        // Currency code (e.g., "USD")
  thumbnail?: string;       // Product image URL
  snippet?: string;         // Product description
  rating?: number;          // Product rating
  ratingCount?: number;     // Number of reviews
  delivery?: string;        // Shipping info
  position: number;
}

export interface SerperSearchResponse {
  searchParameters: {
    q: string;
    gl: string;
    hl: string;
    num: number;
    type: string;
  };
  knowledgeGraph?: SerperKnowledgeGraph;
  answerBox?: SerperAnswerBox;
  organic: SerperOrganicResult[];
  peopleAlsoAsk?: SerperPeopleAlsoAsk[];
  relatedSearches?: SerperRelatedSearch[];
  credits?: number;
}

export interface SerperNewsResponse {
  searchParameters: {
    q: string;
    gl: string;
    hl: string;
    num: number;
    type: string;
  };
  news: SerperNewsResult[];
  credits?: number;
}

export interface SerperImagesResponse {
  searchParameters: {
    q: string;
    gl: string;
    hl: string;
    num: number;
    type: string;
  };
  images: SerperImageResult[];
  credits?: number;
}

export interface SerperPlacesResponse {
  searchParameters: {
    q: string;
    gl: string;
    hl: string;
    num: number;
    type: string;
  };
  places: SerperPlaceResult[];
  credits?: number;
}

export interface SerperScholarResponse {
  searchParameters: {
    q: string;
    gl: string;
    hl: string;
    num: number;
    type: string;
  };
  scholar: SerperScholarResult[];
  credits?: number;
}

export interface SerperShoppingResponse {
  searchParameters: {
    q: string;
    gl: string;
    hl: string;
    num: number;
    type: string;
  };
  shopping: SerperShoppingResult[];
  credits?: number;
}

export type SerperResponse = 
  | SerperSearchResponse 
  | SerperNewsResponse 
  | SerperImagesResponse 
  | SerperPlacesResponse
  | SerperScholarResponse
  | SerperShoppingResponse;
