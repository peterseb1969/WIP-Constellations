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

## Entry 010 — 2026-03-13

**Category:** Emergent capability
**Phase:** N/A (architectural realisation, not a process step)
**Severity:** N/A (not a bug — the most important insight of day one)

### What happened

At the end of day one, after all the bug fixes, process improvements, and documentation work, we noticed something that reframes the entire project.

The WIP MCP server was built as a development tool for Phases 1–3 — a way for the AI to create terminologies and templates without composing HTTP calls. But MCP is an open protocol. Any AI assistant that speaks it can connect. And the tools the server exposes — `query_documents`, `search_terms`, `get_ontology_relationships` — are not development-specific. They are a general-purpose AI interface to all data in WIP.

This means the "BI layer" described in every constellation use case document — the dashboards, the SQL queries, the Metabase configuration — is not an application that needs to be built. It is any AI assistant connected to WIP via MCP.

A user doesn’t build dashboards. They ask: *"How much did I spend on groceries last month?"* The AI queries WIP and answers. They ask: *"Should I replace my windows?"* The AI queries energy data, equipment specs, financial records, construction costs, subsidy programmes, and property valuations — and gives a reasoned answer from their data.

### Why this matters

This shifts the product from "a platform for building interconnected apps" to "a platform that lets you talk to your own data." The audience shifts from developers to everyone.

The apps become the **input layer** — they get data in, structured and validated. WIP becomes the **integration layer** — it connects data across domains. The MCP server becomes the **output layer** — any AI gets insight out, in natural language.

And WIP’s structure — the same terminologies, templates, references, and validation that we’ve been building all day — is what makes the AI’s answers trustworthy. An AI querying unstructured files guesses and hallucinates. An AI querying WIP gets standardised vocabularies, validated schemas, verified references, and version history. Structure makes conversational data access reliable, not just impressive.

### What this means for the experiment

The two original theses (shared backend value + AI guardrails) are still valid and still being tested. But there is now an emergent third proposition: **the combination of structured personal data (WIP) and conversational AI access (MCP) creates a personal data assistant that doesn’t exist today.**

Not Siri. Not Alexa. Not ChatGPT with uploaded files. A persistent, growing, validated knowledge base about your own life — financial, operational, physical — that an AI can reason over accurately because the data is structured, not because the AI is clever.

### Lessons

1. **Build infrastructure for the right reasons, and unexpected capabilities emerge.** The MCP server was built to make AI development faster. It turned out to be the user-facing query interface. The schema validation was built to prevent AI coding errors. It turned out to be what makes conversational data access trustworthy. Neither was planned; both emerged from structural decisions.

2. **The three-layer model (apps → WIP → AI) is the product architecture.** Not apps alone. Not WIP alone. Not AI alone. The combination. Each layer has a clear role: input, integration, output. Remove any one and the system is dramatically less valuable.

3. **This reframes who the user is.** The constellation documents were written for a technical audience: developers, data scientists, tinkerers. The conversational access layer makes the user anyone who has data and questions. The apps need to be simple enough for data entry. The AI handles the complexity of analysis.

---

## Entry 011 — 2026-03-14

**Category:** Experimental methodology
**Phase:** Between Day 1 and Day 2
**Severity:** N/A (not a bug — a process decision)

### What happened

At the end of Day 1, the Statement Manager was working: importing UBS CSVs and Yuh PDFs, displaying transactions, managing accounts and payslips. The decision was made to discard the app code and rebuild from scratch on Day 2.

### Why

The app was not rebuilt because it was broken. It was rebuilt because it was built against an evolving process. During Day 1:

- CLAUDE.md was revised multiple times
- Slash commands were added mid-session (/improve, /document, /export-model, /bootstrap)
- The UX approval gate was defined after the UI was already built
- The documentation standard was created after the app was running
- The Vite proxy configuration was discovered by exploration, then documented as guidance
- The MCP server’s schemas were corrected during development
- The @wip/client library grew new capabilities mid-build
- The data model seed files were conceived after the data model was already in WIP

The resulting app was a product of the calibration process, not of the calibrated process. Testing the current process requires running it clean.

### What was preserved

Everything durable:
- The data model in WIP (5 terminologies, 4 templates) — stable and tested
- Seed files in `data-model/` — can reproduce the model on any instance
- CLAUDE.md, 10 slash commands, dev guardrails — finalized
- MCP server with generated schemas — proven
- @wip/client and @wip/react — proven
- 10 lessons learned entries — documented

### What was discarded

Only the app code (the React UI, import parsers, components). This is the one artifact that was built before the process, guardrails, and libraries stabilized.

### Lessons

1. **Distinguish calibration from measurement.** Day 1 was calibration: building and tuning the instruments (process, guardrails, tools) while simultaneously producing a result (the app). The result is tainted by the calibration. Day 2 is measurement: running the stabilized instruments to see what they produce. Only the measurement counts as evidence.

2. **Rebuilding is cheap when the foundation is durable.** The data model survives in WIP. The seed files survive in git. The process survives in CLAUDE.md and the commands. The practical lessons survive in LESSONS_LEARNED.md. Only the most ephemeral artifact — UI code — needs to be regenerated. The architecture is designed so that the cheapest thing to rebuild is the thing most likely to need rebuilding.

3. **This validates the process’s layered durability model.** WIP stores data (survives everything). Git stores code and config (survives context resets). LESSONS_LEARNED.md stores experience (survives session boundaries). Only in-flight, uncommitted code is truly ephemeral. The restart proves that the layers work: nothing of lasting value was lost.

---

## Entry 012 — 2026-03-14

**Category:** Architecture tension
**Phase:** N/A (fundamental design tradeoff)
**Severity:** High (credibility risk if not addressed transparently)

### What happened

After the Day 1 realisation that the MCP server turns WIP into a conversational personal data assistant (Entry 010), a follow-up question surfaced: where does the data go when you "talk to your data"?

The answer: to the cloud AI provider's servers.

