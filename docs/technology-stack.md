# Technology Stack

This document details the technology choices for World In a Pie (WIP) and the rationale behind each decision.

---

## Stack Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      TECHNOLOGY STACK                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FRONTEND                                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Vue 3          │  Composition API, reactive UI         │    │
│  │  PrimeVue       │  UI component library                 │    │
│  │  PrimeIcons     │  Icon set                             │    │
│  │  Vite           │  Build tool                           │    │
│  │  TypeScript     │  Type safety                          │    │
│  │  Pinia          │  State management                     │    │
│  │  oidc-client-ts │  OIDC authentication                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  BACKEND                                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Python 3.11+   │  Runtime                              │    │
│  │  FastAPI        │  Web framework                        │    │
│  │  Pydantic       │  Data validation                      │    │
│  │  Motor          │  Async MongoDB driver                 │    │
│  │  asyncpg        │  Async PostgreSQL driver              │    │
│  │  nats-py        │  NATS client                          │    │
│  │  uvicorn        │  ASGI server                          │    │
│  │  wip-auth       │  Shared authentication library        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  AUTH                                                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Dex            │  Lightweight OIDC provider (~30MB)    │    │
│  │  wip-auth       │  Shared auth library (dual mode)      │    │
│  │  PyJWT          │  JWT validation                       │    │
│  │  jwcrypto       │  JWKS handling                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  DATA                                                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  MongoDB        │  Document store                       │    │
│  │  PostgreSQL     │  Reporting store                      │    │
│  │  NATS           │  Message queue (with JetStream)       │    │
│  │  MinIO          │  S3-compatible file storage            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  INFRASTRUCTURE                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Podman         │  Container runtime                    │    │
│  │  Podman Compose │  Service orchestration                │    │
│  │  Caddy          │  Reverse proxy with auto-TLS          │    │
│  │  nginx          │  Console SPA server (in container)     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  OPTIONAL                                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Metabase       │  BI dashboard (deploy/optional/)      │    │
│  │  Mongo Express  │  MongoDB web UI (dev mode)            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Frontend

### Vue 3

**Choice**: Vue 3 with Composition API

**Rationale**:
- **Reactive by design**: Two-way binding is natural for form-heavy applications
- **Composition API**: Better code organization and reusability
- **Smaller learning curve**: More approachable than React for contributors
- **TypeScript support**: First-class TS integration
- **Bundle size**: Smaller than React (~33KB vs ~42KB gzipped)

**Alternatives Considered**:

| Alternative | Why Not Chosen |
|-------------|----------------|
| React | Larger ecosystem but more boilerplate; JSX polarizing |
| Svelte | Smallest bundle but ecosystem too limited for complex editors |
| HTMX | Not suitable for rich interactive UIs needed for editors |

### PrimeVue

**Choice**: PrimeVue component library

**Rationale**:
- **Rich components**: TreeTable, DataTable, OrderList perfect for WIP UIs
- **Flexible theming**: Not locked into Material Design
- **Enterprise-ready**: Form validation, complex interactions built-in
- **Active development**: Regular updates, good documentation

**Key Components Used**:

| Component | Use Case |
|-----------|----------|
| DataTable | Document and terminology browsing |
| Dialog | Modal editing forms |
| InputText/Number | Form inputs |
| Dropdown | Terminology term selection |
| AutoComplete | Search with suggestions |
| Toast | Notifications |
| ConfirmDialog | Destructive action confirmation |
| TabView | Document metadata/raw JSON views |

### Vite

**Choice**: Vite build tool

**Rationale**:
- **Fast dev server**: Instant HMR, near-instant startup
- **ES modules**: Modern, no bundling during development
- **Optimized builds**: Efficient production bundles
- **Vue ecosystem**: First-class Vue support

### Pinia

**Choice**: Pinia for state management

**Rationale**:
- **Official Vue store**: Successor to Vuex, recommended by Vue team
- **TypeScript-first**: Full type inference
- **Modular**: Store composition without boilerplate
- **DevTools**: Excellent debugging support

### oidc-client-ts

**Choice**: oidc-client-ts for browser-side OIDC

**Rationale**:
- **PKCE support**: Secure authorization code flow
- **TypeScript**: Full type definitions
- **Token management**: Automatic refresh, silent renew
- **Standard compliant**: Works with any OIDC provider

---

## Backend

### Python 3.11+

**Choice**: Python 3.11 or higher

**Rationale**:
- **Productivity**: Rapid development, readable code
- **Ecosystem**: Excellent libraries for data validation, async I/O
- **Performance**: 3.11+ brought significant speed improvements
- **Team familiarity**: Common knowledge base
- **Async support**: Native async/await for I/O-bound workloads

### FastAPI

**Choice**: FastAPI web framework

**Rationale**:
- **Automatic OpenAPI**: API documentation generated from code
- **Pydantic integration**: Validation built-in, perfect for WIP's validation needs
- **Async native**: Non-blocking I/O for better Pi performance
- **Type hints**: Self-documenting, catches errors early
- **Performance**: One of the fastest Python frameworks

**Key Features Used**:

