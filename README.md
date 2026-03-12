# WIP Constellations

*A shared backend for personal data. A guardrail for AI-assisted development.*

---

## What is this?

An experiment testing two ideas at once:

**Thesis 1 — The network effect of personal data.** When multiple apps share a common backend, the value of the system grows non-linearly. Each new app retroactively increases the value of every existing app by enabling cross-dataset queries that would be impractical to build as point-to-point integrations. Nobody would build a custom integration between their wine collection app and their child's school fee tracker. But if both already write to WIP, the query is just there, waiting to be asked.

**Thesis 2 — AI-assisted development needs guardrails, not freedom.** An AI making hundreds of infrastructure decisions from scratch produces software that works initially and decays rapidly. A well-structured platform like [WIP](https://github.com/WorldInAPie) constrains the AI's degrees of freedom to exactly the decisions where human judgment matters most: *which terminologies does this domain need? which templates represent its entities? which fields determine identity?* Everything else — storage, validation, versioning, referential integrity, queryability — is enforced by the platform.

Neither thesis is proven. Both are plausible. This repository contains the documentation, design specifications, and (eventually) the applications that will test them.

## What is WIP?

[World In a Pie](https://github.com/WorldInAPie) is a generic, domain-agnostic storage and reporting engine. It provides six primitives:

| Primitive | Purpose |
|-----------|---------|
| **Registry** | Universal identity, synonym resolution, namespace isolation, federation |
| **Terminologies & Ontologies** | Controlled vocabularies, with typed relationships for semantic modelling |
| **Templates** | Document schemas with typed fields and validation rules |
| **Documents** | Versioned data that conforms to templates |
| **Files** | Binary storage with reference tracking (MinIO/S3) |
| **Reporting** | Automatic sync to PostgreSQL for SQL analysis |

WIP doesn't know what a receipt, a meter reading, or a vehicle is. You define that through terminologies and templates. WIP handles the rest: schema validation, controlled vocabularies, referential integrity, identity-based versioning, soft delete, and real-time reporting sync.

### Terminologies and ontologies

Terminologies are controlled vocabularies — flat lists or single-parent hierarchies of terms with aliases for real-world messiness ("Mr.", "MR", "MALE" all resolve to "Male"). But WIP goes further: terms can have **typed relationships** with each other, turning a simple vocabulary into a semantic model.

A term can have multiple parents (`is_a`), be part of another (`part_of`), map to terms in other vocabularies (`maps_to`), or relate associatively (`related_to`). Relationship types are themselves a WIP terminology, so domains can define their own. This enables polyhierarchy (a concept belonging to multiple branches), cross-terminology links, and traversal queries (ancestors, descendants) — enough to faithfully import standard ontologies like SNOMED CT, ICD-10, or any SKOS thesaurus without losing structural information.

The design philosophy: **WIP captures and serves ontology structure; reasoning is downstream.** OWL-DL axioms are preserved in metadata for round-trip fidelity but not evaluated at data capture time. This keeps WIP lightweight while supporting serious semantic modelling for domains that need it.

### The Registry: the heart of WIP

At the centre of every WIP operation sits the **Registry** — a federated identity service that every other service depends on. Every entity in WIP (terminology, term, template, document, file) receives its ID from the Registry. Nothing exists without being registered first.

But ID generation is just the entry point. The Registry's real power is **synonyms**: multiple identifiers can resolve to the same canonical entity. A template might be `TPL-000001` inside WIP, `OLD-TPL-42` in a legacy system, and `contract-template-v3` at a partner organisation — all resolving to the same entity. This means legacy IDs keep working after migration, external systems integrate without adopting your naming scheme, and the same real-world entity is never duplicated just because different systems call it different things.

Identity is established through **composite keys** — a set of fields that define what makes an entity unique (e.g., `{code, name}` for a terminology, `{terminology_id, code, value}` for a term). Submitting the same composite key returns the existing ID (idempotent upsert). The composite key is SHA-256 hashed for uniform indexing regardless of key shape.

The Registry also provides **namespace isolation** — separate ID sequences and configurable formats per namespace (UUID7 by default, or human-readable prefixed sequences like `TERM-000001`). This powers multi-tenancy: a single WIP instance can serve personal finance, home automation, and recipe management in isolated namespaces on the same Raspberry Pi.

The architecture is designed for **federation**: a future where a central Registry coordinates multiple autonomous WIP instances across locations, enabling cross-instance lookups and queries while each instance retains data sovereignty. Not yet implemented, but the synonym mechanism and namespace isolation are the building blocks.

## What are constellations?

Constellations are clusters of apps that each work independently but become dramatically more valuable when their data coexists in a shared backend.

### Personal Finance *(foundational — building first)*
- **Statement Manager** — Bank and employer statement normalisation
- **Receipt Scanner** — Line-item extraction via OCR, transaction matching
- **Investment Tracker** — Holdings, valuations, performance
- **Subscription Tracker** — Recurring charge detection and monitoring
- **BI Layer** — Cross-app dashboards and analysis

### Energy & Sustainability
- Utility metering and tariff analysis
- Solar production monitoring
- Home climate logging
- External enrichment: weather, grid carbon intensity

### Vehicle & Mobility *(satellite — bridges energy and finance)*
- Fuel and charging logs
- Trip classification
- Service history and total cost of ownership

### Home Management *(convergence point)*
- Equipment registry and maintenance logging
- Network inventory
- Renovation planning — the ultimate cross-constellation test

> **The renovation question:** Should I replace these windows? The answer draws on energy data (consumption per heating degree day), climate measurements (temperature stability), equipment records (current window specs), construction costs, subsidy rules, financial records (affordability), and property valuations (ROI). No single app produces this analysis. But if every app writes to WIP, it's a SQL query.

## How the two theses reinforce each other

Thesis 1 needs Thesis 2 for **velocity**. Building a dozen interconnected apps by hand is too slow to reach the network effect before interest fades. AI-assisted development compresses the timeline from weeks per app to hours.

Thesis 2 needs Thesis 1 for **meaning**. AI-generated apps are impressive as demos but often feel hollow. The constellations give AI development a real mission: build apps that manage real money, real receipts, real energy data — software people actually use.

The constellations form a graduated proof:

1. **Single app** (Statement Manager) — proves the process works at all
2. **Cross-app references** (Receipt Scanner matching transactions) — proves inter-app data linking works
3. **Cross-constellation queries** (Energy + Finance via utility bills) — proves the shared backend adds real value
4. **Multi-constellation analysis** (renovation decision spanning three constellations) — proves the network effect

## Repository structure

```
WIP-instructions/          Development process & API reference
  Vision.md                Philosophy and core concepts
  AI-Assisted-Development.md   4-phase process with strict gates
  api-conventions.md       Bulk-first API patterns (read this first)
  architecture.md          Microservices architecture
  HOW-TO.md                Curl examples for all APIs
  authentication.md        API key & OIDC setup
  semantic-types.md        Field validation patterns

docs/                      Use cases & design specifications
  WIP_TwoTheses.md         The full argument for both theses
  WIP_DevGuardrails.md     UI stack, deployment, app skeleton conventions
  WIP_ClientLibrary_Spec.md    @wip/client and @wip/react design
  WIP_UseCase_PersonalFinance.md
  WIP_UseCase_Energy.md
  WIP_UseCase_Vehicle.md
  WIP_UseCase_HomeManagement.md
```

## The experiment

This will be conducted transparently. As implementation proceeds, the following will be shared:

- Data models as designed (terminologies, templates, identity field choices)
- AI development sessions — including mistakes, corrections, and process deviations
- Working applications running on a live WIP instance
- Observations on what the AI handled well and where it needed human intervention
- Honest assessment of whether the theses hold up under real use

The questions being tested:

- At what point does cross-constellation analysis become genuinely useful — something you actually consult, not just theoretically possible?
- How far can an AI go with the structured process and WIP as guardrails? Where does it need human intervention beyond domain expertise?
- Does AI-assisted development produce the velocity needed to reach the network effect threshold before the user loses interest?

## Get involved

This is not a product launch. It is an exploration of two ideas that may or may not hold up in practice.

- **If you care about personal data management** — the constellation use cases may resonate with problems you've tried to solve with spreadsheets and disconnected apps. Your frustrations are valuable input.
- **If you care about AI-assisted development** — this is a live case study with a structured process, under human supervision. The failure modes will be as instructive as the successes.
- **If you care about WIP** — the constellations are a stress test across multiple domains, data models, and cross-cutting queries that exercise every primitive WIP offers.

Read the use case documents and challenge the data models. Suggest constellations that would test the theses in new ways. Try building your own app on WIP. Or wait for results and judge the evidence on its merits.

---

*The first implementation session begins with the Financial constellation's Statement Manager. Let's see how far this goes.*
