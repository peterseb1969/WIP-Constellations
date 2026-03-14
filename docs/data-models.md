# Data Models

This document defines the conceptual data structures used throughout World In a Pie (WIP).

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA MODEL HIERARCHY                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│   DEF-STORE                    TEMPLATE STORE              DOCUMENT STORE  │
│   ══════════                   ══════════════              ══════════════   │
│                                                                            │
│   ┌──────────────┐            ┌──────────────┐            ┌──────────────┐ │
│   │ Terminology  │            │   Template   │            │   Document   │ │
│   │              │◄───────────│              │◄───────────│              │ │
│   │ • term_id    │  canonical │ • template_id│  conforms  │ • document_id│ │
│   │ • value      │  IDs       │ • value      │  to        │ • template_id│ │
│   │ • label      │            │ • version    │            │ • version    │ │
│   │              │            │ • fields[]   │            │ • data{}     │ │
│   └──────────────┘            │ • rules[]    │            │ • term_refs[]│ │
│          │                    │ • reporting{}│            │ • refs[]     │ │
│          │ contains           └──────────────┘            └──────────────┘ │
│          ▼                           │                                     │
│   ┌──────────────┐                   │ contains                            │
│   │    Term      │                   ▼                                     │
│   │              │            ┌──────────────────┐                         │
│   │ • term_id    │            │  FieldDefinition │                         │
│   │ • value      │◄───────────│ • name, label    │                         │
│   │ • aliases[]  │  canonical │ • type           │                         │
│   │ • label?     │  IDs       │ • terminology_ref│                         │
│   │ • parent_id  │            │ • template_ref   │                         │
│   └──────────────┘            │ • version_strategy│                        │
│                               └──────────────────┘                         │
│                                                                            │
│   Note: Terms have NO versioning - changes tracked via audit log           │
│   Note: Templates can have multiple active versions simultaneously         │
│   Note: Documents store both original data AND resolved term_references    │
│   Note: All IDs are UUID7 by default; custom namespaces can configure      │
│         prefixed or other ID algorithms per entity type                    │
│                                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Def-Store Models

### Terminology

A terminology is a controlled vocabulary containing related terms. **Terminologies do not have versioning.**

```python
class Terminology(BaseModel):
    """A controlled vocabulary containing related terms."""

    namespace: str = Field(
        default="wip",
        description="Namespace for data isolation"
    )
    terminology_id: str = Field(
        ...,
        description="Unique identifier from Registry (UUID7 by default)"
    )
    value: str = Field(
        ...,
        description="Short identifier for the terminology (unique within namespace)",
        examples=["DOC_STATUS", "COUNTRY", "DEPARTMENT"]
    )
    label: str = Field(
        ...,
        description="Human-readable display label",
        examples=["Document Status", "Country", "Department"]
    )
    description: str | None = Field(
        None,
        description="Detailed description of the terminology"
    )
    case_sensitive: bool = Field(
        default=False,
        description="Whether term matching is case-sensitive"
    )
    allow_multiple: bool = Field(
        default=False,
        description="Whether multiple terms can be selected"
    )
    extensible: bool = Field(
        default=False,
        description="Whether new terms can be added by users"
    )
    status: Literal["active", "inactive"] = Field(
        default="active",
        description="Lifecycle status"
    )
    term_count: int = Field(
        default=0,
        description="Denormalized count of active terms"
    )
    metadata: TerminologyMetadata = Field(
        default_factory=TerminologyMetadata,
        description="Additional metadata (source, version, language, custom)"
    )
    created_at: datetime
    created_by: str = Field(
        ...,
        description="Identity string (e.g., 'apikey:legacy', 'user:admin-001')"
    )
    updated_at: datetime | None = None
    updated_by: str | None = None
```

**Example:**
```json
{
  "namespace": "wip",
  "terminology_id": "019469a0-1234-7abc-8def-abcdef123456",
  "value": "DOC_STATUS",
  "label": "Document Status",
  "description": "Controlled vocabulary for document lifecycle states",
  "case_sensitive": false,
  "allow_multiple": false,
  "extensible": false,
  "status": "active",
  "term_count": 4,
  "metadata": {
    "source": "system",
    "language": "en"
  },
  "created_at": "2024-01-15T10:00:00Z",
  "created_by": "apikey:legacy",
  "updated_at": "2024-02-01T14:30:00Z",
  "updated_by": "user:admin-001"
}
```

