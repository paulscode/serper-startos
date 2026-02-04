# Serper Clone Instructions

Welcome to **Serper Clone** - a self-sovereign, privacy-respecting search API that's fully compatible with the Serper.dev API format!

## Why Serper Clone?

Instead of relying on a third-party service that requires subscriptions and sends your AI's queries to external servers, Serper Clone lets you **own your search infrastructure**. Your queries stay on your server, you're not dependent on external API keys or service availability, and you maintain full control over your data.

## Overview

This package provides a drop-in replacement for [Serper.dev](https://serper.dev) powered by [SearXNG](https://docs.searxng.org), a metasearch engine that aggregates results from multiple search engines without tracking you.

**Key Features:**
- 🏠 **Self-sovereign**: Run your own search API - no subscriptions or external dependencies
- 🔒 **Privacy-first**: Your queries never leave your server
- 🔄 **Serper-compatible**: Works with LangChain, AutoGPT, and other AI tools
- 🌐 **Multiple sources**: Aggregates Google, Bing, DuckDuckGo, Brave, and more
- 🔑 **Secure**: Built-in API key authentication

## Quick Start

### 1. Get Your API Key

Go to **Properties** in the Start9 UI to find your auto-generated API key.

### 2. Test the API

```bash
curl -X POST "https://YOUR_LAN_ADDRESS/search" \
  -H "X-API-KEY: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"q": "hello world"}'
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/search` | POST | Web search (Serper-compatible) |
| `/news` | POST | News search |
| `/images` | POST | Image search |
| `/shopping` | POST | Product search with price extraction |
| `/scholar` | POST | Academic papers (arXiv, PubMed, Semantic Scholar) |
| `/places` | POST | Places search (limited - see note below) |
| `/health` | GET | Health check (no auth required) |

> **Note on Places Search**: The `/places` endpoint provides basic location results, but has limited functionality compared to Google Maps-based services. Results depend on SearXNG's map engines (Photon, Nominatim) and may not include rich business data like ratings, hours, or phone numbers.

> **Shopping Search**: The `/shopping` endpoint automatically falls back to general search results when shopping engines return no results (due to eBay anti-scraping). Prices are extracted from snippets when present (e.g., $45.84, €299.00). Returns results from Amazon, Best Buy, Apple, and other retailers.

## Request Format

All search endpoints accept JSON with these parameters:

```json
{
  "q": "your search query",
  "num": 10,
  "gl": "us",
  "hl": "en"
}
```

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `q` | string | Search query (required) | - |
| `num` | number | Number of results | 10 |
| `gl` | string | Country code | us |
| `hl` | string | Language code | en |

## Using with LangChain

Since Serper Clone is self-hosted, you'll need to point LangChain to your instance:

```python
import os
import requests

# Set your API key
os.environ["SERPER_API_KEY"] = "YOUR_API_KEY"

# Direct API usage
response = requests.post(
    "https://YOUR_LAN_ADDRESS/search",
    headers={
        "X-API-KEY": os.environ["SERPER_API_KEY"],
        "Content-Type": "application/json"
    },
    json={"q": "your query", "num": 10},
    verify=False  # For self-signed certs
)
results = response.json()
```

### Custom LangChain Wrapper

For seamless LangChain integration, create a wrapper:

```python
from langchain_community.utilities import GoogleSerperAPIWrapper
from typing import Optional

class SelfHostedSerperAPIWrapper(GoogleSerperAPIWrapper):
    serper_api_url: str = "https://YOUR_LAN_ADDRESS"
    
    def _google_serper_api_results(
        self, search_term: str, search_type: str = "search", **kwargs
    ):
        import requests
        
        endpoint = f"{self.serper_api_url}/{search_type}"
        response = requests.post(
            endpoint,
            headers={
                "X-API-KEY": self.serper_api_key,
                "Content-Type": "application/json"
            },
            json={"q": search_term, **kwargs},
            verify=False
        )
        return response.json()

# Usage
serper = SelfHostedSerperAPIWrapper(
    serper_api_key="YOUR_API_KEY",
    serper_api_url="https://YOUR_LAN_ADDRESS"
)
results = serper.run("your query")
```

## Response Format

Responses match the Serper.dev format:

```json
{
  "searchParameters": {
    "q": "your query",
    "gl": "us",
    "hl": "en",
    "num": 10,
    "type": "search"
  },
  "organic": [
    {
      "title": "Result Title",
      "link": "https://example.com",
      "snippet": "Description of the result...",
      "position": 1
    }
  ],
  "searchInformation": {
    "totalResults": 1000000,
    "timeTaken": 0.5
  }
}
```

## Troubleshooting

### SSL Certificate Errors

When accessing via LAN, you may see SSL certificate warnings. Either:
- Use `verify=False` in Python requests
- Use `-k` flag with curl
- Access via Tor address (no SSL issues)

### No Results Returned

If you're getting empty results:
1. Check that SearXNG engines are working (some may be temporarily blocked)
2. Try a different query
3. Check the logs: `journalctl -u serper -f`

### API Key Rejected

Ensure you're using the correct header:
- Header name: `X-API-KEY` (not `Authorization`)
- The key is case-sensitive

## Support

- **Serper Clone**: https://paulscode.com
