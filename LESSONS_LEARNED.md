# Lessons Learned — Constellation Experiment

This is a living document. It captures observations, bugs, and insights from the AI-assisted development experiment as it progresses. Each entry is dated and categorised. The purpose is threefold: improve the development configuration over time, provide evidence for or against the Two Theses, and help future participants avoid known pitfalls.

---

## Entry 001 — 2026-03-13

**Category:** Guardrail correctness
**Phase:** Pre-implementation (MCP server validation)
**Severity:** Critical (silent data corruption)

### What happened

Before any constellation app was built, a cross-audit between the WIP MCP server and WIP's actual API models revealed three field naming discrepancies:

| MCP server said | API actually expects | Consequence |
|---|---|---|
| `subject_term_id`, `object_term_id` | `source_term_id`, `target_term_id` | API rejects — ontology relationship creation fails |
| `required: true` (template fields) | `mandatory: true` | API ignores unknown field — all fields silently become optional |
| `terminology_id` (field reference) | `terminology_ref` | API ignores unknown field — term validation silently disabled |

### Why it matters

The second and third bugs are the worst kind: **silent failures**. WIP's API does not reject unknown fields — it ignores them. This is a reasonable design choice for forward compatibility, but it means a typo in a field name doesn't produce an error. It produces a template that looks correct but doesn't validate anything.

An AI following the MCP server's tool descriptions would have:
1. Created templates where no fields were required (because `required` was ignored, and `mandatory` was never set)
2. Created templates where term fields had no terminology binding (because `terminology_id` was ignored, and `terminology_ref` was never set)
3. Believed everything worked, because the API returned success
4. Produced apps that accept any garbage data without validation

The problem would only surface later, when someone queries the data and wonders why nothing was validated.

### How it was found

One Claude instance (working on the constellation documentation and configuration) flagged the risk that the MCP server and @wip/client might teach the AI different patterns. Another Claude instance (working on the WIP MCP server) was asked to "triple check" consistency. It launched three parallel audit agents against the actual API models, the MCP server tool schemas, and the @wip/client types. The discrepancies were found and fixed before any app was built.

### Lessons

1. **Guardrails must be correct, not just present.** An incorrect MCP tool description is worse than no tool at all — it gives the AI false confidence. The AI won't question a tool's parameter names; it will use them exactly as documented.

2. **Silent acceptance is dangerous.** APIs that ignore unknown fields (rather than rejecting them) create a class of bugs that are invisible at creation time and only manifest as data quality issues downstream. This is not a WIP design flaw — it's a legitimate compatibility strategy — but it means adapters (MCP server, client library) must be exact.

3. **Auto-generate, don't hand-write.** The MCP server's tool parameter schemas were hand-written based on the developer's understanding of the API. The fix is the same as what was specified for @wip/client: generate schemas from WIP's OpenAPI specs, so field names cannot drift. Both the MCP server and the client library should derive their contracts from the same source of truth.

4. **Cross-audit between AI instances is valuable.** The bug was found because two separate Claude instances were asked to verify the same interface from different perspectives. A single instance building and testing in isolation might not have caught it — the MCP server's tests would pass against the MCP server's own expectations, which were consistently wrong.

5. **This is Thesis 2 evidence.** The guardrail architecture (WIP + process + MCP server + client library) works — but only if the guardrails themselves are verified. Correctness doesn't cascade automatically from good intentions. It requires deliberate validation, ideally automated (type generation from shared specs) rather than manual (triple-checking by AI audit agents).

### Action taken

- MCP server tool schemas corrected to match actual API field names.
- Recommendation added to generate MCP tool parameter schemas from WIP's OpenAPI specs (same pipeline as @wip/client type generation).
- This entry created to document the incident for the experiment record.

### Implications for the experiment

This incident occurred *before* the first line of constellation app code was written. It was caught by process, not by accident. This is both encouraging (the process works) and sobering (without the cross-audit, the first app would have shipped with silently broken validation). The question for the experiment going forward: can we make this kind of verification automatic rather than relying on a human asking "are you 100% sure?"

---

## Entry 002 — 2026-03-13

**Category:** Guardrail architecture
**Phase:** Pre-implementation (MCP server hardening)
**Severity:** Structural fix (eliminates a class of bugs)

### What happened

Following the discovery of three field naming bugs in Entry 001, the MCP server was hardened with a Level 2 + Config generation approach. A shared OpenAPI schema cache was also introduced, unifying the source of truth for both the MCP server (Python) and the @wip/client library (TypeScript).

