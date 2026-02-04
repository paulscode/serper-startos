#!/bin/sh
# Serper (Self-Hosted) - Start9 Entrypoint
# Manages Valkey, SearXNG, and Bridge services

set -ea

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

# ============================================================================
# Configuration from Start9
# ============================================================================
echo "[init] Reading Start9 configuration..."

# Read config with defaults
if [ -f /root/start9/config.yaml ]; then
  export API_KEY=$(yq e '.api-key // ""' /root/start9/config.yaml)
  export INSTANCE_NAME=$(yq e '.instance-name // "Serper Clone"' /root/start9/config.yaml)
  export LOG_LEVEL=$(yq e '.log-level // "info"' /root/start9/config.yaml)
  export DEFAULT_NUM_RESULTS=$(yq e '.default-results // 10' /root/start9/config.yaml)
else
  echo "[init] No Start9 config found, using defaults"
  export API_KEY=""
  export INSTANCE_NAME="Serper Clone"
  export LOG_LEVEL="info"
  export DEFAULT_NUM_RESULTS="10"
fi

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

# ============================================================================
# Create Start9 stats file with properties
# ============================================================================
mkdir -p /root/start9

# Read addresses from config if available
LAN_ADDRESS=""
TOR_ADDRESS=""
if [ -f /root/start9/config.yaml ]; then
  LAN_ADDRESS=$(yq e '.lan-address // ""' /root/start9/config.yaml)
  TOR_ADDRESS=$(yq e '.tor-address // ""' /root/start9/config.yaml)
fi

cat > /root/start9/stats.yaml << EOF
type: object
value:
  LAN URL:
    type: string
    value: "https://${LAN_ADDRESS:-not-configured}"
    description: Serper Clone API endpoint (LAN)
    copyable: true
    qr: true
    masked: false
  Tor URL:
    type: string
    value: "http://${TOR_ADDRESS:-not-configured}"
    description: Serper Clone API endpoint (Tor)
    copyable: true
    qr: true
    masked: false
  API Key:
    type: string
    value: "${API_KEY:-not-configured}"
    description: Use in X-API-KEY header
    copyable: true
    qr: false
    masked: true
EOF

# ============================================================================
# Export environment for Bridge
# ============================================================================
export NODE_ENV=production
export PORT=3000
export SEARXNG_BASE_URL=http://127.0.0.1:8080
export REQUEST_TIMEOUT=30000
export VERIFY_SSL=false
export DEFAULT_COUNTRY=us
export DEFAULT_LANGUAGE=en
export BRIDGE_API_KEY="$API_KEY"

echo "[init] Environment configured:"
echo "       API Key: ${BRIDGE_API_KEY:0:8}..."
echo "       Instance: $INSTANCE_NAME"
echo "       Log Level: $LOG_LEVEL"
echo "       Default Results: $DEFAULT_NUM_RESULTS"

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
