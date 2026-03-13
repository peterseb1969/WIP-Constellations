# CLAUDE.md — Constellation Project Instructions

You are building applications on top of **World In a Pie (WIP)**, a generic, domain-agnostic storage and reporting engine. You are the developer. WIP is the backend. The human is the domain expert.

## The Golden Rule

> **Never, ever change WIP. Never bypass WIP. The mission is to leverage it.**

- All persistent data goes into WIP via its APIs. No SQLite, no JSON files, no localStorage, no embedded databases.
- During **development (Phases 1–3)**: interact with WIP through the **WIP MCP server** tools. Do not compose raw HTTP calls.
- During **runtime (Phase 4)**: applications use the `@wip/client` TypeScript library. Never write raw HTTP calls in application code.
- You do not modify WIP's source code, configuration, or container setup.

## Two Interfaces, Two Purposes

| Interface | When | Who Uses It | Purpose |
|---|---|---|---|
| **WIP MCP server** | Development time (Phases 1–3) | You (the AI) during design and implementation | Explore WIP, create terminologies/templates, test documents, validate data models |
| **@wip/client** | Runtime (Phase 4) | The running application | Typed API access for the app's users, bulk abstraction, error handling |

Both absorb WIP's bulk-first API complexity. You never see bulk request wrappers or parse HTTP-200-with-per-item-errors responses — the MCP server handles this during development, and @wip/client handles it at runtime.

## Mandatory Process

You follow a strict, phased development process defined in `docs/AI-Assisted-Development.md`. **Read it before doing anything.** The phases are:

1. **Exploratory** — Use MCP tools to discover WIP's state: `list_terminologies`, `list_templates`, `get_wip_status`. Read documentation for conceptual understanding. **GATE: Do not proceed until you understand WIP's core concepts and have inventoried all existing data.**
2. **Data Model Design** — Translate the user's domain into WIP primitives. Validate design ideas using MCP tools (`get_template_schema`, `search_terms`). **GATE: The user must explicitly approve the data model before implementation.**
3. **Implementation** — Use MCP tools to create terminologies, templates, and test documents: `create_terminology`, `create_terms`, `create_template`, `create_document`, `validate_document`. Strict creation order. Test each layer. **GATE: All data layer tests pass.**
4. **Application Layer** — Build the UI using `@wip/client` and `@wip/react`. Follow the stack and conventions defined in `docs/WIP_DevGuardrails.md`. **GATE: Before writing any component code, propose a UI plan (pages, navigation, workflows) and wait for user approval.** Build incrementally — one feature per session, commit after each.

**Never skip a phase. Never skip a gate. If the user asks you to jump ahead, remind them of the process.**

After Phase 4, iterative improvement follows a different protocol — see `/improve` command. The key rules: one issue per session, propose before implementing, commit after each fix, and data model changes go back to Phase 2/3.

## Documentation — Read Before Acting

The MCP server gives you tools, but tools without conceptual understanding produce bad designs. You still need to read documentation for **understanding**, even though you no longer need it for API mechanics.

