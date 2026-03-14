#!/bin/sh
# Generate runtime config from environment variables.
# This lets the same built image work against any WIP instance.
cat > /srv/config.json <<EOF
{"wipApiUrl":"${WIP_API_URL}","wipApiKey":"${WIP_API_KEY}","basePath":"${APP_BASE_PATH:-/}"}
EOF

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
