# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repository Is

WIP-Constellations is the **documentation and design specification** for building applications ("constellations") on top of World In a Pie (WIP) — a generic, domain-agnostic storage and reporting engine. This repo contains no implementation code; actual WIP backend services and WIP Console UI live in separate repos.

### The Golden Rule

> **Never, ever change WIP. The mission is to leverage it.**

WIP provides primitives (registry, terminologies, templates, documents, files, reporting). The AI's job is to map a user's domain onto those primitives and build an application layer on top.

## The Two Theses

This project tests two independent but reinforcing hypotheses:

**Thesis 1 — Shared backend network effect:** When multiple apps share WIP as their backend, system value grows non-linearly. Each new app retroactively enriches every existing app by enabling cross-dataset queries (just SQL joins in PostgreSQL) that would be impractical as point-to-point integrations. A renovation decision can draw on energy data, climate logs, equipment records, construction costs, and financial records — no ETL, no integration work.

**Thesis 2 — WIP as AI guardrail:** WIP's structural constraints (schema validation, controlled vocabularies, referential integrity, automatic versioning, soft delete) eliminate the infrastructure decisions where AI-generated code most commonly fails. The AI's decision surface is reduced to domain-specific choices: which terminologies, which templates, which identity fields, which references. Everything else is enforced by the platform.

**Together:** Thesis 1 needs Thesis 2 for velocity (building a dozen interconnected apps by hand is too slow to reach the network effect). Thesis 2 needs Thesis 1 for meaning (AI-built apps need a real purpose, not just demos). The constellations form a graduated proof — each step (single app → cross-app references → cross-constellation queries → multi-constellation analysis) raises the bar for both theses.

**Planned progression:** Finance constellation first (Statement Manager → Receipt Scanner → Investment/Subscription Trackers → BI layer), then Energy, then Home Management, culminating in a cross-constellation renovation analysis spanning all three.

## Repository Structure

- `WIP-instructions/` — Core development process and API reference
  - `Vision.md` — Philosophy, primitives, core concepts
  - `AI-Assisted-Development.md` — Strict 4-phase process for building on WIP
  - `api-conventions.md` — Bulk-first API patterns (critical — read first)
  - `architecture.md` — Microservices architecture and service ports
  - `HOW-TO.md` — Curl examples for all API operations
  - `authentication.md` — API key and OIDC setup
  - `semantic-types.md` — Field validation patterns (email, url, geo_point, etc.)
  - `ontology-support.md` — Ontology modeling (proposed)
- `docs/` — Use case specifications and design docs
  - `WIP_DevGuardrails.md` — UI stack, deployment, app skeleton conventions
  - `WIP_ClientLibrary_Spec.md` — @wip/client and @wip/react design
  - `WIP_UseCase_*.md` — Domain-specific constellation designs (finance, energy, vehicle, home)

## The Registry

The Registry is the heart of WIP — every other service depends on it. Every entity (terminology, term, template, document, file) gets its ID from the Registry. Nothing exists without being registered.

Key capabilities:

- **Centralized ID generation**: UUID7 by default (time-ordered, globally unique), or configurable prefixed sequences per namespace (`TERM-000001`, `TPL-000001`)
- **Synonyms**: Multiple identifiers resolve to one canonical entity. A template can be `TPL-000001` in WIP, `OLD-TPL-42` in a legacy system, and `contract-template-v3` at a partner org — all the same entity. This is how legacy migrations, external integrations, and multi-system environments work without ID conflicts.
- **Composite keys**: Identity is a set of fields (e.g., `{code, name}` for a terminology), SHA-256 hashed for uniform indexing. Same composite key = same entity (idempotent upsert), which drives the create-or-update decision and the versioning system.
- **Namespace isolation**: Separate ID sequences and formats per namespace, enabling multi-tenancy on a single WIP instance.
- **Federation potential** (not yet implemented): Architecture supports a central Registry coordinating multiple autonomous WIP instances across locations, with cross-instance lookups while preserving data sovereignty.

Note: Term *aliases* (Def-Store) and Registry *synonyms* solve different problems. Aliases handle user input variation ("Mr.", "MR", "MALE" → "Male"). Synonyms handle cross-system identity mapping (`legacy:OLD-ID` → `TPL-000001`).

