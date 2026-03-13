# Two Theses, One Experiment

*A shared backend for personal data. A guardrail for AI-assisted development.*

*DRAFT — March 2026*

---

# What This Document Is

World In a Pie (WIP) is a generic, domain-agnostic storage and reporting engine. It provides primitives — terminologies, templates, documents, references, versioning, reporting — onto which any data domain can be mapped. WIP itself is not the subject of this document. Its architecture and APIs are documented elsewhere.

This document is about what happens when you combine WIP with two ideas and test them together:

1.  That a shared, standardised backend for personal data creates compounding value across applications — value that isolated apps with their own databases fundamentally cannot match.

2.  That an AI assistant, given a structured process and a platform like WIP, can autonomously build real applications — not toy demos, not boilerplate, but working software that stores, retrieves, and analyses real data.

Neither thesis is proven. Both are plausible. This document lays out the argument for each, explains how they reinforce each other, and describes the experiment that will test them. The experiment is beginning now, starting with a Personal Finance constellation. It is an invitation to watch, to critique, and — if you’re interested — to participate.

# Thesis 1: The Network Effect of Personal Data

> **The claim**
> When multiple apps share a common backend, the value of the system grows non-linearly. Each new app retroactively increases the value of every existing app by enabling cross-dataset queries that would be impractical to build as point-to-point integrations.

This is easy to assert and hard to prove. The sceptic’s counter-arguments are legitimate: maybe it’s faster to build throwaway apps with embedded databases. Maybe cross-app analysis sounds good in theory but nobody actually does it. Maybe the overhead of a shared schema isn’t worth the interoperability it buys.

To move beyond assertion, a companion document series presents concrete use cases organised as constellations — clusters of apps that each work independently but become dramatically more valuable when their data coexists in a shared backend:

- **Personal Finance** (the foundational constellation): receipt scanning, bank statement management, investment tracking, subscription monitoring, and a BI layer that queries across all four.

- **Energy & Sustainability:** utility metering, solar production monitoring, and home climate logging — enriched by external data sources (weather, tariffs, grid carbon intensity) that transform raw readings into actionable insight.

- **Vehicle & Mobility** (a satellite): fuel and charging logs, trip classification, service history, and total cost of ownership — bridging the energy and financial domains.

- **Home Management:** equipment registry, maintenance logging, network inventory, and renovation planning — the convergence point where physical assets meet financial costs and energy performance.

## Why constellations, not just apps

A single app writing to WIP is convenient — you get schema validation, versioning, and API access for free. But the real argument begins at two apps, when queries can span both datasets without extraction, transformation, or migration. And it becomes compelling at three or more, where the number of possible cross-dataset queries grows combinatorially.

The constellation documents illustrate this with specific examples. A renovation decision — should I replace these windows? — draws on energy meter data (consumption per heating degree day), indoor climate measurements (temperature stability by room), equipment records (current window specifications), construction cost benchmarks, subsidy programme rules, financial records (can I afford it?), and property valuations (will it increase my home’s value?). No single app could produce this analysis. But if every app writes to the same backend, the query is straightforward.

> **The network effect**
> Nobody would build a custom integration between their wine collection app and their child’s school fee tracker. But if both already write to WIP, the query is just there, waiting to be asked. The cost of enabling cross-domain analysis drops to zero — the only investment is asking the right question.

Critically, WIP does not prescribe the constellation model. WIP is a generic platform, equally suited to a single standalone app, a flat data lake, or any other architecture. The constellation approach is a design choice — one that happens to exploit WIP’s strengths particularly well, but one that the app designer makes, not WIP.

# Thesis 2: WIP as a Guardrail for AI-Assisted Development

> **The claim**
> A well-structured platform like WIP, combined with a well-defined development process, can make agentic AI coding viable for real applications — because the platform constrains the AI’s degrees of freedom to exactly the decisions where human judgment matters most.

