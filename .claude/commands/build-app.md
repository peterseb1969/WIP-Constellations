Execute Phase 4 (Application Layer) of the AI-Assisted Development process.

## Prerequisites
Phase 3 must be complete with all terminologies, templates, and test documents verified via MCP tools.

**This phase shifts from MCP tools to @wip/client.** The data model is proven. You are now writing application code that end users will interact with. All runtime WIP interactions go through `@wip/client` and `@wip/react` — not MCP tools.

## Critical: Build Incrementally

Phase 4 is the most token-intensive phase. Do NOT attempt to build the entire app in one session. Break it into focused tasks and commit after each:

1. Scaffold the app structure (commit)
2. Build the first page/feature (commit)
3. Build the next page/feature (commit)
4. Add tests (commit)
5. Containerize (commit)

If the context window runs out mid-generation, uncommitted code is lost. Phases 1–3 data is safe in WIP, but UI code only survives in git. Commit early, commit often.

Avoid parallel background agents for code generation — they multiply context consumption and risk exhausting the window before any agent completes.

## Before Writing Any Code
1. Run `/wip-status` to confirm all terminologies and templates from Phase 3 are intact.
2. Read `docs/WIP_DevGuardrails.md` — all seven guides apply in this phase.
3. Read `docs/WIP_ClientLibrary_Spec.md` — understand @wip/client and @wip/react APIs.
4. Confirm the app name, gateway path, and internal port with the user.

## UX Proposal — GATE (requires user approval)

Before writing any component code, propose the UI plan to the user. This is a product decision, not a technical one — the user must approve it, just like the data model in Phase 2.

Present a concise plan covering:
- **Page structure:** What pages/views does the app have? What is the landing page?
- **Navigation:** Sidebar, tabs, top nav? How does the user move between sections?
- **Primary workflows:** What does the user do most? Import data? Browse transactions? View summaries?
- **Key screens:** For each page, describe what the user sees — table, cards, charts, forms?
- **Data entry:** How does data get in? File upload, manual form, paste, API sync?
- **Mobile considerations:** Which pages must work on phone-width screens?

Example format:

```
Statement Manager — UI Plan

Pages:
- Accounts: list of accounts as cards (type, institution, balance, currency)
- Transactions: filterable table (date range, account, category, type, search)
- Payslips: monthly timeline, click to expand line item detail
- Import: upload CSV/PDF, preview parsed data, map columns, confirm

Navigation: sidebar with Accounts / Transactions / Payslips / Import sections
Landing page: Transactions (most frequently used)
Top bar: app name, home link to portal, breadcrumbs
```

**STOP and wait for user approval.** Do not scaffold or write component code until the user approves the UI plan. The user may want a completely different page structure, navigation pattern, or primary workflow than what you propose.

This gate exists because UX decisions are invisible in the data model but determine whether the app is actually usable. A technically correct app with wrong UX decisions wastes the user’s time and the context window.

## Steps

### Step 1: Scaffold the app
Use the app skeleton from Guide 3 of the guardrails:
- Create folder structure (src/, tests/, etc.)
- Create `app-manifest.json` for gateway registration
- Create `.env.example` with WIP connection variables
- Set up `vite.config.ts` with configurable base path
- Set up `tailwind.config.ts` with shared design tokens from Guide 2
- Install dependencies: react, @wip/client, @wip/react, tailwind, shadcn/ui components
- Create the WipProvider + QueryClientProvider setup in App.tsx

### Step 2: Build core pages
For each major feature of the app:
- Use `@wip/react` hooks for data fetching (useDocuments, useTemplate, useTerminology)
- Use `@wip/react` mutations for data creation (useCreateDocument)
- Handle errors using the WipError hierarchy — map to user-facing messages per Guide 6
- Use shadcn/ui components with Tailwind styling per Guide 2 design tokens
- Ensure responsive layout (works at 375px width and up)

### Step 3: Build data entry forms
Follow Guide 5 (Data Entry Patterns):
- For simple forms: use `useFormSchema()` to auto-generate from template
- For specialized UIs (e.g., receipt scanning): build custom forms using @wip/client types
- Term fields → searchable dropdown populated from `useTerminology()`
- Reference fields → search input using `wip.utils.resolveReference()`
- File fields → upload zone using `useUploadFile()`, then link FILE-XXXXXX to document
- Always handle: required field validation, term resolution errors, reference resolution errors

### Step 4: Build list/table views
- Use `useDocuments(templateCode, filters)` for paginated document lists
- Provide filtering by key fields (date ranges, categories, etc.)
- Show loading states, empty states, and error states

### Step 5: Create Dockerfile
Multi-stage build per Guide 3:
- Stage 1: `node:20-alpine` — install deps, build
- Stage 2: `caddy:2-alpine` — serve dist/
- Include Caddyfile for the internal server
- Expose the app's internal port

### Step 6: Write tests
Per Guide 7 (Testing Contract):
- Data layer tests against live WIP (create, version, validate, reference)
- UI component tests (form renders, validation, error display)
- At least one E2E flow (create → view → update)
- Health endpoint returns 200

### Step 7: Verify definition of done
- [ ] All data layer tests pass
- [ ] All UI component tests pass
- [ ] At least one E2E flow works
- [ ] app-manifest.json is valid
- [ ] Health endpoint returns 200
- [ ] All documentation files present and current (see Step 8)

### Step 8: Document the app

Run `/document` to generate all required documentation files:
- README.md — what the app does, how to run it
- ARCHITECTURE.md — page structure, component hierarchy, data flow, key decisions
- WIP_DEPENDENCIES.md — terminologies, templates, cross-app references
- IMPORT_FORMATS.md — supported data formats with column mappings (if applicable)
- KNOWN_ISSUES.md — what's incomplete or intentionally deferred
- CHANGELOG.md — initial entry

Commit:
```
git add apps/{app-name}/*.md
git commit -m "docs: initial documentation for {app-name}"
```

**An undocumented app is an unmaintainable app.** The next session starts cold. Documentation is the app's memory.

## After Phase 4: Iterative Improvement

Once the app passes the definition of done, is documented, and is committed, switch to the `/improve` command for all subsequent work on this app. The `/improve` protocol has different rules than Phase 4 — focused on surgical fixes, not greenfield building.

## Reminders
- All runtime data goes through WIP via @wip/client. No local storage.
- Use the prescribed tech stack. No substitutions.
- Follow the design tokens (colours, typography, spacing) from Guide 2.
- Navigation: top bar with app name, home link to portal, breadcrumbs.
- No custom authentication UI — auth is handled by WIP/gateway.
- If you need to check WIP's current state during development, you can still use MCP tools for quick queries — but the application code itself must use @wip/client.
