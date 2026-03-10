/**
 * ML-Based Prompt Injection Scanner
 * Uses a fine-tuned DeBERTa model to classify search result text
 * as benign or injection-detected.
 *
 * The model is loaded once at startup and reused for all requests.
 * Inference is async to avoid blocking the Node.js event loop.
 */

import { config } from '../config';
import { logger } from '../logger';

// Lazy-loaded pipeline reference
let classifier: any = null;
let initPromise: Promise<void> | null = null;
let initFailed = false;

/**
 * Result of scanning a single text field.
 */
export interface MlScanResult {
  isInjection: boolean;
  score: number;
}

/**
 * Initialize the ML model pipeline.
 * Called once at startup. If the model fails to load, the scanner
 * degrades gracefully — all subsequent scans return { isInjection: false }.
 */
export async function initMlScanner(): Promise<void> {
  if (!config.mlScanEnabled) {
    logger.info('ML prompt injection scanner: disabled');
    return;
  }

  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      logger.info('ML prompt injection scanner: loading model...');
      const startTime = Date.now();

      // Dynamic import — the package uses ESM
      const { pipeline, env } = await import('@huggingface/transformers');

      // Disable remote model fetching if a local cache is available
      // In Docker, models will be baked into the image
      if (config.mlModelCacheDir) {
        env.localModelPath = config.mlModelCacheDir;
        env.allowRemoteModels = true; // allow fallback to download
      }

      classifier = await pipeline(
        'text-classification',
        config.mlModelId,
        {
          dtype: config.mlModelDtype as any,
          // Explicitly set device to cpu (WASM backend)
          device: 'cpu',
        }
      );

      const elapsed = Date.now() - startTime;
      logger.info(`ML prompt injection scanner: model loaded in ${elapsed}ms`);
    } catch (error) {
      initFailed = true;
      classifier = null;
      logger.error(`ML prompt injection scanner: failed to load model: ${(error as Error).message}`);
      logger.warn('ML prompt injection scanner: falling back to regex-only sanitization');
    }
  })();

  return initPromise;
}

/**
 * Scan a single text field for prompt injection.
 * Returns a classification result with label and confidence score.
 */
export async function scanText(text: string): Promise<MlScanResult> {
  if (!classifier || !config.mlScanEnabled) {
    return { isInjection: false, score: 0 };
  }

  if (!text || text.trim().length === 0) {
    return { isInjection: false, score: 0 };
  }

  try {
    // Truncate to model's max sequence length (512 tokens ≈ ~2000 chars)
    const input = text.length > 2000 ? text.substring(0, 2000) : text;

    const results = await classifier(input, { topk: 1 });
    const result = Array.isArray(results) ? results[0] : results;

    // The protectai model uses label "INJECTION" for detected injections
    // and "SAFE" for benign text
    const isInjection =
      (result.label === 'INJECTION' || result.label === 'LABEL_1') &&
      result.score >= config.mlScanThreshold;

    return { isInjection, score: result.score };
  } catch (error) {
    logger.warn(`ML scan error: ${(error as Error).message}`);
    return { isInjection: false, score: 0 };
  }
}

/**
 * Scan multiple text fields in batch.
 * Returns results in the same order as the input array.
 */
export async function scanTexts(texts: string[]): Promise<MlScanResult[]> {
  if (!classifier || !config.mlScanEnabled || texts.length === 0) {
    return texts.map(() => ({ isInjection: false, score: 0 }));
  }

  // Scan each text individually — batching with Transformers.js on CPU
  // doesn't provide significant speedup and complicates error handling
  return Promise.all(texts.map(scanText));
}

/**
 * Check if the ML scanner is ready (model loaded and enabled).
 */
export function isMlScannerReady(): boolean {
  return config.mlScanEnabled && classifier !== null && !initFailed;
}

/**
 * Reset scanner state. Exposed for testing only.
 */
export function _resetForTesting(): void {
  classifier = null;
  initPromise = null;
  initFailed = false;
}