### Term

A single concept within a terminology. **Terms do not have versioning — all changes are tracked in an audit log.**

```python
class Term(BaseModel):
    """An individual concept within a terminology."""

    namespace: str = Field(
        default="wip",
        description="Namespace for data isolation"
    )
    term_id: str = Field(
        ...,
        description="Unique identifier from Registry (UUID7 by default)"
    )
    terminology_id: str = Field(
        ...,
        description="Parent terminology reference"
    )
    terminology_value: str | None = Field(
        None,
        description="Denormalized parent terminology value for efficient lookups"
    )
    value: str = Field(
        ...,
        description="Primary value (unique within terminology)",
        examples=["Draft", "Under Review", "Approved", "Archived"]
    )
    aliases: list[str] = Field(
        default_factory=list,
        description="Alternative values that resolve to this term",
        examples=[["DRAFT", "draft", "New"]]
    )
    label: str | None = Field(
        None,
        description="Display label (defaults to value if not set)"
    )
    description: str | None = Field(
        None,
        description="Detailed description"
    )
    status: Literal["active", "deprecated", "inactive"] = Field(
        default="active"
    )
    parent_term_id: str | None = Field(
        None,
        description="Parent term ID for hierarchical taxonomies"
    )
    sort_order: int = Field(
        default=0,
        description="Display order within terminology"
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Additional metadata (mappings, etc.)"
    )
    translations: list[TermTranslation] = Field(
        default_factory=list,
        description="Multi-language translations"
    )
    deprecated_reason: str | None = None
    replaced_by_term_id: str | None = None
    created_at: datetime
    created_by: str
    updated_at: datetime | None = None
    updated_by: str | None = None
```

**Example:**
```json
{
  "namespace": "wip",
  "term_id": "019469a0-5678-7abc-8def-abcdef567890",
  "terminology_id": "019469a0-1234-7abc-8def-abcdef123456",
  "terminology_value": "DOC_STATUS",
  "value": "Draft",
  "aliases": ["DRAFT", "draft", "New"],
  "label": "Draft",
  "description": "Document is in draft state, not yet submitted for review",
  "status": "active",
  "parent_term_id": null,
  "sort_order": 1,
  "metadata": {
    "workflow_step": 1
  },
  "translations": [
    { "language": "de", "value": "Entwurf" },
    { "language": "fr", "value": "Brouillon" }
  ],
  "created_at": "2024-01-15T10:00:00Z",
  "created_by": "apikey:legacy"
}
```

### Term Alias Resolution

When validating a value against a terminology, the system checks in order:
1. **value** — Exact match on primary value
2. **aliases** — Match against any alias

The validation response indicates which match type was used:

```json
{
  "terminology_value": "DOC_STATUS",
  "input_value": "DRAFT",
  "valid": true,
  "term_id": "019469a0-5678-7abc-8def-abcdef567890",
  "matched_via": "alias",
  "normalized_value": "Draft"
}
```

### Term Audit Log

Instead of versioning, term changes are recorded in an audit log:

```python
class TermAuditEntry(BaseModel):
    """An audit log entry for term changes."""

    term_id: str
    terminology_id: str
    action: Literal["created", "updated", "deprecated", "deleted"]
    changed_at: datetime
    changed_by: str
    changed_fields: list[str] = Field(
        default_factory=list,
        description="Fields that were modified"
    )
    previous_values: dict[str, Any] = Field(
        default_factory=dict
    )
    new_values: dict[str, Any] = Field(
        default_factory=dict
    )
```

**Example:**
```json
{
  "term_id": "019469a0-5678-7abc-8def-abcdef567890",
  "terminology_id": "019469a0-1234-7abc-8def-abcdef123456",
  "action": "updated",
  "changed_at": "2024-01-30T10:00:00Z",
  "changed_by": "user:admin-001",
  "changed_fields": ["aliases"],
  "previous_values": {"aliases": ["DRAFT"]},
  "new_values": {"aliases": ["DRAFT", "draft", "New"]}
}
```

### Hierarchical Terms Example