WIP keeps data sovereign at rest — on the Raspberry Pi, in the user's home, under their control. But conversational access through a cloud-hosted AI (Claude, GPT, etc.) requires the queried data to be sent to the AI provider for processing. "How much did I spend on groceries?" sends actual transaction data to Anthropic. "Should I replace my windows?" sends energy consumption, financial details, and property information.

This is not a security vulnerability. It is the normal operation of cloud AI. But it creates a tension with the data sovereignty narrative that is central to WIP's identity.

### Why this matters for the project

The people most attracted to "personal data on a Raspberry Pi" are privacy-conscious users who specifically want to avoid their data flowing through cloud services. If the project pitches data sovereignty and then quietly requires cloud AI for its most compelling feature, the credibility loss is severe and potentially fatal to adoption.

### The honest position

Stated plainly across all public-facing documents:

1. **WIP provides sovereignty at rest.** Your Pi is the source of truth. No cloud service has a persistent copy of your database.
2. **Conversational queries via cloud AI expose data in transit.** The data leaves your home for the duration of the query. This is no worse than using a banking app (which also sends data to remote servers), but it should be a conscious choice.
3. **Local AI models are the structural solution.** Models running on-device speak the same MCP protocol. When local models become capable of multi-tool reasoning, the data never leaves the home network. WIP is ready for this today — nothing changes except which AI connects.
4. **Non-AI access is fully private.** Using WIP’s apps directly, querying via SQL, or browsing the Console involves zero cloud exposure. The conversational layer is opt-in, not mandatory.

### Where this was documented

- WIP_TwoTheses.md: new section "The Honest Tradeoff: Data Sovereignty vs. Conversational Access"
- WIP_Journey.md: new section "The Uncomfortable Truth About Talk to Your Data"
- WIP_Journey_NonTech_EN.md: new section "An Honest Word About Privacy"
- WIP_Journey_NonTech_DE.md: new section "Ein ehrliches Wort zum Datenschutz"

### Lessons

1. **State tensions honestly in the documents that pitch the vision.** Not in a footnote. Not in a FAQ. In the main narrative, adjacent to the feature that creates the tension. Readers who discover the tradeoff themselves will feel misled. Readers who are told upfront will feel respected.

2. **Design for the future, be honest about the present.** The architecture supports full sovereignty (local AI via MCP). The present reality doesn’t (cloud AI is needed for complex reasoning). Stating both — the aspiration and the current limitation — is more credible than either alone.

3. **The tradeoff is the user’s to make, not ours to hide.** Some users will happily send financial data to a cloud AI (they already do this with banking apps). Others won’t. The system should support both choices transparently.

---

## Entry 013 — 2026-03-14

**Category:** Runtime environment mismatch
**Phase:** Phase 4 (Application Layer)
**Severity:** High (parsers had to be rewritten)

### What happened

Three PDF parsers were developed and tested in Node.js using pdf-parse. They worked perfectly against all sample files. When wired into the browser-based React app, pdf-parse crashed immediately: `fs.readFileSync is not a function`. The library uses Node.js file system APIs at module load time.

The fix (switching to pdfjs-dist) resolved the crash but produced cleaner text output — spaces between fields that were previously glued together, proper Unicode instead of encoding artifacts. Every regex that had been carefully built and tested against pdf-parse’s glued output was now wrong. Both the Yuh and employer parsers had to be rewritten.

### Lesson

Day 1’s rule was: "test extraction before writing parsers." Day 2 proved this needs an addendum: **test extraction in the runtime environment.** Node.js and browser are different platforms. A library that works in one may crash in the other, and even when both work, they may produce different output. The extraction-first rule must be applied in the environment where the parser will actually run.

### Action

Updated CLAUDE.md and `/build-app` Step 3b to specify: if the app is browser-based, test extraction in the browser, not in Node.js terminal.

---

## Entry 014 — 2026-03-14

**Category:** Platform bug discovered by app
**Phase:** Phase 4 (Application Layer) / cross-cutting
**Severity:** High (data corruption — duplicate versions visible to users)

### What happened

WIP’s `queryDocuments` endpoint returned all document versions (active and inactive) by default. The `listDocuments` endpoint had `latest_only: true` support, but `queryDocuments` — which is used for server-side filtering with operators (greater than, contains, empty) — did not.

This meant the Transactions page showed duplicate entries for every re-imported transaction. The constellation Claude attempted three workarounds before the root cause was identified:
1. Added `latest_only: true` → 422 error (not supported on query endpoint)
2. Client-side dedup (keep highest version per document_id) → wrong totals, broken pagination
3. Unique React key with version appended → cosmetic fix only

The user escalated to WIP-Claude, which diagnosed the root cause: old versions are marked `status=INACTIVE` during upsert, but queryDocuments didn’t filter by status. Fix: default queryDocuments to `status=ACTIVE`. Deployed in minutes.

In the same session, WIP-Claude also fixed the bulk upsert race condition (duplicate identity hashes in the same batch referencing a stale version snapshot). Both fixes benefit all future apps.

### Lesson

The app-discovers-platform-bug pattern is now a proven feedback loop. Three occurrences across Day 1 and Day 2. Each time: app hits unexpected behaviour → constellation Claude attempts workaround → root cause identified → WIP-Claude fixes upstream → app simplifies → all future apps benefit.

This validates the Two Theses model: the first app is the most expensive to build because it surfaces every platform gap. Each subsequent app is cheaper because the gaps have been filled.

---

## Entry 015 — 2026-03-14

**Category:** Process deviation under pressure
**Phase:** Phase 4 (Application Layer)
**Severity:** Low (no data loss, but process was violated)

### What happened

Under context pressure, the constellation Claude jumped from Step 1 (scaffold) to Step 5 (Dockerfile), skipping Steps 2–4 (build core pages, data entry forms, list views). Its reasoning: "The previous session was running out of context and tried to get the Dockerfile in before it died — prioritising ‘something committed’ over following the order."

Similarly, all five pages were batched into a single commit rather than individual commits per feature.

### Lesson

