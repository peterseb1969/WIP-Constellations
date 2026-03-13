# World In a Pie: Vision

## The Problem

Modern applications often face a fundamental tension:

1. **Rigid schemas** provide consistency but resist change
2. **Schemaless storage** provides flexibility but sacrifices consistency
3. **Domain-specific systems** solve one problem well but don't generalize
4. **Enterprise platforms** generalize but are heavy and expensive

Organizations end up with multiple disconnected systems, inconsistent data quality, difficulty querying across silos, and vendor lock-in.

**WIP resolves this** by separating *structure definition* from *data storage*: store anything, as long as it conforms to a template that references a shared vocabulary.

## Philosophy

World In a Pie (WIP) is a **generic, domain-agnostic storage and reporting engine**. It is not an application—it is a foundation upon which applications are built.

### WIP Supports Nothing Out of the Box

This is intentional. WIP provides **primitives**, not solutions:

| Primitive | Purpose |
|-----------|---------|
| **Terminologies** | Controlled vocabularies (codes, values, aliases) |
| **Templates** | Document schemas with validation rules |
| **Documents** | Validated, versioned data storage |
| **Files** | Binary file storage with reference tracking (MinIO) |
| **Reporting** | SQL-accessible data via PostgreSQL sync |

These primitives are domain-agnostic. WIP doesn't know what a "patient", "invoice", or "sensor reading" is. You define that through terminologies and templates.

### The Console is Admin UI Only

The WIP Console (`/ui/wip-console`) is for **system administrators**:
- Define and manage terminologies
- Create and version templates
- Browse and validate documents
- Monitor reporting sync

It is **not** an end-user application. End users interact with custom applications built on top of WIP.

### Demo Apps are Built ON TOP of WIP

To demonstrate WIP's capabilities, demo applications must be built as **separate projects** that consume WIP's APIs. They should not modify WIP's core code.

```
┌─────────────────────────────────────────────┐
│           Custom Applications               │
│  (Patient Portal, Invoice System, IoT Hub)  │
├─────────────────────────────────────────────┤
│              WIP APIs                       │
│  Terminologies │ Templates │ Documents │ Files │ SQL│
├─────────────────────────────────────────────┤
│           WIP Infrastructure                │
│  MongoDB │ PostgreSQL │ NATS │ MinIO │ Dex/OIDC │
└─────────────────────────────────────────────┘
```

This separation ensures:
- WIP remains generic and reusable
- Each demo showcases real-world integration patterns
- The same WIP instance can power multiple unrelated applications

---

## Target Audience

WIP is designed for a diverse audience:

| Audience | Use Case |
|----------|----------|
| **Hobbyists** | Personal data management, home automation logs |
| **Developers** | Rapid prototyping with validated data storage |
| **AI/Automation** | Backend for AI-generated solutions |

The common requirement: **willingness to learn**. WIP rewards understanding of its primitives with flexibility and power.

---

## Integration Patterns

### Custom User Interfaces

Applications connect to WIP via its REST APIs:

```
Browser → Custom SPA → WIP APIs
                   ↘ Same OIDC provider (any OIDC-compliant provider)
```

Applications with server-side business logic can also proxy WIP API calls using API key authentication.

### Authentication

- **User authentication**: OIDC via any compliant provider (Dex ships as the default)
- **Service authentication**: API keys for system-to-system calls
- **Custom apps**: Share the same OIDC provider for SSO experience

### Event-Driven Integration

NATS JetStream powers event-driven sync from MongoDB to PostgreSQL. All document and entity changes publish events that consumers can subscribe to:

| Direction | Status | Use Case |
|-----------|--------|----------|
| WIP internal | Implemented | MongoDB → PostgreSQL reporting sync via NATS JetStream |
| WIP → External | Available via NATS subscription | React to document changes |
| External → WIP | Planned (streaming ingest) | High-volume data ingestion |

### Business Logic

**All business logic lives in the application layer**, not in WIP.

WIP provides:
- ✅ Data validation (type checking, term validation, cross-field rules)
- ✅ Identity-based versioning
- ✅ Audit trail (what changed, when, by whom)

WIP does **not** provide:
- ❌ Business workflows
- ❌ Notifications
- ❌ Custom computed fields
- ❌ Domain-specific logic

These belong in your application.

---

## The Registry: Federated Identity Foundation

At the heart of WIP lies the **Registry**—a service that may seem simple but enables powerful capabilities: **universal identity, cross-system integration, and federation**.

### Centralized ID Generation

Every entity in WIP receives its ID from the Registry:

| Entity Type | Default ID Format | Configurable |
|-------------|-------------------|--------------|
| Terminologies | UUID7 | Per namespace (e.g., `TERM-000001`) |
| Terms | UUID7 | Per namespace (e.g., `T-000001`) |
| Templates | UUID7 | Per namespace (e.g., `TPL-000001`) |
| Documents | UUID7 | Per namespace |
| Files | UUID7 | Per namespace (e.g., `FILE-000001`) |

All IDs default to UUID7 (time-ordered, globally unique). Custom namespaces can configure sequential prefixed formats (e.g., the default `wip` namespace uses `TERM-`, `T-`, `TPL-`, `FILE-` prefixes).