```json
[
  {
    "term_id": "019469a0-aaaa-7abc-8def-000000000001",
    "terminology_id": "019469a0-aaaa-7abc-8def-000000000000",
    "value": "Engineering",
    "parent_term_id": null,
    "sort_order": 1
  },
  {
    "term_id": "019469a0-aaaa-7abc-8def-000000000002",
    "terminology_id": "019469a0-aaaa-7abc-8def-000000000000",
    "value": "Frontend",
    "parent_term_id": "019469a0-aaaa-7abc-8def-000000000001",
    "sort_order": 1
  },
  {
    "term_id": "019469a0-aaaa-7abc-8def-000000000003",
    "terminology_id": "019469a0-aaaa-7abc-8def-000000000000",
    "value": "Backend",
    "parent_term_id": "019469a0-aaaa-7abc-8def-000000000001",
    "sort_order": 2
  }
]
```

---

## Template Store Models

### Template

A schema definition for documents. **Multiple template versions can be active simultaneously** — for gradual migration, or when genuinely different versions serve different use cases (e.g., ongoing projects use v1 while new projects adopt v2).

```python
class Template(BaseModel):
    """A schema definition that documents must conform to."""

    namespace: str = Field(
        default="wip",
        description="Namespace for data isolation"
    )
    template_id: str = Field(
        ...,
        description="Unique identifier from Registry (UUID7 by default)"
    )
    value: str = Field(
        ...,
        description="Template value (shared across versions, unique within namespace)",
        examples=["PERSON", "EMPLOYEE", "PLANNED_VISIT"]
    )
    label: str = Field(
        ...,
        description="Human-readable display label",
        examples=["Person", "Employee Record", "Planned Visit"]
    )
    description: str | None = None
    version: int = Field(
        default=1,
        description="Version number (incremented on updates)"
    )
    status: Literal["draft", "active", "inactive"] = Field(
        default="active"
    )
    extends: str | None = Field(
        None,
        description="Parent template_id for inheritance"
    )
    extends_version: int | None = Field(
        None,
        description="Pinned parent version (None = always use latest parent version)"
    )
    identity_fields: list[str] = Field(
        default_factory=list,
        description="Fields that form the composite identity key"
    )
    fields: list[FieldDefinition] = Field(
        default_factory=list
    )
    rules: list[ValidationRule] = Field(
        default_factory=list
    )
    metadata: TemplateMetadata = Field(
        default_factory=TemplateMetadata,
        description="Domain, category, tags, custom metadata"
    )
    reporting: ReportingConfig | None = Field(
        None,
        description="PostgreSQL sync configuration"
    )
    created_at: datetime
    created_by: str
    updated_at: datetime | None = None
    updated_by: str | None = None
```

### FieldDefinition

A field definition within a template. Entity reference fields store **canonical IDs** (resolved from user-supplied values at template creation time).