AI-assisted code generation is advancing rapidly. Large language models can write functions, build APIs, generate UIs, and wire services together. But building a real application is more than writing code. It requires hundreds of design decisions about data storage, validation, relationships, naming, versioning, error handling, and migration. An AI making all of these decisions autonomously, from scratch, will produce something that works initially and decays rapidly — because there is no structural discipline forcing consistency.

WIP changes this equation fundamentally. It is not just a database. It is an opinionated infrastructure layer that enforces a set of practices:

- **Schema validation via templates:** every piece of data conforms to a defined structure with typed fields, required/optional constraints, and controlled vocabularies. The AI cannot store unvalidated data.

- **Controlled vocabularies via terminologies:** repeating values are formalised, with aliases for real-world messiness. The AI cannot invent ad-hoc category strings.

- **Referential integrity via typed references:** cross-document links are validated and resolved automatically. The AI cannot create dangling foreign keys.

- **Versioning via identity hashes:** submitting the same identity fields creates a new version, not a duplicate. The AI gets versioning for free without implementing it.

- **Auditability via soft delete:** nothing is ever physically destroyed. Historical references always resolve. The AI cannot accidentally lose data.

- **Cross-domain queryability via reporting sync:** data is automatically synchronised to a relational store for SQL analysis. The AI does not need to build ETL pipelines.

These are not optional features. They are structural constraints that every application built on WIP inherits automatically. For an AI developer, this is transformative. Instead of making hundreds of infrastructure decisions — most of which have nothing to do with the user’s domain — the AI’s decision space is reduced to a well-defined surface:

- **Which terminologies** does this domain need?

- **Which templates** represent the domain’s entities?

- **Which fields** determine identity (and therefore versioning)?

- **Which references** link entities together?

- **What creation order** ensures dependencies are satisfied?

These are the domain-specific decisions where the human’s input is essential and the AI’s role is to translate that input into WIP primitives. Everything else — storage, validation, versioning, integrity, queryability — is handled by the platform.

## The AI-Assisted Development process

To make this concrete, a structured process has been defined for AI assistants building on WIP. It has four phases with strict gates:

**Phase 1 (Exploratory):** The AI reads all documentation, connects to a live WIP instance, catalogs every API endpoint, and inventories what already exists. The gate: do not proceed until the AI can explain WIP’s core concepts and has mapped every available endpoint. This phase prevents the AI from guessing at API behaviour.

**Phase 2 (Data Model Design):** The AI interviews the user to understand their domain, then translates it into WIP primitives — terminologies, templates, identity fields, references. The gate: the user must explicitly approve the data model before any implementation begins. This phase prevents the AI from making irreversible design decisions without human oversight.

**Phase 3 (Implementation):** Build in strict order — terminologies first, then templates (referenced entities before referencing ones), then documents. Test each layer before proceeding. This phase prevents dependency violations and cascading errors.

**Phase 4 (Application Layer):** With the data model proven and populated, build the application logic, UI, and integrations on top. The data layer is already solid.

The golden rule throughout: never modify WIP itself. The AI consumes WIP’s APIs; it does not extend or alter the platform. This constraint is what keeps the AI within its competence boundary.

> **The key insight**
> WIP does not just store data for the AI. It disciplines the AI. The platform’s structural constraints act as guardrails that prevent the most common failure modes of AI-generated software: inconsistent schemas, unvalidated inputs, broken references, lost history, and unreproducible state. The AI is free to be creative in the domain layer. It is structurally prevented from being sloppy in the infrastructure layer.

## The MCP server: closing the last gap

WIP’s structural constraints discipline what the AI stores. But there remained a gap in how the AI interacts with WIP during development: composing raw HTTP calls, managing bulk request/response envelopes, and parsing error responses. These are mechanical tasks where mistakes are easy and debugging is tedious.