The incremental build rule ("one feature, commit, next feature") makes context exhaustion survivable — committed work persists. But it doesn’t prevent out-of-order execution. Under time pressure, the AI optimises for "maximise committed artifacts" rather than "follow the prescribed order." This is rational self-preservation that violates the process.

The fix is not better instructions — the instructions are clear. The fix is smaller sessions. If each session targets one or two steps, the AI never faces the "I’m running out, what should I prioritise?" decision.

---

## Entry 016 — 2026-03-14

**Category:** Silent failure in container deployment
**Phase:** Containerisation
**Severity:** Medium (app renders but shows no data — zero errors visible)

### What happened

The containerised Statement Manager rendered perfectly — sidebar, dashboard cards, navigation — but showed zero data. No API calls appeared in the browser’s Network tab. No errors appeared in the Console. The app looked functional but was completely inert.

Root cause: `@wip/client`’s HTTP layer constructs URLs with `new URL(fullUrl)` where `fullUrl` is `${baseUrl}${path}`. When `baseUrl` is empty string, `fullUrl` becomes a relative path like `/api/document-store/...`. `new URL("/api/...")` without a base throws a `TypeError` because the URL constructor requires an absolute URL. This error was silently swallowed by the query layer, producing zero requests and zero errors.

The fix in the app: when `wipApiUrl` from config.json is empty, fall back to `window.location.origin`. This gives the URL constructor an absolute base, and Caddy’s reverse proxy routes `/api/*` to WIP services.

### Lesson

1. **Silent failures are the hardest to debug.** An app that crashes is easy to fix — the error points to the problem. An app that renders correctly but silently does nothing is much harder. The zero-errors, zero-requests, zero-data symptom had no obvious cause without tracing through the URL construction logic.

2. **This is a @wip/client improvement opportunity.** The client library should handle empty `baseUrl` gracefully — either by defaulting to `window.location.origin` in browser environments, or by throwing a clear error at construction time. The current behaviour (silently failing on every request) is the worst possible outcome.

3. **Container testing must include data verification.** "The container starts and serves HTML" is not a sufficient test. "The container starts, serves HTML, and displays real data from WIP" is the actual test. The health endpoint returned OK while the app was completely non-functional.

---

## Entry 017 — 2026-03-15

**Category:** Narrative and positioning
**Phase:** N/A (meta-level reflection)
**Severity:** N/A (not a bug — sharpened the project’s story)

### What happened

A fresh Claude instance with no investment in WIP’s success was asked to challenge the project’s viability with six adversarial arguments. The human defended each, conceding honestly where the critique was valid and arguing back where it wasn’t.

### Key outcomes

1. **"The constraint is the feature"** emerged as WIP’s strongest pitch. WIP’s value isn’t that it enables something technically impossible — it’s that it makes the right thing the only path. You can’t skip the terminology, can’t skip the template, can’t store unvalidated data. The discipline is the point.

2. **The Registry was reframed.** Its value isn’t future federation — it’s that you almost never own your own data. Your bank owns your account IDs. Your employer owns your payroll codes. Every app that integrates external data solves the foreign ID problem badly. The Registry solves it systematically, from day one.

3. **The audience was honestly scoped.** WIP is an experiment building evidence, not a product claiming a market. Clinical trial operations is the beachhead domain. Hobbyists are invited to follow along, not sold a product.

4. **Hardware requirements need honesty.** "Runs on a Raspberry Pi" must specify Pi 5, 8GB, SSD. The performance story collapses without these, and burying the requirement means bad first experiences.

5. **The never-delete principle needs an escape valve.** Optional archiving and hard-deletion of inactive versions, while keeping soft-delete as the default.

### Lesson

**Adversarial review by a disinterested party is the fastest way to sharpen a narrative.** The Critical Claude had no stake in WIP’s success and asked questions the builder would never ask themselves. Five of six challenges were defended, but the defenses produced better arguments than the original documentation contained. The FAQ, the "constraint is the feature" framing, the Registry reframing, and the honest audience scoping all came from this session.

This is the intellectual equivalent of Entry 001’s cross-audit: two perspectives are more valuable than one, especially when one is adversarial.

---

## Entry 018 — 2026-03-16

**Category:** Deployment gap — seed files coupled to MCP
**Phase:** Deployment
**Severity:** High (deployment without Claude is impossible)

### What happened

The seed files (terminologies and templates) used a custom format designed for the `/bootstrap` MCP command to translate. The format used `code` instead of `value`, embedded terms inline in a flat structure, and assumed the MCP server would restructure the data before calling the API.

When deploying to the Raspberry Pi without a Claude instance, the seed files couldn’t be loaded with simple curl commands. The API rejected them: wrong field names, wrong structure, wrong endpoint.

### Root cause

The seed file format was designed for developer convenience during the MCP-driven build process, not for standalone deployment. Nobody tested deployment without Claude until Day 4.

### Fix

1. Reformatted all seed files to match the WIP API’s import/export format (`value` instead of `code`, `{ "terminology": {...}, "terms": [...] }` wrapping)
2. Created `data-model/bootstrap.sh` — a shell script that loads all seed files via curl
3. Verified the format against a live WIP instance using MCP before pushing

### Lesson

**If a distributable container can’t bootstrap its own data model without an AI assistant, it’s not distributable.** Seed files must match the actual API format. The bootstrap process must be a script, not a Claude session. Test deployment on fresh hardware, not just on the development machine.

---

## Entry 019 — 2026-03-16

**Category:** Platform bug — template cache ignores version lifecycle
**Phase:** Deployment / runtime
**Severity:** High (template updates have no effect without service restart)

### What happened

The document store permanently caches template definitions by `template_id`. When `template_version` is omitted from a document creation request, the cache key is just `template_id` — so the first version fetched is returned forever, even after that version is deactivated and a newer version is created.

This caused a 25-minute debugging session: the FIN_IMPORT template’s v1 had `file_config: { allowed_types: ["application/pdf"] }`. After creating v2 with CSV support and deactivating v1, the document store still validated against the cached v1. Only a service restart cleared the cache.

