# Application Development Guardrails & Conventions

*WIP Development Guidelines*

*DRAFT — March 2026*

---

# Purpose of This Document

The AI-Assisted Development process defines how an AI builds applications on WIP: explore, design, implement, verify. But it deliberately leaves open a set of decisions about how the applications themselves are structured, deployed, and presented. This companion document fills that gap.

These are opinionated conventions. They exist to reduce the AI’s decision surface for infrastructure and presentation concerns, just as WIP reduces its decision surface for data concerns. An AI following these guidelines will produce applications that are consistent in appearance, predictable in deployment, and straightforward to integrate into the growing app ecosystem.

> **When to read this**
> The AI-Assisted Development process has four phases. This document is most relevant in Phase 4 (Application Layer), but the Gateway and App Skeleton sections should be read before Phase 3, as they affect how the application is structured from the start.

## Guide Overview

|        |                                      |              |                                                                                                                                                                       |
|--------|--------------------------------------|--------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **\#** | **Guide**                            | **Priority** | **Scope**                                                                                                                                                             |
| **1**  | **Gateway & Portal**                 | **Critical** | Reverse proxy, port management, app discovery, landing page. Must exist before the second app is deployed.                                                            |
| **2**  | **UI Stack & Styling**               | **High**     | Framework choice, component library, design tokens. Needed before any user-facing UI is built.                                                                        |
| **3**  | **App Skeleton & Container Pattern** | **High**     | Dockerfile template, folder structure, environment variables, health check. The structural blueprint for every app.                                                   |
| **4**  | **WIP Client Library**               | **High**     | @wip/client and @wip/react: WIP-distributed packages providing typed API access, bulk abstraction, error normalisation, and React hooks. See dedicated specification. |
| **5**  | **Data Entry Patterns**              | Medium       | Form generation from templates, file upload flows, bulk import, validation UX.                                                                                        |
| **6**  | **Error Handling Guide**             | Medium       | WIP error codes mapped to user-facing messages, retry patterns, graceful degradation.                                                                                 |
| **7**  | **Testing Contract**                 | Medium       | Minimum test expectations, E2E test patterns, definition of “done” for AI-built apps.                                                                                 |

# Guide 1: Gateway & Portal

> **Priority: Critical — deploy before the second app**
> On a Raspberry Pi with a single IP address, every containerised app needs its own port. Without a gateway, users must remember that the Statement Manager is on port 8081, the Receipt Scanner is on 8082, WIP Console is on 8443, and so on. This is unworkable beyond two apps. The gateway solves port management, TLS termination, and app discovery in a single container.

## Architecture

The gateway is a reverse proxy (Caddy is recommended for its automatic TLS and simple configuration) that listens on the host’s ports 80 and 443. All constellation apps sit behind it, accessible via path-based routing on a single hostname.

https://wip-pi.local/ → Portal (landing page)

https://wip-pi.local/apps/statements/ → Statement Manager (port 3001 internal)

https://wip-pi.local/apps/receipts/ → Receipt Scanner (port 3002 internal)

https://wip-pi.local/apps/energy/ → Energy Monitor (port 3003 internal)

https://wip-pi.local/console/ → WIP Console (port 8443 internal)

https://wip-pi.local/api/ → WIP API services (ports 8001-8005)

Each app binds to its own internal port (never exposed to the host). The gateway is the only container that binds to host ports 80 and 443. This eliminates all port conflicts.

## App registration

Every app must register itself with the gateway. This is done via a simple JSON manifest file included in each app’s container:

app-manifest.json:

{

"id": "statements",

"name": "Statement Manager",

"description": "Bank and employer statement management",

"version": "0.1.0",

"icon": "bank",

"path": "/apps/statements",

"internal_port": 3001,

"health_endpoint": "/health",

"constellation": "finance"

}

The gateway reads manifests from all running app containers (via a shared Docker label or a mounted manifest directory) and generates its routing configuration and the portal landing page automatically.

## Portal landing page

The portal is a lightweight page served by the gateway itself (not a separate app). It displays all registered apps as cards, grouped by constellation, with status indicators (healthy/unhealthy based on health endpoint checks). It is auto-generated from the app manifests — no manual maintenance required.

The portal should also provide quick links to the WIP Console, Mongo Express (if available), and any BI tools (Metabase) running on the system.

## Implementation notes

