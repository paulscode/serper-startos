#!/bin/sh
# Serper (Self-Hosted) - shared, env-driven supervisor.
#
# Used directly on StartOS 0.4.x (the daemon runs this with the environment
# already set by startos/main.ts) and by plain `docker run`. The 0.3.5.x package
# execs this from docker_entrypoint.sh after mapping config.yaml -> env.
#
# It manages Valkey, SearXNG, and the Serper bridge. All inputs are environment
# variables with sensible defaults, so it works even with nothing set.

set -ea

# ============================================================================
# Defaults (only applied when not already provided by the caller)
# ============================================================================
export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-3000}"
export SEARXNG_BASE_URL="${SEARXNG_BASE_URL:-http://127.0.0.1:8080}"
export REQUEST_TIMEOUT="${REQUEST_TIMEOUT:-30000}"
export VERIFY_SSL="${VERIFY_SSL:-false}"
export DEFAULT_COUNTRY="${DEFAULT_COUNTRY:-us}"
export DEFAULT_LANGUAGE="${DEFAULT_LANGUAGE:-en}"

export INSTANCE_NAME="${INSTANCE_NAME:-Serper Clone}"
export LOG_LEVEL="${LOG_LEVEL:-info}"
export DEFAULT_NUM_RESULTS="${DEFAULT_NUM_RESULTS:-10}"
export SANITIZE_RESULTS="${SANITIZE_RESULTS:-true}"
export SANITIZE_WRAP_MARKERS="${SANITIZE_WRAP_MARKERS:-false}"
export INCLUDE_RESPONSE_META="${INCLUDE_RESPONSE_META:-true}"
export RATE_LIMIT_PER_MINUTE="${RATE_LIMIT_PER_MINUTE:-60}"
export MAX_QUERY_LENGTH="${MAX_QUERY_LENGTH:-2000}"
export ML_SCAN_ENABLED="${ML_SCAN_ENABLED:-true}"
export ML_SCAN_THRESHOLD="${ML_SCAN_THRESHOLD:-0.5}"
export ML_REDACT_MODE="${ML_REDACT_MODE:-redact}"
export ML_MODEL_CACHE_DIR="${ML_MODEL_CACHE_DIR:-/app/models}"

export API_KEY="${API_KEY:-}"
export BRIDGE_API_KEY="${BRIDGE_API_KEY:-$API_KEY}"

# ============================================================================
# Signal Handling
# ============================================================================
_term() {
  echo "[supervisor] Caught TERM signal, shutting down..."
  kill -TERM "$bridge_process" 2>/dev/null
  kill -TERM "$searxng_process" 2>/dev/null
  kill -TERM "$valkey_process" 2>/dev/null
}

trap _term TERM INT

# Generate random secret key for SearXNG
export ULTRA_SECRET_KEY=$(head -c 24 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9')

# ============================================================================
# Configure SearXNG
# ============================================================================
echo "[init] Configuring SearXNG..."
sed -i "s|ultrasecretkey|$ULTRA_SECRET_KEY|g" /etc/searxng/settings.yml
sed -i "s|instance_name: .*|instance_name: \"$INSTANCE_NAME\"|g" /etc/searxng/settings.yml

# Ensure required files exist
touch /etc/searxng/limiter.toml

echo "[init] Environment configured:"
echo "       API Key: ${BRIDGE_API_KEY:0:8}..."
echo "       Instance: $INSTANCE_NAME"
echo "       Log Level: $LOG_LEVEL"
echo "       Default Results: $DEFAULT_NUM_RESULTS"
echo "       Sanitize Results: $SANITIZE_RESULTS"
echo "       Wrap Markers: $SANITIZE_WRAP_MARKERS"
echo "       Include Meta: $INCLUDE_RESPONSE_META"
echo "       Rate Limit: $RATE_LIMIT_PER_MINUTE req/min"
echo "       Max Query Length: $MAX_QUERY_LENGTH"
echo "       ML Scanner: $ML_SCAN_ENABLED"
echo "       ML Threshold: $ML_SCAN_THRESHOLD"
echo "       ML Redact Mode: $ML_REDACT_MODE"

# ============================================================================
# Start Services
# ============================================================================

# Start Valkey (cache)
echo "[supervisor] Starting Valkey..."
valkey-server --save "" --appendonly "no" --unixsocket "/var/run/valkey.sock" &
valkey_process=$!
sleep 1

# Wait for Valkey socket
for i in $(seq 1 30); do
  if [ -S /var/run/valkey.sock ]; then
    echo "[supervisor] Valkey is ready"
    break
  fi
  sleep 0.5
done

# Start SearXNG
echo "[supervisor] Starting SearXNG..."
/usr/local/searxng/entrypoint.sh &
searxng_process=$!

# Wait for SearXNG to be ready
echo "[supervisor] Waiting for SearXNG..."
for i in $(seq 1 60); do
  if wget -q -O /dev/null http://127.0.0.1:8080/healthz 2>/dev/null; then
    echo "[supervisor] SearXNG is ready"
    break
  fi
  sleep 1
done

# Start Bridge
echo "[supervisor] Starting Serper Bridge..."
cd /app/bridge
node dist/index.js &
bridge_process=$!

echo "[supervisor] All services started"
echo "             Valkey PID: $valkey_process"
echo "             SearXNG PID: $searxng_process"
echo "             Bridge PID: $bridge_process"

# Wait for all processes
wait $valkey_process $searxng_process $bridge_process