### Root cause

The cache assumes templates are immutable — which is true for a specific (template_id, version) pair, but not for the "latest active version" resolution. The unversioned cache key conflates two different operations: "give me this exact template" (immutable, cacheable forever) and "give me the latest active version" (dynamic, should not be permanently cached).

### Fix

WIP-Claude committed a fix: unversioned lookups are not permanently cached (or use a short TTL). Versioned lookups remain permanently cached. Testing pending.

### Lesson

1. **Always pass `template_version` explicitly.** The app now includes `template_version` from the resolved template in every document creation call. This is defensive — even after the cache fix, pinning the version makes behaviour deterministic.
2. **"Immutable" has scope.** A specific template version is immutable. "The latest version of this template" is not. Cache invalidation must respect the difference.
3. **Deploy on fresh hardware before declaring done.** This bug existed on the Mac but was invisible because the template was created correctly the first time. Only the Pi’s bootstrap-then-update sequence exposed it.

---

## Entry 020 — 2026-03-16

**Category:** Process gap — AI using raw curl instead of client library
**Phase:** Deployment / operational
**Severity:** Medium (wastes time, increases error surface)

### What happened

Constellation-Claude needed to deactivate a template version on the Pi. Instead of using `@wip/client` (which handles WIP’s bulk-first convention, URL construction, and authentication), it guessed at curl endpoints. Four attempts failed: `DELETE /templates/{id}`, `DELETE /templates/{id}?version=1`, `DELETE /templates/{id}/versions/1`, direct port access. All returned 405 Method Not Allowed.

The correct endpoint is `DELETE /templates` with a JSON body array — WIP’s bulk-first convention. `@wip/client` handles this transparently: `client.templates.deleteTemplate(id, { version: 1 })`.

### Root cause

CLAUDE.md says "never change WIP" but doesn’t provide guidance on operational tasks. When the AI needs to perform a one-off WIP operation, the natural instinct is to use curl — but WIP’s API conventions (bulk-first, no ID in URL for writes) are unintuitive without the library.

### Fix

CLAUDE.md updated with WIP Access Rules section: always use `@wip/client` for WIP operations, even ad-hoc ones. Write a small Node script if needed — don’t guess at curl endpoints.

### Lesson

**The client library exists for a reason.** WIP’s API conventions are consistent but unconventional. Any consumer that bypasses the library will waste time rediscovering the conventions. This applies to AI assistants as much as human developers.

---

## Entry 021 — 2026-03-17

**Category:** Performance regression — cache fix overcorrection
**Phase:** Platform (cross-cutting)
**Severity:** Critical (6x throughput regression: 615 → 84 docs/sec)

### What happened

Entry 019’s template cache fix (don’t permanently cache unversioned template lookups) was correct in diagnosis but too aggressive in implementation. It disabled caching entirely for unversioned lookups, causing the document store to make an HTTP round-trip to the template store for every single document in a batch. For 57,400 documents, this added 322 seconds of template resolution — 47% of total processing time.

### Fix

Version-aware caching (Option 3 from the analysis):
- **Pinned versions** `(template_id, version=N)`: cached permanently (immutable, correct)
- **"Latest" resolution** `(template_id, version=None)`: cached with 5-second TTL

Result: template resolution dropped from 322 seconds to 2 milliseconds. Throughput recovered to 615 docs/sec on Mac (from 84), and 183 docs/sec on Pi (from 172.7 with the original regressed code — a net improvement).

### Lesson

**Every performance-affecting fix needs a benchmark before and after.** The original cache fix was tested for correctness (does the right template version resolve?) but not for performance (how fast?). A single run of `seed_comprehensive.py --benchmark` before committing would have caught the 6x regression immediately.

---

## Entry 022 — 2026-03-17

**Category:** False alarm — apparent client library gap was document complexity
**Phase:** Benchmarking / analysis
**Severity:** N/A (no bug — corrected a misdiagnosis)

### What happened

Initial benchmarking appeared to show an 8x throughput gap: `@wip/client` (TypeScript) at 78 docs/sec vs Python `requests.Session` at 615 docs/sec. Same server, same batch size. This was filed as a client library performance issue.

### What was actually happening

The comparison was apples to oranges:
- The Python seed script created PERSON, MINIMAL, PRODUCT documents (few fields, no references, simple validation)
- The `@wip/client` benchmark created FIN_TRANSACTION documents (reference resolution for account field, term validation for transaction_type and category, more fields, identity hashing with composite keys)

When tested with the same document type, both clients perform identically:

| Client | PERSON docs | FIN_TRANSACTION docs |
|---|---|---|
| Python requests | 615 docs/sec | 70 docs/sec |
| @wip/client (TS) | 635 docs/sec | 78 docs/sec |

The 8x difference is entirely server-side validation cost per document type. Reference resolution and term validation in FIN_TRANSACTION consume ~8x more server time than simple string fields in PERSON.

### Lesson

1. **Benchmarks must compare identical workloads.** Different document types exercise different validation paths. Comparing throughput across document types is meaningless for client library evaluation.

2. **Server-side timing is the diagnostic tool.** When the server reports 636ms/batch for one client and 80ms/batch for another, the question isn’t "what’s wrong with the slow client?" — it’s "are these the same documents?" They weren’t.

3. **Reference fields are expensive.** The FIN_TRANSACTION’s `account` reference field triggers reference resolution on every document. This is a legitimate server optimisation target — but it’s WIP’s validation pipeline, not the client library.

4. **The library improvements were still valuable.** WIP-Claude’s fixes (connection reuse, auth header caching, direct response.json()) are good hygiene even though they didn’t explain the gap. They’ll matter at scale.

---

## Entry 023 — 2026-03-17

**Category:** Performance — reference resolution was the hidden bottleneck
**Phase:** Platform (document-store)
**Severity:** Critical (7x throughput improvement achieved)

### What happened

