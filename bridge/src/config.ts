import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

export interface Config {
  port: number;
  searxngBaseUrl: string;
  bridgeApiKey: string | null;
  logLevel: string;
  defaultNumResults: number;
  defaultCountry: string;
  defaultLanguage: string;
  requestTimeout: number;
  verifySsl: boolean;

  // Prompt injection defense settings
  sanitizeResults: boolean;
  sanitizeWrapMarkers: boolean;
  includeResponseMeta: boolean;
  rateLimitPerMinute: number;
  maxQueryLength: number;
  maxTitleLength: number;
  maxSnippetLength: number;
  maxAnswerLength: number;
  maxAttributeLength: number;
  maxSuggestionLength: number;

  // ML-based prompt injection scanning
  mlScanEnabled: boolean;
  mlModelId: string;
  mlModelDtype: string;
  mlModelCacheDir: string;
  mlScanThreshold: number;
  mlRedactMode: string;
}

export const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  searxngBaseUrl: process.env.SEARXNG_BASE_URL || 'https://searxng.local.lan',
  bridgeApiKey: process.env.BRIDGE_API_KEY || null,
  logLevel: process.env.LOG_LEVEL || 'info',
  defaultNumResults: parseInt(process.env.DEFAULT_NUM_RESULTS || '10', 10),
  defaultCountry: process.env.DEFAULT_COUNTRY || 'us',
  defaultLanguage: process.env.DEFAULT_LANGUAGE || 'en',
  requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '10000', 10),
  verifySsl: process.env.VERIFY_SSL !== 'false',

  // Prompt injection defense settings
  sanitizeResults: process.env.SANITIZE_RESULTS !== 'false',
  sanitizeWrapMarkers: process.env.SANITIZE_WRAP_MARKERS === 'true',
  includeResponseMeta: process.env.INCLUDE_RESPONSE_META !== 'false',
  rateLimitPerMinute: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '60', 10),
  maxQueryLength: parseInt(process.env.MAX_QUERY_LENGTH || '2000', 10),
  maxTitleLength: parseInt(process.env.MAX_TITLE_LENGTH || '500', 10),
  maxSnippetLength: parseInt(process.env.MAX_SNIPPET_LENGTH || '2000', 10),
  maxAnswerLength: parseInt(process.env.MAX_ANSWER_LENGTH || '1000', 10),
  maxAttributeLength: parseInt(process.env.MAX_ATTRIBUTE_LENGTH || '500', 10),
  maxSuggestionLength: parseInt(process.env.MAX_SUGGESTION_LENGTH || '200', 10),

  // ML-based prompt injection scanning
  mlScanEnabled: process.env.ML_SCAN_ENABLED !== 'false',
  mlModelId: process.env.ML_MODEL_ID || 'ProtectAI/deberta-v3-base-prompt-injection-v2',
  mlModelDtype: process.env.ML_MODEL_DTYPE || 'q8',
  mlModelCacheDir: process.env.ML_MODEL_CACHE_DIR || '',
  mlScanThreshold: parseFloat(process.env.ML_SCAN_THRESHOLD || '0.5'),
  mlRedactMode: process.env.ML_REDACT_MODE || 'redact',
};

export function validateConfig(): void {
  if (!config.searxngBaseUrl) {
    throw new Error('SEARXNG_BASE_URL environment variable is required');
  }
  
  // Validate URL format
  try {
    new URL(config.searxngBaseUrl);
  } catch {
    throw new Error('SEARXNG_BASE_URL must be a valid URL');
  }
}
