# From Vision to Running App in a Day: Building a Personal Data Platform with AI

*A field report on using Claude to design, document, and build an application ecosystem on a generic backend — and what broke along the way.*

---

## The Starting Point

The premise was simple but ambitious: what if all your personal data — finances, energy consumption, home maintenance, vehicle costs, health metrics — lived in one shared backend instead of dozens of disconnected apps? And what if an AI could build the apps?

The backend already existed: **World In a Pie (WIP)**, a generic, domain-agnostic storage engine. WIP doesn't know what a bank transaction is. It knows what a terminology is (controlled vocabulary), what a template is (schema with typed fields), and what a document is (validated data conforming to a template). It handles identity resolution, versioning, referential integrity, and real-time sync to PostgreSQL for SQL analytics. It runs on a Raspberry Pi.

The experiment tested two theses simultaneously:

1. **A shared backend creates compounding value** — each new app makes every existing app more valuable through cross-dataset queries that siloed apps can't do.
2. **AI can build real apps if you give it guardrails** — not toy demos, but working software against a real platform, following a real process.

What follows is what actually happened in a single day.

---

## Phase 1: Designing the Constellation

Before writing any code, we needed to answer: what would someone actually build on a shared personal data backend?

The answer came in the form of **constellations** — clusters of apps that each work independently but become dramatically more powerful when their data coexists. We designed four:

**Personal Finance** (foundational): a Statement Manager for bank/employer data, a Receipt Scanner for item-level purchase detail, a Subscription Tracker for recurring costs, an Investment Tracker for portfolio management, and a BI layer across all four.

**Energy & Sustainability**: utility metering, solar production monitoring, home climate logging — enriched by external data (weather, tariffs, grid carbon intensity) that turns raw readings into actionable insight.

**Vehicle & Mobility** (a "satellite"): fuel logs, trip classification for tax purposes, maintenance history, total cost of ownership. It bridges energy and finance — an EV charged from your solar panels creates a data link between three domains.

**Home Management** (the convergence point): equipment registry, maintenance logs, network inventory, and renovation planning. This is where we wrote a worked example: a window replacement decision that draws on energy meter data, indoor climate measurements, equipment specs, construction costs, subsidy rules, financial records, and property valuations. Six data sources from three constellations, converging on one decision. No single app could do it. A shared backend makes it a SQL join.

The key insight that emerged: **the constellation model creates a network effect on your own data.** Nobody would build a custom integration between their wine collection app and their kid's school fee tracker. But if both write to the same backend, the cross-query is free. Each new app retroactively increases the value of every existing app.

We also established that WIP doesn't prescribe this model — it's a generic platform. The constellation approach is a design choice that happens to exploit WIP's strengths, but WIP is equally suited to a single standalone app.

---

## Phase 2: Building the Guardrails

If an AI is going to build apps, it needs constraints. Not because AI is unreliable, but because unconstrained AI produces inconsistent output — one app in React, another in Vue, a third with SQLite instead of WIP, and suddenly your shared backend isn't shared.

We produced a set of development guidelines:

**A strict four-phase process** with gates: (1) explore WIP and inventory what exists, (2) design the data model and wait for human approval, (3) implement terminologies and templates with testing at each step, (4) build the application layer.

**A non-negotiable tech stack**: React + Vite + Tailwind + shadcn/ui for all constellation apps. Not because it's the best stack (that's a religious war), but because consistency across apps matters more than individual optimality. And because Claude generates React more reliably than anything else — a pragmatic concession to Thesis 2.

Interestingly, **WIP's own Console uses a completely different stack** (Vue + PrimeVue) — also built by Claude. Different tool for a different job. An admin interface with complex data tables has different needs than a consumer-facing finance app. The consistency requirement applies within the constellation, not across the entire WIP universe.

**A gateway architecture** for the Raspberry Pi deployment. One IP, one hostname, multiple apps. A reverse proxy routes `/apps/statements/` to port 3001, `/apps/receipts/` to port 3002. Without it, users remember port numbers. With two apps, that's manageable. With five, it's unworkable.

**A TypeScript client library specification** (`@wip/client`) that abstracts WIP's APIs — particularly the bulk-first design, where all create/update endpoints return HTTP 200 and bury per-item errors inside the response body. A naïve app that checks `response.ok` has a latent bug. The client library catches it.

---