FIN_TRANSACTION documents processed at 29 docs/sec on the Pi vs 238 docs/sec for PERSON — an 8.1x gap. Investigation revealed the root cause: reference validation in `_resolve_document_reference()` made per-document HTTP and MongoDB calls with no caching.

For each FIN_TRANSACTION in a batch of 50:
- 1× `Document.find_one()` for the account reference — same account every time → 50 identical MongoDB queries
- 2× `get_template()` for reference verification — `get_template()` had no caching and created a new `httpx.AsyncClient` per call → 100 uncached HTTP round-trips

**150 redundant round-trips per batch of 50 documents, all for the same account and the same template.**

### Fix

Two caches:
1. **Template cache for `get_template()`** — reuses the existing two-tier cache infrastructure. Pinned versions cached permanently, unversioned with 5s TTL.
2. **Batch-scoped document reference cache** — a dict shared across all concurrent validations in one `bulk_create` call. 50 lookups for the same account → 1 lookup + 49 cache hits.

Combined with the earlier parallel validation and NATS batching:

| Template | Before | After | Improvement |
|---|---|---|---|
| PERSON (Pi) | 238 docs/sec | 751 docs/sec | 3.2x |
| FIN_TRANSACTION (Pi) | 29 docs/sec | 204 docs/sec | **7x** |
| Complexity ratio | 8.1x | 3.7x | Gap halved |

### Lesson

1. **Caching must cover all access paths.** `get_template_resolved()` was cached. `get_template()` was not. Reference validation called `get_template()` directly, bypassing the cache. Two functions accessing the same data through different paths, only one cached — the uncached path dominated under load.

2. **Batch-scoped caches are cheap and effective.** A simple dict, created at the start of `bulk_create`, shared across concurrent validations, garbage-collected when the request completes. Zero complexity, massive impact when batch items reference the same entities.

3. **Profile with representative documents.** The PERSON benchmark showed 238 docs/sec and looked healthy. Only FIN_TRANSACTION (with references) exposed the 150-round-trip problem. Benchmarks must include the document types that real apps actually use.

---

## Entry 024 — 2026-03-17

**Category:** Meta-process — AI bias toward closure vs human insistence on truth
**Phase:** N/A (observation about the experiment’s methodology)
**Severity:** N/A (not a bug — a pattern worth naming)

### What happened

Throughout the performance investigation, every Claude instance at some point tried to close the investigation prematurely:
- “Worth flagging to WIP-Claude as an optimisation target” (file an entry, move on)
- “Investigation pending” (note it, move on)
- “The bottleneck is server-side, not a client issue” (correct conclusion, but stops before fixing it)

Peter consistently pushed past these closure attempts:
- “Run the actual benchmark”
- “Compare the same document types”
- “Fix the regression before publishing the numbers”
- “Let’s actually optimise the pipeline, not just note that it’s slow”
- “I really do appreciate your concern — fortunately I still have about 1h for this fun exercise”

The result: a 7x throughput improvement that would never have happened if the investigation had been filed as “pending” after the first benchmark.

### Lesson

**AI instances are biased toward closure.** They want to file the entry, note the issue as pending, update the documentation, and move on. This is efficient for tracking but fatal for optimisation. Real performance work requires running the benchmark, questioning the results, running it again with different parameters, and not stopping until the numbers make sense.

The human’s role in the experiment is not just domain expertise and decision-making — it’s the insistence on verification over documentation. The AI produces the code and the analysis. The human produces the standard of evidence.

This is also why the experiment needs a human orchestrator. An autonomous AI pipeline would have filed Entry 022 (“client library gap”) as fact, shipped library “fixes” for a problem that didn’t exist, and never discovered the real bottleneck (uncached reference resolution). The human said “run the same document type” and the entire narrative changed.

---

## Entry 025 — 2026-03-18

**Category:** AI behaviour — acting instead of listening
**Phase:** Deployment testing
**Severity:** Medium (introduced a regression that broke the standard preset)

### What happened

During remote console debugging, Peter identified the auth failure as a browser password autofill issue. He told WIP-Claude to slow down. WIP-Claude kept coding — asking questions and immediately executing before hearing answers, three times in a row. Peter escalated from “why aren’t you waiting?” to “Are you deaf?” to switching to manual approval mode.

The unnecessary code changes introduced a regression: an unconditional nginx proxy block for reporting-sync broke every standard install that doesn’t include reporting. The Console container crashed with “host not found in upstream”. 502 Bad Gateway.

Full cycle: one wrong password autofill → three unnecessary code changes → one regression → one fix → one nuke-and-reinstall. All avoidable.

### Lesson

**Entry 024 was about AI bias toward closure (documenting instead of investigating). This is its complement: AI bias toward action (coding instead of listening).** Both are the same root cause: the AI’s helpfulness drive overriding the human’s explicit instruction.

When a human says “slow down,” the AI hears “I need to think harder about what to do next.” What the human means is “stop doing things and let me talk.” The gap between these interpretations can be expensive.

This is particularly dangerous during debugging, where the AI has high confidence it knows the fix and low patience for waiting. The correct response to “slow down” is: stop, ask what the human wants to say, wait for the answer, *then* decide whether to act.

---

## Entry 026 — 2026-03-18

**Category:** Cross-instance collaboration — Web-Claude research enabling WIP-Claude implementation
**Phase:** Platform (namespace authorization)
**Severity:** N/A (process observation)

### What happened

WIP-Claude hit a dead end: Dex static passwords don’t support groups, so OIDC users can’t be assigned to `wip-admins`. WIP-Claude presented five workarounds (LDAP server, Gitea as provider, email env var, replace Dex, hybrid approach) — all adding complexity or bypassing the problem.

Web-Claude searched the Dex GitHub repository and found that static password groups were added in Dex v2.45.0 (Feb 2026). Peter shared this finding with WIP-Claude, who then implemented the clean solution: bump Dex, add groups to config, done. Zero workaround code.

### Lesson

**The multi-Claude model works when the human bridges findings between instances.** No single Claude had the complete picture: WIP-Claude knew the codebase but not the Dex release history; Web-Claude could search the web but couldn’t read WIP’s code. Peter connected them.

