# AI-Assisted Development on WIP

## Purpose

This document defines a **strict, phased process** for an AI assistant (such as Claude) to build applications on top of World In a Pie (WIP). The AI acts as a developer; WIP acts as the backend. The AI must never modify WIP itself—only consume its APIs.

### The Golden Rule

> **Never, ever change WIP. The mission is to leverage it.**

WIP is a generic, domain-agnostic storage and reporting engine. It provides primitives (terminologies, templates, documents, reporting). The AI's job is to map a user's domain onto those primitives and build an application layer on top.

---

## Prerequisites

Before starting, the AI needs:

1. **Access to this file** and `Vision.md` in the same directory
2. **Network access** to a running WIP instance (hostname + port)
3. **An API key** or OIDC credentials for authentication
4. **A user** who knows what they want to store and why

---

## Phase 1: Exploratory

**Goal:** Understand WIP's capabilities by reading documentation and probing live APIs.

**Gate:** Do not proceed to Phase 2 until the AI can explain WIP's core concepts and has cataloged all available API endpoints.

### Step 1.1: Read All Local Documentation

Read every `.md` file in the project directory. Pay special attention to:

- **Vision.md** — Philosophy, primitives, Registry, synonym management, federation potential
- **This file** — The development process you must follow
- Any additional docs the user provides (architecture, data models, authentication)

Key concepts the AI **must** internalize:

| Concept | What It Means | Why It Matters |
|---------|---------------|----------------|
| **Registry** | Central ID generator and identity resolver for all entities | Every entity gets its ID from the Registry. IDs are namespaced and guaranteed unique. The Registry also resolves synonyms and external identifiers. |
| **Synonyms** | Multiple identifiers resolving to one entity | Legacy IDs, aliases, and external references all map to a canonical WIP ID. Synonyms are first-class citizens — as fast to look up as canonical IDs. |
| **Terminologies** | Controlled vocabularies (value + aliases) | The building blocks of validated data. Terms are resolved by value or alias. |
| **Templates** | Document schemas with typed fields and validation | Define what data looks like. Fields can reference terminologies, other documents, and more. |
| **Documents** | Validated, versioned data conforming to a template | The actual data. Identity fields determine uniqueness; same identity = new version. |
| **Identity Hash** | SHA-256 of identity fields | How WIP decides if a document is new or an update to an existing one. **Get identity fields wrong and versioning breaks.** |
| **References** | Typed, validated links between documents | Documents can reference other documents via `type: "reference"` fields. WIP validates and resolves references automatically. |
| **Reporting Sync** | Real-time MongoDB to PostgreSQL sync via NATS | Enables SQL queries over document data. Must be configured per template. |
| **Namespaces** | Logical partitions for IDs (pools) | Each namespace has its own ID sequence and format. Cross-namespace search is supported. |
| **File Storage** | Binary files stored in MinIO (S3-compatible) | Files are first-class entities with Registry IDs (FILE-XXXXXX), reference tracking, and orphan detection. Linked to documents via `type: "file"` fields. |
| **Soft Delete** | Nothing is ever physically deleted | Entities are set to `status: inactive`. Historical references always resolve. Exception: files support hard-delete after soft-delete to reclaim MinIO storage. |

### Step 1.2: Ask the User for Connection Details

Ask the user:

1. **What is the WIP hostname?** (e.g., `localhost`, `wip-pi.local`, `wip.example.com`)
2. **What ports are the services running on?** (defaults: Registry 8001, Def-Store 8002, Template-Store 8003, Document-Store 8004, Reporting-Sync 8005)
3. **What authentication method is configured?** (API key, OIDC/JWT, or dual mode)
4. **What is the API key?** (if applicable)
5. **Is the WIP Console available?** (typically port 3000 or 8443)
6. **Is Mongo Express available?** (typically port 8081 — useful for inspecting raw data)

### Step 1.3: Catalog Available APIs

Fetch the OpenAPI/Swagger documentation from each running service:

```bash
# Fetch Swagger docs from each service
curl -s http://<hostname>:8001/docs       # Registry
curl -s http://<hostname>:8002/docs       # Def-Store
curl -s http://<hostname>:8003/docs       # Template-Store
curl -s http://<hostname>:8004/docs       # Document-Store
curl -s http://<hostname>:8005/docs       # Reporting-Sync (if available)
```

For each service, record:

- All available endpoints (method + path)
- Request/response schemas
- Required vs optional parameters
- Authentication requirements
- Bulk operation endpoints (these are important for efficiency)

**Do not rely solely on documentation.** The Swagger docs are the source of truth for what the API actually accepts.

### Step 1.4: Verify Connectivity

Test authentication and basic connectivity:

```bash
# Test API key authentication
curl -s -H "X-API-Key: <key>" http://<hostname>:8002/api/def-store/terminologies | head -20

# Check what already exists in WIP
curl -s -H "X-API-Key: <key>" http://<hostname>:8002/api/def-store/terminologies | jq '.items | length'
curl -s -H "X-API-Key: <key>" http://<hostname>:8003/api/template-store/templates | jq '.items | length'
curl -s -H "X-API-Key: <key>" http://<hostname>:8004/api/document-store/documents | jq '.total'
```

### Step 1.5: Inventory Existing Data

**This step is critical.** Before designing anything, check what already exists:

- List all terminologies and their codes
- List all templates and their codes
- Note active vs inactive entities

Do not recreate terminologies or templates that already exist in WIP. Reuse what is there. A WIP instance may already have `COUNTRY`, `GENDER`, `CURRENCY`, or other common vocabularies loaded.

---

## Phase 2: Data Model Design

**Goal:** Translate the user's domain into WIP primitives (terminologies, templates, documents).

**Gate:** Do not proceed to Phase 3 until the user has explicitly approved the proposed data model.

### Step 2.1: Gather Domain Knowledge

Ask the user:

1. **What data do you need to store?** Ask for examples, spreadsheets, JSON files, CSVs, or plain descriptions.
2. **What are the entities?** (e.g., patients, invoices, sensor readings, recipes)
3. **What fields does each entity have?** Ask for specifics: names, types, which fields have controlled values.
4. **What makes each entity unique?** These become identity fields in the template.
5. **Are there relationships between entities?** (e.g., an order has line items, a patient has visits)
6. **Do external systems have their own IDs for these entities?** These become synonyms.