## Phase 3: The MCP Server — and the Bugs It Introduced

WIP already had APIs. The AI could have composed HTTP calls. But that's tedious and error-prone — URLs, headers, bulk envelopes, error parsing. So a second Claude instance built an **MCP (Model Context Protocol) server** that exposes WIP as native AI tools: `list_terminologies`, `create_template`, `validate_document`, `query_documents`.

This collapsed the development workflow. Instead of "read docs → compose curl → parse response," the AI just calls a tool and gets a typed result. Phases 1–3 became dramatically faster.

Then we asked: "Are you 100% sure the MCP server teaches the AI the same patterns that `@wip/client` uses at runtime?"

The answer was no.

**Three silent bugs** were discovered through a cross-audit between two Claude instances:

| MCP server said | API actually expects | Consequence |
|---|---|---|
| `required: true` | `mandatory: true` | All fields silently become optional |
| `terminology_id` | `terminology_ref` | Term validation silently disabled |
| `subject_term_id` | `source_term_id` | API rejects with validation error |

An important clarification: **WIP's API actually does reject unknown fields** — all write models enforce `extra='forbid'` via a StrictModel base class, and middleware rejects unknown query parameters with HTTP 422. These bugs would have been caught immediately if the MCP server had been tested against a live instance. The wrong field names were in tool descriptions — the documentation the AI reads — not in tested API calls. The real failure was shipping documentation without running it.

The fix was structural: **generate parameter schemas from WIP's OpenAPI specs** instead of hand-writing them. A `tools.yaml` config file holds the authored descriptions (which an AI needs to use tools well), while the field names, types, and constraints are pulled from the API's Pydantic models. A shared `schemas/` directory ensures both the Python MCP server and the TypeScript client library derive from the same source.

Total implementation: 435 lines of authored code, 3,800 lines generated, 9 minutes of AI time. The class of bug is now structurally impossible.

**Lesson:** documentation derived from code is trustworthy; documentation written by hand drifts. The API's strict validation was the safety net that would have caught the bugs on first contact. The schema generation pipeline ensures the documentation never diverges from the code that enforces it. Both layers matter: the API rejects wrong fields (defense in depth), and the tool descriptions send correct fields (prevention). But the root cause was mundane: we shipped docs without testing them against the live system.

---

## Phase 4: Building the Statement Manager

With the data model designed (5 terminologies, 4 templates, careful identity field choices), approved by the human, and tested via MCP tools, the AI built the Statement Manager app.

Phase 3 was clean: terminologies created, templates created, test documents with real Swiss bank data (UBS, Yuh) and a real payslip verified. Versioning worked. References resolved. Re-import was idempotent. All via MCP tool calls — no HTTP composition, no error parsing.

Phase 4 is where things got interesting.

**The context window ran out.** The AI used parallel background agents to build multiple components simultaneously. They didn't complete before the context limit. All uncommitted code was lost. The data layer (in WIP) was fine — Phases 1–3 are durable by design. But the UI code had to be regenerated from scratch.

**Lesson:** build incrementally. One feature per session. Commit after each. Context exhaustion is not a bug — it's a physical constraint. The recovery path is git, not re-engineering.

**The AI never asked about UX.** It built the entire UI — page structure, navigation, workflows, data display — without a single question. The guardrails specified *what to build with* (React, shadcn/ui) but not *what to build*. The data model had an approval gate; the UI had none. The AI treated UX as a technical decision (like choosing a port number) rather than a product decision (like choosing identity fields).

**Lesson:** gates are needed wherever the human has an opinion. A ten-line UI plan costs almost nothing in context. A full rebuild after "that's not what I wanted" costs everything.

**The AI explored WIP's codebase.** It needed to figure out how the browser-based app reaches WIP's APIs (a CORS issue) and went looking at WIP's internal Caddy configuration. This crosses the golden rule's spirit — the constellation app should never depend on WIP's internals.

**Lesson:** when the AI encounters a gap in instructions, it fills it with exploration. Every time the AI goes looking outside the constellation repo, that's a signal of a missing instruction. The fix: document the Vite dev proxy configuration explicitly.

---

## What We Built (by the numbers)

By the end of the day:

**Documentation:**
- 4 use case documents (Finance, Energy, Vehicle, Home Management)
- 1 "Two Theses" vision document
- 1 development guardrails document (7 guides)
- 1 client library specification
- 1 replication guide
- 1 setup guide