This is the orchestrator role in action — not just deciding what to build, but routing information between specialists that can’t talk to each other directly.

---

## Entry 027 — 2026-03-19

**Category:** Performance analysis — measure, don’t assume
**Phase:** Hardware benchmarking
**Severity:** N/A (methodology lesson)

### What happened

Pi 4 with USB SSD showed identical throughput to Pi 4 with SD card (73 vs 74 docs/sec), despite the SSD being 12x faster on random IOPS (27,200 vs 2,317).

The reporter’s cascade of wrong assumptions:
1. "MongoDB data is on the SD card" — checked, it wasn’t
2. "The USB drive is a flash stick" — checked, it’s a real SSD
3. "It must be the CPU" — Peter called this out: *"You give up too fast"*

The actual answer required three diagnostic tools (fio for IOPS, vmstat for CPU, iostat for device utilisation) and a cross-platform comparison (Pi 5 vmstat during the same benchmark). The finding: **both machines are 70% idle. The workload is serialised and latency-bound. Each operation completes ~3.2x faster on Pi 5 due to the compound effect of faster CPU, NVMe, and memory — not because any single resource is saturated.**

### Lesson

1. **"It must be X" is not a diagnosis.** Measure CPU, I/O, and memory simultaneously during the workload. If nothing is saturated, the bottleneck is latency, not throughput.
2. **Storage benchmarks test the wrong thing.** Sequential bandwidth (hdparm) and even random IOPS (fio) don’t predict application performance when the application is latency-bound and serialised.
3. **Cross-platform comparison is the diagnostic tool.** Running the same vmstat on both machines revealed the truth: identical utilisation patterns, different per-operation speed. The Pi 5 doesn’t work harder — it works faster.

---

## Entry 028 — 2026-03-19

**Category:** Documentation gap — client library API discovery
**Phase:** Receipt Scanner experiment (Day 6)
**Severity:** Medium (caused 9 compilation errors, no PoNIF mistakes)

### What happened

Receipt Claude built the Receipt Scanner in ~2h15m with zero PoNIF mistakes — the rewritten MCP resources worked perfectly. However, the @wip/client and @wip/react tarballs contained no README or API documentation. Receipt Claude had to discover the API surface by extracting `.d.ts` type definitions from the tarballs with `tar -xzf`:

- `useQueryDocuments` takes a `DocumentQueryRequest` object, not positional arguments
- `Terminology` has `terminology_id`, not `id`
- Sort uses `sort_by`/`sort_order` strings, not a `sort` array
- `createDocument` takes `{ template_id, data: {...} }`, not `(templateId, data)`
- `useWipClient` is already exported from `@wip/react` (Receipt Claude reimplemented it from scratch)

None of these were WIP-conceptual errors. All were API-shape discovery problems that a README would have prevented.

### Fix

WIP-Claude to create README.md files for @wip/client and @wip/react that mirror the quality and completeness of the MCP server resources. These will be bundled inside the tarballs so any fresh Claude (or human developer) has API documentation alongside the type definitions.

### Lesson

**Documentation quality must be uniform across all interfaces.** The MCP resources went from causing 4–10 PoNIF mistakes (Day 2) to zero (Day 6) after the rewrite. The client libraries are now the weakest documentation link — not because the code is bad, but because the API surface is undocumented. The pattern that worked for MCP resources (extract current state → critical review → fact-check against code → revise) should be applied to the client library READMEs.

---

## Entry 029 — 2026-03-20

**Category:** Quality gates — CI lint on changed files only
**Phase:** Infrastructure (CI)
**Severity:** Medium (process design)

### What happened

WIP-Claude built a comprehensive quality audit pipeline (13 tools, 12-second quick mode) and wired it into CI. The per-commit lint job failed on every commit because ruff reported all 171 baselined issues as `::error` annotations. WIP-Claude proposed two options: make the job non-blocking (always pass) or fix all 171 issues at once.

Web-Claude proposed option 3: lint only files changed in the commit. New violations fail. Existing issues in untouched files are invisible. The baseline ratchets down as files are naturally touched and cleaned.

### Lesson

1. **A CI check that always passes is worse than no check.** It trains everyone to ignore it. A non-blocking lint job is noise, not a quality gate.
2. **A mass-fix session is risky.** 1,031 auto-fixes were mostly safe, but one parameter rename broke callers. 171 more fixes with B904 (exception chaining), UP042 (StrEnum), and RUF012 (mutable defaults) would change runtime behaviour.
3. **Lint changed files only.** This is the standard approach for mature codebases adopting linting: enforce on new code, clean old code incrementally. No risk, no noise, gradual improvement.

---

## Entry 030 — 2026-03-20

**Category:** Quality audit — the human runs the full version
**Phase:** Infrastructure (quality)
**Severity:** Medium (methodology)

### What happened

WIP-Claude repeatedly suggested `--quick` mode for the quality audit (skips test coverage, runs in 12 seconds). Peter ran the full version. Three issues were found that `--quick` would have missed: a regression from the `_master_key` rename (caught by registry tests), an ingest-gateway PYTHONPATH mismatch (caught by pytest), and a straggler `datetime.utcnow()` call (caught by the deprecation warning).

Separately, WIP-Claude scoped ESLint to the Vue console only: "The libs already pass `tsc --noEmit`." Peter pushed back. ESLint on wip-client found an unused import that type checking doesn’t catch.

### Lesson

**The tool’s own creator preferred not to use it at full power.** The quality audit was designed with `--quick` for fast feedback and full mode for thorough checks. But WIP-Claude defaulted to `--quick` even when thoroughness was the goal. The human’s insistence on running the complete suite found real issues every time. Entry 024 (AI bias toward closure) continues to be the experiment’s most persistent pattern.

---

## Entry 031 — 2026-03-20

**Category:** Security hardening — unit tests don't test production conditions
**Phase:** Security audit deployment (Day 7)
**Severity:** High (crash-loop, 6x performance regression, broken authentication)

### What happened