```python
class FieldType(str, Enum):
    STRING = "string"
    NUMBER = "number"
    INTEGER = "integer"
    BOOLEAN = "boolean"
    DATE = "date"
    DATETIME = "datetime"
    TERM = "term"          # Term from a Def-Store terminology
    REFERENCE = "reference"  # Cross-entity reference (document, term, terminology, template)
    FILE = "file"            # Binary file attachment (MinIO)
    OBJECT = "object"        # Nested template
    ARRAY = "array"          # Collection of items


class ReferenceType(str, Enum):
    DOCUMENT = "document"      # Reference to another document
    TERM = "term"              # Reference to a term in a terminology
    TERMINOLOGY = "terminology"  # Reference to a terminology itself
    TEMPLATE = "template"      # Reference to a template itself


class VersionStrategy(str, Enum):
    LATEST = "latest"   # Accept any version of the same template family (default)
    PINNED = "pinned"   # Accept only the exact stored template version


class SemanticType(str, Enum):
    EMAIL = "email"          # RFC 5322 email address
    URL = "url"              # Valid HTTP(S) URL
    LATITUDE = "latitude"    # Geographic latitude (-90 to 90)
    LONGITUDE = "longitude"  # Geographic longitude (-180 to 180)
    PERCENTAGE = "percentage"  # Percentage value (0 to 100)
    DURATION = "duration"    # Time duration {value, unit}
    GEO_POINT = "geo_point"  # Geographic point {latitude, longitude}


class FieldDefinition(BaseModel):
    """A field definition within a template."""

    name: str
    label: str                          # Human-readable label
    type: FieldType
    mandatory: bool = False
    default_value: Any | None = None

    # For type=term: terminology reference (resolved from value at creation)
    terminology_ref: str | None = Field(
        None,
        description="Canonical terminology_id, resolved from terminology value at creation"
    )

    # For type=object: nested template (resolved from value at creation)
    template_ref: str | None = Field(
        None,
        description="Canonical template_id, resolved from template value at creation"
    )

    # For type=reference: unified reference configuration
    reference_type: ReferenceType | None = None
    target_templates: list[str] | None = Field(
        None,
        description="Canonical template_ids for document references (resolved from values at creation)"
    )
    include_subtypes: bool | None = Field(
        None,
        description="When true, also accepts documents from child templates via inheritance"
    )
    target_terminologies: list[str] | None = Field(
        None,
        description="Canonical terminology_ids for term references (resolved from values at creation)"
    )
    version_strategy: VersionStrategy | None = Field(
        None,
        description="How to resolve reference versions: latest (default) or pinned"
    )

    # For type=file
    file_config: FileFieldConfig | None = None

    # For type=array: item configuration
    array_item_type: FieldType | None = None
    array_terminology_ref: str | None = Field(
        None,
        description="Canonical terminology_id for array term items"
    )
    array_template_ref: str | None = Field(
        None,
        description="Canonical template_id for array object items"
    )
    array_file_config: FileFieldConfig | None = None

    # Validation constraints (nested object)
    validation: FieldValidation | None = None

    # Semantic type for universal data patterns
    semantic_type: SemanticType | None = None

    # Inheritance tracking (populated during resolution, not stored)
    inherited: bool | None = None
    inherited_from: str | None = None

    # Additional metadata
    metadata: dict[str, Any] = {}


class FieldValidation(BaseModel):
    pattern: str | None = None      # Regex pattern for string fields
    min_length: int | None = None
    max_length: int | None = None
    minimum: float | None = None    # Minimum numeric value
    maximum: float | None = None    # Maximum numeric value
    enum: list[Any] | None = None   # Allowed values (not term-based)


class FileFieldConfig(BaseModel):
    allowed_types: list[str] = ["*/*"]  # MIME type patterns
    max_size_mb: float = 10.0           # Max file size (up to 100MB)
    multiple: bool = False              # Allow multiple files
    max_files: int | None = None        # Max files when multiple=true
```

### ReportingConfig

Configuration for PostgreSQL sync:

```python
class ReportingConfig(BaseModel):
    """Configuration for reporting sync to PostgreSQL."""

    sync_enabled: bool = Field(default=True)
    sync_strategy: Literal["latest_only", "all_versions", "disabled"] = Field(
        default="latest_only"
    )
    table_name: str | None = Field(
        None,
        description="Custom table name (default: doc_{value})"
    )
    include_metadata: bool = Field(default=True)
    flatten_arrays: bool = Field(default=True)
    max_array_elements: int = Field(default=10)
```

### ValidationRule

Cross-field validation rules:

```python
class RuleType(str, Enum):
    CONDITIONAL_REQUIRED = "conditional_required"
    CONDITIONAL_VALUE = "conditional_value"
    MUTUAL_EXCLUSION = "mutual_exclusion"
    DEPENDENCY = "dependency"


class ValidationRule(BaseModel):
    """A cross-field validation rule."""

    type: RuleType
    description: str | None = None
    condition: RuleCondition | None = None
    target_field: str | None = None
    target_fields: list[str] | None = None  # For mutual_exclusion
    error_message: str | None = None


class RuleCondition(BaseModel):
    """A condition for conditional rules."""

    field: str
    operator: Literal["equals", "not_equals", "in", "not_in", "exists", "not_exists"]
    value: Any = None
```