**AI configuration:**
- 1 CLAUDE.md master instruction file
- 10 slash commands (`/explore`, `/design-model`, `/implement`, `/build-app`, `/improve`, `/export-model`, `/bootstrap`, `/wip-status`, `/add-app`, plus the WIP-status check)
- 15 lessons learned entries (12 Day 1, 3 Day 2)

**In WIP:**
- 5 terminologies with 51 terms
- 4 templates with validated identity fields and cross-references
- Test documents from real Swiss bank statements and payslips

**Running software:**
- 1 Statement Manager app (React + @wip/client + shadcn/ui)
- 1 MCP server with OpenAPI-generated schemas (33 tools)
- 1 TypeScript client library

---

## What We Learned

**The shared backend thesis is plausible but unproven.** We have one app. The network effect requires at least two, ideally three. The data model is designed for cross-app queries (receipts reference transactions, payslips reference employer accounts), but until the Receipt Scanner exists, those cross-links are theoretical. The proof comes next.

**The AI guardrail thesis is partially validated.** An AI following a structured process, with platform constraints (WIP), tool constraints (MCP server), and procedural constraints (phased process with gates), can build a working app against a non-trivial backend in a single day. But:

- It needs correct guardrails (the MCP schema bugs would have silently corrupted everything)
- It needs explicit guidance for every boundary it shouldn't cross (WIP codebase exploration)
- It needs approval gates for subjective decisions (UX), not just technical ones (data model)
- It hits hard physical limits (context window) that require process adaptation (incremental commits)

**The first consumer drives the library.** The `@wip/client` spec was written before any app existed. The Statement Manager — as the first real consumer — immediately found gaps: no typed query filters, no server-side filtering hook in `@wip/react`, and another silent wrong-field-name bug hiding behind `Record<string, unknown>` (the TypeScript equivalent of "accept anything"). The WIP-side Claude fixed the library in 3 minutes, the constellation Claude used the improvement immediately. The library is maturing through use, not through anticipation. This pattern will repeat with every new app.

**MCP tools are ephemeral; git is durable.** The AI creates terminologies and templates via MCP tools during Phase 3 — fast, interactive, immediate feedback. But those creations live only in the running WIP instance. If the database is lost, or someone clones the repo to replicate the experiment, there's nothing to recreate the data model. The fix: declarative seed files in a `data-model/` directory, exported after every Phase 3 and committed to git. A `/bootstrap` command recreates everything on a fresh WIP instance. This is the database migration problem, reframed for WIP.

**The experiment's feedback loop works.** Every failure produced a structural fix: schema generation for field naming bugs, explicit prohibitions for boundary violations, incremental build rules for context exhaustion, UX gates for missing product input. Five entries in the lessons learned, five permanent improvements to the process. The experiment is getting better at running itself.

**The MCP server is transformative but dangerous.** It collapses the distance between the AI and the platform from "compose HTTP" to "call tool." But an incorrect tool description doesn't produce an error — it produces an AI that confidently creates broken data. The fix (generate from OpenAPI specs, author only the descriptions) makes the dangerous part impossible and the valuable part excellent.

---

## What's Next

The Statement Manager needs real data imports and UX refinement. Then the Receipt Scanner — the second app, the first cross-app reference, the first real test of the network effect. Then the gateway, so two apps can coexist on one Raspberry Pi without port number archaeology.

The constellation documents describe a path all the way to a renovation decision that draws on energy data, equipment specs, financial records, and climate measurements across three constellations. We're at the beginning of that path. But the foundation — the platform, the process, the guardrails, and the first working app — was built in a day.

The experiment is public. The [constellation repository](link) and [WIP repository](link) are available. The process is replicable — the replication guide has been tested against the actual setup failures we encountered. If you want to build your own constellation (personal health, hobby collections, anything), the same CLAUDE.md, the same slash commands, and the same process apply. WIP is generic. The constellations are examples, not limits.

---

## The Realisation That Changes Everything

The last insight of day one wasn't a bug fix, a process improvement, or a documentation gap. It was a reframing of the entire project.

The MCP server was built as a development tool — a way for the AI to interact with WIP during Phases 1–3 without composing raw HTTP calls. A productivity enhancement. A developer convenience.