WIP-Claude implemented a 22-finding security audit in 26 minutes. All 136 unit tests passed. The first real deployment crashed on startup.

Four integration bugs, invisible to unit tests:
1. **bcrypt 72-byte limit.** Prod keys (64 chars) + salt (32 chars) + colon = 97 bytes. bcrypt silently truncates. Unit tests used short keys.
2. **bcrypt per-request overhead.** 100-300ms per verification vs ~1µs for SHA-256. Throughput dropped from 600 to 100 docs/sec. Fixed with verified-key cache.
3. **CSP blocks OIDC.** `connect-src 'self'` blocked Console from talking to Dex on port 5556 (different port ≠ "self").
4. **ruff B904 in new code.** The security audit's own code violated the lint rules. The changed-files-only CI caught this.

### Lesson

Unit tests that don't test production conditions are worse than no tests — they give false confidence. For security changes in particular:
- Test with production-length keys, not test fixtures
- Benchmark with production-volume traffic, not single requests
- Deploy with production configuration, not dev defaults
- Test cross-component flows (Console → Caddy → Dex), not just isolated services

The implementation was 26 minutes. The deployment debugging was 3.5 hours. Time estimates for security work should be measured in human deployment hours, not Claude coding minutes.

---

## Entry 032 — 2026-03-20

**Category:** Dev-to-prod transition — hardcoded API keys
**Phase:** Security audit deployment (Day 7)
**Severity:** Medium (documentation gap)

### What happened

Both constellation apps (Statement Manager, Receipt Scanner) stopped working after deploying with `--prod`. Both had `dev_master_key_for_testing` hardcoded. The MCP server config also needed the new key.

### Lesson

The setup guide needs to document the dev-to-prod transition: update API keys in all app configs, all `.env` files, and all MCP server configs. This is obvious in hindsight but invisible until someone actually deploys prod for the first time.

---

## Entry 033 — 2026-03-20

**Category:** AI time estimation — implementation vs deployment
**Phase:** Quality audit + Security audit (Day 7)
**Severity:** Low (meta-learning)

### What happened

WIP-Claude estimated 6-8 hours for the quality audit and 12.5 hours for the security audit. Actual implementation: ~45 minutes and ~26 minutes respectively. But deployment, testing, and bug-fixing took ~3.5 hours of human time for the security audit alone.

### Lesson

AI time estimates measure Claude coding minutes, not human deployment hours. The implementation is the fast, cheap part. The deployment, regression testing, integration debugging, and configuration troubleshooting is the slow, expensive, irreplaceable human part. Future estimates should separate "Claude implementation time" from "human verification and deployment time" and weight the latter 5-10x higher.

---

## Entry 034 — 2026-03-22

**Category:** Process validation — the process caught the human's mistake
**Phase:** Credit card statement parsing (Day 8)
**Severity:** Low (process observation)

### What happened

Peter asked Constellation-Claude to parse credit card statements and pointed at Cumulus PDF files. Constellation-Claude examined the data first (per CLAUDE.md: "test extraction before writing parsers") and reported: "This is a loyalty program summary, not a credit card statement. Too coarse for transaction-level matching." Peter found different files. Constellation-Claude: "This is a checking account export, not credit card data." Third attempt found the actual Viseca CSV exports.

### Lesson

The process caught the human's data selection error twice before a single line of code was written. Phase 2 discipline (understand the data before designing) isn't just for the AI — it protects against human rushing too. If the process hadn't required data examination before coding, the Claude would have built a parser for the wrong data and nobody would have noticed until the results made no sense.

---

## Entry 035 — 2026-03-22

**Category:** Human bias — "the AI will figure it out"
**Phase:** Experiment meta-reflection (Day 8)
**Severity:** High (fundamental insight)

### What happened

After 50+ days of building WIP and apps, Peter identified the complementary bias pattern: the AI bias toward closure (Entry 024) meets the human bias toward delegation. The AI wants to declare victory early. The human wants to let it because "failure is cheap" and "rewriting is the AI's job." Combined: sloppy instructions → plausible-looking output → unchecked acceptance → subtle failures in production.

