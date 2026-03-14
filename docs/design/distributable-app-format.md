# Design: Distributable App Format

**Status:** Specification (not yet implemented)

## Motivation

WIP constellation apps are currently developed and deployed by the same person on the same machine. For community uptake, apps need a standard packaging format that lets someone:

1. Pull a container image
2. Point it at their WIP instance
3. Have the app's data model bootstrapped automatically
4. Access it via the gateway or standalone

Without this, every app is a bespoke deployment — undocumented, fragile, and non-portable. This spec defines what a distributable app must contain, how it declares its WIP dependencies, how it integrates with the gateway, and how it runs standalone.

## Goals

1. A single container image is the distribution unit — no separate scripts or manual steps
2. The container self-bootstraps its WIP data model on first start
3. The same image works behind the WIP gateway or standalone on a different host
4. Compatibility is declared explicitly — no silent breakage on version mismatch
5. No runtime dependency on source code, npm registries, or build tools

## Non-Goals

- Multi-container apps (database-backed apps that need their own PostgreSQL). These exist but are outside the scope of this v1 spec.
- Hot-reload or development mode. This spec covers the built, distributable artifact.
- OIDC provider bundling. Authentication is provided by the WIP deployment, not the app.

---

## 1. Container Image Contract

### Base Image

Apps follow a two-stage build pattern. The production image serves static assets via a lightweight HTTP server:

| Stage | Image | Purpose |
|-------|-------|---------|
| Build | `node:20-alpine` | Install deps, compile TypeScript, bundle with Vite |
| Serve | `caddy:2-alpine` | Serve static files, provide health endpoint, handle SPA routing |

Caddy is preferred over nginx for the serve stage because it provides automatic health responses and simpler configuration. Apps with a backend component (Python, Node server) use their runtime image directly.

### Required Exposed Port

Every app exposes exactly **one port**, declared in `app-manifest.json` as `internal_port`. This port is never bound to the host — only the WIP gateway or the user's own reverse proxy connects to it.

Convention: constellation apps use ports 3001-3099. The port is internal to the container network and has no significance outside it.

### Required Health Endpoint

Every app must respond to `GET /health` with HTTP 200 when ready to serve. The response body is informational:

```json
{
  "status": "healthy",
  "app": "statements",
  "version": "0.1.0",
  "wip_connected": true
}
```

For static frontend apps served by Caddy, the Caddyfile includes:

```
handle /health {
    respond "OK" 200
}
```

For apps with a backend, the health endpoint should verify WIP API connectivity.

### Required Environment Variables

Apps accept all configuration via environment variables. No file editing inside the container is required or supported.

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `WIP_API_URL` | Yes | — | Base URL of the WIP API gateway (e.g., `https://wip-pi.local` or `http://wip-registry:8001` on the container network) |
| `WIP_API_KEY` | Yes | — | API key for WIP service authentication |
| `APP_BASE_PATH` | No | `/` | Path prefix when running behind the gateway (e.g., `/apps/statements`). Vite's `base` and the router's `basename` are set from this. |
| `APP_PORT` | No | `3001` | Port the app listens on inside the container |

Apps may define additional environment variables for their own configuration, documented in `.env.example` and the README.

### Build-Time vs Runtime Configuration

Vite bakes `VITE_*` variables into the JavaScript bundle at build time. For distributable images, this creates a problem: the WIP URL and API key can't be changed after the image is built.

**Solution:** Apps use a runtime configuration injection pattern:

1. The Caddyfile (or nginx) serves a `/config.json` that is generated at container startup from environment variables
2. The app fetches `/config.json` before initializing the WIP client
3. An entrypoint script writes the config file from environment variables:

```sh
#!/bin/sh
# /docker-entrypoint.sh
cat > /srv/config.json <<EOF
{
  "wipApiUrl": "${WIP_API_URL}",
  "wipApiKey": "${WIP_API_KEY}",
  "basePath": "${APP_BASE_PATH:-/}"
}
EOF
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
```