**Template Example (as stored — all references are canonical IDs):**
```json
{
  "namespace": "wip",
  "template_id": "019469a0-cccc-7abc-8def-000000000001",
  "value": "PERSON",
  "label": "Person",
  "description": "Template for person records",
  "version": 3,
  "status": "active",
  "extends": null,
  "extends_version": null,
  "identity_fields": ["email"],
  "fields": [
    {
      "name": "first_name",
      "label": "First Name",
      "type": "string",
      "mandatory": true,
      "validation": { "min_length": 1, "max_length": 100 }
    },
    {
      "name": "last_name",
      "label": "Last Name",
      "type": "string",
      "mandatory": true
    },
    {
      "name": "email",
      "label": "Email",
      "type": "string",
      "mandatory": true,
      "semantic_type": "email"
    },
    {
      "name": "status",
      "label": "Status",
      "type": "term",
      "terminology_ref": "019469a0-1234-7abc-8def-abcdef123456"
    },
    {
      "name": "country",
      "label": "Country",
      "type": "term",
      "terminology_ref": "019469a0-1234-7abc-8def-abcdef999999"
    },
    {
      "name": "tax_id",
      "label": "Tax ID",
      "type": "string"
    },
    {
      "name": "addresses",
      "label": "Addresses",
      "type": "array",
      "array_item_type": "object",
      "array_template_ref": "019469a0-cccc-7abc-8def-000000000008"
    },
    {
      "name": "supervisor",
      "label": "Supervisor",
      "type": "reference",
      "reference_type": "document",
      "target_templates": ["019469a0-cccc-7abc-8def-000000000001"],
      "version_strategy": "latest",
      "include_subtypes": true
    }
  ],
  "rules": [
    {
      "type": "conditional_required",
      "description": "Tax ID required for German residents",
      "condition": {
        "field": "country",
        "operator": "equals",
        "value": "Germany"
      },
      "target_field": "tax_id",
      "error_message": "Tax ID is required for German residents"
    }
  ],
  "metadata": {
    "domain": "hr",
    "category": "master_data",
    "tags": ["person", "core"]
  },
  "reporting": {
    "sync_enabled": true,
    "sync_strategy": "latest_only",
    "table_name": "doc_person",
    "flatten_arrays": true
  },
  "created_at": "2024-01-15T10:00:00Z",
  "created_by": "apikey:legacy"
}
```

### Template Versioning

When a template is updated, a **new version is created with the same `template_id`**. The `(template_id, version)` pair is the unique key. Multiple versions can be active simultaneously — for gradual migration, or when genuinely different versions serve different use cases (e.g., ongoing projects use v1 while new projects adopt v2).

| Operation | Result |
|-----------|--------|
| Create template (value=PERSON) | `019469a0-cccc-...`, version=1 |
| Update template | Same `019469a0-cccc-...`, version=2, **version 1 still active** |
| Update template | Same `019469a0-cccc-...`, version=3, **all versions still active** |

All versions share the same `template_id` and `value`. The `extends_version` field allows pinning inheritance to a specific parent version (None = always resolve latest active parent version).

---

## Document Store Models

### Document

The core data entity. Documents store original data plus resolved term references, entity references, and file references.

```python
class Document(BaseModel):
    """A validated document conforming to a template."""

    namespace: str = Field(
        default="wip",
        description="Namespace for data isolation"
    )
    document_id: str = Field(
        ...,
        description="Unique document ID from Registry (UUID7)"
    )
    template_id: str = Field(
        ...,
        description="Template ID this document conforms to"
    )
    template_version: int = Field(
        ...,
        description="Version of template used for validation"
    )
    template_value: str | None = Field(
        None,
        description="Template value (e.g., PERSON) for easier identification"
    )
    identity_hash: str = Field(
        ...,
        description="SHA-256 hash of identity field values"
    )
    version: int = Field(
        default=1,
        description="Document version number"
    )
    status: Literal["active", "inactive", "archived"] = Field(
        default="active"
    )
    data: dict[str, Any] = Field(
        ...,
        description="Original submitted document content"
    )

    # Resolved references (populated during validation)
    term_references: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Resolved term IDs: [{field_path, term_id, terminology_ref, matched_via}]"
    )
    references: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Resolved entity references: [{field_path, reference_type, resolved: {...}}]"
    )
    file_references: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Resolved file refs: [{field_path, file_id, filename, content_type, size_bytes}]"
    )

    metadata: DocumentMetadata = Field(
        default_factory=DocumentMetadata,
        description="Source system, warnings, custom metadata"
    )
    created_at: datetime
    created_by: str
    updated_at: datetime | None = None
    updated_by: str | None = None
```

**Key design decisions:**

1. **`data`** stores the original submitted values (e.g., `"country": "Germany"`)
2. **`term_references`** stores resolved term IDs as an array of `{field_path, term_id, terminology_ref, matched_via}`
3. **`references`** stores resolved entity references (documents, terms, terminologies, templates)
4. **`file_references`** stores resolved file metadata for file fields
5. Both original data and resolved references are preserved for audit compliance