WIP’s MCP (Model Context Protocol) server closes this gap. It exposes WIP’s capabilities as native AI tools — `list_terminologies`, `create_template`, `validate_document`, `query_documents` — with the bulk-first complexity absorbed internally. The AI calls a tool and gets back a clean result or a clear error. It never constructs a URL, never wraps a payload in an array, never parses an HTTP-200-with-buried-failure response.

This creates a complete guardrail stack: WIP’s data model enforces structural correctness (what gets stored), the AI-Assisted Development process enforces procedural correctness (when things happen), and the MCP server enforces interaction correctness (how the AI communicates with WIP). At runtime, the `@wip/client` TypeScript library provides the same interface quality for the running application and its end users.

# The Unexpected Consequence: Your Data Becomes Conversational

The two theses above were the plan. What follows was not planned — it emerged from the implementation.

WIP's MCP server was built as a development tool. Its purpose was narrow: let the AI create terminologies, templates, and test documents during the development process without composing raw HTTP calls. A productivity enhancement for Phases 1–3.

But MCP is a protocol, not a feature of one tool. Any AI that speaks MCP can connect. And the tools the server exposes — `query_documents`, `search_terms`, `get_template_schema`, `get_ontology_relationships` — are not just development tools. They are a **general-purpose AI interface to all data in WIP.**

This changes everything.

## The BI layer is a conversation

Throughout the constellation use case documents, we described a "BI layer" that would sit on top of WIP and generate insights across apps. We imagined dashboards, SQL queries, Metabase configurations, chart widgets. A separate application that a technically skilled person would build and maintain.

With the MCP server, the BI layer is not an application. It is any AI assistant connected to WIP. The user doesn't build dashboards. They ask questions:

*"How much did I spend on groceries last month?"*
The AI calls `query_documents` on FIN_TRANSACTION with date and category filters. Done.

*"How does that compare to last year, adjusted for inflation?"*
The AI queries both periods, fetches CPI data, computes the comparison.

*"Show me the trend over 12 months."*
The AI queries, aggregates, and generates a chart — in the conversation, not in a dashboard.

*"I'm thinking about replacing my windows. Is it worth it?"*
The AI queries energy consumption (Meter Tracker), indoor temperatures (Climate Logger), current window specs (Equipment Registry), construction costs (external data), subsidy programmes (external data), your financial situation (Statement Manager), and property valuations (external data). It synthesises a reasoned answer. From your data. On your Raspberry Pi. In your kitchen. In whatever language you speak.

No SQL. No dashboard. No technical skill. Just a question and an answer, grounded in your own structured, validated, cross-linked data.

## The apps are the input layer. WIP is the integration layer. The AI is the output layer.

This reframes the entire constellation model:

**The apps** (Statement Manager, Receipt Scanner, Energy Monitor) exist to get data *in* — structured, validated, properly linked. They have UIs because data entry benefits from forms, import wizards, and visual feedback. Humans interact with apps to capture information.

**WIP** exists to store and connect the data — across apps, across domains, with validated schemas, versioned history, and referential integrity. WIP is the platform that ensures the data is trustworthy.

**The MCP server** exists to get insight *out* — in natural language, across any constellation, with no technical skill required. The AI reasons over the structured data and presents answers a human can act on.

This is a fundamentally different product from "a platform for building interconnected apps." It is a **personal data assistant** — one that knows your finances, your energy consumption, your home, your vehicles, your health, because you (or AI-built apps) have been feeding it structured data over time.

## Why this matters for non-technical users

A non-technical person will not build apps for fun. They will not write SQL queries. They will not configure Metabase dashboards. But they might:

- Import their bank statements once a month
- Photograph their receipts
- Log their energy meter readings
- Record when the boiler was serviced

If doing so means they can later *ask their AI assistant questions about their life* that no single app could answer — questions about their spending patterns, their energy efficiency, their renovation decisions, their total cost of raising a child — then the data entry has a clear, tangible payoff.

