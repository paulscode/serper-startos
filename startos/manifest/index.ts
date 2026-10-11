import { setupManifest } from '@start9labs/start-sdk'

const short =
  'Self-sovereign Serper-compatible search API - own your AI\'s search capability.'

const long =
  'Serper Clone is a self-sovereign, privacy-respecting search API that provides full ' +
  'compatibility with the Serper.dev API format. Take back control of your AI workflows ' +
  'by hosting your own search infrastructure - no subscriptions, no external API keys, ' +
  'no data harvesting. Powered by SearXNG, aggregating results from multiple search ' +
  'engines without tracking you. Works with LangChain, AutoGPT, and other AI tools that ' +
  'expect a Serper-compatible API, with built-in API key authentication and ML-powered ' +
  'prompt injection defenses.'

export const manifest = setupManifest({
  id: 'serper',
  title: 'Serper Clone',
  license: 'MIT',
  packageRepo: 'https://github.com/paulscode/serper-startos',
  upstreamRepo: 'https://github.com/paulscode/searxng-serper-bridge',
  marketingUrl: 'https://paulscode.com',
  donationUrl: null,
  description: { short, long },
  // StartOS 0.4.0.2, not the SDK's default, so the registry hides releases from
  // older servers. Every release from 2026-10-11 on targets 0.4.0.2.
  osVersion: '0.4.0.2',
  volumes: ['main'],
  images: {
    main: {
      source: {
        dockerBuild: {
          dockerfile: 'Dockerfile',
          workdir: '.',
        },
      },
      arch: ['x86_64', 'aarch64'],
    },
  },
})