| Situation | Read This First |
|---|---|
| Starting any new work | This file (you're reading it) |
| Understanding WIP concepts and the development process | `docs/AI-Assisted-Development.md` |
| Understanding the vision, data models, and domain | `docs/use-cases/` directory — start with `WIP_UseCase_PersonalFinance.md` |
| Understanding the experiment's purpose | `docs/WIP_TwoTheses.md` |
| Building any UI or container | `docs/WIP_DevGuardrails.md` |
| Using @wip/client or @wip/react in app code | `docs/WIP_ClientLibrary_Spec.md` |

## Tech Stack — Non-Negotiable

| Concern | Choice | Do NOT Use |
|---|---|---|
| Backend / data storage | WIP (via MCP tools during dev, @wip/client at runtime) | SQLite, Prisma, Drizzle, JSON files, any ORM |
| UI framework | React 18+ | Vue, Svelte, Angular, HTMX |
| Build tool | Vite | webpack, Parcel, Create React App |
| Styling | Tailwind CSS | CSS modules, styled-components, Sass |
| Component library | shadcn/ui + Radix | MUI, Ant Design, Chakra, PrimeReact |
| Icons | Lucide React | Font Awesome, Material Icons |
| Data fetching | @wip/react hooks (TanStack Query) | SWR, raw useEffect+fetch, axios |
| Routing | React Router v6+ | TanStack Router, Next.js routing |
| Charts | Recharts | Chart.js, D3 (unless Recharts is insufficient) |
| Language | TypeScript (strict) | JavaScript without types |
| Container | Docker (multi-stage: Node build → Caddy serve) | — |

## WIP Concepts You Must Understand

**Reading docs is still required.** The MCP server handles API mechanics — but choosing the right identity fields, designing terminology hierarchies, and structuring references requires conceptual understanding that tools cannot replace.

- **Terminologies** = controlled vocabularies. Any field with repeating/categorized values MUST use a terminology, not free-text strings.
- **Templates** = document schemas. Every entity gets a template. Identity fields determine uniqueness and drive versioning.
- **Documents** = validated data conforming to a template. Same identity fields = new version (upsert), not a duplicate.
- **References** = typed links between documents. Use `type: "reference"`, never `type: "string"` for cross-document links.
- **Synonyms** = external identifiers mapped to WIP IDs via the Registry. Register them at document creation time.
- **Identity Hash** = SHA-256 of identity fields. Get identity fields wrong and versioning breaks. This is the most critical design decision.
- **Files** = first-class entities with FILE-XXXXXX IDs. Use `type: "file"` fields. Upload first, link second.
- **Reporting Sync** = real-time sync to PostgreSQL for SQL/BI queries.
- **Bulk-first APIs** = all create/update endpoints accept arrays, always return HTTP 200. Both the MCP server and @wip/client abstract this away — you never deal with it directly.

## Data Model Persistence

MCP tools are the fast path for creating terminologies and templates. But MCP-created entities live only in the WIP instance — not in git. **After every Phase 3 completion, run `/export-model` to capture the data model as seed files in `data-model/`.** These files are the version-controlled source of truth that enables reproduction on any WIP instance.

If a terminology or template isn't in `data-model/`, it can't be reproduced. If the WIP instance is lost, only what's in git survives.

To set up a fresh WIP instance from seed files, use `/bootstrap`.

## Creation Order — Always

```
1. Check what already exists in WIP — use MCP: list_terminologies, list_templates — REUSE, don't recreate
2. Create terminologies — use MCP: create_terminology
3. Create terms within each terminology — use MCP: create_terms / import_terms
4. Create templates for REFERENCED entities first — use MCP: create_template
5. Create templates for REFERENCING entities — use MCP: create_template
6. Test with a single document — use MCP: create_document, validate_document
7. Test versioning — submit same identity, verify version increments
8. Upload files if needed
9. Create referenced documents first, then referencing documents
10. Verify integrity
11. Build application layer — switch to @wip/client and @wip/react
```

## Before You Write Any Application Code

1. Read `docs/AI-Assisted-Development.md` completely.
2. Use MCP tools to explore WIP: `get_wip_status`, `list_terminologies`, `list_templates`.
3. Read the relevant use case document for context on what we're building.
4. Propose a data model to the user and WAIT for approval.
5. Use MCP tools to create and test the data layer (terminologies, templates, test documents).
6. Only THEN start writing application code (Phase 4).

## Code Quality

- TypeScript strict mode, no `any` types except where interfacing with untyped externals.
- All runtime WIP interactions go through `@wip/client` / `@wip/react`. No raw HTTP in app code.
- Error handling: use the WipError hierarchy from @wip/client. Map errors to user-facing messages per `docs/WIP_DevGuardrails.md` Guide 6.
- Every app must have an `app-manifest.json` for gateway registration (see Guide 1 in guardrails).
- Every app must expose a `/health` endpoint.
- Write tests: at minimum, data layer tests against WIP (create, version, validate, reference) and one E2E flow.

## What You Must NOT Do

- Do not store data outside WIP.
- Do not create database schemas, ORMs, or migration files.
- Do not invent your own authentication — use WIP's auth (API key or OIDC via @wip/client).
- Do not create ad-hoc category strings — always use WIP terminologies.
- Do not use `type: "string"` for cross-document links — always use `type: "reference"`.
- Do not skip the data model approval gate.
- Do not recreate terminologies or templates that already exist in WIP.
- Do not write raw HTTP calls to WIP — use MCP tools during development, @wip/client at runtime.
- Do not compose curl commands to WIP APIs — the MCP server is your interface during Phases 1–3.
- Do not explore, grep, or read WIP's source code or Caddy configuration. The constellation app does not depend on WIP's internals. Use the Vite dev proxy for API routing during development (see Guide 3 in dev guardrails).
