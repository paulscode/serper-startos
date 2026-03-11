# Serper Clone (Self-Hosted) - Start9 Package

A self-hosted, privacy-focused search API that provides Serper-compatible endpoints for AI applications.

## Overview

This package provides a drop-in replacement for [Serper.dev](https://serper.dev) powered by [SearXNG](https://docs.searxng.org). It's perfect for:

- **LangChain applications** using `GoogleSerperAPIWrapper`
- **AutoGPT** and other AI agents needing web search
- **Custom AI tools** requiring web search capabilities
- **Privacy-conscious users** who want to avoid third-party API tracking

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Serper Package                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│    ┌─────────────────┐         ┌─────────────────┐          │
│    │  Serper Bridge  │────────▶│    SearXNG      │          │
│    │    (Node.js)    │  JSON   │   (Internal)    │          │
│    │   Port 3000     │         │   Port 8080     │          │
│    └─────────────────┘         └─────────────────┘          │
│           │                            │                    │
│           │                     ┌──────┴──────┐             │
│           │                     │   Valkey    │             │
│           │                     │   (Cache)   │             │
│           │                     └─────────────┘             │
│           │                                                 │
│    ┌──────▼──────────────────────────────────────────┐      │
│    │              External API Access                │      │
│    │  /search, /news, /images (Serper-compatible)    │      │
│    └─────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## API Compatibility (Verified 2026-02-04)

| Serper.dev Endpoint | Supported | Notes |
|---------------------|-----------|-------|
| `/search` (POST) | ✅ | Web search with knowledgeGraph, relatedSearches |
| `/news` (POST) | ✅ | News with dates and sources |
| `/images` (POST) | ✅ | Images with URLs and thumbnails |
| `/places` (POST) | ⚠️ | Limited - uses OpenStreetMap data, not Google Maps |
| `/scholar` (POST) | ✅ | Academic papers via arXiv, PubMed, Semantic Scholar |
| `/shopping` (POST) | ✅ | Product search with automatic fallback & price extraction |

## Building

### Prerequisites

- [start-sdk](https://github.com/Start9Labs/start-os) >= 0.3.5.1
- [deno](https://deno.land) >= 2.5.6
- Docker with buildx support
- yq

### ML Model Setup

The package includes an ML-based prompt injection scanner powered by a quantized DeBERTa model. The ONNX model binary (~233MB) is **not** stored in Git — you must fetch it before building:

```bash
# Install Python dependencies (one-time)
pip install onnx onnxruntime

# Download and quantize the model
./scripts/fetch-model.sh
```

This downloads the fp32 model from HuggingFace, quantizes it to uint8, and places the files in `models/`. The build will fail if the model hasn't been fetched.

To re-download (e.g., after a model update):

```bash
make clean-model
./scripts/fetch-model.sh
```

### Build Commands

```bash
# Build for all architectures (auto-fetches model if needed)
make

# Build for x86_64 only
make x86

# Build for ARM64 only
make arm

# Install to your Start9 server
make install

# Clean build artifacts
make clean

# Remove quantized model (to re-download)
make clean-model
```

## Configuration

After installation, configure via the Start9 UI:

| Setting | Description | Default |
|---------|-------------|---------|
| API Key | Authentication key for API requests | Auto-generated |
| Instance Name | Display name | "Serper" |
| Log Level | Logging verbosity | info |
| Default Results | Results per query | 10 |

## Usage

- See the **Interfaces** page for your API endpoint URLs (LAN and Tor)
- See the **Config** page for your API key
- See the **Instructions** page for example code snippets

### Quick Test

```bash
curl -X POST "https://YOUR_LAN_ADDRESS/search" \
  -H "X-API-KEY: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"q": "hello world"}'
```

## Project Structure

```
serper-startos/
├── bridge/              # Node.js Serper bridge
│   ├── src/             # TypeScript source
│   ├── package.json
│   └── tsconfig.json
├── engines/             # Custom SearXNG engines
│   └── openfoodfacts.py # Open Food Facts product search
├── models/              # ML model files (fetched by scripts/fetch-model.sh)
│   └── ProtectAI/       # Quantized DeBERTa prompt injection model
├── scripts/             # Start9 integration & build tools
│   ├── embassy.ts       # Main exports
│   ├── bundle.ts        # Build script
│   ├── fetch-model.sh   # Download & quantize ML model
│   ├── deps.ts          # Dependencies
│   └── services/        # Service implementations
├── Dockerfile           # Multi-stage build
├── docker_entrypoint.sh # Process supervisor
├── manifest.yaml        # Start9 package manifest
├── settings.yml         # SearXNG configuration
├── instructions.md      # User-facing docs
└── Makefile             # Build automation
```

## License

MIT License - See [LICENSE](LICENSE)

## Related Projects

- [SearXNG Serper Bridge](https://github.com/paulscode/searxng-serper-bridge) - Serper-compatible interface on top of SearXNG
- [SearXNG](https://github.com/searxng/searxng) - The metasearch engine powering this package
- [Serper.dev](https://serper.dev) - The API this project is compatible with
- [LangChain](https://github.com/langchain-ai/langchain) - AI framework with Serper integration
