import { sdk } from './sdk'
import { port } from './utils'

export const setInterfaces = sdk.setupInterfaces(async ({ effects }) => {
  const multihost = sdk.MultiHost.of(effects, 'api')
  // Bind the container's API port. StartOS automatically fronts it with TLS on
  // the LAN and exposes a .onion over Tor.
  const apiMultiOrigin = await multihost.bindPort(port, {
    protocol: 'http',
  })
  const main = sdk.createInterface(effects, {
    name: 'Serper Clone API',
    id: 'main',
    description:
      'Self-sovereign Serper-compatible search API endpoint. Authenticate with the X-API-KEY header.',
    type: 'api',
    masked: false,
    schemeOverride: null,
    username: null,
    path: '',
    query: {},
  })

  const mainReceipt = await apiMultiOrigin.export([main])

  return [mainReceipt]
})
