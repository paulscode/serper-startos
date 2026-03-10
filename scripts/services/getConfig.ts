// Configuration spec for Serper (Self-Hosted)
// These options display in the Start9 UI Config section

import { compat, types as T } from "../deps.ts";

export const getConfig: T.ExpectedExports.getConfig = compat.getConfig({
  "tor-address": {
    name: "Tor Address",
    description: "The Tor address of the network interface",
    type: "pointer",
    subtype: "package",
    "package-id": "serper",
    target: "tor-address",
    interface: "main",
  },
  "lan-address": {
    name: "LAN Address",
    description: "The LAN address of the network interface",
    type: "pointer",
    subtype: "package",
    "package-id": "serper",
    target: "lan-address",
    interface: "main",
  },
  "api-key": {
    type: "string",
    name: "API Key",
    description:
      "Your Serper API key. Use this in your applications just like you would use a Serper.dev API key. Set in the X-API-KEY header or SERPER_API_KEY environment variable.",
    nullable: false,
    default: {
      charset: "a-z,A-Z,0-9",
      len: 32,
    },
    pattern: "^[a-zA-Z0-9]{16,64}$",
    "pattern-description": "Must be 16-64 alphanumeric characters",
    masked: true,
    copyable: true,
  },
  "instance-name": {
    type: "string",
    name: "Instance Name",
    description: "A friendly name for your Serper instance",
    nullable: false,
    default: "Serper",
    placeholder: "My Serper Instance",
  },
  "log-level": {
    type: "enum",
    name: "Log Level",
    description: "Logging verbosity for the Serper bridge",
    values: ["error", "warn", "info", "debug"],
    "value-names": {
      "error": "Error - Only errors",
      "warn": "Warning - Errors and warnings",
      "info": "Info - Standard logging",
      "debug": "Debug - Verbose logging",
    },
    default: "info",
  },
  "default-results": {
    type: "number",
    name: "Default Results",
    description: "Default number of search results to return when not specified in the request",
    nullable: false,
    default: 10,
    range: "[1,100]",
    integral: true,
  },
  "prompt-injection-defense": {
    type: "object",
    name: "Prompt Injection Defense",
    description: "Settings to defend against indirect prompt injection when LLM agents consume search results",
    spec: {
      "sanitize-results": {
        type: "boolean",
        name: "Sanitize Results",
        description:
          "Strip dangerous HTML, control characters, and flag/neutralize common prompt injection patterns in search result text. Recommended to keep enabled.",
        default: true,
      },
      "wrap-markers": {
        type: "boolean",
        name: "Boundary Markers",
        description:
          "Wrap search result text in ---BEGIN SEARCH RESULT--- / ---END SEARCH RESULT--- delimiters. Helps LLMs distinguish data from instructions when combined with appropriate system prompts. May break some integrations that don't expect markers.",
        default: false,
      },
      "include-meta": {
        type: "boolean",
        name: "Include Response Metadata",
        description:
          "Add a _meta field to responses with content trust level and sanitization stats. Useful for LLM system prompts that reference metadata. Adds a small amount of extra data to each response.",
        default: true,
      },
      "rate-limit": {
        type: "number",
        name: "Rate Limit (per minute)",
        description:
          "Maximum search requests per IP address per minute. Set to 0 to disable rate limiting.",
        nullable: false,
        default: 60,
        range: "[0,1000]",
        integral: true,
      },
      "max-query-length": {
        type: "number",
        name: "Max Query Length",
        description:
          "Maximum number of characters allowed in search queries. Prevents excessively long queries.",
        nullable: false,
        default: 2000,
        range: "[100,10000]",
        integral: true,
      },
      "ml-scan-enabled": {
        type: "boolean",
        name: "ML Scanner",
        description:
          "Enable ML-based prompt injection scanning using a DeBERTa model. Scans search result text and flags detected injection attempts. Requires ~250 MB RAM for the quantized model. First startup may be slow while the model downloads. Disable if memory is constrained.",
        default: true,
      },
      "ml-scan-threshold": {
        type: "string",
        name: "ML Scan Threshold",
        description:
          "Confidence threshold (0.1–1.0) for the ML scanner to flag a result as a prompt injection. Lower values catch more but increase false positives. Default 0.5 is balanced.",
        nullable: false,
        default: "0.5",
        pattern: "^(0\\.\\d{1,2}|1\\.0{0,2})$",
        "pattern-description": "Must be a decimal between 0.01 and 1.0 (e.g. 0.5, 0.75)",
      },
      "ml-redact-mode": {
        type: "enum",
        name: "ML Flagged Content Action",
        description:
          "What to do with search result content flagged by the ML scanner as potential prompt injection.",
        values: ["redact", "tag", "drop"],
        "value-names": {
          "redact": "Redact - Replace flagged text with a redaction notice",
          "tag": "Tag - Prefix flagged text with a warning (original text still visible to LLM)",
          "drop": "Drop - Remove entire results containing flagged content",
        },
        default: "redact",
      },
    },
  },
});
