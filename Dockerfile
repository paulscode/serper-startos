# Serper (Self-Hosted) - Dockerfile
# A unified container running SearXNG + Serper-compatible API bridge
#
# Architecture:
#   - SearXNG runs internally on port 8080
#   - Serper Bridge runs on port 3000 (exposed)
#   - Valkey provides caching for SearXNG
#   - All managed by shell-based supervisor

# ============================================================================
# Stage 1: Build tools from Alpine (yq, valkey)
# ============================================================================
FROM valkey/valkey:alpine AS tools

RUN apk add --no-cache yq && \
    mv /usr/bin/yq /usr/local/bin/ && \
    rm -f /var/cache/apk/*

# ============================================================================
# Stage 2: Build the Node.js bridge
# ============================================================================
FROM node:20-alpine AS bridge-builder

WORKDIR /app

# Copy bridge source code
COPY bridge/package*.json ./
RUN npm ci

COPY bridge/tsconfig.json ./
COPY bridge/src/ ./src/

# Build TypeScript
RUN npm run build

# Also prepare production node_modules
RUN rm -rf node_modules && npm ci --only=production

# ============================================================================
# Stage 3: Final unified image
# ============================================================================
FROM searxng/searxng:2025.10.15-576d30ffc

USER root

# Copy yq and valkey from tools stage
COPY --from=tools /usr/local/bin/yq /usr/local/bin/
COPY --from=tools /usr/local/bin/valkey-* /usr/local/bin/
RUN ln -sf /usr/local/bin/valkey-cli /usr/local/bin/redis-cli && \
    ln -sf /usr/local/bin/valkey-server /usr/local/bin/redis-server

# ============================================================================
# Setup Bridge Application (copy Node.js from Alpine)
# ============================================================================
# Copy Node.js runtime from node:20-alpine
COPY --from=bridge-builder /usr/local/bin/node /usr/local/bin/
COPY --from=bridge-builder /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -sf /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm

WORKDIR /app/bridge

# Copy bridge production dependencies and built code
COPY --from=bridge-builder /app/node_modules ./node_modules
COPY --from=bridge-builder /app/dist ./dist
COPY bridge/package.json ./

# ============================================================================
# Setup SearXNG Configuration
# ============================================================================
COPY settings.yml /etc/searxng/settings.yml

# ============================================================================
# Setup entrypoint
# ============================================================================
COPY --chmod=755 docker_entrypoint.sh /usr/local/bin/docker_entrypoint.sh

# ============================================================================
# Environment defaults
# ============================================================================
ENV NODE_ENV=production \
    PORT=3000 \
    SEARXNG_BASE_URL=http://127.0.0.1:8080 \
    DEFAULT_NUM_RESULTS=10 \
    DEFAULT_COUNTRY=us \
    DEFAULT_LANGUAGE=en \
    REQUEST_TIMEOUT=30000 \
    LOG_LEVEL=info \
    VERIFY_SSL=false

# Expose the Serper API port
EXPOSE 3000

WORKDIR /usr/local/searxng

ENTRYPOINT ["/usr/local/bin/docker_entrypoint.sh"]