- **Caddy over Nginx/Traefik:** Caddy provides automatic HTTPS with self-signed certificates (suitable for .local domains), simple Caddyfile syntax, and built-in file serving for the portal page. For a Raspberry Pi deployment, simplicity wins.

- **Internal network:** All app containers and WIP services join a shared Docker network. Inter-container communication uses container names as hostnames (e.g., http://statements:3001). Only the gateway exposes ports to the host.

- **Automatic reconfiguration:** When a new app container starts, the gateway detects it and updates routing. This can be as simple as a cron job that regenerates the Caddyfile from discovered manifests, or a Docker event listener for live updates.

> **Why this is the first thing to build**
> The gateway is infrastructure that every subsequent app depends on. Building it first means the very first constellation app (Statement Manager) is deployed correctly from day one — behind the proxy, at a clean URL, with health monitoring. Every subsequent app just adds a manifest and appears on the portal automatically.

## Future: Gateway as a WIP core feature

WIP already ships Caddy as part of its container suite, handling TLS termination and authentication redirects (Dex/OIDC). This means the reverse proxy infrastructure described above is not entirely new — it extends what WIP already deploys. A natural evolution would be to integrate the gateway and portal into WIP’s standard deployment, solving the single-IP port management problem out of the box for every WIP user.

The cleanest approach would be conditional behaviour based on the number of registered apps:

- **Single app (Console only):** Caddy routes directly to the WIP Console. No landing page, no extra click. The experience is identical to a fresh WIP install today. Zero friction for users who have not yet built any constellation apps.

- **Two or more apps:** Caddy serves a lightweight landing page with cards for each registered app, including the Console. One additional click to reach any destination, but full discoverability. The portal appears only when it has a reason to exist.

Importantly, the WIP Console would be one of the apps listed on the portal — not the portal itself. The Console is an administration and debugging tool; mixing it with app navigation would confuse both audiences. The portal is a separate, minimal UI whose only job is discovery and routing.

**This is not required for the initial experiment** — direct port navigation is sufficient for development. But for community uptake and ease of onboarding, a single HTTPS entry point that “just works” on a Raspberry Pi would be a significant usability improvement. The detection mechanism is trivial (count routing entries at startup), and the implementation stays within Caddy’s existing configuration model.

# Guide 2: UI Stack & Styling

> **Priority: High — needed before any user-facing UI**
> Without a shared UI convention, every app the AI builds will make independent choices about framework, components, and visual style. The result: an ecosystem that looks like it was built by ten different teams. These constraints ensure visual and behavioural consistency across all constellation apps.

## Relationship to the WIP Console stack

The WIP Console — itself built by Claude — uses a different frontend stack: Vue 3 with PrimeVue, Pinia for state management, and the same Vite build tool. This is a deliberate divergence, not an inconsistency.

The Console is a data-heavy administration and debugging interface. PrimeVue’s DataTable, TreeTable, and complex form components are purpose-built for exactly this kind of work: inspecting terminologies, browsing raw documents, editing template schemas. It is the right tool for an admin UI.

Constellation apps are end-user tools: a receipt scanner, a fuel log, an energy dashboard, a renovation planner. They need to feel lightweight, approachable, and visually cohesive with each other — not like lighter versions of an admin console. A different component library (shadcn/ui) and framework (React) better serve this audience.

There is also a practical consideration for the AI-assisted development experiment. While Claude can produce excellent Vue/PrimeVue code (the Console proves this), the depth of React training data across LLMs is significantly larger. For an experiment testing the limits of AI-generated applications, optimising for the AI’s strongest output language reduces a variable and gives the experiment its best chance of success.

**What remains consistent** across both the Console and constellation apps: Vite as the build tool, TypeScript for type safety, the same OIDC/authentication flow (wip-auth, oidc-client-ts), the same Docker container patterns, and the same Caddy integration. These shared foundations ensure that apps are interoperable at the infrastructure level, even when their UI layers differ.

## Framework and libraries

All constellation apps use the same stack:

|                            |                              |                                                                                                                                                  |
|----------------------------|------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------|
| **Concern**                | **Choice**                   | **Rationale**                                                                                                                                    |
| **UI Framework**           | React 18+                    | Widest AI training coverage, broadest component ecosystem, Claude’s strongest UI generation language.                                            |
| **Build tool**             | Vite                         | Fast cold start, simple config, excellent React support, small footprint suitable for Pi.                                                        |
| **Styling**                | Tailwind CSS                 | Utility-first approach works well with AI code generation. No separate CSS files to maintain. Consistent spacing and colour via config.          |
| **Component library**      | shadcn/ui                    | Unstyled, composable primitives built on Radix. Tailwind-native. Copy-paste model means no version dependency issues. AI generates well with it. |
| **Icons**                  | Lucide React                 | Clean, consistent icon set. Already a shadcn/ui convention.                                                                                      |
| **Data fetching**          | TanStack Query (React Query) | Handles caching, refetching, loading/error states. Prevents every app from reinventing data fetch patterns.                                      |
| **Routing**                | React Router v6+             | Standard React routing. Apps must support a configurable base path for gateway integration (e.g., /apps/statements/).                            |
| **Charts / visualisation** | Recharts                     | React-native charting, simple API, sufficient for the BI dashboards described in the constellation docs.                                         |

## Design tokens

All apps share a common Tailwind configuration that defines the visual language. This is distributed as a shared config file (part of the app skeleton, Guide 3).

### Colour palette

|                   |           |                                                       |
|-------------------|-----------|-------------------------------------------------------|
| **Token**         | **Value** | **Usage**                                             |
| **primary**       | \#2B579A  | Navigation, primary buttons, headings, active states  |
| **primary-light** | \#5B9BD5  | Secondary buttons, links, hover states, chart accents |
| **accent**        | \#ED7D31  | Alerts, highlights, call-to-action, notifications     |
| **success**       | \#2E8B57  | Positive states, confirmations, healthy status        |
| **danger**        | \#DC3545  | Errors, destructive actions, unhealthy status         |
| **surface**       | \#FFFFFF  | Card backgrounds, modal backgrounds                   |
| **background**    | \#F8FAFC  | Page background, subtle separation                    |
| **text**          | \#333333  | Body text, primary content                            |
| **text-muted**    | \#999999  | Secondary text, labels, timestamps                    |

### Typography

- **Font family:** Inter (sans-serif). Available via Google Fonts or self-hosted. Excellent legibility on screens, good Unicode coverage.

- **Base size:** 16px (1rem). All other sizes relative.

- **Scale:** text-sm (14px) for secondary content, text-base (16px) for body, text-lg (18px) for emphasis, text-xl (20px) for section headings, text-2xl (24px) for page titles.

### Spacing and layout

- **Spacing unit:** 4px base (Tailwind default). Use multiples: p-2 (8px), p-4 (16px), p-6 (24px).

- **Border radius:** rounded-lg (8px) for cards and containers, rounded-md (6px) for buttons and inputs.

- **Max content width:** max-w-6xl (72rem) for main content areas. Full-width tables and charts may exceed this.

- **Responsive:** Mobile-first. All layouts must work at 375px width (phone) and up. The primary use case is a desktop/tablet browser on the local network, but mobile access should not be broken.

### Navigation pattern

Each app has a consistent navigation structure:

- **Top bar:** App name and icon on the left, breadcrumb trail in the centre, user/settings on the right. A “Home” icon links back to the portal (gateway landing page).

- **Sidebar (optional):** For apps with multiple sections (e.g., Statement Manager has accounts, transactions, pay slips). Collapsible on mobile.

- **No app should implement its own authentication UI.** Authentication is handled by the gateway or WIP’s OIDC integration. Apps receive an authenticated context.

# Guide 3: App Skeleton & Container Pattern

> **Priority: High — the structural blueprint for every app**
> Every constellation app is a containerised web application with a predictable structure. The AI copies this skeleton for every new app, modifying only the domain-specific parts. This ensures consistency and eliminates boilerplate decision-making.

## Folder structure

app-name/

├── app-manifest.json \# Gateway registration (see Guide 1)

├── Dockerfile \# Multi-stage build: Node build → Caddy serve

├── docker-compose.yml \# Standalone dev compose (extends ecosystem compose)

├── .env.example \# Environment variable template

├── vite.config.ts \# Vite config with base path from env

├── tailwind.config.ts \# Extends shared design tokens

├── src/

│ ├── main.tsx \# Entry point

│ ├── App.tsx \# Root component with router

│ ├── lib/

│ │ └── config.ts \# Runtime config (WIP URL, base path)

│ ├── components/ \# Reusable UI components

│ ├── pages/ \# Route-level page components

│ ├── hooks/ \# Custom React hooks (data fetching, etc.)

│ └── types/ \# TypeScript type definitions

├── tests/

│ ├── e2e/ \# End-to-end tests (see Guide 7)

│ └── unit/ \# Unit tests

└── README.md \# App-specific documentation

## Environment variables

Every app uses the same environment variable pattern for WIP connection and gateway integration:

|                      |                     |                                                      |
|----------------------|---------------------|------------------------------------------------------|
| **Variable**         | **Example**         | **Purpose**                                          |
| **VITE_WIP_HOST**    | http://wip-api:8001 | WIP Registry service URL (internal network)          |
| **VITE_WIP_API_KEY** | wip-dev-key-001     | API key for development/scripts                      |
| **VITE_BASE_PATH**   | /apps/statements    | Gateway path prefix. Vite and React Router use this. |
| **VITE_APP_PORT**    | 3001                | Internal port (never exposed to host)                |

## Dockerfile pattern

Multi-stage build: Node.js for building, a lightweight server for serving. The production image should be as small as possible for Raspberry Pi deployment.

\# Stage 1: Build

FROM node:20-alpine AS build

WORKDIR /app

COPY package\*.json ./

RUN npm ci

COPY . .

RUN npm run build

\# Stage 2: Serve

FROM caddy:2-alpine

COPY --from=build /app/dist /srv

COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 3001

## Health endpoint

Every app exposes a /health endpoint that the gateway checks. For a static frontend app, Caddy can serve a static health response. For apps with a backend component, the health check should verify WIP connectivity.

## Docker Compose integration

Each app has its own docker-compose.yml for standalone development. For production, an ecosystem-level compose file includes all apps, the gateway, and WIP services. Apps declare their dependency on the WIP services and the gateway network:

services:

statements:

build: ./apps/statements

labels:

\- "wip.app=true"

\- "wip.manifest=/app/app-manifest.json"

networks:

\- wip-network

depends_on:

\- wip-document-store

# Guide 4: WIP Client Library

> **Priority: High — part of the WIP distribution**
> WIP ships two TypeScript packages as part of its standard distribution: @wip/client (the core, framework-agnostic client) and @wip/react (a React companion with pre-built TanStack Query hooks). Every constellation app depends on these packages. They are versioned in lockstep with WIP’s API services and documented in a dedicated design specification.

## Why this exists

WIP’s APIs are bulk-first: all create and update operations accept arrays and always return HTTP 200 with per-item results. This is efficient at the API level, but it means a naïve app that checks response.ok and assumes success has a latent bug — individual items may have failed validation, reference resolution, or conflict checks inside that 200 response. The client library absorbs this complexity entirely.

Single-item methods (the common case in apps) wrap the input into a one-element array, send it to the bulk endpoint, unwrap the response, inspect the per-item result, and either return the entity or throw a typed error. The caller never sees the bulk wrapper. Bulk methods expose the full per-item result set with chunking, progress callbacks, and structured success/failure reporting.

## What the packages provide

- **@wip/client — core client:** Typed service classes for all WIP APIs (Def-Store, Template-Store, Document-Store, Registry, Reporting-Sync). Authentication handling (API key and OIDC). A typed error hierarchy that normalises both HTTP-level errors and item-level failures extracted from bulk responses. Auto-generated TypeScript types from WIP’s OpenAPI specs. Utility functions including templateToFormSchema() for auto-generating form descriptors from templates.

- **@wip/react — React companion:** Pre-built TanStack Query hooks for common operations: useDocuments, useTemplate, useTerminology, useCreateDocument, useFormSchema, useUploadFile. A WipProvider context that makes the client instance available throughout the component tree. Consistent cache strategy across all apps.

## Usage in constellation apps

import { createWipClient } from '@wip/client';

import { WipProvider, useDocuments, useCreateDocument } from '@wip/react';

// Initialise once at app root:

const wip = createWipClient({

host: 'https://wip-pi.local',

auth: { mode: 'api-key', key: import.meta.env.VITE_WIP_API_KEY },

});

// In components — query:

const { data, isLoading } = useDocuments('BANK_TRANSACTION', { filters });

// In components — create with typed error handling:

const { mutate, isPending } = useCreateDocument();

mutate({ templateId, data }, {

onError: (e) =\> {

if (e instanceof WipValidationError) highlightFields(e.fields);

if (e instanceof WipResolutionError) showTermError(e.field, e.value);

}

});

The full specification — including all service methods, the error hierarchy, the BulkResult type, the type generation pipeline, and the React hooks — is documented in the companion design specification: @wip/client TypeScript Client Library.

# Guide 5: Data Entry Patterns

> **Priority: Medium — needed before user-facing data entry**
> The constellation docs describe what data to store. This guide describes how data gets into WIP through user-facing interfaces.

## Form generation from templates

WIP templates define field types, required/optional status, and terminology references. This is enough information to auto-generate a basic form for any template. The AI should build a generic form renderer that takes a template definition and produces a working form:

- **string fields:** Text input. If the field has a max_length, enforce it.

- **number / integer fields:** Numeric input with appropriate step value.

- **date fields:** Date picker component.

- **boolean fields:** Toggle or checkbox.

- **term fields:** Dropdown or searchable combobox populated from the referenced terminology. The WIP client fetches the terminology’s terms and displays value (with aliases available for search).

- **reference fields:** Search input that queries WIP for matching documents of the referenced template. Display the document’s identity fields as the search result.

- **file fields:** File upload zone (drag-and-drop or click). Upload to WIP’s file storage first, then link the returned FILE-XXXXXX ID to the document.

- **array / object fields:** Repeatable field groups with add/remove controls.

This auto-generated form is a starting point. Apps with specialised UX needs (e.g., the Receipt Scanner’s OCR-assisted entry) build custom forms on top of the same WIP client methods, but the generic renderer covers the 80% case and is invaluable for rapid prototyping.

## File upload flow

WIP treats files as first-class entities. The upload pattern is always two steps:

**Step 1:** Upload the file to WIP’s file storage endpoint. Receive a FILE-XXXXXX identifier.

**Step 2:** Create or update the document, referencing the FILE-XXXXXX ID in the appropriate file field.

The UI should show upload progress (WIP supports multipart upload) and handle the two-step process transparently — the user uploads a file and fills in the form; the app orchestrates the upload-then-create sequence.

## Bulk import

Several constellation apps need bulk import for historical data: past bank statements (CSV), old receipts, existing equipment lists. The pattern:

- Accept CSV, XLSX, or JSON file upload

- Parse and preview the data with column-to-field mapping (let the user confirm the mapping)

- Validate all rows against the WIP template before submission

- Submit via WIP’s bulk document creation endpoint with a progress indicator

- Report results: created, updated (if identity match), failed (with error details per row)

# Guide 6: Error Handling Guide

> **Priority: Medium — quality differentiator for user experience**
> AI-generated code tends to either swallow errors or surface raw API responses. This guide defines how WIP errors should be translated into user-facing messages.

## Error categories

|                 |                |                                                                         |                                                                                                                           |
|-----------------|----------------|-------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------|
| **HTTP Status** | **Category**   | **User-Facing Message Pattern**                                         | **UI Behaviour**                                                                                                          |
| **400**         | Validation     | "\[Field\] is invalid: \[reason\]"                                      | Highlight the specific field(s). Show inline validation messages. Do not clear the form.                                  |
| **401 / 403**   | Authentication | "Session expired. Please log in again."                                 | Redirect to login or prompt for re-authentication. Preserve form state so the user doesn’t lose work.                     |
| **404**         | Not found      | "\[Entity\] not found. It may have been removed."                       | Show a clear message with a link to go back. Do not show a raw 404 page.                                                  |
| **409**         | Conflict       | "This record was updated by someone else. Please review and try again." | Show the conflicting version if possible. Offer to reload.                                                                |
| **422**         | Unprocessable  | "Could not process: \[specific reason\]"                                | Common for term resolution failures or reference resolution failures. Show which value could not be resolved.             |
| **500+**        | Server error   | "Something went wrong. Please try again in a moment."                   | Show a non-technical message. Log the full error to console. Offer a retry button.                                        |
| **Network**     | Connectivity   | "Cannot reach the server. Check your network connection."               | Relevant for Raspberry Pi on local network — the Pi may be off, or the user may be on the wrong WiFi. Retry with backoff. |

## Notification pattern

- **Success:** Toast notification (auto-dismiss after 3 seconds). Green. “Transaction saved.”

- **Validation error:** Inline on the affected field(s) + a summary toast. Red. Persistent until corrected.

- **Server/network error:** Banner at the top of the page (not a toast — this is more severe). Red. Persistent with a retry button.

- **Warning:** Toast notification (auto-dismiss after 5 seconds). Amber. Used for non-blocking issues like “This terminology has inactive terms.”

## Retry pattern

For network and server errors, the WIP client (Guide 4) implements automatic retry with exponential backoff: 1s, 2s, 4s, maximum 3 attempts. If all retries fail, the error is surfaced to the UI. Mutations (POST/PUT/DELETE) are not automatically retried — only the user can trigger a retry for write operations, to prevent duplicate submissions.

# Guide 7: Testing Contract

> **Priority: Medium — defines what “done” means**
> Without a testing contract, the AI will declare an app complete after the first successful API call. This guide defines minimum test coverage that every app must meet before it is considered operational.

## Minimum test requirements

Every constellation app must have the following tests passing before deployment:

### Data layer tests (against a live WIP instance)

- Create a document with all required fields → verify success and returned document ID

- Create the same document again (same identity fields) → verify version increments to 2

- Create a document with an invalid term value → verify WIP returns a validation error

- Create a document with a valid reference → verify the reference resolves correctly

- Create a document with an invalid reference → verify WIP returns a resolution error

- Query documents by template code → verify the created documents are returned

- If the app uses file upload: upload a file, link it to a document, verify the file is retrievable

### UI tests (component-level)

- Form renders correctly for the app’s primary template(s)

- Required field validation prevents submission when empty

- Term dropdowns populate from WIP terminology data

- Successful submission shows a success notification

- Validation error from WIP highlights the correct field(s)

- Network error shows the appropriate error banner

### Integration tests (end-to-end)

- User can navigate from the portal to the app

- User can create a new record through the UI

- User can view the created record in a list or table

- User can update an existing record and see the version change

- Health endpoint returns 200

## Test infrastructure

- **Data layer tests:** Run against a dedicated WIP test namespace (not the production namespace). The test suite creates its own terminologies and templates, runs tests, then deactivates what it created. WIP’s soft delete ensures no permanent pollution.

- **UI tests:** Vitest + Testing Library for component tests. Mock the WIP client for unit tests; use the real client against a test WIP instance for integration tests.

- **E2E tests:** Playwright for browser-level tests. Run against the full stack (app + gateway + WIP) in a Docker Compose test environment.

## Definition of done

An app is considered operational when:

- All data layer tests pass against a live WIP instance

- All UI component tests pass

- At least one E2E flow (create → view → update) passes through the full stack

- The app manifest is valid and the gateway routes to it correctly

- The health endpoint returns 200

- The README documents what the app does, what WIP templates it uses, and how to run it

> **Why this matters for the experiment**
> The testing contract is also an observability tool for the AI-assisted development experiment. By tracking test pass rates across development sessions, we can measure whether the AI’s output quality improves over time, whether certain types of tests consistently fail, and where human intervention is most needed. Test results are data about the development process itself.

# How These Guides Relate to the Development Process

The AI-Assisted Development process has four phases. These guides slot in as follows:

|                                |                                                  |                                                                                                               |
|--------------------------------|--------------------------------------------------|---------------------------------------------------------------------------------------------------------------|
| **Phase**                      | **AI-Assisted Dev Process**                      | **Read These Guides**                                                                                         |
| **Phase 1: Exploratory**       | Read docs, catalog APIs, inventory existing data | Guide 1 (Gateway) — understand the deployment target                                                          |
| **Phase 2: Data Model**        | Design terminologies, templates, references      | Guide 4 (WIP Client) — understand @wip/client and @wip/react                                                  |
| **Phase 3: Implementation**    | Create terminologies, templates, test documents  | Guide 3 (App Skeleton) — set up the project structure. Guide 7 (Testing) — write data layer tests.            |
| **Phase 4: Application Layer** | Build UI, integrate data, deploy                 | Guide 2 (UI Stack), Guide 5 (Data Entry), Guide 6 (Error Handling), Guide 7 (Testing) — all remaining guides. |

These guides are living documents. As the experiment progresses and patterns emerge from real implementation, they will be updated. The AI-Assisted Development process defines what to build. These guides define how to build it consistently.