This centralization provides:
- **Guaranteed uniqueness** across all services
- **Predictable formats** supported as a configuration option per namespace (prefixed IDs are human-readable)
- **Time-ordering** (UUID7 enables chronological sorting by default)
- **Single source of truth** for identity

### The Synonym Philosophy

Here's where the Registry becomes powerful: **multiple identifiers can resolve to the same entity**.

```
Registry ID: TPL-000001 (preferred/canonical)
    │
    ├── Synonym: legacy_system:OLD-TPL-42
    ├── Synonym: external_api:template_abc
    └── Synonym: partner_org:contract-template-v3
```

**Why this matters:**

1. **Legacy Integration**: When migrating from an old system, the old IDs continue to work. Both `legacy_system:OLD-TPL-42` and `TPL-000001` resolve to the same template.

2. **External References**: Partner systems can reference entities using their own naming conventions. The Registry maps these to canonical WIP IDs.

3. **Vendor Onboarding**: A new supplier uses their own product catalog IDs (`VENDOR-A:SKU-9821`). Their products already exist in your Registry under canonical IDs. By adding synonyms, the vendor's IDs resolve to existing entries without requiring the vendor to adopt your naming scheme.

4. **Cross-System Identity**: The same real-world entity (a customer, a product) can be referenced by different IDs in different systems—all mapped to one canonical ID.

### Federation Potential

The Registry is designed for a future where **multiple WIP instances share identity coordination**:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   WIP #1    │     │   WIP #2    │     │   WIP #3    │
│  (Berlin)   │     │  (London)   │     │   (Tokyo)   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                    ┌──────┴──────┐
                    │  Registry   │
                    │  (Central)  │
                    └─────────────┘
```

**Current state**: Single Registry per WIP instance.

**Future vision**: A single Registry coordinating multiple autonomous WIP instances:

| Operation | How It Works |
|-----------|--------------|
| **Lookup** | "Who has entity X?" → "Instance #2 in London" |
| **Proxy** | "Get entity X" → forwards request to Instance #2 → returns result |
| **Sync** | Terminologies and templates can be shared across instances |
| **Local autonomy** | Each instance operates independently; Registry provides coordination |

This enables:
- **Distributed deployments** across geographic regions
- **Data sovereignty** (data stays where it was created)
- **Cross-instance queries** without data replication
- **Organizational separation** with shared vocabularies

**Not yet implemented**, but the Registry's architecture is designed for it. The synonym mechanism and namespace isolation are building blocks for federation.

### Composite Key Registration

Every entity is registered with a **composite key**—a set of fields that uniquely identify it:

```python
# Terminology composite key
{
    "namespace": "wip",
    "entity_type": "terminologies",
    "composite_key": {
        "value": "GENDER",
        "label": "Gender"
    }
}
# → Generates: TERM-000001

# Term composite key
{
    "namespace": "wip",
    "entity_type": "terms",
    "composite_key": {
        "terminology_id": "TERM-000001",
        "value": "M",
        "label": "Male"
    }
}
# → Generates: T-000001
```

Composite keys serve three purposes:

1. **Identity**: The composite key establishes what makes an entity unique. Two registrations with the same composite key refer to the same entity.

2. **Upsert behavior**: If the same composite key is registered again, the **existing ID is returned** (idempotent). This drives the create-or-update decision — the caller knows whether they created a new entity or matched an existing one.

3. **Efficient search**: The composite key is hashed (SHA-256) into a single value. This enables fast lookups even when composite keys have different structures (e.g., a terminology keyed on `{code, name}` vs. a term keyed on `{terminology_id, code, value}`). The hash provides a uniform index regardless of key shape.

---

## Term Aliases vs Registry Synonyms

WIP has two distinct mechanisms for mapping alternative names to canonical entities. They operate at different levels and serve different purposes:

| Feature | Term Aliases (Def-Store) | Registry Synonyms |
|---------|--------------------------|-------------------|
| **Scope** | Within a terminology | Across all entity types |
| **Purpose** | Accept variant user input for a term | Map external/legacy IDs to canonical IDs |
| **Example** | "Mr.", "MR", "MALE" all resolve to term "Male" | `legacy_system:OLD-TPL-42` resolves to `TPL-000001` |
| **Stored in** | Term record (`aliases` array) | Registry synonym table |
| **Used during** | Document validation (matching user input) | Cross-system integration and migration |

### Term Aliases

Term aliases handle the problem of **user input variation**. A term for "Male" might be entered as "M", "Mr", "Mr.", or "MALE". Rather than rejecting these, the Def-Store resolves them:

```json
{
  "term_id": "T-000001",
  "code": "M",
  "value": "Male",
  "aliases": ["MR", "Mr", "Mr.", "MALE", "mr"]
}
```

During validation, the response tells you **how** the input was matched:

```json
{
  "input_value": "Mr.",
  "valid": true,
  "term_id": "T-000001",
  "matched_via": "alias",
  "normalized_value": "Male"
}
```

### Registry Synonyms

Registry synonyms solve a different problem: **cross-system identity**. When external systems use their own identifiers for entities that already exist in WIP, synonyms map those external IDs to canonical WIP IDs without requiring the external system to change.

This is essential for legacy migrations, partner integrations, and multi-system environments where the same real-world entity has different identifiers in different systems.

---

## Multi-Tenancy

WIP supports multi-tenancy for scenarios where multiple independent use cases share infrastructure:

### For Hobbyists and Small Deployments

A single WIP instance can serve multiple unrelated purposes:

```
WIP Instance (Raspberry Pi)
├── Namespace: home-automation
│   ├── Terminologies: SENSOR_TYPE, ROOM, ...
│   ├── Templates: SENSOR_READING, DEVICE_STATUS
│   └── Documents: sensor readings, device logs
│
├── Namespace: personal-finance
│   ├── Terminologies: CATEGORY, ACCOUNT_TYPE, ...
│   ├── Templates: TRANSACTION, BUDGET
│   └── Documents: transactions, budgets
│
└── Namespace: recipe-collection
    ├── Terminologies: CUISINE, DIFFICULTY, ...
    ├── Templates: RECIPE, INGREDIENT
    └── Documents: recipes
