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
   * Check if the SearXNG instance is healthy
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