If the user provides files (CSV, XLSX, JSON), analyze them to:
- Identify columns/fields and their data types
- Detect columns with repeating values (candidates for terminologies)
- Identify natural keys (candidates for identity fields)
- Note data quality issues (nulls, inconsistencies, varying formats)

### Step 2.2: Identify Terminologies

For every field with controlled/repeating values, propose a terminology:

| Field in User's Data | Proposed Terminology | Rationale |
|----------------------|---------------------|-----------|
| Status column with "Active", "Inactive", "Pending" | `ORDER_STATUS` | Controlled vocabulary, limited set |
| Country names in various formats | `COUNTRY` (may already exist) | Needs aliases for "UK", "United Kingdom", "GB" |
| Category codes | `PRODUCT_CATEGORY` | Hierarchical controlled values |

**Synonym awareness:** For each terminology, think about aliases. Real-world data is messy:
- "United Kingdom", "UK", "GB", "Great Britain" should all resolve to the same term
- "M", "Male", "Mr", "Mr." should all resolve to the same term
- Old codes from legacy systems should be registered as synonyms

### Step 2.3: Design Templates

For each entity, design a WIP template. **This is the most critical step** — template design determines everything that follows.

```
Template: <CODE>
  Name: <Human-readable name>
  Identity Fields: [<fields that determine uniqueness>]
  Fields:
    - name: <field_name>
      label: <Human-readable label>
      type: string | number | integer | date | boolean | term | array | object | reference
      required: true | false
      terminology_ref: <TERMINOLOGY_CODE>  (for term-type fields only)
      reference_type: document | term       (for reference-type fields only)
      target_templates: [<TEMPLATE_CODE>]   (for document references)
  Reporting:
    sync_enabled: true
    sync_strategy: latest_only
```

#### Template Field Rules

- **Every field needs a `label`** — this is required by the Template-Store
- **`type: term`** fields must have `terminology_ref`
- **`type: reference`** fields must have `reference_type` and `target_templates` (for document refs) or `target_terminologies` (for term refs). Add `include_subtypes: true` to also accept documents from child templates.
- **`type: object`** fields use `template_ref` to reference another template for nested structure
- **`type: array`** fields use `items` with a full field definition
- **`type: file`** fields link binary files stored in MinIO. Use `file_config` to constrain allowed types and sizes.
- **Semantic type hints** can be added via `semantic_type`: `email`, `url`, `percentage`, `duration`, `geo_point`, `latitude`, `longitude`

#### Identity Fields — Get These Right

> **Identity fields are the single most important design decision.** They determine what makes a document unique and control WIP's entire versioning behavior.

**How identity fields work:**

1. WIP computes a SHA-256 hash of the identity field values
2. When a new document is submitted:
   - If a document with the same identity_hash exists → **new version** (old version deactivated)
   - If no document with that hash exists → **new document**

**If you define no identity fields, every POST creates a brand new document. You get no versioning, no deduplication, nothing.**

**Good identity field choices:**

| Entity | Identity Fields | Why |
|--------|----------------|-----|
| Person | `["email"]` | Email is unique per person |
| Order | `["order_number"]` | Business assigns unique order numbers |
| Invoice Line | `["invoice_number", "line_number"]` | Composite: line is unique within an invoice |
| Sensor Reading | `["sensor_id", "timestamp"]` | Each sensor produces one reading per timestamp |
| Country | `["iso_code"]` | ISO codes are globally unique |

**Bad identity field choices:**

| Entity | Bad Choice | Problem |
|--------|-----------|---------|
| Person | `["first_name", "last_name"]` | Two "John Smith"s collide — one overwrites the other |
| Order | `[]` (none) | Every submission creates a new document, no versioning |
| Invoice | `["invoice_number", "amount", "date", "customer"]` | Correcting the amount creates a new document instead of a new version |
| Sensor | `["sensor_id"]` | All readings from the same sensor overwrite each other — you keep only the latest |

**The rule of thumb:** Identity fields should include exactly the fields that answer "is this the same real-world thing?" — no more, no less.

#### Reference Fields — Linking Documents

Use `type: "reference"` whenever one document points to another. **Never use `type: "string"` for cross-document links** — you lose validation, resolution, and referential integrity.

```json
{
  "name": "customer",
  "label": "Customer",
  "type": "reference",
  "reference_type": "document",
  "target_templates": ["CUSTOMER"],
  "mandatory": true
}
```

**What this gives you:**
- WIP validates the referenced document exists
- WIP validates it conforms to one of the `target_templates`
- WIP stores the resolved document_id and identity_hash
- The reference survives document versioning (follows identity_hash chain)

**Version strategy** (optional, defaults to `latest`):
- `latest` — always resolves to the current active version of the referenced document
- `pinned` — locks to the exact version at creation time (for audit compliance)

**Polymorphic references** — a field can accept documents from multiple templates:

```json
{
  "name": "parent_entity",
  "label": "Parent",
  "type": "reference",
  "reference_type": "document",
  "target_templates": ["STUDY_DEFINITION", "STUDY_ARM", "STUDY_TIMEPOINT"]
}
```

**Inheritance-aware references** — use `include_subtypes` to automatically accept child templates:

```json
{
  "name": "entity",
  "label": "Entity",
  "type": "reference",
  "reference_type": "document",
  "target_templates": ["BASE_ENTITY"],
  "include_subtypes": true
}
```

With `include_subtypes: true`, WIP expands `target_templates` at validation time to include all templates that inherit from `BASE_ENTITY` (directly or indirectly). This is useful when you have a template hierarchy and want a reference field to accept any member of the hierarchy without maintaining an explicit list.

> **Reference validation is template-exact by default.** If a reference field specifies `target_templates: ["PARENT_TEMPLATE"]`, only documents created with that exact template are accepted. Documents created with child templates that extend `PARENT_TEMPLATE` are **not** automatically accepted, even though they inherit from it.
>
> **To accept child templates**, you have two options:
> 1. **`include_subtypes: true`** (recommended) — add this to the field definition and WIP will automatically expand `target_templates` to include all descendant templates at validation time
> 2. **Explicit listing** — manually list every accepted template code in `target_templates`

#### Reporting Configuration

If the user needs SQL access to the data, configure reporting on each template:

```json
{
  "reporting": {
    "sync_enabled": true,
    "sync_strategy": "latest_only",
    "table_name": "doc_customer"
  }
}
```

