/**
 * Type definitions for SearXNG API request/response formats
 * These types define the interface of the upstream SearXNG instance
 */

// =============================================================================
// SearXNG Request Types
// =============================================================================

export interface SearxngSearchParams {
  q: string;                    // Search query (required)
  categories?: string;          // Comma-separated list of categories
  engines?: string;             // Comma-separated list of engines
  language?: string;            // Language code
  pageno?: number;              // Page number (default: 1)
  time_range?: 'day' | 'week' | 'month' | 'year';  // Time range filter
  format?: 'json' | 'csv' | 'rss';  // Output format
  safesearch?: 0 | 1 | 2;       // Safe search level
  image_proxy?: boolean;        // Proxy images through SearXNG
}

// =============================================================================
// SearXNG Response Types
// =============================================================================

export interface SearxngResult {
  url: string;
  title: string;
  content?: string;             // Snippet/description
  engine?: string;              // Engine that returned this result
  engines?: string[];           // All engines that returned this result
  positions?: number[];         // Positions in each engine
  score?: number;               // Relevance score
  category?: string;            // Category (general, images, news, etc.)
  pretty_url?: string;
  parsed_url?: string[];
  template?: string;
  
  // Optional fields depending on result type
  publishedDate?: string;       // For news results
  thumbnail?: string;           // For image/video results
  img_src?: string;             // Image source URL
  thumbnail_src?: string;       // Thumbnail URL
  resolution?: string;          // Image resolution
  img_format?: string;          // Image format
  
  // For infobox results
  infobox?: string;
  id?: string;
  urls?: Array<{ title: string; url: string }>;
  attributes?: Array<{ label: string; value: string }>;
  
  // Additional metadata
  seed?: string;
  magnetlink?: string;
  torrentfile?: string;
  filesize?: number;
}

export interface SearxngInfobox {
  infobox: string;
  id: string;
  content?: string;
  img_src?: string;
  urls?: Array<{ title: string; url: string }>;
  attributes?: Array<{ label: string; value: string }>;
  engine?: string;
  engines?: string[];
}

export interface SearxngSuggestion {
  suggestion: string;
}

export interface SearxngSearchResponse {
  query: string;
  number_of_results: number;
  results: SearxngResult[];
  answers?: string[];
  corrections?: string[];
  infoboxes?: SearxngInfobox[];
  suggestions?: string[];
  unresponsive_engines?: Array<[string, string]>;  // [engine, error]
}

// Categories available in SearXNG
export type SearxngCategory = 
  | 'general'
  | 'images'
  | 'videos'
  | 'news'
  | 'map'
  | 'music'
  | 'it'
  | 'science'
  | 'files'
  | 'social media';
