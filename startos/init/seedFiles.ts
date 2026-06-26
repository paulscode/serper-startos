import { utils } from '@start9labs/start-sdk'
import { configJson } from '../fileModels/config.json'
import { sdk } from '../sdk'

// On first install, generate a strong random API key so the package is usable
// out of the box (the user can change it later via the Configure action).
export const seedFiles = sdk.setupOnInit(async (effects) => {
  const existing = await configJson.read().once()
  if (!existing || !existing.apiKey) {
    await configJson.write(effects, {
      apiKey: utils.getDefaultString({ charset: 'a-z,A-Z,0-9', len: 32 }),
      instanceName: existing?.instanceName ?? 'Serper',
      logLevel: existing?.logLevel ?? 'info',
      defaultResults: existing?.defaultResults ?? 10,
      promptInjectionDefense: existing?.promptInjectionDefense ?? {
        sanitizeResults: true,
        wrapMarkers: false,
        includeMeta: true,
        rateLimit: 60,
        maxQueryLength: 2000,
        mlScanEnabled: true,
        mlScanThreshold: '0.5',
        mlRedactMode: 'redact',
      },
    })
  }
})
