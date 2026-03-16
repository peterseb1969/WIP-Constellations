# World In a Pie — Frequently Asked Questions

## General

### What is World In a Pie, really?

WIP is a generic, domain-agnostic storage and reporting engine. It knows nothing about your domain until you teach it through terminologies and templates. Think of it as a foundation layer that enforces data quality, manages identity, and stores anything — so that every application built on top of it inherits those properties automatically.

It is not a CRM, a CMS, or an ERP. It is what you build those on.

---

### Why does this exist? Isn't this problem already solved?

The tooling to build disciplined data systems has always existed. PostgreSQL, MongoDB, JSON Schema validation — none of this is new. What is new is the observation that **people never actually use it correctly under deadline pressure**.

Every project starts with good intentions: proper data modeling, controlled vocabularies, referential integrity. Then a deadline arrives, and someone says "let's put a placeholder list of values in place and fix it later." Nobody ever fixes it. By the time the mess hits production, the cost of fixing it is enormous.

WIP solves a behavioral problem, not a technical one. It makes the right thing the only path. You cannot store a document without a template. You cannot define a template without thinking about identity fields. The structure is enforced before the first record is written.

This matters especially for AI-generated applications, which are the worst offenders of schema shortcuts — they generate fast, beautiful-looking solutions with invisible data disasters underneath.

---

### Is this just another over-engineered backend framework?

It is opinionated, but the opinions are deliberate and come from hard experience in regulated data environments — specifically clinical trial operations, where data interoperability is not a nice-to-have but a legal requirement.

The complexity that might look like over-engineering is largely in the Registry — and the Registry is solving a real, universal problem: **you are almost never the authoritative source of your own data**. Your bank owns your account IDs. SNOMED owns clinical concept codes. PubChem owns chemical compound identifiers. Every application that integrates external data has to solve the foreign ID problem. WIP solves it once, transparently, for everything stored in the system.

---

## Hardware and Performance

### Does it really run on a Raspberry Pi?

Yes, but **a Raspberry Pi 5, not a Pi 4**. On an 8GB Pi 5 with SSD storage (see below), WIP runs comfortably with real headroom. On a 16GB Pi 5 it runs with plenty of room. Tested throughput exceeds 200 document registrations per second — stored in MongoDB and streamed to PostgreSQL simultaneously.

**Pi 4 is not recommended.** The architecture of WIP's stack is a step beyond what a Pi 4 handles gracefully.

---

### Why does SSD matter so much?

This is the single biggest performance variable in a Pi deployment, and it is not mentioned prominently enough in the documentation.

MongoDB's write performance on an SD card is a serious bottleneck. NATS JetStream persistence, PostgreSQL writes, and MinIO all compound this. On an SSD, these constraints effectively disappear. The 200+ docs/second figure is an SSD figure. On an SD card you will get a fraction of that and likely blame the platform.

**Use an SSD. This is not optional for any workload beyond evaluation.**

---

### The stack looks heavy — MongoDB, PostgreSQL, NATS, MinIO, Dex, Caddy, six microservices. Will this actually fit?

WIP is composable. Different presets let you run only the services relevant to your use case. If you do not need reporting sync, you do not run the reporting-sync service or PostgreSQL. If you do not need file storage, you do not run MinIO. A minimal deployment is significantly lighter than the full stack.

If you look at the stack and think "MongoDB isn't for a Pi," WIP is probably not the right tool for you — and that is fine. WIP is for people who want a full-featured data foundation, not a lightweight embedded store.

---

## Data Model and Design

### Why do I have to define terminologies and templates before I can store anything?

Because that constraint is the entire point.

Every system that allows you to store data without defining structure first eventually accumulates inconsistent data that is expensive to clean up. WIP enforces schema-first design as a hard requirement. You cannot skip it. This feels like overhead on day one and pays dividends on day thirty when you need to query across records and everything means what you thought it meant.

---

### What are identity fields and why do they matter so much?

Identity fields are the fields that make a document unique. WIP hashes them (SHA-256) to determine whether an incoming document is a new record or an update to an existing one.

Get them right and you get automatic versioning, deduplication, and business key resolution for free. Get them wrong — too many fields, too few fields, or the wrong fields — and either different records collide (overwriting each other) or every submission creates a new document with no versioning at all.

The rule of thumb: identity fields should answer exactly the question "is this the same real-world thing?" — no more, no less.

---

### Why does WIP never delete data?

This default comes from regulated data environments where audit trails are a legal requirement and the ability to reconstruct historical state is non-negotiable. Soft-delete (setting status to inactive) means historical references always resolve, nothing is ever irretrievably lost, and you can always answer "what did this record look like on date X?"

For Pi users and hobbyists, data volume is rarely a constraint that makes this painful. However, optional retention policies and hard-deletion of inactive document versions are on the roadmap for users who need explicit storage management.

**Exception:** Binary files stored in MinIO support hard-deletion after soft-delete, specifically to reclaim storage.

---

## The Registry

### The Registry seems complex. Do I actually need to understand it?

You need to understand one thing about it: **every entity in WIP gets its ID from the Registry, and multiple external identifiers can map to that same entity**.

Everything else — the federation potential, the composite key hashing, the synonym resolution cascade — flows from that. In practice, for most use cases, the Registry works transparently in the background. You notice it when you register synonyms at document creation time, and you appreciate it the first time you successfully reference a document using an external system's ID without writing any translation logic.