This means the same built image can be pointed at any WIP instance by changing environment variables at `docker run` time.

---

## 2. Seed Files and Bootstrap

### Data Model Declaration

Every app declares its WIP data model dependencies in a `data-model/` directory inside the container:

```
/app/data-model/
├── terminologies/          # Terminology definitions + terms
│   ├── STATEMENT_TYPE.json
│   └── ACCOUNT_TYPE.json
├── templates/              # Template definitions
│   ├── BANK_ACCOUNT.json
│   └── BANK_TRANSACTION.json
└── wip-dependencies.json   # Dependency manifest
```

### wip-dependencies.json

The dependency manifest declares what the app needs from WIP:

```json
{
  "app_id": "statements",
  "app_version": "0.1.0",
  "wip_min_version": "0.2.0",
  "required_features": ["files", "reporting"],
  "terminologies": [
    {
      "file": "terminologies/STATEMENT_TYPE.json",
      "value": "STATEMENT_TYPE",
      "action": "create_if_missing"
    },
    {
      "file": "terminologies/ACCOUNT_TYPE.json",
      "value": "ACCOUNT_TYPE",
      "action": "create_if_missing"
    }
  ],
  "templates": [
    {
      "file": "templates/BANK_ACCOUNT.json",
      "value": "BANK_ACCOUNT",
      "action": "create_if_missing",
      "depends_on": ["ACCOUNT_TYPE"]
    },
    {
      "file": "templates/BANK_TRANSACTION.json",
      "value": "BANK_TRANSACTION",
      "action": "create_if_missing",
      "depends_on": ["STATEMENT_TYPE", "BANK_ACCOUNT"]
    }
  ]
}
```

### Seed File Format

Terminology seed files use the same JSON format as WIP's export endpoint:

```json
{
  "value": "STATEMENT_TYPE",
  "label": "Statement Type",
  "description": "Types of financial statements",
  "namespace": "wip",
  "terms": [
    {"value": "BANK", "label": "Bank Statement"},
    {"value": "EMPLOYER", "label": "Employer Pay Slip"},
    {"value": "TAX", "label": "Tax Statement"}
  ]
}
```

Template seed files use the same JSON format as WIP's create template request:

```json
{
  "value": "BANK_TRANSACTION",
  "label": "Bank Transaction",
  "namespace": "wip",
  "identity_fields": ["date", "amount", "description"],
  "fields": [
    {"name": "date", "label": "Date", "type": "date", "mandatory": true},
    {"name": "amount", "label": "Amount", "type": "number", "mandatory": true},
    {"name": "description", "label": "Description", "type": "string", "mandatory": true},
    {"name": "category", "label": "Category", "type": "term", "terminology_ref": "STATEMENT_TYPE"}
  ]
}
```

### Bootstrap Process

The app bootstraps its data model on first start via a bootstrap script that runs before the main process. The script is idempotent — running it multiple times is safe.

**Bootstrap sequence:**

1. **Check connectivity** — Verify WIP API is reachable at `WIP_API_URL`. Retry with backoff (1s, 2s, 4s, max 30s total). Fail with a clear error if WIP is unreachable.

2. **Check compatibility** — Call `GET /health` on Registry to get the WIP version. Compare against `wip_min_version`. Log a warning if the version is lower (do not hard-fail — the app may still work).

3. **Check required features** — For each entry in `required_features`, verify the corresponding service is healthy:
   - `files` → Document Store file storage enabled (check health response)
   - `reporting` → Reporting Sync service reachable
   - Log warnings for missing features (do not hard-fail).

4. **Create terminologies** — For each terminology in `wip-dependencies.json`, ordered by dependency:
   - Call `GET /api/def-store/terminologies/by-value/{value}`
   - If it exists: skip (log "STATEMENT_TYPE already exists, skipping")
   - If 404: create the terminology, then create its terms via bulk endpoint
   - Handle partial failures gracefully (some terms may already exist from a prior partial bootstrap)