```python
from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel, Field
from wip_auth import setup_auth, require_identity

app = FastAPI(
    title="Document Store API",
    description="Document storage and validation",
    version="1.0.0"
)
setup_auth(app)  # Pluggable authentication

class DocumentCreate(BaseModel):
    """Document creation request."""
    template_id: str = Field(..., description="Template to validate against")
    data: dict = Field(..., description="Document content")

@app.post("/documents", response_model=Document)
async def create_document(
    doc: DocumentCreate,
    identity: UserIdentity = Depends(require_identity)
):
    """Create a new document with validation."""
    # identity contains user info from JWT or API key
    ...
```

### Pydantic

**Choice**: Pydantic v2 for data validation

**Rationale**:
- **JSON-native**: Perfect for validating JSON documents
- **Declarative**: Models define validation rules clearly
- **FastAPI integration**: Seamless request/response validation
- **Performance**: v2 rewritten in Rust, very fast
- **Error messages**: Detailed, user-friendly validation errors

### wip-auth (Shared Library)

**Choice**: Custom shared authentication library

**Rationale**:
- **Pluggable providers**: Switch between none, api_key, jwt, dual modes
- **Consistent API**: Same dependencies across all services
- **Named API keys**: Support for owner/groups on API keys
- **Environment-driven**: Configuration via WIP_AUTH_* variables

**Usage**:
```python
from wip_auth import setup_auth, require_identity, require_admin

app = FastAPI()
setup_auth(app)

@app.get("/admin-only")
async def admin_endpoint(identity = Depends(require_admin())):
    # Only users in wip-admins group can access
    ...
```

---

## Authentication

### Dex (OIDC Provider)

**Choice**: Dex for OIDC authentication

**Rationale**:
- **Lightweight**: ~30MB RAM footprint
- **Works over HTTP**: No HTTPS requirement for development
- **Full OIDC**: Standard protocol, easy to switch providers later
- **Static users**: YAML configuration for development/testing
- **Pluggable connectors**: Can connect to LDAP, SAML, etc.

**Resource Usage**: ~30MB RAM

**Configuration** (auto-generated by setup.sh):
```yaml
issuer: https://<hostname>:8443/dex  # Always behind Caddy

staticClients:
  - id: wip-console
    name: WIP Console
    secret: wip-console-secret
    redirectURIs:
      - https://<hostname>:8443/auth/callback

staticPasswords:
  - email: "admin@wip.local"
    hash: "..."  # bcrypt hash, generated dynamically
    username: "admin"
    userID: "admin-001"
```

**Test Users**:

| Email | Password | Group |
|-------|----------|-------|
| admin@wip.local | admin123 | wip-admins |
| editor@wip.local | editor123 | wip-editors |
| viewer@wip.local | viewer123 | wip-viewers |

### wip-auth Library

Shared library providing authentication for all services:

**Auth Modes**:

| Mode | Use Case |
|------|----------|
| `none` | Development/testing (no auth) |
| `api_key_only` | Service-to-service only |
| `jwt_only` | User authentication only |
| `dual` | Both API keys and JWT (default) |

**Configuration**:
```bash
WIP_AUTH_MODE=dual
WIP_AUTH_LEGACY_API_KEY=dev_master_key_for_testing
WIP_AUTH_JWT_ISSUER_URL=http://localhost:5556/dex
WIP_AUTH_JWT_JWKS_URI=http://wip-dex:5556/dex/keys
WIP_AUTH_JWT_AUDIENCE=wip-console
```

---

## Data Stores

### MongoDB (Document Store)

**Choice**: MongoDB as document store

**Rationale**:
- **Native JSON**: No impedance mismatch with document model
- **Flexible schema**: Aligns with "store anything" philosophy
- **Rich queries**: Query nested documents, arrays naturally
- **Indexing**: Compound indexes, text search
- **ARM support**: Official Raspberry Pi builds (4.4.x for Pi 4)

**Version Notes**:
- Pi 4: MongoDB 4.4.x (ARMv8.0 support)
- Pi 5 / Mac / Cloud: MongoDB 7.x

### PostgreSQL (Reporting Store)

**Choice**: PostgreSQL as reporting store

**Rationale**:
- **SQL power**: Complex queries, aggregations, window functions
- **JSONB**: Flexible JSON storage when needed
- **Reliability**: Proven, battle-tested
- **Tooling**: Every BI/reporting tool supports Postgres
- **ARM support**: Available on Raspberry Pi

**Reporting Table Generation**:
```python
async def generate_table(template: Template, conn: asyncpg.Connection):
    columns = ["document_id TEXT PRIMARY KEY", "version INTEGER"]

    for field in template.fields:
        sql_type = TYPE_MAP.get(field.type, "TEXT")
        columns.append(f"{field.name} {sql_type}")

    sql = f"CREATE TABLE IF NOT EXISTS doc_{template.value} ({', '.join(columns)})"
    await conn.execute(sql)
```

---

## Message Queue

### NATS

**Choice**: NATS as message queue