| Setting | Options | Default | Description |
|---------|---------|---------|-------------|
| `sync_enabled` | true/false | false | Sync to PostgreSQL |
| `sync_strategy` | `latest_only`, `all_versions`, `disabled` | `latest_only` | Which versions to sync |
| `table_name` | string | `doc_{code}` | PostgreSQL table name |
| `flatten_arrays` | true/false | true | Expand arrays into rows |

**If the user mentions reporting, dashboards, or SQL — always enable reporting sync.**

#### File Fields — Attaching Binary Files to Documents

Use `type: "file"` when a document needs attached files (images, PDFs, scans, contracts). Files are stored in MinIO and linked to documents via file fields.

```json
{
  "name": "contract_scan",
  "label": "Contract Scan",
  "type": "file",
  "file_config": {
    "allowed_types": ["application/pdf", "image/*"],
    "max_size_mb": 50,
    "multiple": false
  }
}
```

| Config Key | Type | Description |
|------------|------|-------------|
| `allowed_types` | array | MIME patterns: `"application/pdf"`, `"image/*"`, `"*/*"` (any) |
| `max_size_mb` | number | Maximum file size in MB |
| `multiple` | boolean | Allow multiple files in one field |

**How file linking works:**

1. **Upload the file first** — `POST /api/document-store/files` returns a `FILE-XXXXXX` ID
2. **Use the file ID in document data** — set the field value to `"FILE-XXXXXX"`
3. **WIP validates** — checks the file exists, is active, matches `allowed_types` and `max_size_mb`
4. **WIP tracks references** — the file's `reference_count` increments, status changes from `orphan` to `active`

**File lifecycle:**
- Newly uploaded files start as `orphan` (not referenced by any document)
- When linked to a document → `active` (reference_count > 0)
- When all document references are removed → back to `orphan`
- Soft-delete → `inactive` (only if not referenced, or with `force=true`)
- Hard-delete → permanent removal (only from `inactive` status)

**If the user mentions attachments, uploads, scans, images, or binary files — use file fields, not string fields with external URLs.**

### Step 2.4: Present the Data Model to the User

Present the complete proposed model:

1. List of terminologies with their terms (values, labels, aliases)
2. List of templates with all fields, types, and validation rules
3. How identity fields determine document uniqueness — **explain the versioning behavior explicitly**
4. Which fields are references and what they point to
5. Which existing WIP terminologies/templates will be reused
6. A diagram or table showing entity relationships
7. Which templates have reporting enabled

**Wait for explicit user approval before proceeding.** The data model is the foundation — getting it wrong means rework.

### Step 2.5: Document the Mapping

Create a clear mapping from the user's original data to WIP primitives:

```
User's "Customer" spreadsheet
  → Template: CUSTOMER (identity: [customer_id])
  → Reporting: sync_enabled, table: doc_customer
  → Fields:
      customer_id  → string, required (IDENTITY FIELD)
      name         → string, required
      country      → term (COUNTRY terminology)
      status       → term (CUSTOMER_STATUS terminology)
      email        → string, semantic_type: email
      created_date → date

User's "Invoice" spreadsheet
  → Template: INVOICE (identity: [invoice_number])
  → Reporting: sync_enabled, table: doc_invoice
  → Fields:
      invoice_number → string, required (IDENTITY FIELD)
      customer       → reference (document, target: CUSTOMER)
      amount         → number, required
      currency       → term (CURRENCY terminology)
      issue_date     → date, required
```

---

## Phase 3: Understand User Interaction Needs

**Goal:** Determine how the user wants to interact with their data and why.

**Gate:** Do not proceed to Phase 4 until interaction requirements are clear.

### Step 3.1: Ask "Why"

Ask the user:

1. **Why are you storing this data?** (compliance, analysis, operational, archival)
2. **Who will use the system?** (just you, a team, external users)
3. **How often does data change?** (real-time, daily batches, rarely)
4. **What questions do you want to answer?** (these drive reporting requirements)

### Step 3.2: Ask "How"

Ask the user about preferred interaction methods:

| Method | Best For | Complexity |
|--------|----------|------------|
| **curl / CLI scripts** | Automation, batch loading, quick testing | Low |
| **Python/Node scripts** | Programmatic access, ETL pipelines | Low-Medium |
| **Single-page web app** | Interactive data entry and browsing | Medium-High |
| **Multi-page web app** | Full application with navigation, dashboards | High |
| **WIP Console only** | Admin use, no custom app needed | Zero (already exists) |

### Step 3.3: Assess Reporting Needs

If the user needs reporting or analytics:

- **Simple queries** → Use the Document-Store table view API (`GET /api/document-store/table/<template_id>`)
- **Complex queries / joins** → Use the PostgreSQL reporting layer directly
- **Dashboards** → Consider Metabase or similar BI tools connected to PostgreSQL
- **Exports** → Generate CSV/JSON from API responses or SQL queries

### Step 3.4: Assess Authentication Needs

If the application has multiple users:

- **API key only** → Suitable for scripts, automation, single-user
- **OIDC (Dex/Authentik)** → Required for multi-user web apps with login
- **Dual mode** → API key for service calls, OIDC for user-facing access

If the user wants a web app with login, the app must integrate with the same OIDC provider that WIP uses. This is a significant architectural decision.

---

## Phase 4: Technical Design

**Goal:** Design the technical solution and get user sign-off on the implementation plan.

**Gate:** Do not proceed to Phase 5 until the user has approved the implementation plan.

### Step 4.1: Explore Technical Possibilities

Based on Phases 2 and 3, the AI has full creative freedom to propose solutions. Everything is on the table:

- Simple bash scripts with curl commands
- Python CLI tool using `httpx` or `requests`
- Node.js Express server with server-side rendering
- Vue/React SPA calling WIP APIs directly
- Multi-page application with routing, auth, dashboards
- Jupyter notebooks for data analysis
- Combined approaches (script for data loading + web app for querying)

### Step 4.2: Discuss Trade-Offs with the User

Present options with honest trade-offs:

- **Simplicity vs features** — A curl script loads data in 10 minutes; a web app takes hours
- **Maintenance burden** — More code means more to maintain
- **User skill level** — Match the solution to the user's technical comfort
- **Iteration speed** — Start simple, add complexity as needed

### Step 4.3: Create an Implementation Plan

Once the user agrees on the approach, create a detailed plan:

1. **What will be built** — Clear deliverables
2. **Technology choices** — Languages, frameworks, libraries
3. **File structure** — Where code will live
4. **Implementation phases** — Ordered steps (see Phase 5)
5. **What the user will be able to do** after each phase

### Step 4.4: Define Data Ingestion Strategy

