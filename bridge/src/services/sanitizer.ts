/**
 * Content Sanitizer
 * Defends against indirect prompt injection in search results.
 * Applied to all text fields returned from SearXNG before they reach the LLM.
 */

import { config } from '../config';
import { logger } from '../logger';

/**
 * Patterns that commonly appear in prompt injection attempts.
 * Each entry has a regex and a human-readable label.
 */
const INJECTION_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // Role reassignment
  { pattern: /you\s+are\s+now\b/gi, label: 'role-reassignment' },
  { pattern: /act\s+as\s+(a|an|if)\b/gi, label: 'role-reassignment' },
  { pattern: /pretend\s+(to\s+be|you\s*'?re)/gi, label: 'role-reassignment' },
  { pattern: /roleplay\s+as\b/gi, label: 'role-reassignment' },
  { pattern: /you\s+must\s+(now\s+)?obey\b/gi, label: 'role-reassignment' },
  { pattern: /from\s+now\s+on\s+you\s+(are|will)\b/gi, label: 'role-reassignment' },

  // Instruction override
  { pattern: /ignore\s+(all\s+)?(previous|prior|above|earlier|preceding)\s+(instructions?|prompts?|rules?|guidelines?)/gi, label: 'instruction-override' },
  { pattern: /disregard\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|context)/gi, label: 'instruction-override' },
  { pattern: /forget\s+(everything|all|your\s+(previous|prior))/gi, label: 'instruction-override' },
  { pattern: /override\s+(system\s+)?prompt/gi, label: 'instruction-override' },
  { pattern: /new\s+instructions?\s*:/gi, label: 'instruction-override' },
  { pattern: /do\s+not\s+follow\s+(your|the)\s+(previous|original)/gi, label: 'instruction-override' },

  // System prompt markers / delimiter attacks
  { pattern: /\bSYSTEM\s*:/gi, label: 'system-marker' },
  { pattern: /\[SYSTEM\]/gi, label: 'system-marker' },
  { pattern: /###\s*(INSTRUCTION|SYSTEM|PROMPT)/gi, label: 'system-marker' },
  { pattern: /```\s*system\b/gi, label: 'system-marker' },
  { pattern: /<\|?(system|im_start|im_end|endoftext)\|?>/gi, label: 'system-marker' },
  { pattern: /\[INST\]/gi, label: 'system-marker' },
  { pattern: /<<\s*SYS\s*>>/gi, label: 'system-marker' },
  { pattern: /\bBEGIN\s+SYSTEM\s+PROMPT\b/gi, label: 'system-marker' },
  { pattern: /\bEND\s+SYSTEM\s+PROMPT\b/gi, label: 'system-marker' },

  // Data exfiltration
  { pattern: /send\s+(this|the|all|my)\s+(data|information|conversation|chat|history|context|messages?)(\s+\w+)?\s+to\b/gi, label: 'exfiltration' },
  { pattern: /make\s+a\s+(GET|POST|PUT|DELETE|http)\s+request\s+to\b/gi, label: 'exfiltration' },
  { pattern: /fetch\s+(the\s+)?url\b/gi, label: 'exfiltration' },
  { pattern: /call\s+(the\s+)?api\s+at\b/gi, label: 'exfiltration' },
  { pattern: /exfiltrate\b/gi, label: 'exfiltration' },

  // Encoded payloads (base64 blocks that look like instructions)
  { pattern: /\batob\s*\(/gi, label: 'encoded-payload' },
  { pattern: /base64[_\s]*decode/gi, label: 'encoded-payload' },
];

/**
 * Zero-width and special Unicode characters used to hide injections.
 */
const CONTROL_CHAR_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B\u200C\u200D\u200E\u200F\u2028\u2029\u202A-\u202E\u2060\u2066-\u2069\uFEFF\uFFF9-\uFFFB]/g;

/**
 * HTML tag pattern (strip residual HTML that might leak through).
 */
const HTML_TAG_REGEX = /<\/?(?:script|style|iframe|object|embed|form|input|textarea|button|link|meta|base)[^>]*>/gi;

export interface SanitizationResult {
  text: string;
  flagCount: number;
  flags: string[];
}

/**
 * Sanitize a single text field.
 * Returns the cleaned text along with any injection flags found.
 */
export function sanitizeText(text: string, maxLength: number): SanitizationResult {
  if (!text) {
    return { text: '', flagCount: 0, flags: [] };
  }

  const flags: string[] = [];
  let sanitized = text;

  // 1. Strip control characters and zero-width chars
  sanitized = sanitized.replace(CONTROL_CHAR_REGEX, '');

  // 2. Strip dangerous HTML tags
  sanitized = sanitized.replace(HTML_TAG_REGEX, '');

  // 3. Normalize excessive whitespace (collapse 3+ newlines to 2, collapse long spaces)
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
  sanitized = sanitized.replace(/[ \t]{10,}/g, '  ');

  // 4. Detect and neutralize injection patterns
  for (const { pattern, label } of INJECTION_PATTERNS) {
    // Reset lastIndex for global regexes
    pattern.lastIndex = 0;
    if (pattern.test(sanitized)) {
      flags.push(label);
      // Reset again before replace
      pattern.lastIndex = 0;
      sanitized = sanitized.replace(pattern, (match) => `[UNTRUSTED: ${match}]`);
    }
  }

  // 5. Truncate to max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '…';
  }

  // Deduplicate flags
  const uniqueFlags = [...new Set(flags)];

  if (uniqueFlags.length > 0) {
    logger.warn(`Sanitizer flagged content (${uniqueFlags.join(', ')}): "${text.substring(0, 100)}..."`);
  }

  return {
    text: sanitized,
    flagCount: uniqueFlags.length,
    flags: uniqueFlags,
  };
}

/**
 * Optionally wrap text with boundary markers.
 */
export function wrapWithMarkers(text: string): string {
  if (!config.sanitizeWrapMarkers || !text) {
    return text;
  }
  return `---BEGIN SEARCH RESULT---\n${text}\n---END SEARCH RESULT---`;
}

/**
 * Sanitize a title field.
 */
export function sanitizeTitle(text: string): SanitizationResult {
  return sanitizeText(text, config.maxTitleLength);
}

/**
 * Sanitize a snippet/content field.
 */
export function sanitizeSnippet(text: string): SanitizationResult {
  return sanitizeText(text, config.maxSnippetLength);
}

/**
 * Sanitize an answer field.
 */
export function sanitizeAnswer(text: string): SanitizationResult {
  return sanitizeText(text, config.maxAnswerLength);
}

/**
 * Sanitize an attribute value.
 */
export function sanitizeAttribute(text: string): SanitizationResult {
  return sanitizeText(text, config.maxAttributeLength);
}

/**
 * Sanitize a suggestion string.
 */
export function sanitizeSuggestion(text: string): SanitizationResult {
  return sanitizeText(text, config.maxSuggestionLength);
}
