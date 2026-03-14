#!/bin/sh
# Generate runtime config from environment variables.
# wipApiUrl is empty by default — the container's Caddy proxies /api/* to WIP services.
# Set WIP_API_URL only if the browser should call a different origin directly.
cat > /srv/config.json <<EOF
{"wipApiUrl":"${WIP_API_URL:-}","wipApiKey":"${WIP_API_KEY:-}","basePath":"${APP_BASE_PATH:-/}"}
EOF

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
