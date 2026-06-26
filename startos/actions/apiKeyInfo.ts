import { T } from '@start9labs/start-sdk'
import { configJson } from '../fileModels/config.json'
import { sdk } from '../sdk'

// Surfaces the current API key so the user can copy it. Replaces the 0.3.x
// "Properties" page.
export const apiKeyInfo = sdk.Action.withoutInput(
  'api-key-info',

  async ({ effects }) => ({
    name: 'Show API Key',
    description: 'Display the API key for the Serper Clone API',
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),

  async ({ effects }): Promise<T.ActionResult & { version: '1' }> => {
    const config = await configJson.read().once()
    return {
      version: '1' as const,
      title: 'Serper API Key',
      message:
        'Use this key in the X-API-KEY header (or SERPER_API_KEY environment variable) when calling the Serper Clone API.',
      result: {
        type: 'single' as const,
        value: config?.apiKey ?? '',
        copyable: true,
        qr: false,
        masked: true,
      },
    }
  },
)