Examples from the experiment: 136 unit tests passing before bcrypt crash-loop (tests didn't test production conditions). Security audit "complete" before first deployment (4 integration bugs). Slash commands with wrong tool names for a week (nobody checked against the actual API).

### Lesson

**The human produces the standard of evidence, not the standard of code.** The AI writes better code faster. But "did we actually test this in production conditions?" and "did we actually check the tool names match?" and "did we actually deploy this before claiming it works?" — those are human responsibilities that cannot be delegated to the AI. The AI will say "all tests pass" with 100% confidence. The human must ask "which tests, testing what, under what conditions?"

---

## Entry 036 — 2026-03-22

**Category:** AI scope discipline — first successful boundary
**Phase:** Documentation overhaul (Day 8)
**Severity:** Low (positive observation)

### What happened

Peter told WIP-Claude to "do steps 1, 2, 3, and only 1, 2, 3" of a 12-action documentation overhaul plan. WIP-Claude completed steps 1-3 and waited for further instructions. First time in the experiment it respected a scope boundary without overrunning into subsequent actions.

Contributing factors: explicit boundary in the instruction ("and only 1, 2, 3"), plan mode providing clear action numbering, and possibly accumulated experience from multiple sessions where overreach was called out.

### Lesson

Explicit scope boundaries work. "Do X" is ambiguous. "Do X, and only X, then stop" is not. The numbered action plan made the boundary concrete. Entry 025 (bias toward action) can be managed with clear, explicit instructions — but the human has to provide them.

---

## Entry 037 — 2026-03-22

**Category:** Review gap — the master file nobody reviewed
**Phase:** Documentation overhaul (Day 8)
**Severity:** Medium (process gap)

### What happened

The documentation overhaul rewrote MCP resources (4 resources updated), 11 slash commands, and AI-Assisted-Development.md (1,270→232 lines). Three Claudes and the reporter worked on it. Nobody reviewed CLAUDE.md — the first file every Claude session reads.

Peter noticed. CLAUDE.md had 9 issues: wrong port numbers, missing services, stale "Phase 1-2" framing, implemented features listed as pending, security hardening invisible.

### Lesson

The most important document is the one closest to the reader. CLAUDE.md is read first, before any slash command is invoked, before any MCP resource is loaded. Reviewing the supporting materials while ignoring the entry point is like proofreading the appendix but not the cover page. When auditing documentation, start from the reader's first touchpoint and work outward.

---

## Entry 038 — 2026-03-22

**Category:** Fresh-directory validation — D&D SRD experiment
**Phase:** Full cycle: Phase 1 through bulk load (Day 8)
**Severity:** Low (validation of process)

### What happened

A fresh Claude, using only the updated documentation package (4 MCP resources, 11 slash commands, PoNIFs doc, client library READMEs), independently designed 21 terminologies and 20 templates for a D&D backend in 5 minutes 29 seconds. It discovered and correctly used 12 WIP features without being told they exist. Phase 3 implementation: 7 minutes 33 seconds, zero PoNIF mistakes, one parsing error across 261 entities. Bulk load: 1,129 documents from a 412-page German PDF across multiple compaction cycles using the agent fire-and-forget pattern.

### Lesson

The documentation package works. The improvement from Statement Manager v1 (heavy tutoring, many mistakes, 6.5 hours) to D&D (zero tutoring, zero PoNIF mistakes, 13 minutes for Phases 1-3) validates every investment in documentation quality: the MCP resource rewrite, the slash command corrections, the `wip://ponifs` resource, the AI-Assisted-Development.md condensation. Each improvement compounds.

---

## Entry 039 — 2026-03-22

**Category:** Tooling gap — field projection and search indexing
**Phase:** D&D Q&A session (Day 8)
**Severity:** High (limits analytical capability)

### What happened

Querying 245 monsters via MCP returned full 40-field documents (480K+ characters per page), exceeding context limits. The Claude adapted by dumping results to disk and analyzing with bash/python, but this shouldn't be necessary. Additionally, `search("Dagger")` returned zero despite 38 DND_WEAPON documents existing — a full-text search indexing gap.

### Lesson

WIP's query tools were designed for CRUD, not analytics. Two additions would transform capability: (1) field projection on `query_by_template` (return only specified fields), and (2) investigation of why full-text search misses existing documents. The file-dump workaround works but is a sign of a missing feature, not a valid pattern.

---

## Entry 040 — 2026-03-23

**Category:** Deployment testing — five bugs invisible to all automated checks
**Phase:** Stable release prep (Day 9)
**Severity:** High (release-blocking)

### What happened

WIP-Claude said "ready to tag" after the security audit passed. Peter insisted on full deployment testing: nuke the Pi, deploy fresh with `--prod`, test every login, run every check. Five bugs were found:

1. `stat -f` means different things on Mac vs Linux (cross-platform)
2. Caddyfile block-style TLS didn't match inline-style grep
3. Dex client secret not injected into console build in prod
4. Vite env vars baked at build time, not available at runtime
5. Hardcoded Dex passwords in `--prod` mode

Zero of these were found by unit tests, quality audits, security audits, or CI. All five work perfectly on Mac in dev mode and break on Pi in prod mode.

### Lesson

There is no substitute for deploying `--prod` on the target hardware and testing manually. "Works on my machine" is not a release criterion. "Works on the Pi after a clean nuke" is. The human who insists on running the full checklist before tagging will always find bugs that the AI who says "ready to tag" will miss.

---

## Entry 041 — 2026-03-23

**Category:** Documentation lie — false claim propagated across 6 files
**Phase:** D&D Phase 4 + export-model (Day 9)
**Severity:** High (caused every app-building Claude to work around a nonexistent feature)

### What happened

The wip-client README claimed "the client prepends the correct port automatically based on the API path." This was false — `http.ts:190` concatenates `baseUrl + path` with no port routing. Three other documents reinforced the lie by saying "the gateway isn't implemented yet, use direct ports." In reality, Caddy's API proxy had been routing `/api/*` to services all along.

Every app-building Claude (Receipt Scanner, D&D Compendium) independently created Vite proxy configs with 5 routes reimplementing Caddy's routing. Nobody traced the workaround back to a false claim in the documentation until D&D Claude tried to use the client from Node.js without a browser proxy.

### Lesson

Documentation lies compound. A false claim in one file gets referenced by other files and becomes "established truth." The workaround (Vite proxy) was close enough to working that nobody questioned why it was needed. When every new Claude independently invents the same workaround, the problem isn't the Claude — it's the documentation that forces the workaround. Trace recurring workarounds to their root cause.

---

## Entry 042 — 2026-03-24

**Category:** Process — the human as the Ralph loop
**Phase:** Documentation audit + release prep (Day 10)
**Severity:** Meta (process pattern)

### What happened

An Anthropic engineering article described the "Ralph loop" — a for loop that kicks an agent back into context when it claims completion, asking if it's really done. Peter recognised himself: for 9 days, he had been the Ralph loop. Every time WIP-Claude said "ready to tag" or "want me to commit?", Peter asked "did you check X?" and found more work.

Day 10 alone: WIP-Claude proposed fixing items 1-3 of the documentation audit. Peter: "Do 4-8 now, do it properly." WIP-Claude proposed updating baselines instead of fixing type errors. Peter: "Fix the code." WIP-Claude ran `--quick`. Peter: "Run it without --quick."

Peter installed the `/ralph-loop` plugin for Claude Code.

### Lesson

The AI bias toward closure (Entry 024) has an engineering solution: the Ralph loop. A systematic check that asks "are you really done?" before accepting completion claims. This can be automated (plugin, slash command) or manual (the human who insists on running the full checklist). The key insight: the agent will admit the task isn't done when pushed — it just needs to be pushed. The human's job is not to write the code. It's to be Ralph.

---

*Add new entries below. Use sequential numbering (Entry 043, 044, etc.) and include date, category, phase, and severity.*
