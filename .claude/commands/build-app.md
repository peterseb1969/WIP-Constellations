Execute Phase 4 (Application Layer) of the AI-Assisted Development process.

## Prerequisites
Phase 3 must be complete with all terminologies, templates, and test documents verified via MCP tools.

**This phase shifts from MCP tools to @wip/client.** The data model is proven. You are now writing application code that end users will interact with. All runtime WIP interactions go through `@wip/client` and `@wip/react` — not MCP tools.

## Before Writing Any Code
1. Read `docs/WIP_DevGuardrails.md` — all seven guides apply in this phase.
2. Read `docs/WIP_ClientLibrary_Spec.md` — understand @wip/client and @wip/react APIs.
3. Confirm the app name, gateway path, and internal port with the user.

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
- [ ] README documents what the app does, what WIP templates it uses, how to run it

## Reminders
- All runtime data goes through WIP via @wip/client. No local storage.
- Use the prescribed tech stack. No substitutions.
- Follow the design tokens (colours, typography, spacing) from Guide 2.
- Navigation: top bar with app name, home link to portal, breadcrumbs.
- No custom authentication UI — auth is handled by WIP/gateway.
- If you need to check WIP's current state during development, you can still use MCP tools for quick queries — but the application code itself must use @wip/client.