```

### Isolation Mechanisms

| Mechanism | Level | Description |
|-----------|-------|-------------|
| **Namespaces** | ID generation | Separate ID sequences per namespace |
| **Template codes** | Schema | Use prefixes (e.g., `FINANCE_TRANSACTION`) |
| **Groups** | Access control | OIDC groups for authorization |
| **PostgreSQL schemas** | Reporting | Separate schemas per tenant (future) |

---

## Design Principles

### 1. Never Delete, Only Deactivate

Data is never physically deleted. Documents, templates, and terms are soft-deleted (`status: inactive`). This ensures:
- Historical references always resolve
- Audit trails remain complete
- Recovery is always possible

**Exception:** Binary files (stored in MinIO) support an optional hard-delete after soft-delete, to reclaim storage. Domain entities in MongoDB are never hard-deleted.

### 2. References Must Resolve

Every reference (term_id, template_id, document_id) must point to an existing entity. The system validates references and warns about inactive targets.

### 3. Preserve Original Values

Documents store both the original submitted value AND the resolved reference. This supports:
- Audit compliance (what was actually submitted)
- Data recovery (original values available)
- ETL flexibility (transform in reporting layer, not source)

### 4. Configuration Over Code

Backend selection, auth providers, and sync behavior are configured via environment variables and config files—not code changes.

### 5. Pluggable Architecture

Every major component has an abstraction layer:
- Storage: MongoDB now, SQLite later
- Auth: Dex ships as default, any OIDC-compliant provider works
- Reporting: PostgreSQL now, other SQL databases possible

---

## Benefits

### For Developers

- **No schema migrations** — templates define structure, not database schemas
- **Self-documenting** — templates and definitions serve as documentation
- **API consistency** — same REST API regardless of data type

### For Data Managers

- **Single source of truth** — all definitions in one place
- **Controlled vocabulary** — terminology enforced across all data
- **Data quality** — validation prevents bad data entry
- **Audit trail** — full history of all changes

### For Organizations

- **Reduced silos** — one system for many data types
- **Lower costs** — runs on minimal infrastructure
- **Vendor independence** — open source, portable

### For Analysts

- **Consistent data** — same field means the same thing everywhere
- **Query flexibility** — JSON queries or SQL via reporting layer
- **Historical analysis** — query data at any point in time

---

## Design Tradeoffs

Every architecture involves tradeoffs. WIP makes these deliberately:

| We Prioritize | Over | Because |
|---------------|------|---------|
| Flexibility | Raw performance | Most systems are I/O bound, not CPU bound |
| Validation | Ingestion speed | Catching errors early saves time later |
| Portability | Deep platform integration | Independence is more valuable long-term |
| Simplicity | Feature richness | Simple systems are maintainable systems |
| JSON | Binary formats | Human-readable is debuggable |

---

## Use Cases

WIP is well-suited for:

| Use Case | Why WIP Works |
|----------|---------------|
| **Research data management** | Flexible schemas, full provenance |
| **Configuration management** | Versioned, validated configs |
| **Master data management** | Single source of truth, cross-system identity |
| **Content management** | Template-driven content types |
| **IoT data collection** | Lightweight, runs at the edge |
| **Compliance records** | Audit trail, never-delete policy |
| **Multi-tenant SaaS** | Same engine, different templates per tenant |

---

## What WIP Is Not

| WIP is NOT... | Instead... |
|---------------|------------|
| A CRM | Build a CRM on WIP |
| A CMS | Build a CMS on WIP |
| An ERP | Build ERP modules on WIP |
| A workflow engine | Integrate with workflow tools that consume WIP APIs |
| A low-code platform | It's a backend; build your own UI or use AI-generated code |

---

## Summary

World In a Pie is a **meta-system**: a validated, versioned, SQL-queryable data layer that knows nothing about your domain until you teach it through terminologies and templates.

Its power comes from what it **doesn't** do—by staying generic, it becomes a foundation for anything.
