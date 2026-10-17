import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes =
  'Rebuilt on version 3 of the StartOS packaging SDK, which needs StartOS ' +
  '0.4.0.2. Nothing you have set changes. ' +
  'Uses version 3.0.6 of the packaging SDK, which stops a restart during ' +
  'startup from leaving the previous run still going.'

export const current = VersionInfo.of({
  version: '1.0.1:2',
  releaseNotes: {
    en_US: notes,
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