Based on data volume:

| Volume | Strategy | Notes |
|--------|----------|-------|
| < 100 records | Direct REST API calls | Simple, synchronous |
| 100 - 10,000 | Bulk API endpoints | Use batch endpoints with appropriate sizes |
| 10,000 - 100,000 | Bulk with throttling | Batch size ~1000, registry batch ~50 |
| 100,000+ | Ingest Gateway (NATS JetStream) | Async, persistent, highest throughput |

**Important:** For large imports, tune batch sizes to avoid timeouts. WIP's bulk endpoints accept `batch_size` and `registry_batch_size` parameters.

---

## Phase 5: Test-Driven Implementation

**Goal:** Build the solution incrementally, testing every API interaction before relying on it.

**Gate:** Each sub-phase must be verified before moving to the next.

### The Cardinal Rule of Phase 5

> **Test every API call with curl before writing code that depends on it.**

Do not assume behavior from Swagger documentation. APIs may have undocumented requirements (like the `label` field on template fields), validation rules, or error responses that only surface when tested.

### Sub-Phase 5.1: Create Terminologies

**Order matters.** Terminologies must exist before templates can reference them.

For each terminology in the data model:

```bash
# 1. Check if it already exists (use by-code endpoint for exact match)
curl -s -H "X-API-Key: <key>" \
  "http://<hostname>:8002/api/def-store/terminologies/by-code/<CODE>" | jq .
# Returns the terminology if found, or 404 if not

# 2. Create if it doesn't exist
curl -s -X POST -H "X-API-Key: <key>" -H "Content-Type: application/json" \
  "http://<hostname>:8002/api/def-store/terminologies" \
  -d '{"code": "<CODE>", "name": "<Name>", "description": "<Description>"}' | jq .

# 3. Add terms (bulk) — every term requires value; label is optional (defaults to value)
curl -s -X POST -H "X-API-Key: <key>" -H "Content-Type: application/json" \
  "http://<hostname>:8002/api/def-store/terminologies/<ID>/terms/bulk" \
  -d '{"terms": [{"value": "...", "label": "...", "aliases": ["..."]}]}' | jq .

# 4. Verify terms were created
curl -s -H "X-API-Key: <key>" \
  "http://<hostname>:8002/api/def-store/terminologies/<ID>/terms" | jq '.items | length'
```

**Tell the user:** "You can verify these in WIP Console at `https://<hostname>:8443` under Terminologies."

### Sub-Phase 5.2: Create Templates

Templates must exist before documents can be created. **Create templates for referenced entities before templates that reference them** (e.g., CUSTOMER before INVOICE).

```bash
# 1. Create the template
curl -s -X POST -H "X-API-Key: <key>" -H "Content-Type: application/json" \
  "http://<hostname>:8003/api/template-store/templates" \
  -d '{
    "code": "CUSTOMER",
    "name": "Customer",
    "identity_fields": ["customer_id"],
    "fields": [
      {"name": "customer_id", "label": "Customer ID", "type": "string", "mandatory": true},
      {"name": "name", "label": "Name", "type": "string", "mandatory": true},
      {"name": "country", "label": "Country", "type": "term", "terminology_ref": "COUNTRY"},
      {"name": "email", "label": "Email", "type": "string", "semantic_type": "email"}
    ],
    "reporting": {
      "sync_enabled": true,
      "sync_strategy": "latest_only"
    }
  }' | jq .

# 2. Verify the template — check that identity_fields and field types are correct
curl -s -H "X-API-Key: <key>" \
  "http://<hostname>:8003/api/template-store/templates/<ID>" | jq '{
    template_id, code, identity_fields,
    fields: [.fields[] | {name, type, terminology_ref, reference_type, target_templates}]
  }'
```

**For templates with reference fields:**

```bash
curl -s -X POST -H "X-API-Key: <key>" -H "Content-Type: application/json" \
  "http://<hostname>:8003/api/template-store/templates" \
  -d '{
    "code": "INVOICE",
    "name": "Invoice",
    "identity_fields": ["invoice_number"],
    "fields": [
      {"name": "invoice_number", "label": "Invoice Number", "type": "string", "mandatory": true},
      {
        "name": "customer",
        "label": "Customer",
        "type": "reference",
        "reference_type": "document",
        "target_templates": ["CUSTOMER"],
        "mandatory": true
      },
      {"name": "amount", "label": "Amount", "type": "number", "mandatory": true},
      {"name": "currency", "label": "Currency", "type": "term", "terminology_ref": "CURRENCY"},
      {"name": "issue_date", "label": "Issue Date", "type": "date", "mandatory": true}
    ],
    "reporting": {
      "sync_enabled": true,
      "sync_strategy": "latest_only"
    }
  }' | jq .
```

**Tell the user:** "You can see the template structure in WIP Console under Templates."

### Sub-Phase 5.3: Create Referenced Documents First

Before creating documents that reference other documents, the referenced documents must exist. This mirrors real-world data flow: customers exist before invoices.

**Basic document creation:**

```bash
# Create a customer document
curl -s -X POST -H "X-API-Key: <key>" -H "Content-Type: application/json" \
  "http://<hostname>:8004/api/document-store/documents" \
  -d '{
    "template_id": "<CUSTOMER-TPL-ID>",
    "data": {
      "customer_id": "CUS-001",
      "name": "Acme Corp",
      "country": "Germany",
      "email": "info@acme.com"
    }
  }' | jq .
```

**Verify the response:**
```bash
# Check:
# 1. document_id was generated (UUID7)
# 2. identity_hash was computed
# 3. term_references shows resolved term IDs (e.g., "country": "T-000042")
# 4. version is 1
```

**Document creation with synonyms — register external IDs at creation time:**

If external systems have their own IDs for this entity, register them as synonyms in the same call:

```bash
curl -s -X POST -H "X-API-Key: <key>" -H "Content-Type: application/json" \
  "http://<hostname>:8004/api/document-store/documents" \
  -d '{
    "template_id": "<CUSTOMER-TPL-ID>",
    "data": {
      "customer_id": "CUS-001",
      "name": "Acme Corp",
      "country": "Germany",
      "email": "info@acme.com"
    },
    "synonyms": [
      {"erp_id": "ERP-ACME-001"},
      {"salesforce_id": "SF-00042"}
    ]
  }' | jq .
```

This registers `ERP-ACME-001` and `SF-00042` as synonyms in the Registry. Later, any document can reference this customer by any of these identifiers.