**Example:**
```json
{
  "namespace": "wip",
  "document_id": "0192abc1-def2-7abc-8def-123456789abc",
  "template_id": "019469a0-cccc-7abc-8def-000000000001",
  "template_value": "PERSON",
  "template_version": 3,
  "identity_hash": "a1b2c3d4e5f6g7h8i9j0...",
  "version": 2,
  "status": "active",
  "data": {
    "first_name": "Alice",
    "last_name": "Schmidt",
    "email": "alice@example.com",
    "status": "Approved",
    "country": "Germany",
    "tax_id": "12345678901",
    "addresses": [
      {
        "street": "Hauptstraße 1",
        "city": "Berlin",
        "postal_code": "10115",
        "country": "Germany"
      }
    ],
    "supervisor": "0192abc1-aaaa-7abc-8def-111111111111"
  },
  "term_references": [
    {
      "field_path": "status",
      "term_id": "019469a0-5678-7abc-8def-abcdef567893",
      "terminology_ref": "019469a0-1234-7abc-8def-abcdef123456",
      "matched_via": "value"
    },
    {
      "field_path": "country",
      "term_id": "019469a0-5678-7abc-8def-abcdef999042",
      "terminology_ref": "019469a0-1234-7abc-8def-abcdef999999",
      "matched_via": "value"
    }
  ],
  "references": [
    {
      "field_path": "supervisor",
      "reference_type": "document",
      "lookup_value": "0192abc1-aaaa-7abc-8def-111111111111",
      "version_strategy": "latest",
      "resolved": {
        "document_id": "0192abc1-aaaa-7abc-8def-111111111111",
        "identity_hash": "f5e6d7c8...",
        "template_id": "019469a0-cccc-7abc-8def-000000000001",
        "version": 1
      }
    }
  ],
  "file_references": [],
  "created_at": "2024-01-15T10:00:00Z",
  "created_by": "user:admin-001",
  "updated_at": "2024-02-20T14:30:00Z",
  "updated_by": "user:admin-001"
}
```

### Document Versioning

Documents use identity-based versioning with **stable document IDs**. The `document_id` remains the same across all versions; the `(document_id, version)` pair is the unique key.

When a document with the same identity_hash is submitted:

1. The Registry returns the existing `document_id` (composite key match on `{namespace, identity_hash, template_id}`)
2. The existing active document is deactivated
3. A new version is created with the same `document_id` and incremented version number

Documents without identity fields always get a fresh `document_id` (empty composite key — no dedup).

```
Document v1 (identity_hash: abc123)
    status: inactive
    document_id: 0192aaa...
    version: 1
    is_latest_version: false

Document v2 (identity_hash: abc123)
    status: active
    document_id: 0192aaa...    ← SAME document_id
    version: 2
    is_latest_version: true
```

---

## Registry Models

### Namespace

A logical partition for IDs to prevent collisions across systems. Each namespace can configure ID generation algorithms per entity type.

```python
class IdAlgorithmConfig(BaseModel):
    """Configuration for ID generation within a namespace."""

    algorithm: str = Field(
        default="uuid7",
        description="ID algorithm: uuid7 (default), uuid4, prefixed, nanoid, pattern, any"
    )
    prefix: str | None = Field(
        None,
        description="Prefix for 'prefixed' algorithm (e.g., 'TERM-', 'TPL-')"
    )
    pad: int = Field(
        default=6,
        description="Zero-padding width for 'prefixed' algorithm (e.g., TERM-000042)"
    )
    length: int = Field(
        default=21,
        description="Character length for 'nanoid' algorithm"
    )
    pattern: str | None = Field(
        None,
        description="Regex pattern for 'pattern' algorithm validation"
    )


class Namespace(BaseModel):
    """A logical partition in the Registry for ID isolation."""

    prefix: str = Field(
        ...,
        description="Unique namespace identifier (e.g., 'wip', 'dev', 'customer-abc')"
    )
    description: str = Field(default="")
    isolation_mode: Literal["open", "strict"] = Field(
        default="open",
        description="open allows cross-namespace refs; strict requires same-namespace"
    )
    allowed_external_refs: list[str] = Field(
        default_factory=list,
        description="For open mode, optional allowlist of external namespaces"
    )
    id_config: dict[str, IdAlgorithmConfig] = Field(
        default_factory=dict,
        description="Per-entity-type ID algorithm config (omitted types default to UUID7)"
    )
    status: Literal["active", "archived", "deleted"] = Field(default="active")
    created_at: datetime
    created_by: str
    updated_at: datetime | None = None
    updated_by: str | None = None
```