5. **Create templates** — For each template, ordered by `depends_on`:
   - Call `GET /api/template-store/templates/by-value/{value}`
   - If it exists: skip
   - If 404: resolve `terminology_ref` values to IDs (by calling by-value lookups), then create the template
   - For templates with circular dependencies: create as `status: "draft"`, then activate after all are created

6. **Log summary** — Print what was created vs skipped. Store bootstrap status in a local marker file so the next restart skips the full check (but still verifies connectivity).

**Implementation:** The bootstrap script is a Python or shell script (`/app/bootstrap.sh`) invoked by the container entrypoint before the main process:

```dockerfile
COPY bootstrap.sh /app/bootstrap.sh
COPY data-model/ /app/data-model/
ENTRYPOINT ["/app/docker-entrypoint.sh"]
```

```sh
#!/bin/sh
# /app/docker-entrypoint.sh

# Generate runtime config
cat > /srv/config.json <<EOF
{"wipApiUrl":"${WIP_API_URL}","wipApiKey":"${WIP_API_KEY}","basePath":"${APP_BASE_PATH:-/}"}
EOF

# Bootstrap WIP data model (idempotent)
if [ -n "$WIP_API_URL" ] && [ -n "$WIP_API_KEY" ]; then
    python3 /app/bootstrap.py || echo "WARNING: Bootstrap failed, app may not work correctly"
fi

# Start the app
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
```

### Handling "Already Exists" Gracefully

The bootstrap MUST NOT fail if entities already exist. WIP's bulk API returns per-item results — a "duplicate" status on an item is not an error. The bootstrap script checks `result.status` for each item and only reports actual errors.

This is critical for two scenarios:
- **Reinstall:** User removes and re-deploys the app container. Data model already exists in WIP.
- **Shared terminologies:** Two apps both declare COUNTRY as a dependency. The second app to start finds it already created.

---

## 3. Gateway Integration

### app-manifest.json

Every distributable app includes an `app-manifest.json` at a well-known path inside the container:

```json
{
  "id": "statements",
  "name": "Statement Manager",
  "description": "Bank and employer statement management",
  "version": "0.1.0",
  "icon": "bank",
  "path": "/apps/statements",
  "internal_port": 3001,
  "health_endpoint": "/health",
  "constellation": "finance",
  "wip_min_version": "0.2.0"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique app identifier (lowercase, alphanumeric + hyphens) |
| `name` | string | Yes | Human-readable app name |
| `description` | string | Yes | One-line description |
| `version` | string | Yes | Semantic version |
| `icon` | string | No | Icon name (from Lucide icon set) |
| `path` | string | Yes | Gateway path prefix (e.g., `/apps/statements`) |
| `internal_port` | int | Yes | Port the app listens on inside the container |
| `health_endpoint` | string | Yes | Path for health checks (relative to app root) |
| `constellation` | string | No | Grouping label for the portal (e.g., `finance`, `energy`, `home`) |
| `wip_min_version` | string | No | Minimum WIP version required |

### Docker Labels for Discovery

The gateway discovers apps via Docker/Podman labels on running containers:

```yaml
services:
  statements:
    image: ghcr.io/user/wip-statements:latest
    labels:
      - "wip.app=true"
      - "wip.manifest=/app/app-manifest.json"
    networks:
      - wip-network
    environment:
      WIP_API_URL: http://wip-registry:8001
      WIP_API_KEY: ${WIP_API_KEY}
