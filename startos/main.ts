import { configJson } from './fileModels/config.json'
import { sdk } from './sdk'
import { port } from './utils'

export const main = sdk.setupMain(async ({ effects }) => {
  /**
   * ======================== Setup ========================
   */
  console.info('Starting Serper Clone')

  // .const (not .once) so changing the config re-runs main and restarts the
  // services with the new values, rather than waiting for a manual restart.
  const config = (await configJson.read().const(effects)) ?? {
    apiKey: '',
    instanceName: 'Serper',
    logLevel: 'info' as const,
    defaultResults: 10,
    promptInjectionDefense: {
      sanitizeResults: true,
      wrapMarkers: false,
      includeMeta: true,
      rateLimit: 60,
      maxQueryLength: 2000,
      mlScanEnabled: true,
      mlScanThreshold: '0.5',
      mlRedactMode: 'redact' as const,
    },
  }

  const pid = config.promptInjectionDefense
  const bool = (b: boolean) => (b ? 'true' : 'false')

  const container = await sdk.SubContainer.of(
    effects,
    { imageId: 'main' },
    sdk.Mounts.of().mountVolume({
      volumeId: 'main',
      subpath: null,
      mountpoint: '/root',
      readonly: false,
    }),
    'serper',
  )

  /**
   * ======================== Daemons ========================
   */
  return sdk.Daemons.of(effects).addDaemon('main', {
    subcontainer: container,
    exec: {
      // The shared, env-driven supervisor (also used by the 0.3.5.1 package and
      // plain `docker run`). It starts Valkey, SearXNG, and the Serper bridge.
      command: ['/usr/local/bin/docker_entrypoint_040.sh'],
      env: {
        API_KEY: config.apiKey,
        BRIDGE_API_KEY: config.apiKey,
        INSTANCE_NAME: config.instanceName,
        LOG_LEVEL: config.logLevel,
        DEFAULT_NUM_RESULTS: String(config.defaultResults),
        SANITIZE_RESULTS: bool(pid.sanitizeResults),
        SANITIZE_WRAP_MARKERS: bool(pid.wrapMarkers),
        INCLUDE_RESPONSE_META: bool(pid.includeMeta),
        RATE_LIMIT_PER_MINUTE: String(pid.rateLimit),
        MAX_QUERY_LENGTH: String(pid.maxQueryLength),
        ML_SCAN_ENABLED: bool(pid.mlScanEnabled),
        ML_SCAN_THRESHOLD: pid.mlScanThreshold,
        ML_REDACT_MODE: pid.mlRedactMode,
        ML_MODEL_CACHE_DIR: '/app/models',
      },
      runAsInit: true,
    },
    ready: {
      display: 'Serper Clone API',
      fn: () =>
        sdk.healthCheck.checkPortListening(effects, port, {
          successMessage: 'Serper Clone API is ready',
          errorMessage: 'Serper Clone API is starting',
        }),
    },
    requires: [],
  })
})