### WIP Default Namespace

The `wip` namespace is auto-created by `POST /initialize-wip` with an empty `id_config`, meaning all entity types default to **UUID7**:

| Entity Type | Default Algorithm | Example ID |
|-------------|-------------------|------------|
| `terminologies` | uuid7 | `019469a0-1234-7abc-8def-abcdef123456` |
| `terms` | uuid7 | `019469a0-5678-7abc-8def-abcdef567890` |
| `templates` | uuid7 | `019469a0-cccc-7abc-8def-000000000001` |
| `documents` | uuid7 | `0192abc1-def2-7abc-8def-123456789abc` |
| `files` | uuid7 | `019469a0-ffff-7abc-8def-000000000001` |

### Custom Namespace with Prefixed IDs

To create a namespace with prefixed IDs (or any other algorithm), configure `id_config` per entity type:

```bash
curl -X POST http://localhost:8001/api/registry/namespaces \
  -H "X-API-Key: dev_master_key_for_testing" \
  -H "Content-Type: application/json" \
  -d '{
    "prefix": "legacy-erp",
    "description": "Legacy ERP system with sequential IDs",
    "isolation_mode": "open",
    "id_config": {
      "terminologies": { "algorithm": "prefixed", "prefix": "TERM-", "pad": 6 },
      "terms": { "algorithm": "prefixed", "prefix": "T-", "pad": 6 },
      "templates": { "algorithm": "prefixed", "prefix": "TPL-", "pad": 6 },
      "documents": { "algorithm": "uuid7" },
      "files": { "algorithm": "prefixed", "prefix": "FILE-", "pad": 6 }
    }
  }'
```

Entity types omitted from `id_config` automatically default to UUID7. The available algorithms are:

| Algorithm | Description | Example |
|-----------|-------------|---------|
| `uuid7` | Time-ordered UUID (default) | `019469a0-1234-7abc-8def-abcdef123456` |
| `uuid4` | Random UUID | `550e8400-e29b-41d4-a716-446655440000` |
| `prefixed` | Sequential with prefix | `TERM-000042` |
| `nanoid` | Compact random ID | `V1StGXR8_Z5jdHi6B-myT` |
| `pattern` | Regex-validated external ID | (matches provided pattern) |
| `any` | Accept any external ID | (no validation) |

### Registry Entry

A registry entry stores a canonical ID with its composite key and optional synonyms.

```python
class RegistryEntry(BaseModel):
    entry_id: str          # Canonical ID (e.g., UUID7)
    namespace: str         # Namespace this entry belongs to
    entity_type: str       # Entity type: terminologies, terms, templates, documents, files
    primary_composite_key: dict[str, Any]  # Original composite key
    primary_composite_key_hash: str        # Hash of the primary composite key
    synonyms: list[Synonym]               # Alternative composite keys
    search_values: list[str]              # Flattened string values from all composite keys
    status: str            # "reserved", "active", or "inactive"
    source_info: SourceInfo | None
    metadata: dict[str, Any]
```

**`search_values`** is a flat array containing all string values extracted from `primary_composite_key` and all `synonyms[].composite_key`. It is automatically rebuilt whenever synonyms are added, removed, or entries are merged. Merged/deprecated IDs are also added to `search_values`. This enables efficient value-based lookups — any string value from any composite key can be resolved to its canonical entry via a single indexed query.

**Example:**
```json
{
  "entry_id": "0192abc1-def2-7abc-8def-123456789abc",
  "namespace": "wip",
  "entity_type": "documents",
  "primary_composite_key": {
    "identity_hash": "abc123...",
    "template_id": "019469a0-cccc-7abc-8def-000000000001"
  },
  "synonyms": [
    {
      "namespace": "wip",
      "entity_type": "documents",
      "composite_key": { "external_id": "ERP-CUS-001" }
    }
  ],
  "search_values": ["ERP-CUS-001", "019469a0-cccc-7abc-8def-000000000001", "abc123..."]
}
```

---

## Event Models

Events are published to NATS and contain the **full document** (self-contained for reliable processing).

