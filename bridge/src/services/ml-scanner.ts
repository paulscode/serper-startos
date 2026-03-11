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

      // Configure WASM backend for ONNX Runtime.
      // In Docker, onnxruntime-node is stubbed to re-export onnxruntime-web
      // so transformers uses WASM inference instead of native glibc binaries.
      const ort = await import('onnxruntime-web');
      const path = await import('path');
      const ortMainPath = require.resolve('onnxruntime-web');
      ort.env.wasm.wasmPaths = path.dirname(ortMainPath) + '/';
      ort.env.wasm.numThreads = 1;

      // Dynamic import — the package uses ESM
      const { pipeline, env } = await import('@huggingface/transformers');

      // Disable remote model fetching if a local cache is available
      // In Docker, models will be baked into the image
      if (config.mlModelCacheDir) {
        env.localModelPath = config.mlModelCacheDir;
        env.allowRemoteModels = false;
      }

      classifier = await pipeline(
        'text-classification',
        config.mlModelId,
        {
          dtype: config.mlModelDtype as any,
        }
      );

      const elapsed = Date.now() - startTime;
      logger.info(`ML prompt injection scanner: model loaded in ${elapsed}ms`);

      // Warmup probe: run one short inference to measure device speed.
      // WASM inference on low-power hardware (e.g. Start9 servers) can be
      // orders of magnitude slower than native. If too slow, auto-disable.
      const probeStart = Date.now();
      await classifier('test', { topk: 1 });
      const probeMs = Date.now() - probeStart;
      logger.info(`ML prompt injection scanner: warmup inference took ${probeMs}ms`);

      if (probeMs > MAX_INFERENCE_MS) {
        logger.warn(
          `ML prompt injection scanner: inference too slow (${probeMs}ms > ${MAX_INFERENCE_MS}ms limit). ` +
          `Disabling ML scanner — regex-only sanitization will be used.`
        );
        classifier = null;
        initFailed = true;
        return;
      }
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
 * Maximum per-inference time (ms) that's acceptable. If the warmup probe
 * exceeds this, the ML scanner is auto-disabled since the device is too
 * slow for practical use.
 */
const MAX_INFERENCE_MS = 5000;

/**
 * Maximum character length for ML scanner input.
 * DeBERTa's max is 512 tokens (~350-512 chars). Truncating saves
 * tokenization and inference time without losing detection accuracy
 * since injections appear near the start of text.
 */
const MAX_SCAN_CHARS = 512;

/**
 * Maximum time (ms) to spend on ML scanning per request.
 * If exceeded, returns safe defaults for remaining texts.
 */
const ML_SCAN_TIMEOUT_MS = 8000;

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
    const input = text.length > MAX_SCAN_CHARS ? text.substring(0, MAX_SCAN_CHARS) : text;

    const results = await classifier(input, { topk: 1 });
    const result = Array.isArray(results) ? results[0] : results;

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
 * Scan multiple text fields sequentially with a time budget.
 * WASM ONNX inference blocks the event loop, so Promise.race/setTimeout
 * cannot interrupt a running inference. Instead we process texts one at a
 * time and check elapsed time after each completes.
 */
export async function scanTexts(texts: string[]): Promise<MlScanResult[]> {
  if (!classifier || !config.mlScanEnabled || texts.length === 0) {
    return texts.map(() => ({ isInjection: false, score: 0 }));
  }

  const safe: MlScanResult = { isInjection: false, score: 0 };
  const allResults: MlScanResult[] = texts.map(() => safe);
  const startTime = Date.now();

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    if (!text || text.trim().length === 0) continue;

    // Check time budget before starting next inference
    if (Date.now() - startTime > ML_SCAN_TIMEOUT_MS) {
      logger.warn(
        `ML scanner: time budget exhausted after ${Date.now() - startTime}ms, ` +
        `scanned ${i}/${texts.length} texts`
      );
      break;
    }

    try {
      const input = text.length > MAX_SCAN_CHARS ? text.substring(0, MAX_SCAN_CHARS) : text;
      const results = await classifier(input, { topk: 1 });
      const result = Array.isArray(results) ? results[0] : results;

      const isInjection =
        (result.label === 'INJECTION' || result.label === 'LABEL_1') &&
        result.score >= config.mlScanThreshold;

      allResults[i] = { isInjection, score: result.score };
    } catch (error) {
      logger.warn(`ML scan error on text ${i}: ${(error as Error).message}`);
    }
  }

  const elapsed = Date.now() - startTime;
  logger.debug(`ML scanner: scanned ${texts.length} texts in ${elapsed}ms`);

  return allResults;
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