Then we noticed: the tools it exposes — `query_documents`, `search_terms`, `get_template_schema` — aren't just development tools. They're a general-purpose AI interface to all data in WIP. And MCP is an open protocol. Any AI that speaks it can connect.

Which means the "BI layer" we kept describing — dashboards, SQL queries, Metabase — is not an application. It's a conversation.

*"How much did I spend on groceries last month?"* — the AI queries WIP and answers.

*"Show me the trend over 12 months."* — the AI queries, aggregates, generates a chart.

*"Should I replace my windows?"* — the AI queries energy data, equipment specs, financial records, construction costs, subsidy programmes, and property valuations. It synthesises a reasoned answer from your data.

No SQL. No dashboard. No technical skill. Just a question and an answer, grounded in structured, validated, cross-linked personal data.

This reframes the constellation model completely:

- **The apps** are the input layer — they get data *in* (structured, validated, linked)
- **WIP** is the integration layer — it stores and connects the data (across apps, across domains)
- **The MCP server + any AI** is the output layer — it gets insight *out* (in natural language, across everything)

The old pitch: *"WIP is a platform for building interconnected personal data applications."*

The new pitch: **"WIP lets you talk to your own data."**

The audience shifts from developers to everyone. A non-technical person won't build apps, write SQL, or configure dashboards. But they might import their bank statements, photograph their receipts, and log their meter readings — if doing so means they can later ask their AI assistant questions about their life that no single app could answer.

And WIP is what makes the AI's answers trustworthy. An AI querying a folder of random CSVs hallucinates relationships and guesses at field meanings. An AI querying WIP gets standardised vocabularies, validated schemas, verified references, and versioned history. The structure that WIP enforces — the same structure that guardrails the AI during development — is what makes conversational data access reliable rather than a parlour trick.

This wasn't in the plan. It emerged from building the thing. That might be the most valuable lesson of day one: **build the infrastructure for the right reasons, and capabilities you didn't plan for emerge from the structure.**

## The Uncomfortable Truth About "Talk to Your Data"

In the excitement of the MCP realisation, we almost missed something important. The story says: your data lives on your Raspberry Pi, in your home, under your control. No cloud. No data harvesting.

But personal data leaves the Pi through three channels, not one. First, during **development**: when the AI writes a CSV parser for your bank statements, it reads your actual financial data to understand the format. Your transactions, IBANs, and counterparty names appear in the AI’s context as file contents and terminal output. This happened on Day 1, before the MCP server existed. Second, during **MCP-assisted development**: the AI queries WIP to test and verify, and your real data comes back. Third, the one we noticed: **conversational queries**, where "How much did I spend on groceries?" sends your transactions to the AI provider.

The first channel is the one people miss. You don’t need the MCP server to expose data to a cloud AI. You just need to develop against real data — which every developer does. The Raspberry Pi’s sovereignty is real at rest. It is broken in transit through multiple channels whenever a cloud AI is involved.

This is not a bug. It is the normal operation of cloud AI services. And it needs to be said out loud, because the people most attracted to "personal data sovereignty on a Raspberry Pi" are exactly the people who care most about where their data goes.

The honest framing: WIP provides sovereignty at rest. Conversational access via cloud AI trades some of that sovereignty for enormous capability. The tradeoff is explicit, not hidden. And it has a structural solution on the horizon — **local AI models** running on the Pi itself (via Ollama or similar) speak the same MCP protocol. When local models become capable enough for multi-tool reasoning, the data never leaves the home network. WIP's architecture is ready for that transition today. Nothing changes except which AI connects to the MCP server.

In the meantime, users should know: asking your AI assistant about your finances means your finances leave your Pi for the duration of that query. That may be acceptable (it's no worse than using your bank's app, which also sends your data to their servers). But it should be a conscious choice, not an invisible default.

We cannot build credibility on data sovereignty and then quietly route personal data through cloud APIs. Stating the tension honestly is more trustworthy than hiding it.

## Late Addition: Making AI-Built Apps Survive Their Builder

The last problem of day one wasn't a bug. It was a question: what happens tomorrow?

The Statement Manager works. The data model is in WIP. The seed files are in git. The code is committed. But when a new Claude session opens tomorrow to improve the app, it knows nothing. It will read source files, guess at architecture, and potentially undo decisions that were made for good reasons it can't remember.

A human developer who built the app last week carries context in their head — why the navigation works this way, which import edge case is intentionally unhandled, why transactions are the landing page instead of a dashboard. An AI carries nothing. Every session starts from zero.