### Sub-Phase 5.4: Create Documents with References

Now create documents that reference the entities from Sub-Phase 5.3.

**WIP resolves references automatically.** You can provide the reference value in multiple formats — WIP tries each in order:

| Format | Example | Resolution |
|--------|---------|------------|
| Document ID (UUID7) | `"0192abc1-def2-7abc-..."` | Direct lookup — fastest |
| Identity hash | `"hash:a1b2c3d4e5..."` | Find active doc with this hash |
| Synonym / external ID | `"ERP-ACME-001"` | Registry lookup → resolved to canonical ID |
| Business key | `"CUS-001"` | Match against target template's identity fields |
| Composite key (dict) | `{"order_id": "ORD-001", "line": 1}` | Match multiple identity fields |

```bash
# Create an invoice referencing the customer by business key
curl -s -X POST -H "X-API-Key: <key>" -H "Content-Type: application/json" \
  "http://<hostname>:8004/api/document-store/documents" \
  -d '{
    "template_id": "<INVOICE-TPL-ID>",
    "data": {
      "invoice_number": "INV-2024-001",
      "customer": "CUS-001",
      "amount": 1500.00,
      "currency": "EUR",
      "issue_date": "2024-06-15"
    }
  }' | jq .
```

**Or reference by synonym (external ID):**

```bash
# Same invoice, but referencing customer by its ERP synonym
curl -s -X POST -H "X-API-Key: <key>" -H "Content-Type: application/json" \
  "http://<hostname>:8004/api/document-store/documents" \
  -d '{
    "template_id": "<INVOICE-TPL-ID>",
    "data": {
      "invoice_number": "INV-2024-002",
      "customer": "ERP-ACME-001",
      "amount": 2300.00,
      "currency": "EUR",
      "issue_date": "2024-07-01"
    }
  }' | jq .
```

**Verify the response:**
```bash
# Check:
# 1. The "references" object contains the resolved customer
# 2. references.customer.resolved.document_id points to the customer document
# 3. references.customer.resolved.template_code is "CUSTOMER"
# 4. No validation errors about unresolved references
```

**If reference resolution fails**, check:
- Does the referenced document exist and have `status: active`?
- Does the template field have `target_templates` set correctly?
- If using a synonym, was it registered? Check with Registry lookup.

### Sub-Phase 5.5: Test Versioning Behavior

Before bulk loading, verify that identity-based versioning works:

```bash
# 1. Create a customer
curl -s -X POST -H "X-API-Key: <key>" -H "Content-Type: application/json" \
  "http://<hostname>:8004/api/document-store/documents" \
  -d '{
    "template_id": "<CUSTOMER-TPL-ID>",
    "data": {"customer_id": "TEST-001", "name": "Test Customer", "email": "test@example.com"}
  }' | jq '{document_id, version, identity_hash}'

# 2. Submit SAME identity (customer_id=TEST-001) with different data
curl -s -X POST -H "X-API-Key: <key>" -H "Content-Type: application/json" \
  "http://<hostname>:8004/api/document-store/documents" \
  -d '{
    "template_id": "<CUSTOMER-TPL-ID>",
    "data": {"customer_id": "TEST-001", "name": "Test Customer Updated", "email": "new@example.com"}
  }' | jq '{document_id, version, identity_hash}'

# Expected: version=2, SAME identity_hash, DIFFERENT document_id
# The first document is now status=inactive

# 3. Submit DIFFERENT identity (customer_id=TEST-002)
curl -s -X POST -H "X-API-Key: <key>" -H "Content-Type: application/json" \
  "http://<hostname>:8004/api/document-store/documents" \
  -d '{
    "template_id": "<CUSTOMER-TPL-ID>",
    "data": {"customer_id": "TEST-002", "name": "Another Customer", "email": "other@example.com"}
  }' | jq '{document_id, version, identity_hash}'

# Expected: version=1, DIFFERENT identity_hash — this is a new document, not an update
```

**If version is always 1:** Your identity fields are wrong or missing. Every submission is creating a new document instead of updating.

### Sub-Phase 5.6: Upload and Link Files (If Applicable)

If any templates have `type: "file"` fields, upload files before creating documents that reference them.

**Step 1: Upload files to MinIO**

```bash
# Upload a file — returns FILE-XXXXXX
curl -s -X POST -H "X-API-Key: <key>" \
  "http://<hostname>:8004/api/document-store/files" \
  -F "file=@/path/to/contract.pdf" \
  -F "description=Signed contract for Acme Corp" \
  -F "tags=legal,contracts" \
  -F "category=contracts" | jq '{file_id, filename, content_type, size_bytes, status}'

# Expected: file_id="FILE-000001", status="orphan"
```

**Step 2: Use file IDs in document data**

```bash
# Create a document with a file reference
curl -s -X POST -H "X-API-Key: <key>" -H "Content-Type: application/json" \
  "http://<hostname>:8004/api/document-store/documents" \
  -d '{
    "template_id": "<TPL-ID>",
    "data": {
      "customer_id": "CUS-001",
      "name": "Acme Corp",
      "contract_scan": "FILE-000001"
    }
  }' | jq .

# The file is now status="active" with reference_count=1
```

**Step 3: Verify and download**

```bash
# Get file metadata
curl -s -H "X-API-Key: <key>" \
  "http://<hostname>:8004/api/document-store/files/FILE-000001" | jq '{status, reference_count}'

# Get a pre-signed download URL (valid for 1 hour by default)
curl -s -H "X-API-Key: <key>" \
  "http://<hostname>:8004/api/document-store/files/FILE-000001/download" | jq .

# Or stream the file directly
curl -s -H "X-API-Key: <key>" \
  "http://<hostname>:8004/api/document-store/files/FILE-000001/content" -o contract.pdf
```

**Managing orphan files:**

Files uploaded but never linked to a document are orphans. Clean them up periodically:

```bash
# List orphan files older than 24 hours
curl -s -H "X-API-Key: <key>" \
  "http://<hostname>:8004/api/document-store/files/orphans/list?older_than_hours=24" | jq '.[].file_id'

# Check overall file integrity
curl -s -H "X-API-Key: <key>" \
  "http://<hostname>:8004/api/document-store/files/health/integrity" | jq .
```

**Duplicate detection:** Files are checksummed (SHA-256) on upload. Check for duplicates before uploading:

```bash
curl -s -H "X-API-Key: <key>" \
  "http://<hostname>:8004/api/document-store/files/by-checksum/<sha256-hex>" | jq .
```

