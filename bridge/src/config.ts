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
