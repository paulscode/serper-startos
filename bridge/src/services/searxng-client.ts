/**
 * SearXNG API Client
 * Handles communication with the upstream SearXNG instance
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import https from 'https';
import { config } from '../config';
import { logger } from '../logger';
import { SearxngSearchParams, SearxngSearchResponse } from '../types';

export class SearxngClient {
  private client: AxiosInstance;

  constructor() {
    // Create HTTPS agent that optionally ignores SSL errors (for self-signed certs)
    const httpsAgent = new https.Agent({
      rejectUnauthorized: config.verifySsl,
    });

    this.client = axios.create({
      baseURL: config.searxngBaseUrl,
      timeout: config.requestTimeout,
      httpsAgent,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SearXNG-Serper-Bridge/1.0',
      },
    });

    // Log requests in debug mode
    this.client.interceptors.request.use((request) => {
      logger.debug(`SearXNG Request: ${request.method?.toUpperCase()} ${request.url}`);
      logger.debug(`SearXNG Params: ${JSON.stringify(request.params)}`);
      return request;
    });

    // Log responses
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`SearXNG Response: ${response.status} ${response.statusText}`);
        return response;
      },
      (error: AxiosError) => {
        logger.error(`SearXNG Error: ${error.message}`);
        throw error;
      }
    );
  }

  /**
   * Perform a search on the SearXNG instance
   */
  async search(params: SearxngSearchParams): Promise<SearxngSearchResponse> {
    try {
      const response = await this.client.get<SearxngSearchResponse>('/search', {
        params: {
          ...params,
          format: 'json',
        },
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        
        if (axiosError.response) {
          // Server responded with error status
          logger.error(`SearXNG returned error ${axiosError.response.status}: ${axiosError.response.statusText}`);
          throw new Error(`SearXNG error: ${axiosError.response.status} ${axiosError.response.statusText}`);
        } else if (axiosError.request) {
          // No response received
          logger.error('No response received from SearXNG');
          throw new Error('Unable to connect to SearXNG instance');
        }
      }
      
      throw error;
    }
  }

  /**
   * Can SearXNG actually answer a search?
   *
   * `healthCheck` only proves the process is listening. That is not the same
   * question, and on 2026-08-17 the difference mattered: one engine failed its
   * start-up init, every `/search` returned 500 for two days, and `/health`
   * reported `searxng: "up"` throughout, because the home page was being served
   * perfectly well the whole time.
   *
   * A health endpoint that goes green while the only thing anyone uses is
   * broken is worse than no health endpoint, because it is the signal that
   * stops somebody looking. So this asks the real question, with a query cheap
   * enough to run on every check and a short timeout so a slow upstream reports
   * degraded rather than hanging the caller.
   */
  async searchCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/search', {
        params: { q: 'test', format: 'json' },
        timeout: 8000,
      });
      return response.status === 200 && !!response.data;
    } catch {
      return false;
    }
  }

  /**
   * Check if the SearXNG instance is reachable.
   *
   * Reachable, not working: see `searchCheck` for the question that matters.
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try to fetch the main page or a simple search
      const response = await this.client.get('/', {
        timeout: 5000,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Get SearXNG instance info (if available)
   */
  async getInstanceInfo(): Promise<Record<string, unknown> | null> {
    try {
      const response = await this.client.get('/config');
      return response.data;
    } catch {
      // Config endpoint might not be available
      return null;
    }
  }
}

// Singleton instance
export const searxngClient = new SearxngClient();