**Rationale**:
- **Lightweight**: ~30MB RAM footprint with JetStream
- **Fast**: Millions of messages per second
- **Simple**: Easy to understand pub/sub model
- **JetStream**: Persistence and replay capabilities
- **Request/Reply**: Supports synchronous patterns too

**Alternatives Considered**:

| Alternative | Why Not Chosen |
|-------------|----------------|
| RabbitMQ | Too heavy for Pi (~150MB RAM) |
| Kafka | Way too heavy; overkill for WIP |
| Redis Streams | Good but NATS is more purpose-built |

**Usage**:
```python
import nats
from nats.js.api import StreamConfig

async def setup_nats():
    nc = await nats.connect("nats://localhost:4222")
    js = nc.jetstream()

    # Create stream for document events
    await js.add_stream(
        StreamConfig(
            name="WIP_EVENTS",
            subjects=["wip.documents.>", "wip.templates.>"]
        )
    )

async def publish_event(event: DocumentEvent):
    nc = await nats.connect("nats://localhost:4222")
    await nc.publish(
        f"wip.documents.{event.event_type}",
        event.model_dump_json().encode()
    )
```

---

## Infrastructure

### Podman

**Choice**: Podman for containerization

**Rationale**:
- **Rootless**: Better security without root daemon
- **Docker compatible**: Same CLI, same Dockerfiles
- **Daemonless**: No background daemon required
- **SystemD integration**: Native on Linux
- **Pod support**: Group containers together

**Base Images**:
```dockerfile
# API services
FROM python:3.12-slim     # Registry, Def-Store, Template-Store, Document-Store
FROM python:3.11-slim     # Reporting-Sync

# UI (multi-stage: build then serve)
FROM node:20-alpine AS builder   # npm run build
FROM nginx:alpine AS production  # Serve dist/

# MongoDB
FROM mongo:7        # Mac/Pi 5
FROM mongo:4.4.18   # Pi 4 (ARMv8.0)

# PostgreSQL
FROM postgres:16

# NATS
FROM nats:2.10

# Dex
FROM ghcr.io/dexidp/dex:v2.38.0

# Caddy
FROM caddy:2-alpine

# MinIO (optional files module)
FROM quay.io/minio/minio:latest
```

### Caddy (Reverse Proxy)

**Choice**: Caddy as reverse proxy

**Rationale**:
- **Auto-TLS**: Automatic HTTPS with self-signed or Let's Encrypt
- **Simple config**: Caddyfile is human-readable
- **Lightweight**: Low resource usage (~25MB)
- **Pi-friendly**: Enables OIDC over network without SSH tunnels

**Why Caddy over nginx/Traefik**:
- OIDC requires HTTPS for `Crypto.subtle` (PKCE)
- Caddy auto-generates self-signed certificates
- Simpler configuration than nginx
- Lower memory than Traefik

**Caddyfile** (auto-generated by setup.sh):
```
{
    auto_https disable_redirects
}

<hostname> {
    tls internal

    handle /api/def-store/* {
        reverse_proxy wip-def-store:8002
    }
    handle /api/template-store/* {
        reverse_proxy wip-template-store:8003
    }
    handle /api/document-store/* {
        reverse_proxy wip-document-store:8004
    }
    handle /dex/* {
        reverse_proxy wip-dex:5556
    }
    handle {
        reverse_proxy wip-console:80
    }
}
```

---

## Development Tools

### Code Quality

| Tool | Purpose |
|------|---------|
| **Ruff** | Fast Python linter and formatter |
| **mypy** | Static type checking |
| **pytest** | Testing framework |
| **pytest-asyncio** | Async test support |
| **ESLint** | JavaScript/TypeScript linting |
| **Prettier** | Code formatting |
| **Vitest** | Frontend testing |

### Development Workflow

All services run in containers via `setup.sh`. Dev mode mounts source code
into containers for Python hot-reload. The console always builds dist into
the image (multi-stage Docker build).

```bash
# Full deployment (dev mode with dev-tools like Mongo Express)
./scripts/setup.sh --preset full --hostname <host>

# Production deployment (random secrets, no dev-tools)
./scripts/setup.sh --preset standard --hostname <host> --prod -y

# Run tests inside a service container
podman exec -it wip-def-store bash -c \
  "pip install pytest pytest-asyncio httpx && pytest /app/tests -v"
```

---

## Version Summary

| Component | Version | Notes |
|-----------|---------|-------|
| Python | 3.11+ | Most services use 3.12; reporting-sync uses 3.11 |
| FastAPI | 0.100+ | Latest stable |
| Pydantic | 2.0+ | v2 for Rust-based performance |
| Vue | 3.4+ | Composition API |
| PrimeVue | 3.40+ | Latest stable |
| MongoDB | 4.4+ (Pi 4), 7.0+ (others) | ARM compatibility varies |
| PostgreSQL | 16+ | Reporting store |
| NATS | 2.10+ | With JetStream enabled |
| MinIO | latest | S3-compatible file storage (optional) |
| Dex | 2.38+ | OIDC provider |
| Caddy | 2.x | Reverse proxy |
| Podman | 4.x+ | Container runtime |
| Metabase | latest | BI dashboard (optional, standalone) |