### Sub-Phase 5.7: Load Data

Once single-document creation and versioning are verified, load the actual data:

**Creation order for documents with references:**
1. Create all "leaf" entities first (entities that don't reference other documents)
2. Then create entities that reference them
3. Continue up the dependency chain

For example: Countries → Customers → Orders → Order Lines

- Use bulk endpoints for efficiency
- Implement progress reporting (log every N records)
- Handle errors gracefully — log failures, continue with valid records
- For large datasets, respect batch size limits

**Tell the user:** "You can monitor document creation in real-time via WIP Console under Documents, or check MongoDB Express at `http://<hostname>:8081` if available."

### Sub-Phase 5.8: Verify Data Integrity

After loading:

```bash
# Count documents by template (by ID or by code)
curl -s -H "X-API-Key: <key>" \
  "http://<hostname>:8004/api/document-store/documents?template_id=<TPL-ID>" | jq '.total'
curl -s -H "X-API-Key: <key>" \
  "http://<hostname>:8004/api/document-store/documents?template_code=CUSTOMER" | jq '.total'

# Check table view works
curl -s -H "X-API-Key: <key>" \
  "http://<hostname>:8004/api/document-store/table/<TPL-ID>?limit=5" | jq .

# Check referential integrity
curl -s -H "X-API-Key: <key>" \
  "http://<hostname>:8004/api/document-store/health/integrity" | jq .

# If reporting sync is active, check PostgreSQL
# (Data should appear in PostgreSQL within seconds of creation)
curl -s -H "X-API-Key: <key>" \
  "http://<hostname>:8005/health" | jq .
```

### Sub-Phase 5.9: Build the Application Layer

Now build whatever was agreed in Phase 4:

- **Start with read operations** — query and display data before building write operations
- **Test each feature** against the live WIP instance as you build it
- **Use WIP's validation** — let the API reject bad data rather than duplicating validation logic
- **Handle WIP error responses** — parse error details and present them to the user

### Sub-Phase 5.10: Verify Reporting (If Applicable)

If the user needs SQL access:

```bash
# Check if reporting sync is active
curl -s -H "X-API-Key: <key>" \
  "http://<hostname>:8005/health" | jq .

# Query PostgreSQL directly
psql -h <hostname> -U wip -d wip_reporting -c "SELECT count(*) FROM doc_customer;"

# Check that reference fields are available in reporting
psql -h <hostname> -U wip -d wip_reporting -c "SELECT invoice_number, customer FROM doc_invoice LIMIT 5;"
```

---

## Reference Resolution — How It Works

When a document contains a reference field, WIP resolves it using a 5-step cascade. Understanding this is essential for troubleshooting.

### The Resolution Cascade

```
Input value provided in document's reference field
        │
        ▼
   ┌─────────────────┐
   │ 1. UUID7 format?│──yes──► Direct document_id lookup
   └────────┬────────┘
            │ no
   ┌────────▼────────┐
   │ 2. "hash:" ?    │──yes──► Identity hash lookup (active docs)
   └────────┬────────┘
            │ no
   ┌────────▼────────┐
   │ 3. Registry     │──yes──► Resolved! Fetch doc by canonical ID
   │    lookup       │         If inactive → follow identity_hash
   └────────┬────────┘         chain to latest active version
            │ not found
   ┌────────▼────────┐
   │ 4. Business key │──yes──► Match against target template's
   │    (string)     │         identity fields
   └────────┬────────┘
            │ not found
   ┌────────▼────────┐
   │ 5. Composite    │──yes──► Match dict against multiple
   │    key (dict)   │         identity fields
   └────────┬────────┘
            │ not found
            ▼
      VALIDATION ERROR
   "Referenced document not found"
```

### Registry Lookup (Step 3) in Detail

The Registry performs a 2-step cascade:

1. **entry_id match** — Is the value a canonical WIP ID?
2. **search_values match** — Is it a synonym, merged/deprecated ID, or composite key value?

The Registry's `search_values` is a flat array of all string values from an entry's composite keys and synonym keys, indexed for O(1) lookups. This is why synonym resolution is as fast as canonical ID lookup.

### Business Key Lookup (Step 4) in Detail

When the Registry doesn't find a match, WIP falls back to searching by template identity fields:

- For each `target_templates` in the field definition, WIP fetches the template
- It reads the template's `identity_fields`
- If the reference value is a string and the template has a single identity field, it queries `data.<identity_field> = value`
- If the reference value is a dict, it matches each key against the corresponding identity field
- Returns the first active document match

**This is why identity fields are critical** — without them, business key lookup can't work.

---

## Synonym Patterns

Synonyms bridge WIP's internal IDs with external system identifiers. Use them whenever data flows between systems.

### When to Use Synonyms

| Scenario | Synonym Pattern |
|----------|----------------|
| **Legacy migration** | Register old system IDs as synonyms: `{"legacy_id": "OLD-42"}` |
| **ERP integration** | Register ERP codes: `{"erp_code": "SAP-MAT-001"}` |
| **Multi-system** | Each system's ID becomes a synonym: `{"system_a": "X"}, {"system_b": "Y"}` |
| **Human-friendly codes** | Register short codes: `{"short_code": "DEMO-001"}` |

### How to Register Synonyms

**At document creation time** (preferred — one API call):

```json
{
  "template_id": "TPL-XXXXXX",
  "data": { "..." },
  "synonyms": [
    {"erp_id": "SAP-CUST-001"},
    {"crm_id": "SF-00042"}
  ]
}
```

**After document creation** (via Registry directly):

```bash
curl -s -X POST -H "X-API-Key: <key>" -H "Content-Type: application/json" \
  "http://<hostname>:8001/api/registry/synonyms/add" \
  -d '[{
    "target_id": "<DOCUMENT-UUID7>",
    "synonym_namespace": "wip",
    "synonym_entity_type": "documents",
    "synonym_composite_key": {"erp_id": "SAP-CUST-001"}
  }]' | jq .
```

### Verifying Synonym Resolution

```bash
# Look up by synonym via Registry
curl -s -X POST -H "X-API-Key: <key>" -H "Content-Type: application/json" \
  "http://<hostname>:8001/api/registry/entries/lookup/by-id" \
  -d '[{"entry_id": "SAP-CUST-001", "namespace": "wip", "entity_type": "documents"}]' | jq .

# Expected: status="found", entry_id=<DOCUMENT-UUID7>, matched_via="composite_key_value"
```

### Namespace Safety

Synonyms are scoped to their namespace and entity type. The same synonym value in different scopes won't collide:
- `{"erp_id": "X"}` in `(wip, documents)` and `{"erp_id": "X"}` in `(wip, templates)` are independent
- Omit `namespace` and `entity_type` in a Registry lookup to search across all scopes

---

## Common Pitfalls

| Pitfall | Prevention |
|---------|------------|
| **No identity fields on template** | Every template MUST have `identity_fields`. Without them, no versioning, no deduplication, no business key resolution. |
| **Using `type: "string"` for cross-document links** | Use `type: "reference"` with `reference_type` and `target_templates`. String fields give you no validation or resolution. |
| **Creating terminologies that already exist** | Always check existing data first (Phase 1.5). |
| **Missing `label` field on template fields** | Every field requires both `name` and `label`. |
| **Missing `reference_type` on reference fields** | `type: "reference"` requires `reference_type: "document"` (or `"term"`) and `target_templates` (or `target_terminologies`). |
| **Assuming inheritance makes references polymorphic** | `target_templates: ["PARENT"]` does NOT accept child templates by default. Use `include_subtypes: true` on the field, or list all accepted template codes explicitly. |
| **Including inherited fields when updating a child template** | Only send the child's own fields in a PUT update. Including inherited fields turns them into overrides, breaking inheritance. Use the `inherited` flag on resolved template fields to distinguish inherited from own fields. |
| **Expecting parent template updates to auto-cascade** | Child templates store a resolved `template_id` for `extends`. Updating the parent does NOT automatically update children. Use `POST /api/template-store/templates/{id}/cascade` to propagate, or update each child individually. |
| **Wrong creation order** | Terminologies → Terms → Templates (referenced first) → Templates (referencing) → Documents (referenced first) → Documents (referencing). |
| **Assuming API behavior from docs** | Test with curl first. Always. |
| **Huge batch without tuning** | Use `batch_size=1000` and `registry_batch_size=50` for large imports. |
| **Trying to delete data** | WIP uses soft-delete only. Deactivate, don't delete. Only files support hard-delete (to reclaim MinIO storage). |
| **Ignoring term aliases** | Real data is messy. Plan aliases when creating terminologies. |
| **Too many identity fields** | Makes every minor change create a new document instead of a new version. |
| **Too few identity fields** | Different real-world entities collide and overwrite each other. |
| **Forgetting reporting config** | If the user needs SQL/dashboards, add `reporting: {sync_enabled: true}` to templates. |
| **Not registering external IDs as synonyms** | Use the `synonyms` field on document creation for external IDs. Without them, cross-system references break. |
| **Using string fields for file URLs** | Use `type: "file"` with `file_config`. String fields give you no validation, no reference tracking, no orphan detection. |
| **Creating documents before uploading files** | Upload files first, get FILE-XXXXXX IDs, then use them in document data. |
| **Not cleaning up orphan files** | Files uploaded but never linked to documents consume storage indefinitely. Check `/files/orphans/list` periodically. |
| **Modifying WIP code** | Never. Build on top of it, not inside it. |
| **Skipping user approval** | Always wait for explicit sign-off at Phase 2 and Phase 4 gates. |

---

## End-to-End Example: Customer/Invoice Domain

This walkthrough demonstrates the complete pattern for a domain with cross-document references and synonyms.

### 1. Create Terminologies

```bash
API_KEY="dev_master_key_for_testing"
HOST="http://localhost"

# Create CURRENCY terminology
curl -s -X POST -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  "$HOST:8002/api/def-store/terminologies" \
  -d '{"code": "CURRENCY", "name": "Currency"}' | jq .

# Add terms (note the CURRENCY terminology_id from above response)
curl -s -X POST -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  "$HOST:8002/api/def-store/terminologies/<TERM-ID>/terms/bulk" \
  -d '{"terms": [
    {"value": "Euro", "aliases": ["euro", "eur", "EUR"]},
    {"value": "US Dollar", "aliases": ["usd", "dollar", "$", "USD"]},
    {"value": "British Pound", "aliases": ["gbp", "pound", "£", "GBP"]}
  ]}' | jq .
```

### 2. Create Templates (referenced entity first)

```bash
# CUSTOMER template — this is referenced by INVOICE, so create it first
curl -s -X POST -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  "$HOST:8003/api/template-store/templates" \
  -d '{
    "code": "CUSTOMER",
    "name": "Customer",
    "identity_fields": ["customer_id"],
    "fields": [
      {"name": "customer_id", "label": "Customer ID", "type": "string", "mandatory": true},
      {"name": "name", "label": "Company Name", "type": "string", "mandatory": true},
      {"name": "email", "label": "Email", "type": "string", "semantic_type": "email"},
      {"name": "country", "label": "Country", "type": "term", "terminology_ref": "COUNTRY"}
    ],
    "reporting": {"sync_enabled": true, "sync_strategy": "latest_only"}
  }' | jq .

# INVOICE template — references CUSTOMER
curl -s -X POST -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  "$HOST:8003/api/template-store/templates" \
  -d '{
    "code": "INVOICE",
    "name": "Invoice",
    "identity_fields": ["invoice_number"],
    "fields": [
      {"name": "invoice_number", "label": "Invoice Number", "type": "string", "mandatory": true},
      {"name": "customer", "label": "Customer", "type": "reference", "reference_type": "document", "target_templates": ["CUSTOMER"], "mandatory": true},
      {"name": "amount", "label": "Amount", "type": "number", "mandatory": true},
      {"name": "currency", "label": "Currency", "type": "term", "terminology_ref": "CURRENCY"},
      {"name": "issue_date", "label": "Issue Date", "type": "date", "mandatory": true},
      {"name": "notes", "label": "Notes", "type": "string"}
    ],
    "reporting": {"sync_enabled": true, "sync_strategy": "latest_only"}
  }' | jq .
```

### 3. Create Customer Documents (with synonyms)

```bash
# Create customer with ERP synonym
curl -s -X POST -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  "$HOST:8004/api/document-store/documents" \
  -d '{
    "template_id": "<CUSTOMER-TPL-ID>",
    "data": {
      "customer_id": "CUS-001",
      "name": "Acme Corp",
      "email": "billing@acme.com",
      "country": "Germany"
    },
    "synonyms": [{"erp_id": "SAP-ACME-001"}]
  }' | jq '{document_id, version, identity_hash}'
```

### 4. Create Invoice Referencing Customer

```bash
# Reference by business key (customer_id)
curl -s -X POST -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  "$HOST:8004/api/document-store/documents" \
  -d '{
    "template_id": "<INVOICE-TPL-ID>",
    "data": {
      "invoice_number": "INV-2024-001",
      "customer": "CUS-001",
      "amount": 1500.00,
      "currency": "EUR",
      "issue_date": "2024-06-15"
    }
  }' | jq .

# OR reference by synonym (ERP ID)
curl -s -X POST -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  "$HOST:8004/api/document-store/documents" \
  -d '{
    "template_id": "<INVOICE-TPL-ID>",
    "data": {
      "invoice_number": "INV-2024-002",
      "customer": "SAP-ACME-001",
      "amount": 2300.00,
      "currency": "USD",
      "issue_date": "2024-07-01"
    }
  }' | jq .
```

### 5. Verify

```bash
# Check both invoices resolved to the same customer
curl -s -H "X-API-Key: $API_KEY" \
  "$HOST:8004/api/document-store/documents?template_code=INVOICE" \
  | jq '.items[] | {invoice_number: .data.invoice_number, customer_ref: .references.customer.resolved.document_id}'

# Both should show the same customer document_id
```

---

## Template Versioning Awareness

When a template is updated, WIP creates a **new version with the same `template_id`**. Multiple versions can be active simultaneously. This means:

- Existing documents keep their original template version reference
- New documents can use any active version
- The AI should always use the latest template version for new documents
- Migration between template versions is the application's responsibility, not WIP's

### Versioning and Inheritance

The `extends` field is stored as a resolved **template_id** (e.g., `TPL-000009`), not as a code — even though creation accepts a code. Since template_id is now stable across versions, `extends` always points to the same parent. The `extends_version` field controls version pinning:

- **`extends_version: null` (default)** — always resolves to the latest active parent version. When the parent is updated, child templates automatically inherit from the new version.
- **`extends_version: N`** — pins to a specific parent version. Child templates continue using version N even when newer parent versions exist.
- **To propagate a parent change to pinned children**, use `POST /api/template-store/templates/{parent_id}/cascade` to create new versions of all child templates.
- **When updating a child template with PUT**, include ONLY the child's own fields. If you fetch a resolved template (which merges inherited + own fields) and send it back in an update, all inherited fields become overrides on the child, effectively **breaking inheritance** for those fields.
- **Distinguishing inherited from own fields:** When fetching a resolved template (e.g., `GET /templates/{id}`), each field includes `inherited: true/false` and `inherited_from: "<template_id>"`. Use this to identify which fields belong to the child vs. which are inherited from parents. Only send non-inherited fields in PUT updates.

---

## Quick Reference: API Authentication

All API calls require authentication via one of:

```
# API Key (header)
-H "X-API-Key: <your-api-key>"

# JWT Bearer Token (header)
-H "Authorization: Bearer <jwt-token>"
```

The API key is simpler for development and scripts. OIDC/JWT is required for user-facing applications with login.

---

## Quick Reference: Creation Order

```
1. Check existing terminologies and templates (reuse what exists)
          ↓
2. Create terminologies (controlled vocabularies)
          ↓
3. Create terms within each terminology (values, labels, aliases)
          ↓
4. Create templates for REFERENCED entities first (e.g., CUSTOMER)
          ↓
5. Create templates for REFERENCING entities (e.g., INVOICE → CUSTOMER)
          ↓
6. Test with a single document — verify identity fields, term resolution, references
          ↓
7. Test versioning — submit same identity, verify version increments
          ↓
8. Upload files if templates have file fields (get FILE-XXXXXX IDs)
          ↓
9. Create REFERENCED documents first (e.g., customers)
   — register synonyms if external IDs exist
          ↓
10. Create REFERENCING documents (e.g., invoices)
    — use business keys, synonyms, or document IDs for references
          ↓
11. Verify data integrity (counts, table view, reporting, referential integrity)
          ↓
12. Build application layer
```

---

## Quick Reference: Key API Endpoints

| Service | Endpoint | Purpose |
|---------|----------|---------|
| **Def-Store** | `POST /api/def-store/terminologies` | Create terminology |
| | `GET /api/def-store/terminologies/by-code/{code}` | Get terminology by code |
| | `POST /api/def-store/terminologies/{id}/terms/bulk` | Bulk create terms |
| | `POST /api/def-store/validate/bulk` | Validate term values |
| **Template-Store** | `POST /api/template-store/templates` | Create template |
| | `GET /api/template-store/templates/by-code/{code}` | Get latest by code |
| | `POST /api/template-store/templates/{id}/cascade` | Cascade parent update to children |
| | `GET /api/template-store/templates/{id}/children` | Get direct child templates |
| | `GET /api/template-store/templates/{id}/descendants` | Get all descendant templates |
| **Document-Store** | `POST /api/document-store/documents` | Create/update document (upsert) |
| | `POST /api/document-store/documents/bulk` | Bulk create/update |
| | `GET /api/document-store/documents?template_code=X` | Filter documents by template code |
| | `GET /api/document-store/table/{template_id}` | Table view |
| | `POST /api/document-store/files` | Upload file (multipart/form-data) |
| | `GET /api/document-store/files/{id}/download` | Get pre-signed download URL |
| | `GET /api/document-store/files/{id}/content` | Stream file content directly |
| | `GET /api/document-store/files/orphans/list` | List orphan files |
| | `GET /api/document-store/files/health/integrity` | File integrity check |
| | `GET /api/document-store/health/integrity` | Referential integrity check |
| **Registry** | `POST /api/registry/entries/lookup/by-id` | Resolve any identifier |
| | `POST /api/registry/synonyms/add` | Register synonyms |

---

## Summary

This process exists because:

1. **WIP is powerful but generic** — the AI must understand its primitives before building on them
2. **Data models are hard to change** — get user approval before implementing
3. **Identity fields make or break versioning** — choose them carefully, always define them
4. **References must use `type: "reference"`** — never `type: "string"` for cross-document links
5. **Synonyms enable cross-system integration** — register external IDs at document creation time
6. **Files are first-class entities** — use `type: "file"` fields, not string URLs. Upload first, link second.
7. **APIs have undocumented behaviors** — test before you code
8. **Order matters** — terminologies → templates (referenced first) → files → documents (referenced first)
9. **The user is the domain expert** — the AI is the technical implementer

Follow the phases. Respect the gates. Test everything. Never change WIP.
