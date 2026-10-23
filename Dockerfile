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
FROM node:24-alpine AS bridge-builder

WORKDIR /app

# Copy bridge source code
COPY bridge/package*.json ./
RUN npm ci

COPY bridge/tsconfig.json ./
COPY bridge/src/ ./src/

# Build TypeScript
RUN npm run build

# Also prepare production node_modules
RUN rm -rf node_modules && npm ci --only=production && \
    rm -rf node_modules/onnxruntime-node && \
    mkdir -p node_modules/onnxruntime-node && \
    echo '{"name":"onnxruntime-node","main":"index.js"}' > node_modules/onnxruntime-node/package.json && \
    echo 'module.exports = require("onnxruntime-web");' > node_modules/onnxruntime-node/index.js

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
# Copy Node.js runtime from node:24-alpine
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
# Add custom engines for shopping support
# ============================================================================
COPY engines/openfoodfacts.py /usr/local/searxng/searx/engines/openfoodfacts.py

# ============================================================================
# Engine resilience: one sick engine must not take down every search
# ============================================================================
# On 2026-08-17 wikidata's init() could not reach query.wikidata.org, so it was
# never registered, and because SearXNG looks every enabled engine up without a
# guard, every search on this instance returned 500 for two days. This patch
# makes a missing engine skip instead of raise, and retries failed engines on a
# timer so they rejoin by themselves when the cause clears.
#
# Loaded by a .pth rather than by editing SearXNG, so an upstream upgrade cannot
# quietly drop it, and the module refuses to install itself if the internals it
# relies on have moved.
COPY searxng-patches/engine_resilience.py /tmp/engine_resilience.py
# The module and its .pth go in SearXNG's own virtualenv, which is the
# interpreter that runs it; the image's system python3 never reads a .pth of
# its own. It is a top-level module rather than searx.engine_resilience because
# a .pth runs before searx is on sys.path; start() then waits off-thread for
# searx to load. The import check fails the build if the hook would not load.
RUN SITE="$(/usr/local/searxng/.venv/bin/python3 -c 'import site; print(site.getsitepackages()[0])')" \
 && mv /tmp/engine_resilience.py "$SITE/serper_engine_resilience.py" \
 && printf 'import serper_engine_resilience as _er; _er.start()\n' > "$SITE/zz_engine_resilience.pth" \
 && echo "engine resilience installed in $SITE" \
 && /usr/local/searxng/.venv/bin/python3 -c 'import serper_engine_resilience'

# ============================================================================
# Bake ML prompt injection model into image
# ============================================================================
COPY models/ /app/models/

# ============================================================================
# Setup entrypoints
# ============================================================================
# Shared env-driven supervisor (used directly on StartOS 0.4.x and for plain
# `docker run`), plus the 0.3.5.x config.yaml-driven shim that execs it.
COPY --chmod=755 docker_entrypoint_040.sh /usr/local/bin/docker_entrypoint_040.sh
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

# Default for plain `docker run` and StartOS 0.4.x: the env-driven supervisor.
# The 0.3.5.x package overrides this with docker_entrypoint.sh via manifest.yaml.
ENTRYPOINT ["/usr/local/bin/docker_entrypoint_040.sh"]
