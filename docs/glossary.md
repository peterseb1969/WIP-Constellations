# Glossary

This glossary defines key terms and concepts used throughout the World In a Pie (WIP) documentation.

---

## A

### Active (Status)
The default status for entities in WIP. Active items are visible in queries and available for use. Contrast with [Inactive](#inactive-status).

### Alias
An alternative value that resolves to the same [term](#term). For example, "Mr", "MR", "Mr.", and "MR." can all be aliases resolving to the same salutation term. Aliases enable flexible input while maintaining data consistency.

### API Key
A secret token used for system-to-system authentication. Services validate API keys via the [wip-auth](#wip-auth) library. Development key: `dev_master_key_for_testing`. Named API keys include owner and group information for audit trails.

### Audit Log
A record of all changes to an entity. [Terms](#term) use audit logs instead of versioning to track modifications while maintaining a stable [term_id](#term-reference).

---

## B

### Bootstrap
The process of initializing the system with foundational data. The [Registry](#registry) must be initialized with WIP namespaces before other services can generate IDs.

### Bulk Operation
The standard API convention in WIP. All write endpoints (POST/PUT/DELETE) accept a JSON array and return a `BulkResponse`. Single operations are sent as `[item]`. There are no single-entity write endpoints. HTTP 200 is always returned — errors are per-item in `results[i].status`.

---

## C

### Caddy
The reverse proxy used in WIP deployments. Provides automatic HTTPS via self-signed certificates and routes traffic to backend services. Enables secure OIDC login over network access.

### Composite Key
A combination of multiple fields that together uniquely identify a document. Defined in the template's `identity_fields` array. Example: `["email"]` or `["order_id", "line_number"]`.

### Conditional Rule
A [validation rule](#validation-rule) that applies only when certain conditions are met. Example: "Tax ID is required if country is Germany."

---

## D

### Deactivate
The action of marking an entity as [inactive](#inactive-status). In WIP, nothing is ever truly deleted—only deactivated. This preserves audit trails and enables reference resolution. Exception: files support hard-delete to reclaim MinIO storage.

### Def-Store
The service managing [terminologies](#terminology), [terms](#term), and [ontology relationships](#relationship). Provides controlled vocabularies that [templates](#template) reference for term-type fields. Supports OBO Graph JSON import for standard ontologies. API: `http://localhost:8002/api/def-store/`.

### Dex
The OIDC provider used in WIP for user authentication. Lightweight (~30MB RAM), works over HTTP, and supports static user configuration via YAML. Provides JWT tokens for authenticated users.

### Document
The primary data entity in WIP. A JSON object that:
1. References a [template](#template) via `template_id`
2. Contains `data` conforming to that template
3. Stores [term_references](#term-reference) with resolved term IDs
4. Has an [identity hash](#identity-hash) for versioning
5. Is [validated](#validation) on creation/update

### Document Store
The service that manages [documents](#document). Provides validation, versioning, and term reference resolution. Uses MongoDB for persistence. API: `http://localhost:8004/api/document-store/`.

### Draft (Status)
A template status that allows creation without reference validation. Enables circular dependencies and order-independent template creation. Draft templates must be activated via `POST /templates/{id}/activate` before they can be used by documents.

### Dual Auth Mode
Authentication mode where both API keys and JWT tokens are accepted. Default mode for most deployments. See [wip-auth](#wip-auth).

---

## E

### Event
A message published to [NATS](#nats) when something changes in WIP. Contains the full entity data (self-contained). Types include `document.created`, `document.updated`, `template.created`, etc. Used by [Reporting-Sync](#reporting-sync) for PostgreSQL synchronization.

### Extends
Template inheritance. A template can extend another template, inheriting its fields and rules while adding or overriding its own. Example: EMPLOYEE extends PERSON. The `extends_version` field can pin inheritance to a specific parent version.

---

## F

### FastAPI
The Python web framework used for WIP's backend services. Provides automatic OpenAPI documentation (`/docs`), Pydantic validation, and async support.

### Field
A single data element within a [template](#template). Has a name, type, and optional validation rules. Types: `string`, `number`, `integer`, `boolean`, `date`, `datetime`, `term`, `object`, `array`, `reference`, `file`.

---

## G

### Groups
User group memberships from OIDC tokens, used for authorization. Standard groups: `wip-admins`, `wip-editors`, `wip-viewers`. Named API keys can also specify groups.

---

## H

### Hash
See [Identity Hash](#identity-hash).

### Health Check
An endpoint (`GET /health`) that reports service status. Used by the setup script and container orchestration to verify services are running.

---

## I

### Identity
The unique "fingerprint" of a document, computed from its [identity fields](#identity-fields). Two documents with the same identity are considered versions of the same entity.

### Identity Fields
The template-defined fields that form the [composite key](#composite-key). Specified in the template's `identity_fields` array. Must be mandatory fields.

### Identity Hash
A SHA-256 hash computed from the [identity fields](#identity-fields). Used to detect if a document is new or an update to an existing entity. Algorithm:
1. Sort field names alphanumerically
2. Concatenate as `field1=value1|field2=value2|...`
3. Hash with SHA-256

### Inactive (Status)
Status of a deactivated entity. Inactive items are retained for historical reference resolution but excluded from normal queries. Previous document versions are automatically set to inactive when a new version is created.

---

## J

### JetStream
NATS's persistence layer for guaranteed message delivery. Enabled by default in WIP. Ensures events are not lost if [Reporting-Sync](#reporting-sync) is temporarily unavailable.

### JWT
JSON Web Token. Used for user authentication via [Dex](#dex). Contains claims like user ID, email, and [groups](#groups).

---

## K

### (No entries)

---

## L

### Latest Version
For documents with multiple versions, the most recent active version. API responses include `is_latest_version` and `latest_version` to help clients work with version chains. Since `document_id` is stable across versions, there is no separate `latest_document_id`.

---

## M

### Mandatory
A field property indicating the field must be present in a document. Validation fails if a mandatory field is missing or null.

### Message Queue
Asynchronous communication layer for events. WIP uses [NATS](#nats) with [JetStream](#jetstream).

### MongoDB
The document store database. Stores documents, templates, terminologies, and terms as native JSON documents.

---

## N

### Namespace
A logical partition in the [Registry](#registry) that enables different ID formats. Default WIP namespaces all use UUID7:
- `wip-terminologies`: UUID7
- `wip-terms`: UUID7
- `wip-templates`: UUID7
- `wip-documents`: UUID7
- `wip-files`: UUID7

Custom namespaces can be configured with prefixed ID formats.

### NATS
Lightweight message queue used by WIP. ~30MB RAM footprint with JetStream enabled. Handles event publishing between services.

---

## O

### OIDC
OpenID Connect. The authentication protocol used by [Dex](#dex). Provides secure user login with JWT tokens.

### Ontology
A formal representation of knowledge as a set of concepts and typed [relationships](#relationship). In WIP, ontologies are represented using [terminologies](#terminology) (for concepts/terms) and [relationships](#relationship) (for typed edges like `is_a`, `part_of`). Standard ontologies can be imported from OBO Graph JSON format. Relationship types are validated against the `_ONTOLOGY_RELATIONSHIP_TYPES` system terminology.

---

## P

### Podman
Container runtime used by WIP. Compatible with Docker commands (`podman-compose`). Supports rootless containers on Linux.

### PostgreSQL
The reporting database. Receives document data via [Reporting-Sync](#reporting-sync) for SQL-based querying and analytics.

### PrimeVue
Vue.js component library used for [WIP Console](#wip-console). Provides DataTable, Dialog, and form components.

### Pydantic
Python data validation library used throughout WIP. Provides declarative schema definition and automatic validation.

---

## Q

### (No entries)

---

## R

### RBAC
Role-Based Access Control. Authorization based on [groups](#groups) from JWT tokens or API key configuration.

### Registry
Service providing ID generation and namespace management. Maps [composite keys](#composite-key) to standardized IDs. Must be initialized before other services. API: `http://localhost:8001/api/registry/`.

### Relationship
A typed, directed edge between two [terms](#term), optionally across [terminologies](#terminology). Used for ontology structure (e.g., `is_a`, `part_of`, `regulates`). Stored in Def-Store and synced to PostgreSQL for reporting.

### Reporting Layer
The PostgreSQL database that mirrors document data for SQL-based querying. Not the source of truth—a projection synchronized from MongoDB via events.

### Reporting-Sync
Service that consumes [events](#event) from NATS and synchronizes data to PostgreSQL. Provides metrics, alerts, and batch sync capabilities. API: `http://localhost:8005/`.

---

## S

### Semantic Type
A field-level type hint that triggers format-specific validation and reporting behavior. Types: `email`, `url`, `latitude`, `longitude`, `percentage`, `duration`, `geo_point`. Specified via `semantic_type` on template fields.

### Setup Script
The `scripts/setup.sh` script that automates WIP deployment. Auto-detects platform, generates configuration, and starts all services.

### Status
Lifecycle state of an entity. Values for documents: `active`, `inactive`, `archived`. Values for terms: `active`, `deprecated`. Values for templates: `draft`, `active`, `inactive`.

### Sync
The process of copying document data to PostgreSQL. Driven by NATS events (real-time) or batch API calls (recovery).

### Synonym
In the [Registry](#registry), an alternative identifier that resolves to the same entity. Enables cross-system identity matching.

---

## T

### Template
A schema definition that documents must conform to. Contains:
- `template_id`: Unique ID (UUID7), stable across versions
- `value`: Human-readable identifier shared across versions
- `label`: Display name
- `fields`: Field definitions with types and validation
- `rules`: Cross-field validation rules
- `identity_fields`: Fields forming the composite key
- `extends`: Optional parent template for inheritance
- `reporting`: Sync configuration for PostgreSQL

### Template Store
Service managing [templates](#template). Validates references to terminologies and parent templates. API: `http://localhost:8003/api/template-store/`.

### Template Version
Templates support multiple active versions simultaneously. When updated, the `template_id` stays the same and the `version` number increments. Documents reference specific template versions. The `extends_version` field can pin inheritance to a specific parent version.

### Term
A single concept within a [terminology](#terminology). Structure:
- `term_id`: Unique ID (UUID7)
- `value`: The canonical value (e.g., "MALE")
- `label`: Display label (e.g., "Male")
- `aliases`: Alternative values that resolve to this term
- `parent_term_id`: Optional parent for hierarchical terms

### Terminology
A controlled vocabulary containing related [terms](#term). Structure:
- `terminology_id`: Unique ID (UUID7)
- `value`: Short identifier (e.g., "GENDER")
- `label`: Display name (e.g., "Gender")

### Terminology Reference
A template field property linking a `term` type field to a specific [terminology](#terminology). Written as `terminology_ref` in field definitions.

### Term Reference
The `term_references` field in documents that stores resolved term IDs. When a document is saved, original values go in `data` and resolved `term_id` values go in `term_references`. This preserves both the submitted value and the canonical reference.

---

## U

### Upsert
The combined create-or-update behavior based on [identity](#identity). If an active document with the same identity hash exists, a new version is created and the old version is deactivated. Otherwise, a new document is created.

### UUID7
Time-ordered UUID format used for all entity IDs in the default `wip` namespace. Provides chronological ordering while maintaining uniqueness.

---

## V

### Validation
The process of checking a document against its [template](#template) before storage. Six-stage pipeline:
1. Structural validation (valid JSON, required fields)
2. Template resolution (fetch and validate template)
3. Field validation (types, patterns, min/max)
4. Term validation (verify against Def-Store)
5. Rule evaluation (cross-field rules)
6. Identity computation (generate hash)

### Validation Rule
A constraint that spans multiple fields. Types:
- `conditional_required`: Field required if condition met
- `conditional_value`: Value constrained by another field
- `mutual_exclusion`: Only one of listed fields can have value
- `dependency`: Field requires another field to be present

### Version
A snapshot of a document at a point in time. When updated via [upsert](#upsert), the `document_id` stays the same and the `version` number increments. The previous version is set to inactive. Versions share the same [identity hash](#identity-hash).

### Vue
JavaScript framework used for [WIP Console](#wip-console). Version 3 with Composition API and TypeScript.

---

## W

### WIP
Acronym for **W**orld **I**n a **P**ie. Also a happy coincidence with "Work In Progress."

### WIP Console
The unified web UI for managing terminologies, templates, and documents. Built with [Vue](#vue) and [PrimeVue](#primevue). Supports both OIDC login and API key authentication. Features a unified import view that auto-detects file format (WIP JSON, OBO Graph JSON, CSV).

### wip-auth
Shared Python library providing pluggable authentication for all WIP services. Supports modes: `none`, `api_key_only`, `jwt_only`, `dual`. Located in `libs/wip-auth/`.

### World In a Pie
The full name of this system. Reflects:
1. The goal of storing "the world" of data
2. The target deployment on a Raspberry **Pi**

---

## X-Z

### (No entries)

---

## Symbols & Abbreviations

| Abbreviation | Meaning |
|--------------|---------|
| API | Application Programming Interface |
| CRUD | Create, Read, Update, Delete |
| JSON | JavaScript Object Notation |
| JWT | JSON Web Token |
| MQ | Message Queue |
| OBO | Open Biomedical Ontologies |
| OIDC | OpenID Connect |
| RBAC | Role-Based Access Control |
| REST | Representational State Transfer |
| SHA | Secure Hash Algorithm |
| SQL | Structured Query Language |
| TLS | Transport Layer Security |
| UI | User Interface |
| UUID | Universally Unique Identifier |
