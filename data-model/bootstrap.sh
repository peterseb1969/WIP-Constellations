#!/bin/bash
# Bootstrap a WIP instance with the constellation's data model.
# Usage: ./bootstrap.sh [WIP_URL] [API_KEY]
#
# Defaults to https://localhost:8443 with dev_master_key_for_testing.
# Use -k for self-signed certs (default on). Set CURL_OPTS to override.

set -euo pipefail

WIP="${1:-https://localhost:8443}"
KEY="${2:-dev_master_key_for_testing}"
CURL_OPTS="${CURL_OPTS:--sk}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

ok=0
fail=0

echo "Bootstrapping WIP at $WIP"
echo ""

# --- Terminologies (import endpoint accepts export format: {terminology: {...}, terms: [...]}) ---
echo "=== Terminologies ==="
for f in "$SCRIPT_DIR"/terminologies/*.json; do
  name=$(basename "$f" .json)
  response=$(curl $CURL_OPTS -w "\n%{http_code}" -X POST \
    "$WIP/api/def-store/import-export/import?format=json&skip_duplicates=true" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $KEY" \
    -d @"$f" 2>/dev/null)
  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')
  if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    echo "  OK  $name"
    ok=$((ok + 1))
  else
    echo "  FAIL $name (HTTP $http_code): $body"
    fail=$((fail + 1))
  fi
done

echo ""

# --- Templates (bulk create endpoint, one at a time wrapped in array) ---
echo "=== Templates ==="
for f in "$SCRIPT_DIR"/templates/*.json; do
  name=$(basename "$f" .json)
  response=$(curl $CURL_OPTS -w "\n%{http_code}" -X POST \
    "$WIP/api/template-store/templates" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $KEY" \
    -d "[$(<"$f")]" 2>/dev/null)
  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')
  if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    echo "  OK  $name"
    ok=$((ok + 1))
  else
    echo "  FAIL $name (HTTP $http_code): $body"
    fail=$((fail + 1))
  fi
done

echo ""
echo "Done: $ok succeeded, $fail failed"