### What was built

**Level 2 + Config generator** (9 minutes of AI implementation time):

| Component | Size | Purpose |
|---|---|---|
| `tools.yaml` | ~90 lines | Hand-authored tool metadata: descriptions, OpenAPI refs, gotcha notes |
| `scripts/generate_schemas.py` | ~290 lines | Fetches OpenAPI specs, resolves $ref chains, generates Python schemas |
| `_generated_schemas.py` | ~3,800 lines (generated) | Resolved JSON schemas + composed descriptions, committed to git |
| `server.py` additions | ~55 lines | `_patch_tool_schemas()` — patches tool parameter schemas at import time |

Of 33 MCP tools, 8 received OpenAPI-enriched schemas (the write tools with complex nested payloads). The remaining 25 read/query tools with scalar parameters were already correct and unchanged.

**Shared schema cache** (follow-up, same session):

```
scripts/update-schemas.sh          ← one script, fetches all 5 WIP services
        ↓
schemas/                           ← committed, version-controlled, shared
  ├── registry.json
  ├── def-store.json
  ├── template-store.json
  ├── document-store.json
  └── reporting-sync.json
        ↓                    ↓
MCP generator (Python)       TS generator (TypeScript)
generate_schemas.py          generate-types.ts --from-cache
        ↓                    ↓
_generated_schemas.py        src/types/generated/*.ts
```

Both adapters now derive field names, types, and descriptions from the same cached JSON files. The workflow is: (1) run `update-schemas.sh` against a live WIP instance, (2) run both generators, (3) commit the cache and generated files. If the two generators ever produce inconsistent output, it's because someone ran step 1 twice against different WIP versions — an intentional act, not an accidental drift.

### What it guarantees

The three bugs from Entry 001 are now **structurally impossible**:

- Field names in MCP tool schemas come from Pydantic models via OpenAPI — not from a human typing them into a docstring. If the API field is `mandatory`, the MCP tool schema says `mandatory`. If the API field is `terminology_ref`, the MCP tool says `terminology_ref`.
- The same guarantee extends to @wip/client's TypeScript types, because both generators read from the same `schemas/` directory.
- The `tools.yaml` config preserves hand-authored descriptions, usage examples, and gotcha warnings. The AI sees correct field names (generated, can't be wrong) AND helpful guidance (authored, can be good).

### What it costs

- Authored code: ~435 lines (generator, config, server patching, shared script)
- Generated code: ~3,800 lines (committed, reviewable, diffable in PRs)
- Maintenance: when a WIP API changes, run `update-schemas.sh` + both generators + commit. Adding a new MCP tool is: add an entry to `tools.yaml`, run the generator.
- Implementation time: 9 minutes of AI time for the generator, plus a short follow-up for the shared cache.

### Lessons

1. **Generate structure, author guidance.** The Level 2 + Config approach splits the problem correctly: schemas (which must be exact) are generated; descriptions (which must be helpful) are authored. Neither alone is sufficient. Generated descriptions are technically correct but unhelpful to an AI ("POST /api/def-store/terminologies"). Authored schemas are helpful but error-prone ("required" instead of "mandatory"). The combination is both.

2. **A shared artifact eliminates accidental divergence.** Before the shared `schemas/` directory, two independent generators fetched from `/openapi.json` at different times. With the cache, they read the same files. Divergence requires an intentional act (re-fetching), not an oversight (fetching at different times against different versions).

3. **The cost of structural prevention is low.** The total implementation was ~435 lines of authored code and 9 minutes of AI time. The cost of *not* doing this — debugging silent validation failures across multiple apps, each using field names that look plausible but are subtly wrong — would have been orders of magnitude higher. Structural prevention is almost always cheaper than detection and repair.

4. **This is strong Thesis 2 evidence.** The guardrail stack now has three layers, each addressing a different failure mode: WIP enforces data correctness (what gets stored), the development process enforces procedural correctness (when things happen), and the generated schemas enforce interface correctness (how the AI and apps communicate with WIP). The third layer was missing at the start of the day and was added within a single session. The platform is getting better at disciplining the AI as the experiment progresses.

### Relationship to Entry 001

Entry 001 found the problem. Entry 002 describes the structural fix. Together they demonstrate the experiment's feedback loop: discover a failure mode, analyse the root cause, implement a prevention mechanism, and document both the problem and the fix for future reference. This loop is the experiment's primary self-improvement mechanism.

---

## Entry 003 — 2026-03-13

**Category:** Process boundary violation
**Phase:** Phase 4 (Application Layer)
**Severity:** Low (inefficiency, not breakage)

### What happened

During Phase 4 (building the Statement Manager UI), the implementation Claude began searching the WIP codebase — grepping for Caddyfile configurations, exploring WIP's internal directory structure — to figure out how the browser-based React app should reach WIP's API services.

### Why it happened

The development guardrails and CLAUDE.md didn't address a practical question: how does a React app on Vite's dev server (port 5173) talk to WIP services on ports 8001–8005? Without explicit guidance, the AI did what seemed logical — looked at how WIP's own Console solves the same problem.

### Why it's wrong

The constellation app should never depend on WIP's internals. The golden rule is "never modify WIP" — but the spirit extends to "never couple to WIP's internal configuration." The app should be deployable against any WIP instance, whether it uses Caddy, Nginx, or no reverse proxy at all.

### Fix

Added "Development proxy configuration" section to Guide 3 (App Skeleton) in the dev guardrails. Vite's built-in proxy handles API routing during development — the app uses relative URLs (`/api/document-store/...`), Vite forwards them to the right port. No CORS, no WIP dependency.

Added explicit prohibition to CLAUDE.md: "Do not explore, grep, or read WIP's source code or Caddy configuration."

### Lesson

When the AI encounters a gap in instructions, it fills it with exploration. This is generally a strength, but it becomes a problem when the exploration crosses a boundary it shouldn't. The fix is to anticipate practical questions and answer them in the guides before the AI has to improvise. Every time the AI goes looking for something outside the constellation repo, that's a signal of a missing instruction.

---

## Entry 004 — 2026-03-13

**Category:** Context window limits
**Phase:** Phase 4 (Application Layer)
**Severity:** Medium (lost work, required restart)

### What happened

During Phase 4, the implementation Claude used background agents to build multiple parts of the Statement Manager app in parallel. The agents did not complete before the context window was exhausted. The entire app had to be recreated from scratch in a new session.

### Why it matters

Phases 1–3 are durable — terminologies, templates, and test documents live in WIP and survive context resets. Phase 4 (application code) is not durable until it’s written to files in the repo. If the context runs out mid-generation, uncommitted code is lost.

Phase 4 is also the most token-intensive phase by far. Phases 1–3 involve compact MCP tool calls and structured data model discussions. Phase 4 involves generating hundreds of lines of React components, hooks, configuration files, and tests. A full app can easily exceed the context window if attempted in one session.

### What was recovered

The new session ran `/wip-status`, confirmed all terminologies and templates were intact in WIP, and restarted Phase 4 from the scaffolding step. The data layer work from Phase 3 was not lost — only the UI code needed to be regenerated.

### Lessons

1. **Phase 4 should be incremental, not monolithic.** Don’t ask the AI to build the entire app in one session. Break it into focused tasks: scaffold first, then accounts page, then transactions page, then payslips page, then import flow. Commit after each.

2. **Commit early and often.** After each working feature, commit to git. This makes context resets recoverable — the next session picks up from the last commit, not from zero.

3. **Be cautious with background agents.** Parallel generation sounds efficient but multiplies context consumption. Sequential, focused work with intermediate commits is safer.

4. **Phases 1–3 are resilient by design.** WIP’s persistence means the data layer survives any client-side failure — context resets, crashed sessions, lost files. This is an underappreciated benefit of the “never bypass WIP” rule: your data model work is always safe.

---

## Entry 005 — 2026-03-13

**Category:** Missing gate
**Phase:** Phase 4 (Application Layer)
**Severity:** Medium (wasted work, wrong product)

### What happened

During Phase 4, the implementation Claude built the entire Statement Manager UI without asking a single question about UX or user interaction design. It made every product decision autonomously: page structure, navigation pattern, primary workflow, data display format, import flow.

### Why it happened

The development process has an explicit approval gate for the data model (Phase 2) but no equivalent for UX (Phase 4). The Dev Guardrails specify *what to build with* (React, shadcn/ui, Tailwind, design tokens) but not *what to build*. The use case documents describe data models and analytical capabilities, not user interactions or workflows.

Given clear technical constraints and no UX guidance, the AI did the rational thing: it made reasonable default choices and kept building. It didn’t ask because nothing in its instructions told it to ask.

### Why it matters

Data model mistakes are caught by WIP — validation errors, reference resolution failures, and identity hash collisions surface immediately. UX mistakes are invisible to the system. A technically correct app that shows a dashboard when the user wanted a transaction table, or that buries the import flow three clicks deep when it’s the primary task, is a app that the user doesn’t want to use. And unlike a bad field name, a bad page structure costs hundreds of lines of generated code to redo — potentially exhausting the context window (see Entry 004).

### Fix

Added a UX proposal gate to the `/build-app` command. Before writing any component code, the AI must present a concise UI plan (pages, navigation, workflows, key screens, data entry patterns) and wait for explicit user approval. The format is lightweight — about ten lines of text, not wireframes — but enough for the user to say "no, transactions should be the landing page" before 200 lines of dashboard code are generated.

### Lessons

1. **Gates are needed wherever the human has an opinion.** Phase 2’s data model gate works because data models are decisions the human cares about. UX is equally opinionated — everyone has preferences about how their tools look and feel. The absence of a gate meant the AI treated UX as a technical decision (like choosing a port number) rather than a product decision (like choosing identity fields).

2. **The guardrails doc constrains tools, not design.** "Use shadcn/ui" tells the AI which buttons to use, not where to put them. Tool constraints and design approval are complementary — you need both.

3. **Cheap decisions should still be confirmed.** A ten-line UI plan costs almost nothing in context tokens. A full app rebuild after the user says "that’s not what I wanted" costs everything. The asymmetry strongly favours asking first.

4. **This mirrors real software development.** No competent human developer would build an entire UI without checking with the stakeholder on page structure and workflows. The AI should be held to the same standard.

---

## Entry 006 — 2026-03-13

**Category:** Correction to Entry 001
**Phase:** Pre-implementation
**Severity:** Informational (corrects the narrative, not the fix)

### What happened

Entry 001 stated that WIP's API "does not reject unknown fields — it ignores them." This was wrong. Investigation by the WIP-side Claude confirmed that strict validation has been in place since February 2025:

- All write models across all 5 services inherit from `StrictModel` which sets `extra='forbid'`. Unknown JSON fields return HTTP 422.
- Three services have `RejectUnknownQueryParamsMiddleware` that rejects undeclared query parameters with HTTP 422.

There was no regression. The strict validation was intact throughout.

### Why the original assessment was wrong

The three MCP server bugs (`required` vs `mandatory`, `terminology_id` vs `terminology_ref`, `subject_term_id` vs `source_term_id`) were in **tool descriptions** — the documentation text the AI reads to understand what parameters to use. They were never tested against a live WIP instance. If an AI had actually called `create_template` with `required: true` in a field definition, WIP would have returned HTTP 422, and the bug would have been caught immediately.

The cross-audit between two Claude instances found the bugs by comparing field names in docstrings against field names in Pydantic models. A simpler test — actually calling the API with the documented parameters — would have caught them just as effectively.

### Corrected lesson

The original Entry 001 lesson 2 ("Silent acceptance is dangerous") was based on a false premise. The corrected lesson:

**We shipped documentation without running it.** The MCP server’s tool descriptions were hand-written from memory of the API, not tested against it. The API’s strict validation was the safety net that would have caught every bug on first contact. The schema generation pipeline (Entry 002) is still the right fix, but for a more precise reason: it ensures documentation is *derived from* the code that enforces validation, making it structurally impossible for the two to diverge.

Both layers are now correct and complementary:
1. **Prevention:** MCP tool schemas are generated from OpenAPI specs — wrong field names can’t enter the documentation
2. **Defense in depth:** WIP’s API rejects unknown fields with HTTP 422 — if a wrong field name somehow gets through, the API catches it immediately

### Meta-lesson

This correction itself is valuable. The original Entry 001 narrative ("WIP silently accepts garbage") sounded plausible, was stated confidently, and would have been believed by anyone reading the lessons learned. It was wrong. The AI that wrote the original assessment didn’t verify — it inferred API behavior from the symptom (bugs existed, therefore the API must not validate). The correction came from a different AI instance that actually checked the code.

**Verify claims about system behavior by inspecting the system, not by inferring from symptoms.** This applies to AI-generated analysis as much as it applies to AI-generated code.

---

## Entry 007 — 2026-03-13

**Category:** Library evolution driven by first consumer
**Phase:** Phase 4 (Application Layer) / cross-cutting
**Severity:** Medium (blocked app development, revealed architectural issue)

### What happened

The Statement Manager needed to filter transactions by account — a basic requirement for any financial app. The `@wip/client` library exposed a `queryDocuments()` method, but its parameter type was `Record<string, unknown>` (accept anything), and `@wip/react` had no hook for filtered document queries. The implementation Claude worked around this with client-side filtering — fetching all documents and filtering in the browser.

The WIP-side Claude was asked to fix the library. Three changes to `@wip/client` and one addition to `@wip/react`:

| Change | What | Impact |
|---|---|---|
| Added `QueryFilter`, `QueryFilterOperator`, `DocumentQueryRequest` types | Typed the filter interface | Compile-time validation of filter field names and operators |
| Typed `queryDocuments()` parameter | `Record<string, unknown>` → `DocumentQueryRequest` | Wrong field names now caught at compile time |
| Fixed `resolve-reference.ts` | Wrong field name in search parameter | **Another silent bug** — same class as MCP server Entry 001 |
| Added `useQueryDocuments` hook to `@wip/react` | Field-level filtering with AND logic, pagination, sorting | Constellation apps can filter server-side |

The constellation Claude immediately replaced its client-side filtering hack with `useQueryDocuments`, which does server-side filtering — correct architecture that will actually work at real data volumes.

### The recurring bug pattern

This is the third time the same class of bug appeared:

| Entry | Where | Bug | Root cause |
|---|---|---|---|
| 001 | MCP server tool descriptions | `required` instead of `mandatory` | Hand-written docstrings |
| 001 | MCP server tool descriptions | `terminology_id` instead of `terminology_ref` | Hand-written docstrings |
| 007 | @wip/client `resolve-reference.ts` | Wrong field name in search parameter | Loose typing (`Record<string, unknown>`) |

The pattern is now a rule: **anywhere an interface between an adapter and WIP's API uses loose types (`Record<string, unknown>`, `any`, `dict`), there is a potential silent field-name bug.** Strict types are the fix at every layer. The MCP server now uses generated schemas from OpenAPI. The client library now uses typed request objects. Both prevent the same class of bug through different mechanisms (generation vs. compile-time checking).

### The library-consumer feedback loop

The `@wip/client` specification was written before any real consumer existed. The Statement Manager is the first app to actually use `queryDocuments` with field-level filters, and it discovered that the capability wasn't properly exposed. This is not a failure of the spec — it's the spec being validated by use.

This feedback loop was predicted in the client library spec: *"The Financial constellation's Statement Manager is the first real consumer of @wip/client. The constellation experiment both drives and validates the client library."* It happened exactly as expected. The library grew a typed filter interface because the first app needed it.

The pattern will repeat. Each new app will discover library gaps — the Receipt Scanner will likely need bulk import helpers, the Investment Tracker will need market data integration patterns. Each gap, when filled, benefits every subsequent app. The library matures through use, not through anticipation.

### Lessons

1. **Loose types hide bugs. Strict types catch them.** `Record<string, unknown>` is TypeScript for "I trust the caller to get it right." The caller (whether human or AI) will not always get it right. Typed request objects (`DocumentQueryRequest`) make wrong field names a compile error instead of a runtime mystery.

2. **Client-side filtering is an architectural smell.** When an app fetches all documents and filters in the browser, it usually means the library or API doesn't expose the right query capability. The fix is upstream (expose server-side filtering), not downstream (optimize the browser filter). With 5 test documents, client-side filtering works fine. With 5,000 real transactions, it doesn't.

3. **The first consumer is the most important consumer.** A library designed in isolation will have gaps. The first real app that uses it discovers those gaps under realistic conditions. Plan for the library to evolve during the first app's development — and make that evolution easy (the WIP-side Claude fixed it in 3 minutes).

4. **Two Claude instances collaborating across repos works.** The constellation Claude hit a library limitation, the human relayed it to the WIP Claude, the WIP Claude fixed the library and tightened the types, the constellation Claude immediately used the improvement. The round-trip took minutes. This is a viable development workflow — not just for AI, but for any situation where a platform team and an app team need to iterate together.

---

## Entry 008 — 2026-03-13

**Category:** Missing artifact
**Phase:** Phase 3 (Implementation)
**Severity:** High (data model not reproducible)

### What happened

After completing Phase 3, five terminologies and four templates existed in WIP. The Statement Manager app was being built against them. But nothing in the git repository could recreate those terminologies and templates on a fresh WIP instance. If the database were lost, or someone cloned the repo to replicate the experiment, they would have no executable way to set up the data model.

The data model was *documented* (in the use case docs and in the Phase 2 proposal), but not *codified* as executable seed files.

### Why it happened

The development process creates WIP entities via MCP tools during Phase 3, which is interactive and efficient. But MCP tool calls are ephemeral — they execute against the running instance and leave no artifact in the repo. The process had no step that said "now capture what you just created as files in git."

### Fix

Two new slash commands:

- `/export-model` — reads the current WIP state via MCP tools and writes declarative JSON seed files to `data-model/` (terminologies, templates, optionally sample documents). Run after every Phase 3 completion.
- `/bootstrap` — reads seed files from `data-model/` and creates everything in a fresh WIP instance. Idempotent — safe to re-run. Skips entities that already exist.

The `/implement` command now has a mandatory Step 7: "Export data model to seed files and commit."

### Lessons

1. **Interactive creation is the fast path. Version-controlled files are the durable path. You need both.** MCP tools are excellent for exploratory creation with immediate feedback. But the result must be captured as files in git, or it exists only in the running instance.

2. **Reproducibility is not optional.** A project that can’t be set up from a clean clone is a project that dies with its original instance. Seed files make the data model as reproducible as the application code.

3. **This is the database migration problem, reframed.** In traditional development, you don’t create tables by typing SQL into a live database and hoping someone remembers the schema. You write migration files. The `data-model/` directory is the WIP equivalent of a migrations folder — declarative, version-controlled, and executable.

---

## Entry 009 — 2026-03-13

**Category:** Missing artifact
**Phase:** Post Phase 4 (Maintainability)
**Severity:** High (threatens long-term viability of the ecosystem)

### What happened

After the Statement Manager was built and running, the question arose: how does the next Claude session (or a human developer) understand this app well enough to improve it without introducing regressions or contradicting earlier decisions?

The app had code in git. It had seed files for the data model. It had the dev guardrails for stack conventions. But it had no app-specific documentation explaining: what pages exist and why, how the components are structured, which WIP entities it depends on, what import formats are supported and how columns map to fields, what’s known to be broken or intentionally deferred, and what changed over time.

### Why it matters more for AI-built apps

A human developer who built an app last week remembers the architecture. They remember why the navigation works this way, which edge case the import parser doesn’t handle, and which known bug they intentionally deferred. They carry that context in their head.

An AI has no memory between sessions. Every session starts from zero. Without documentation, the AI must re-derive the architecture from source files, which is slow, error-prone, and context-intensive. Worse, it may make changes that contradict decisions from previous sessions — not because the decisions were wrong, but because it doesn’t know they were made.

This makes documentation more critical for AI-built apps than for human-built apps. Documentation is the mechanism that gives an amnesiac builder continuity across sessions.

### Fix

A new `/document` command generates and maintains a standardized documentation set for every app:

- `README.md` — what the app does, how to run it, prerequisites
- `ARCHITECTURE.md` — page structure, component hierarchy, data flow, key decisions with rationale
- `WIP_DEPENDENCIES.md` — which terminologies, templates, and cross-app references the app uses (the contract between the app and WIP)
- `IMPORT_FORMATS.md` — supported data formats with column mappings and transformations
- `KNOWN_ISSUES.md` — what’s incomplete, broken, or intentionally deferred
- `CHANGELOG.md` — what changed, when, and why

The `/build-app` command now includes Step 8 (document the app) before transition to improvement. The `/improve` command now includes Step 7 (update relevant docs with every change). Documentation is part of the definition of done, not an afterthought.

### Lessons

1. **Documentation is the app’s memory.** For AI-built apps, this is literal: without docs, the builder has amnesia. With docs, the builder has continuity. The difference between a maintainable app and a disposable demo is whether the next session can understand it without reading every source file.

2. **The seed files closed one gap; this closes the rest.** `data-model/` makes the data layer reproducible. App documentation makes the application layer understandable. Together, they make the entire app self-contained: clone the repo, run `/bootstrap`, read the docs, and you’re productive.

3. **Document decisions, not just structure.** ARCHITECTURE.md’s most important content is the “why”: why this navigation pattern, why this filter approach, why this import strategy. Without “why,” the next session will reconsider every decision. With “why,” it can focus on what actually needs changing.

4. **WIP_DEPENDENCIES.md is the cross-app contract.** When building the second app, the developer (human or AI) needs to know exactly what the first app created in WIP and how it’s structured. This file is what makes `/add-app` work efficiently — it’s the inventory of reusable entities.

---

*Add new entries below. Use sequential numbering (Entry 010, 011, etc.) and include date, category, phase, and severity.*