---

### What problem does the synonym mechanism actually solve?

The problem that every integration project faces but rarely names: **you are almost never the authoritative source of the data you work with**.

Your bank assigns your account ID. Your ERP vendor assigns customer numbers. Clinical trial sponsors assign protocol IDs. SNOMED, MedDRA, and PubChem assign codes for clinical and chemical concepts. When you integrate any of these into your application, you inherit a zoo of ID universes with no guaranteed uniqueness across providers.

WIP's synonym mechanism lets you register all of these external identifiers against a single canonical WIP ID. From that point on, any document in WIP can reference that entity using any of its known identifiers — the bank's ID, the ERP's ID, your own ID — and WIP resolves them all to the same record. Transparently, at lookup time, with no translation logic in your application.

This works equally well whether you are integrating a music library, a chemical compound database, or a clinical data provider.

---

### What about federation — running multiple WIP instances that share identity?

Federation is a future capability, not a current one. The Registry's architecture supports it as a natural extension — multiple autonomous WIP instances coordinating through a shared Registry, enabling cross-instance lookups and shared terminologies while keeping data where it was created.

The synonym mechanism and namespace isolation that exist today are the building blocks. But the value of the Registry does not depend on federation being implemented. The foreign ID management story is present and working today, in a single-instance deployment, for any use case that integrates external data.

---

## Audience and Use Cases

### Who is WIP actually for right now?

Honestly: technically curious people who want to watch an experiment unfold, and professionals in regulated data domains — particularly clinical trial operations — who recognise the data interoperability problems WIP is designed to solve.

WIP is currently a working experiment, not a packaged product. The companion repository [WIP-Constellations](https://github.com/peterseb1969/WIP-Constellations) is generating real evidence about whether non-trivial applications can genuinely be built on WIP in a day, by an AI agent, without writing backend code. That experiment will determine whether WIP can be packaged and distributed to a broader audience of ambitious hobbyists and developers.

---

### What are the best use cases for WIP?

WIP works best when you have:

- **Multiple data sources with different ID schemes** that need to coexist and interoperate
- **Regulated or audit-sensitive data** where full history and provenance matter
- **Multiple applications sharing the same underlying data** where consistency across apps is more important than speed of any one app
- **AI-generated application development** where enforcing schema discipline on the AI before it writes any data is valuable
- **Long-lived data** that needs to outlive the applications that created it
- **Controlled vocabulary requirements** — anywhere that "list of values" problems have burned you before

Concrete domains: clinical trial data management, configuration management, master data management, compliance records, IoT data collection, research data repositories, multi-tenant SaaS backends.

---

### What are bad use cases for WIP?

WIP is the wrong tool when:

- **You need raw write throughput above everything else** — WIP validates and registers every document; that is overhead by design
- **Your data model is truly simple and stable** — a single table with five columns does not need a generic storage engine
- **You need a workflow engine** — WIP stores and validates data; it does not orchestrate processes
- **You need real-time event streaming as a primary capability** — NATS is present for internal sync, not as a general-purpose event bus for your application
- **You want a managed cloud service** — WIP is self-hosted by design; if you want someone else to operate your infrastructure, look elsewhere
- **You are building something purely throwaway** — if the data genuinely does not matter after the app is retired, the structure WIP requires is unnecessary overhead

---

### Is WIP ready for enterprise use?

The architecture is enterprise-grade in its design principles — OIDC authentication, namespace isolation, audit trails, controlled vocabularies, referential integrity, federation-ready identity. The inspiration comes directly from enterprise challenges in clinical trial operations.

However, WIP is currently maintained by a single developer as an experiment. It has no commercial support, no SLA, and no dedicated operations team. For enterprise adoption, the packaging, documentation, and support model would need to mature significantly. The blueprint is sound; the productisation is not there yet.

---

## Development and Integration

### Can I migrate existing data into WIP without writing backend code?

This is what the [AI-Assisted-Development guide](https://github.com/peterseb1969/World-in-a-Pie/blob/main/docs/AI-Assisted-Development.md) is designed to enable. An AI agent reads the source data, proposes terminologies and templates, gets user approval on the data model, and loads the data via WIP's bulk APIs — without any custom backend code.

The brownfield migration capability is being validated in the WIP-Constellations experiment. Watch that repository for real-world evidence.

---

### Can I modify WIP to add domain-specific logic?

You should not, and the AI-Assisted-Development guide makes this a hard rule: **never change WIP, only consume it**.

WIP is deliberately generic. The moment you add domain-specific logic to its core, you lose the generic foundation that makes it valuable. All business logic — workflows, notifications, computed fields, domain rules — belongs in your application layer, which calls WIP's APIs. WIP validates data structure and manages identity. Your application does everything else.

---

### How does WIP handle data I do not own — external databases, third-party APIs, data copies from authoritative systems?

This is one of WIP's core strengths. When you receive a copy of data from an authoritative external system (your bank, a clinical data provider, a reference database), you register the external system's identifier as a synonym in the Registry. WIP assigns a canonical local ID. From that point forward, you can reference that entity using either identifier, and WIP maintains the mapping transparently.

This means your application code never needs to know which ID universe it is operating in. It always works with WIP IDs, and WIP handles resolution to and from whatever external identifiers are in play.

---

*This document was produced from a structured challenge-and-defence session examining WIP's architecture, target audience, and design tradeoffs. Last updated March 2026.*