The barrier to insight drops from "learn SQL and build a dashboard" to "ask in your own language." The barrier to participation drops from "be a developer" to "enter your data."

## What WIP provides that makes this possible

An AI querying unstructured data (a folder of random files, a pile of CSVs) produces unreliable answers. It guesses at field meanings, hallucinates relationships, and cannot validate its own reasoning. This is the fundamental problem with "just dump everything into an LLM context window."

An AI querying WIP produces grounded answers because:

- **Terminologies** ensure values are standardised. "CHF" is always "CHF," not sometimes "Swiss Franc" and sometimes "SFr."
- **Templates** ensure structure is consistent. Every transaction has an amount, a date, a category, and an account reference. No surprises.
- **References** ensure relationships are real. A receipt linked to a transaction is a validated link, not a guess based on amount matching.
- **Versioning** ensures the AI sees current data. If a payslip was corrected, the AI sees the correction, not the original.
- **The reporting sync** enables SQL for complex aggregations. The MCP server can query PostgreSQL for analytics that would be inefficient as document-by-document retrieval.

Without this structure, conversational data access is a parlour trick. With it, the AI's answers are as trustworthy as the data — and WIP ensures the data is trustworthy.

# Where the Two Theses Meet

The two theses are independent claims, but they reinforce each other in a way that makes the experiment more powerful than either thesis alone.

## Thesis 1 needs Thesis 2 for velocity

The constellation model is compelling on paper, but building a dozen interconnected apps by hand is a significant engineering effort. If each app takes weeks to build, the cross-constellation value remains theoretical for a long time. AI-assisted development compresses this timeline dramatically. An AI that can take a domain description and produce working WIP templates, terminologies, and application code in hours rather than weeks makes it practical to build enough apps to actually experience the network effect.

## Thesis 2 needs Thesis 1 for meaning

AI-generated apps are impressive as demos but often feel hollow — technically functional but serving no real purpose. The constellation model gives AI-assisted development a meaningful mission: build apps that people actually use, that store data people actually care about, and that produce analysis people actually act on. The Financial constellation isn’t a toy. It’s a system for managing your real money, your real receipts, your real investments. If the AI can build that successfully, it proves something significant.

## Together: a graduated proof

The constellations are designed as a progression, and that progression doubles as an escalating test of AI-assisted development capability:

> **The ladder**
> Step 1: Build the Statement Manager (a single app, a single template, a handful of terminologies). Proves the process works at all. Step 2: Add the Receipt Scanner (a second app that references the first via transaction matching). Proves cross-app references work. Step 3: Add the Energy constellation (a second domain that links to the first through utility bills and equipment costs). Proves cross-constellation analysis works. Step 4: Execute the renovation worked example (a query spanning three constellations, five apps, and multiple external data sources). Proves the network effect is real, not theoretical.

Each step raises the bar. Each step is made feasible because WIP handles the infrastructure complexity that would otherwise overwhelm an AI developer. And each step produces a working system that a real person can use — not a demo that gets discarded after the presentation.

# What Makes WIP Suited to This Experiment

There are many backend platforms an AI could build on. What makes WIP particularly well-suited to this dual experiment?

**It is genuinely generic.** WIP has no opinion about your domain. It does not know what a receipt is, what a meter reading is, or what a vehicle is. It knows what a terminology is, what a template is, and what a document is. This means the same platform supports every constellation without modification — and the AI’s job is purely translational: map the user’s domain concepts onto WIP’s primitives.

**It enforces structure without limiting scope.** Templates are strict (every field is typed and validated), but you can define any template you want. Terminologies are controlled (every value is checked), but you can create any vocabulary you need. This combination of rigour and flexibility is exactly what an AI developer needs: freedom to model any domain, with a safety net that catches errors.

**It handles the hard infrastructure problems.** Identity resolution, versioning, referential integrity, soft delete, real-time reporting sync, file storage with reference tracking — these are problems that trip up experienced human developers, let alone AI agents. WIP solves them once, at the platform level, so that every application built on top inherits the solutions.