```

The `wip.app=true` label marks the container as a WIP constellation app. The `wip.manifest` label tells the gateway where to find the manifest inside the container. The gateway reads the manifest via `docker exec` or the Docker API to extract routing information.

### Caddy Route Generation

The gateway generates Caddy routing blocks from discovered app manifests. For an app at `/apps/statements` with `internal_port: 3001` and container name `wip-statements`:

```
handle /apps/statements/* {
    uri strip_prefix /apps/statements
    reverse_proxy wip-statements:3001
}
```

Note: unlike WIP's own API services (which use `handle` to preserve the full path), constellation apps use `handle` + `uri strip_prefix` because the app's internal routing starts at `/`, not at `/apps/statements/`. The app's `APP_BASE_PATH` environment variable tells its client-side router to generate correct links.

### Coexistence with WIP Services

The gateway's Caddyfile is structured with explicit precedence:

1. `/dex/*` — Dex OIDC (if OIDC module is active)
2. `/api/*` — WIP API services (registry, def-store, template-store, document-store, reporting-sync, ingest-gateway)
3. `/apps/*` — Constellation apps (dynamically generated from manifests)
4. `/*` — WIP Console (catch-all fallback) or Portal (if 2+ apps registered)

App paths MUST start with `/apps/` to avoid conflicts with WIP's own routes.

---

## 4. Standalone Deployment

The same container image runs standalone — without the WIP gateway — by binding its port directly to the host and pointing `WIP_API_URL` at the remote WIP instance:

```bash
docker run -d \
  --name statements \
  -p 3001:3001 \
  -e WIP_API_URL=https://wip-pi.local \
  -e WIP_API_KEY=your_api_key \
  -e APP_BASE_PATH=/ \
  ghcr.io/user/wip-statements:latest
```

In standalone mode:
- The app is accessed directly at `http://localhost:3001`
- `APP_BASE_PATH` is set to `/` (no path prefix stripping needed)
- The app makes API calls to the remote WIP instance via `WIP_API_URL`
- CORS must be configured on the WIP instance to allow the standalone app's origin
- Bootstrap runs against the remote WIP instance (same idempotent process)

### CORS Consideration

When an app runs standalone on a different host, browser requests to WIP's API are cross-origin. WIP services already support configurable CORS via the `CORS_ORIGINS` environment variable. The WIP deployment must include the standalone app's origin:

```bash
CORS_ORIGINS=https://localhost:8443,http://laptop.local:3001
```

For development, `CORS_ORIGINS=*` is acceptable. For production, list specific origins.

---

## 5. Compatibility Declaration

### WIP Version

Apps declare a minimum WIP version in both `app-manifest.json` and `wip-dependencies.json`:

```json
"wip_min_version": "0.2.0"
```

The bootstrap script checks this against the Registry's `/health` endpoint, which includes the WIP version. Version comparison uses semantic versioning (major.minor.patch).

Behaviour on mismatch:
- **Minor version lower:** Log a warning, continue. The app may work.
- **Major version lower:** Log an error, refuse to bootstrap. The API contract may have changed.

### Required Features

Apps declare required WIP features (optional modules) that must be active:

```json
"required_features": ["files", "reporting"]
```

| Feature | Check | Meaning |
|---------|-------|---------|
| `files` | Document Store health → `file_storage: "connected"` | App needs MinIO file storage |
| `reporting` | Reporting Sync health → `status: "healthy"` | App needs PostgreSQL reporting |
| `ingest` | Ingest Gateway health → `status: "healthy"` | App uses async ingestion |

Bootstrap logs warnings for missing features but does not hard-fail — the app may have degraded functionality without them.

### Required Templates and Terminologies

The `wip-dependencies.json` file (Section 2) serves as the detailed dependency declaration. The bootstrap process is the compatibility check — if a required terminology or template can't be created (e.g., due to a missing upstream dependency), the bootstrap logs the error with enough context to diagnose.

---

## 6. @wip/client Bundling

Constellation apps import `@wip/client` and `@wip/react` as npm dependencies during development. Vite bundles all JavaScript into the production build. The resulting container image:

- Contains only static HTML/CSS/JS files in `/srv/`
- Has **no** `node_modules/`, no `package.json`, no npm registry dependency
- The `@wip/client` code is inlined into the JavaScript bundle
- The image can be pulled and run on any machine without npm access

This is guaranteed by the two-stage Dockerfile: the build stage runs `npm ci` and `npm run build`, the serve stage copies only `/app/dist/` (the Vite output). No Node.js runtime exists in the production image.

**Version pinning:** The `@wip/client` version bundled into the image is fixed at build time. If WIP's API changes in a breaking way, the app needs to be rebuilt with a compatible `@wip/client` version. The `wip_min_version` declaration (Section 5) prevents running an app against an incompatible WIP instance.

---

## 7. Documentation Requirements

Every distributable app must include these files in the container image and/or alongside the published image:

### Required Files

| File | Location | Purpose |
|------|----------|---------|
| `README.md` | Repo root + container `/app/README.md` | What the app does, screenshots, deployment instructions |
| `app-manifest.json` | Container `/app/app-manifest.json` | Gateway registration (Section 3) |
| `wip-dependencies.json` | Container `/app/data-model/wip-dependencies.json` | Data model dependencies (Section 2) |
| `.env.example` | Repo root | All environment variables with descriptions and defaults |
| `data-model/` | Container `/app/data-model/` | Seed files for terminologies and templates (Section 2) |

### README Requirements

The README must document:

1. **What the app does** — one paragraph + screenshot
2. **WIP dependencies** — which terminologies and templates it creates/uses
3. **Import formats** — what file formats the app accepts for data import (CSV columns, expected headers)
4. **Environment variables** — table of all variables with descriptions
5. **Deployment** — instructions for both gateway and standalone modes
6. **Version compatibility** — which WIP version range is supported

### IMPORT_FORMATS (Optional)

Apps that support file import should include an `IMPORT_FORMATS.md` or equivalent section in the README documenting:

- Expected file format (CSV, XLSX)
- Column headers and their mapping to template fields
- Sample data
- How to handle common issues (encoding, date formats, missing values)

---

## Distribution Checklist

A distributable app is ready for publication when:

- [ ] Container image builds and runs with only environment variables for configuration
- [ ] `app-manifest.json` is valid and present at `/app/app-manifest.json`
- [ ] `wip-dependencies.json` lists all WIP data model dependencies
- [ ] Bootstrap creates all required terminologies and templates on first start
- [ ] Bootstrap is idempotent — second run skips existing entities
- [ ] Bootstrap handles "already exists" from shared terminologies gracefully
- [ ] Health endpoint returns 200 when the app is ready
- [ ] App works behind the gateway at `APP_BASE_PATH`
- [ ] App works standalone with `APP_BASE_PATH=/`
- [ ] `WIP_API_URL` and `WIP_API_KEY` are the only required environment variables
- [ ] README documents deployment for both modes
- [ ] No runtime dependency on npm, source code, or build tools
- [ ] Image runs on both amd64 and arm64 (for Raspberry Pi deployment)

---

## Alternatives Considered

### Helm charts or Kubernetes manifests

Rejected for v1. WIP's primary target is Raspberry Pi with Podman, not Kubernetes clusters. A Helm chart adds complexity without benefit for the target audience. Container images with environment variables are the simplest universal format.

### Sidecar bootstrap container

Running the bootstrap as a separate init container (Kubernetes pattern) instead of an entrypoint script. Rejected because:
- Adds complexity for Docker/Podman users who don't have native init container support
- The bootstrap is fast (< 5s) and idempotent — running it inline is simpler
- A separate container means two images to distribute and version

### OCI annotations instead of Docker labels

Using OCI image annotations to embed the manifest. Considered for future work — it would allow discovery without running the container. For v1, Docker labels on running containers are simpler and work with the existing `docker inspect` / `podman inspect` APIs.

### Shared terminology registry

A central registry where apps declare "I need COUNTRY" and the gateway ensures it exists before any app starts. Rejected because:
- Adds a central coordination point that doesn't exist today
- Each app's bootstrap is already idempotent and handles shared terminologies
- Simpler to let each app bootstrap independently and handle "already exists"
