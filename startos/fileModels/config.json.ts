import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

// All user-facing settings for the Serper bridge, stored on the main volume as
// config.json. main.ts reads it and maps each field to the environment the
// container entrypoint expects; the Configure action lets the user change it. A
// random api-key is seeded on first install (see init/seedFiles).
export const configJson = FileHelper.json(
  {
    base: sdk.volumes.main,
    subpath: '/config.json',
  },
  z.object({
    apiKey: z.string().catch(''),
    instanceName: z.string().catch('Serper'),
    logLevel: z.enum(['error', 'warn', 'info', 'debug']).catch('info'),
    defaultResults: z.number().int().catch(10),
    promptInjectionDefense: z
      .object({
        sanitizeResults: z.boolean().catch(true),
        wrapMarkers: z.boolean().catch(false),
        includeMeta: z.boolean().catch(true),
        rateLimit: z.number().int().catch(60),
        maxQueryLength: z.number().int().catch(2000),
        mlScanEnabled: z.boolean().catch(true),
        mlScanThreshold: z.string().catch('0.5'),
        mlRedactMode: z.enum(['redact', 'tag', 'drop']).catch('redact'),
      })
      .catch({
        sanitizeResults: true,
        wrapMarkers: false,
        includeMeta: true,
        rateLimit: 60,
        maxQueryLength: 2000,
        mlScanEnabled: true,
        mlScanThreshold: '0.5',
        mlRedactMode: 'redact',
      }),
  }),
)