```python
class EventType(str, Enum):
    DOCUMENT_CREATED = "document.created"
    DOCUMENT_UPDATED = "document.updated"
    DOCUMENT_DELETED = "document.deleted"
    TEMPLATE_CREATED = "template.created"
    TEMPLATE_UPDATED = "template.updated"
    TEMPLATE_DELETED = "template.deleted"
    TEMPLATE_ACTIVATED = "template.activated"


class DocumentEvent(BaseModel):
    """An event published when a document changes."""

    event_id: str
    event_type: EventType
    timestamp: datetime
    document: Document  # Full document included
```

**Example Event:**
```json
{
  "event_id": "evt-123",
  "event_type": "document.created",
  "timestamp": "2024-01-15T10:00:00Z",
  "document": {
    "namespace": "wip",
    "document_id": "0192abc1-def2-7abc-8def-123456789abc",
    "template_id": "019469a0-cccc-7abc-8def-000000000001",
    "template_value": "PERSON",
    "version": 1,
    "status": "active",
    "data": {
      "first_name": "Alice",
      "email": "alice@example.com"
    },
    "term_references": []
  }
}
```

**Why full document in events:**
- Self-contained: Sync worker doesn't need to fetch from source
- No race conditions: Document state at event time is captured
- Simpler processing: Just transform and upsert

---

## Identity Hash Algorithm

The identity hash determines whether a newly submitted document is a new entity or a new version of an existing entity.

```python
import hashlib

def compute_identity_hash(
    data: dict[str, Any],
    identity_fields: list[str]
) -> str:
    """
    Compute a deterministic hash from identity fields.

    Algorithm:
    1. Sort identity field names alphanumerically
    2. Build normalized string: field1=value1|field2=value2|...
    3. Hash with SHA-256
    4. Return hex digest
    """
    sorted_fields = sorted(identity_fields)

    parts = []
    for field in sorted_fields:
        value = data.get(field, "")
        if value is None:
            value = ""
        else:
            value = str(value)
        parts.append(f"{field}={value}")

    normalized = "|".join(parts)

    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()
```

**Example:**
```python
data = {
    "first_name": "Alice",
    "email": "alice@example.com"
}
identity_fields = ["email"]

# Normalized: "email=alice@example.com"
# Result: sha256("email=alice@example.com")
hash = compute_identity_hash(data, identity_fields)
# → "a1b2c3d4e5f6..."
```

**Namespace scoping:** The identity hash itself covers only the identity field values. However, uniqueness is enforced per-namespace because the Registry's composite key includes `{namespace, identity_hash, template_id}`. This means two documents in different namespaces can share the same identity hash but receive different `document_id`s.

---

## API Response Models

### Paginated Response

```python
class PaginatedResponse(BaseModel, Generic[T]):
    """Paginated list response."""

    items: list[T]
    total: int
    page: int
    page_size: int
    has_more: bool
```

### Validation Result

```python
class ValidationResult(BaseModel):
    """Result of document validation."""

    valid: bool
    identity_hash: str | None = None
    template_version: int | None = None
    template_value: str | None = None
    errors: list[dict] = []       # [{field, code, message, details}]
    warnings: list[str] = []
    term_references: list[dict] = []   # [{field_path, term_id, terminology_ref, matched_via}]
    references: list[dict] = []        # [{field_path, reference_type, resolved: {...}}]
    file_references: list[dict] = []   # [{field_path, file_id, filename, ...}]
    timing: dict[str, float] = {}      # stage -> milliseconds
```

### Error Codes

| Code | Description |
|------|-------------|
| `INVALID_JSON` | Document is not valid JSON |
| `MISSING_TEMPLATE_ID` | No template_id specified |
| `TEMPLATE_NOT_FOUND` | Template does not exist |
| `TEMPLATE_INACTIVE` | Template is deactivated |
| `REQUIRED_FIELD_MISSING` | Mandatory field not provided |
| `INVALID_TYPE` | Field value has wrong type |
| `INVALID_TERM_REFERENCE` | Term value not found in terminology |
| `INVALID_PATTERN` | Value doesn't match pattern |
| `OUT_OF_RANGE` | Numeric value outside range |
| `RULE_VIOLATION` | Cross-field rule violated |
| `IDENTITY_FIELD_MISSING` | Identity field not provided |
