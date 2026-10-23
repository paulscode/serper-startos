import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes =
  "Fixes searches failing with an error. One of SearXNG's search engines " +
  '(Wikidata) cannot start at the moment, and that used to make every ' +
  'search fail. A search engine that fails to start is now skipped, and ' +
  'retried in the background until it works again. The health check now ' +
  'reports when search is not working, not only when the service is down. ' +
  'The bridge now runs on Node.js 24. Uses version 3.1.0 of the packaging SDK.'

export const current = VersionInfo.of({
  version: '1.0.1:3',
  releaseNotes: {
    en_US: notes,
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