## Terminologies and Ontologies

Terminologies and ontologies live in the same Def-Store service. A terminology is a controlled vocabulary (flat or single-parent hierarchy). An ontology extends this with **typed relationships between terms** — enabling polyhierarchy, semantic modelling, and cross-terminology links.

Key capabilities (Phases 1-2 implemented, OWL/SKOS import pending):

- **TermRelationship model**: Directed, typed edges between terms (`is_a`, `part_of`, `maps_to`, `related_to`, etc.). Relationship types are themselves a WIP terminology (`ONTOLOGY_RELATIONSHIP_TYPES`), so users can define domain-specific relationship types.
- **Polyhierarchy**: A term can have multiple parents via `is_a` relationships (e.g., "Viral pneumonia" is_a "Pneumonia" AND is_a "Viral respiratory infection"). The existing single `parent_term_id` continues to work for simple hierarchies.
- **Traversal queries**: Ancestors, descendants, parents, children — with BFS, cycle detection, configurable max depth. Traversal unifies both `parent_term_id` and `is_a` relationships.
- **Cross-terminology links**: Relationships can span terminologies (e.g., mapping ICD-10 codes to SNOMED concepts).
- **Standard ontology support**: SKOS/thesauri map losslessly. OWL-DL axioms are preserved in metadata for round-trip fidelity but not evaluated — WIP captures and serves ontology structure; reasoning is delegated downstream.

API endpoints live under `/api/def-store/ontology/` and follow standard bulk-first conventions.

## Critical API Conventions

All WIP services share these patterns — violations cause subtle bugs:

1. **Bulk-first writes**: Every POST/PUT/DELETE accepts `[item]` array, returns HTTP 200 with per-item `BulkResponse`
2. **Never check HTTP status for business errors**: A 409 will never be returned. Check `results[i].status == "error"` instead
3. **Updates use PUT with ID in body**: `PUT /templates` with `[{"template_id": "...", ...}]`
4. **Soft delete only**: All deletes set `status: inactive`. Exception: binary files support hard-delete after soft-delete
5. **Identity via composite keys**: Same identity fields = new version, not duplicate (SHA-256 hash)

## WIP Services (Ports)

| Service | Port | Purpose |
|---------|------|---------|
| Registry | 8001 | Namespaces, ID generation, synonyms |
| Def-Store | 8002 | Terminologies, terms, aliases, ontology relationships |
| Template-Store | 8003 | Templates, fields, validation rules |
| Document-Store | 8004 | Documents, versioning, validation |
| Reporting-Sync | 8005 | NATS consumer, MongoDB→PostgreSQL sync |

Caddy reverse proxy at `:8443` routes `/api/{service}/` to each service.

## AI-Assisted Development Process (4 Phases)

Must follow in order with gates between phases:

1. **Exploratory** — Read all docs, catalog APIs, verify WIP connectivity
2. **Domain Mapping** — Map user's domain onto WIP primitives (terminologies, templates, identity fields)
3. **Data Layer** — Create terminologies/templates via API, test document creation, set up reporting
4. **Application Layer** — Build UI using the constellation app conventions below

## Constellation App Conventions

All constellation apps (end-user apps built on WIP) follow these standards:

**UI Stack**: React 18+, Vite, Tailwind CSS, shadcn/ui, Lucide React icons, TanStack Query, React Router v6+, Recharts

**Design Tokens**: primary (#2B579A), accent (#ED7D31), success (#2E8B57), danger (#DC3545). Font: Inter. Spacing: 4px units. Border-radius: rounded-lg (8px) for cards.

**App Structure**: Each app is containerized with `app-manifest.json` for gateway registration, multi-stage Dockerfile (Node build → Caddy serve), `/health` endpoint, configurable base path via `VITE_BASE_PATH`.

**WIP Client**: Apps use `@wip/client` (framework-agnostic) and `@wip/react` (TanStack Query hooks). Single-item methods wrap/unwrap the bulk API automatically.

**Testing**: Vitest + Testing Library for components, Playwright for E2E. Data layer tests run against a dedicated WIP test namespace (not production).

Note: WIP Console uses Vue 3 + PrimeVue (different from constellation apps). This is intentional — Console is an admin/debug tool; constellation apps are end-user tools optimized for AI code generation with React.