**It makes interoperability automatic.** Because all apps use the same primitives and write to the same stores, cross-app and cross-constellation queries require no integration work. The reporting sync pushes all document data to PostgreSQL in real time. A BI query that spans receipts, meter readings, and equipment records is just a SQL join. No ETL, no data migration, no API orchestration.

**It preserves everything.** Soft delete means no data is lost. Versioning means every change is recorded. This is important for an AI developer specifically, because it means mistakes are recoverable. A badly designed template version can be superseded; incorrectly categorised documents can be updated. The AI can iterate without destroying previous work.

# The Experiment

The experiment begins now, starting with the Personal Finance constellation as defined in the companion use case document series. The approach is deliberate:

## What will be built

The Financial constellation’s Statement Manager will be the first app implemented, following the AI-Assisted Development process from Phase 1 through Phase 4. It will be built by an AI assistant (Claude), with a human providing domain guidance and approval at each gate. Once the Statement Manager is operational, the Receipt Scanner will follow, introducing cross-app references and transaction matching. The Subscription Tracker and Investment Tracker will be added incrementally. The BI layer will grow as data accumulates.

If the Financial constellation succeeds, the Energy constellation will follow, introducing cross-constellation queries and external data integration. The Home Management constellation completes the series and delivers the convergence test: the renovation worked example that spans all three constellations.

## What will be observed

The experiment is designed to produce evidence for or against both theses. The questions being tested:

- **For Thesis 1 (shared backend value):** At what point does the cross-constellation analysis become genuinely useful — not just theoretically possible, but something you actually consult? Is there a threshold number of apps or constellations where the network effect becomes tangible? Or does the overhead of maintaining consistent data models outweigh the analytical benefit?

- **For Thesis 2 (AI-assisted development):** How far can an AI go with the structured process and WIP as guardrails? Where does it need human intervention beyond domain expertise? Are there recurring failure patterns? Does the process scale — does the tenth app go faster than the first, or does complexity accumulate?

- **For the convergence:** Does AI-assisted development actually produce the velocity needed to reach the network effect threshold before the user loses interest? If it takes too long to build enough apps, the cross-constellation value remains theoretical — and both theses fail in practice even if they’re correct in theory.

## What will be shared

The experiment will be conducted transparently. The use case documents (Parts 1, 2, 2.1, 3) are already available. As implementation proceeds, the following will be shared:

- The data models as designed (terminologies, templates, identity field choices)

- The AI’s development sessions — including mistakes, corrections, and process deviations

- The working applications, running on a live WIP instance

- Observations on what the AI handled well, what it struggled with, and what required human intervention

- Honest assessment of whether the theses hold up under real use

# An Invitation

This experiment is not a product launch. It is not a polished demo. It is a genuine exploration of two ideas that may or may not hold up in practice.

If you are interested in personal data management, the constellation use cases may resonate with problems you’ve tried to solve with spreadsheets, note-taking apps, or purpose-built tools that don’t talk to each other. Your experience with those tools — especially the frustrations — is valuable input.

If you are interested in AI-assisted development, the experiment offers a live case study of an AI building real applications on a real platform, with a structured process, under human supervision. The failure modes will be as instructive as the successes.

If you are interested in WIP itself, the constellations are a stress test. They will push the platform across multiple domains, multiple data models, and cross-cutting queries that exercise every primitive WIP offers. Any limitations or design gaps will surface quickly.

> **How to get involved**
> Watch the experiment as it unfolds. Read the use case documents and challenge the data models. Suggest constellations or satellites that would test the theses in new ways. Try building your own app on WIP using the AI-Assisted Development process and share what you learn. Or simply wait for results and judge the evidence on its merits. All of these are useful contributions.

The first implementation session begins with the Financial constellation’s Statement Manager. Let’s see how far this goes.
