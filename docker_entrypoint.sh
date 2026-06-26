#!/bin/sh
# Serper (Self-Hosted) - StartOS 0.3.5.x entrypoint.
#
# Reads the rendered config from the main volume, maps it to the environment the
# shared supervisor expects, writes the Properties page data, then hands off to
# docker_entrypoint_040.sh. (StartOS 0.4.x sets that environment directly via
# startos/main.ts and runs docker_entrypoint_040.sh itself.)

set -ea

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
  # Prompt injection defense settings
  SANITIZE_RESULTS_RAW=$(yq e '.prompt-injection-defense.sanitize-results // true' /root/start9/config.yaml)
  WRAP_MARKERS_RAW=$(yq e '.prompt-injection-defense.wrap-markers // false' /root/start9/config.yaml)
  INCLUDE_META_RAW=$(yq e '.prompt-injection-defense.include-meta // false' /root/start9/config.yaml)
  export RATE_LIMIT_PER_MINUTE=$(yq e '.prompt-injection-defense.rate-limit // 30' /root/start9/config.yaml)
  export MAX_QUERY_LENGTH=$(yq e '.prompt-injection-defense.max-query-length // 2000' /root/start9/config.yaml)
  ML_SCAN_ENABLED_RAW=$(yq e '.prompt-injection-defense.ml-scan-enabled // false' /root/start9/config.yaml)
  ML_SCAN_THRESHOLD_RAW=$(yq e '.prompt-injection-defense.ml-scan-threshold // "0.5"' /root/start9/config.yaml)
  export ML_REDACT_MODE=$(yq e '.prompt-injection-defense.ml-redact-mode // "redact"' /root/start9/config.yaml)
else
  echo "[init] No Start9 config found, using defaults"
  export API_KEY=""
  export INSTANCE_NAME="Serper Clone"
  export LOG_LEVEL="info"
  export DEFAULT_NUM_RESULTS="10"
  SANITIZE_RESULTS_RAW="true"
  WRAP_MARKERS_RAW="false"
  INCLUDE_META_RAW="true"
  export RATE_LIMIT_PER_MINUTE="60"
  export MAX_QUERY_LENGTH="2000"
  ML_SCAN_ENABLED_RAW="true"
  ML_SCAN_THRESHOLD_RAW="0.5"
  export ML_REDACT_MODE="redact"
fi

# Convert boolean values to the format the bridge expects
if [ "$SANITIZE_RESULTS_RAW" = "false" ]; then
  export SANITIZE_RESULTS="false"
else
  export SANITIZE_RESULTS="true"
fi

if [ "$WRAP_MARKERS_RAW" = "true" ]; then
  export SANITIZE_WRAP_MARKERS="true"
else
  export SANITIZE_WRAP_MARKERS="false"
fi

if [ "$INCLUDE_META_RAW" = "true" ]; then
  export INCLUDE_RESPONSE_META="true"
else
  export INCLUDE_RESPONSE_META="false"
fi

if [ "$ML_SCAN_ENABLED_RAW" = "true" ]; then
  export ML_SCAN_ENABLED="true"
else
  export ML_SCAN_ENABLED="false"
fi

export ML_SCAN_THRESHOLD="$ML_SCAN_THRESHOLD_RAW"
export BRIDGE_API_KEY="$API_KEY"

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
# Hand off to the shared supervisor (configures SearXNG, starts all services)
# ============================================================================
exec /usr/local/bin/docker_entrypoint_040.sh