The fix: **standardised app documentation as a mandatory deliverable**, enforced by the process.

Every constellation app now requires six documentation files alongside its code:

- **README.md** — what the app does, how to run it, what WIP entities it needs
- **ARCHITECTURE.md** — page structure, component hierarchy, data flow, and critically: key decisions with rationale. "We chose transactions as the landing page because..." prevents the next session from rebuilding a dashboard nobody asked for.
- **WIP_DEPENDENCIES.md** — which terminologies, templates, and cross-app references the app uses. This is the contract that makes `/add-app` work — the Receipt Scanner reads this to understand what the Statement Manager provides for cross-linking.
- **IMPORT_FORMATS.md** — for data apps: which bank CSV columns map to which fields, what transformations are applied, what edge cases exist. Import parsers are the most fragile code in any data app; this is how you debug them without re-deriving the logic.
- **KNOWN_ISSUES.md** — what's broken, what's deferred, and why. Prevents the next session from "fixing" something that's intentionally simple, or missing something that's actually broken.
- **CHANGELOG.md** — what changed, when, and why. Human-readable evolution, not git log archaeology.

A new `/document` command generates and maintains these files. The `/build-app` command now requires documentation before transition to improvement. The `/improve` command requires updating relevant docs with every change. Documentation is part of the definition of done, not an afterthought.

The insight that prompted this: **documentation is the mechanism that gives an amnesiac builder continuity across sessions.** For human developers, documentation is helpful. For AI developers, it's existential. Without it, every session reinvents the app's architecture from source code. With it, every session picks up where the last one left off.

Combined with the seed files (data model reproducibility) and the lessons learned (process memory), the constellation repo is now self-contained in a meaningful sense: clone it, run `/bootstrap` to set up WIP, read the docs to understand the app, and you're productive — whether you're a human, an AI, or the same AI that built it yesterday and doesn't remember.

---

## Day One: By the Numbers (Final)

**Documentation:**
- 4 use case documents (Finance, Energy, Vehicle, Home Management)
- 1 vision document (Two Theses)
- 1 development guardrails document (7 guides)
- 1 client library specification
- 1 replication guide, 1 setup guide
- 1 journey narrative (this document) plus non-technical versions in English and German

**AI configuration:**
- 1 CLAUDE.md master instruction file
- 10 slash commands (`/explore`, `/design-model`, `/implement`, `/build-app`, `/improve`, `/document`, `/export-model`, `/bootstrap`, `/wip-status`, `/add-app`)
- 9 lessons learned entries

**In WIP:**
- 5 terminologies with 51 terms
- 4 templates with validated identity fields and cross-references
- Test documents and real imported data from Swiss bank statements and payslips

**Running software:**
- 1 Statement Manager app (React + @wip/client + shadcn/ui)
- 1 MCP server with OpenAPI-generated schemas (33 tools)
- 1 TypeScript client library with typed query filters and React hooks

**Process evolution during the day:**
- 3 new gates added (UX approval, documentation, data model export)
- 1 bug class made structurally impossible (field naming via schema generation)
- 1 correction to our own analysis (Entry 006 — verify claims by inspecting, not inferring)
- The process improved itself 9 times in one day through the lessons learned feedback loop
- 1 emergent insight that reframes the entire product: the MCP server turns WIP from a developer platform into a conversational personal data assistant

---

## Postscript: Why Day 2 Starts Over

The Statement Manager works. It imports real Swiss bank data, displays transactions, manages accounts and payslips. So why rebuild it?

Because it was built while the process was being invented. CLAUDE.md was revised mid-session. The UX gate didn’t exist when the UI was built. The documentation standard was defined after the app was running. The MCP server’s schemas were corrected during development. The client library grew new features in response to gaps. The Vite proxy configuration was discovered by accident, then documented as guidance.

The app is a product of calibration, not of the calibrated instrument. Testing whether the process actually works — whether it produces a better app, faster, with fewer surprises — requires running it clean against a fresh build. Everything durable carries forward: the data model, the seed files, the guardrails, the commands, the lessons learned. Only the UI code is discarded — and that’s the cheapest, most ephemeral layer by design.

Day 1 was calibration. Day 2 is the first real measurement.

*See [Day 2: From One App to an Ecosystem](WIP_Journey_Day2.md) for what happens next.*
