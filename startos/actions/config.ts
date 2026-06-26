import { configJson } from '../fileModels/config.json'
import { sdk } from '../sdk'

const { InputSpec, Value } = sdk

export const inputSpec = InputSpec.of({
  apiKey: Value.text({
    name: 'API Key',
    description:
      'Your Serper API key. Use this in your applications just like you would use a Serper.dev API key. Set in the X-API-KEY header or SERPER_API_KEY environment variable.',
    required: true,
    default: { charset: 'a-z,A-Z,0-9', len: 32 },
    masked: true,
    patterns: [
      {
        regex: '^[a-zA-Z0-9]{16,64}$',
        description: 'Must be 16-64 alphanumeric characters',
      },
    ],
    generate: { charset: 'a-z,A-Z,0-9', len: 32 },
  }),
  instanceName: Value.text({
    name: 'Instance Name',
    description: 'A friendly name for your Serper instance',
    required: true,
    default: 'Serper',
    placeholder: 'My Serper Instance',
  }),
  logLevel: Value.select({
    name: 'Log Level',
    description: 'Logging verbosity for the Serper bridge',
    default: 'info',
    values: {
      error: 'Error - Only errors',
      warn: 'Warning - Errors and warnings',
      info: 'Info - Standard logging',
      debug: 'Debug - Verbose logging',
    },
  }),
  defaultResults: Value.number({
    name: 'Default Results',
    description:
      'Default number of search results to return when not specified in the request',
    required: true,
    default: 10,
    min: 1,
    max: 100,
    integer: true,
  }),
  promptInjectionDefense: Value.object(
    {
      name: 'Prompt Injection Defense',
      description:
        'Settings to defend against indirect prompt injection when LLM agents consume search results',
    },
    InputSpec.of({
      sanitizeResults: Value.toggle({
        name: 'Sanitize Results',
        description:
          'Strip dangerous HTML, control characters, and flag/neutralize common prompt injection patterns in search result text. Recommended to keep enabled.',
        default: true,
      }),
      wrapMarkers: Value.toggle({
        name: 'Boundary Markers',
        description:
          'Wrap search result text in ---BEGIN SEARCH RESULT--- / ---END SEARCH RESULT--- delimiters. Helps LLMs distinguish data from instructions when combined with appropriate system prompts. May break some integrations that don\'t expect markers.',
        default: false,
      }),
      includeMeta: Value.toggle({
        name: 'Include Response Metadata',
        description:
          'Add a _meta field to responses with content trust level and sanitization stats. Useful for LLM system prompts that reference metadata. Adds a small amount of extra data to each response.',
        default: true,
      }),
      rateLimit: Value.number({
        name: 'Rate Limit (per minute)',
        description:
          'Maximum search requests per IP address per minute. Set to 0 to disable rate limiting.',
        required: true,
        default: 60,
        min: 0,
        max: 1000,
        integer: true,
      }),
      maxQueryLength: Value.number({
        name: 'Max Query Length',
        description:
          'Maximum number of characters allowed in search queries. Prevents excessively long queries.',
        required: true,
        default: 2000,
        min: 100,
        max: 10000,
        integer: true,
      }),
      mlScanEnabled: Value.toggle({
        name: 'ML Scanner',
        description:
          'Enable ML-based prompt injection scanning using a DeBERTa model. Scans search result text and flags detected injection attempts. Requires ~250 MB RAM for the quantized model. First startup may be slow while the model downloads. Disable if memory is constrained.',
        default: true,
      }),
      mlScanThreshold: Value.text({
        name: 'ML Scan Threshold',
        description:
          'Confidence threshold (0.1-1.0) for the ML scanner to flag a result as a prompt injection. Lower values catch more but increase false positives. Default 0.5 is balanced.',
        required: true,
        default: '0.5',
        patterns: [
          {
            regex: '^(0\\.\\d{1,2}|1\\.0{0,2})$',
            description:
              'Must be a decimal between 0.01 and 1.0 (e.g. 0.5, 0.75)',
          },
        ],
      }),
      mlRedactMode: Value.select({
        name: 'ML Flagged Content Action',
        description:
          'What to do with search result content flagged by the ML scanner as potential prompt injection.',
        default: 'redact',
        values: {
          redact: 'Redact - Replace flagged text with a redaction notice',
          tag: 'Tag - Prefix flagged text with a warning (original text still visible to LLM)',
          drop: 'Drop - Remove entire results containing flagged content',
        },
      }),
    }),
  ),
})

export const config = sdk.Action.withInput(
  // id
  'config',

  // metadata
  async ({ effects }) => ({
    name: 'Configure',
    description: 'Set the API key and behavior of the Serper Clone API',
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),

  // form input specification
  inputSpec,

  // pre-fill the form with the current config
  async ({ effects }) => configJson.read().once(),

  // the execution function
  async ({ effects, input }) => configJson.merge(effects, input),
)
