# Uniqueness & Identity

## Why This Matters

Consider three scenarios:

1. **Backup & restore:** You export namespace `production` and restore it to a test instance. Every terminology, term, template, and document must arrive with its original ID intact — or downstream references break.

2. **Multi-namespace operation:** You run `wip` and `partner-data` side by side. Both have a `TERM-000001`, but they're completely different entities. Uniqueness can't be global, or the second namespace can never be created.

3. **External system integration:** A vendor sends you records keyed by their internal ID (`SAP-PATIENT-4291`). You need to map that to your canonical WIP ID without losing the vendor's key.

WIP's uniqueness model is designed around these realities. It uses **namespace-scoped uniqueness** for domain entities, a **central Registry** as the single source of truth for IDs, and **synonyms** for linking alternative identities to the same canonical entry.

---

## The Three-Tier Model

### Tier 1: Global Uniqueness (Instance-Wide)

Only two things are globally unique across the entire WIP instance:

| What | Example | Why |
|------|---------|-----|
| Registry `entry_id` | `019469a0-cccc-7abc-...` (UUID7) | Cross-namespace lookup anchor |
| Namespace `prefix` | `wip`, `partner-data`, `backup-2026` | Isolation boundary identifier |

These must be globally unique because they serve as cross-cutting identifiers. The Registry's `entry_id` is the root of all identity — every terminology, term, template, document, and file ultimately traces back to one.

### Tier 2: Namespace-Scoped Uniqueness

All domain entities enforce uniqueness **within their namespace**, not globally:

| Entity | Unique Key | MongoDB Index |
|--------|-----------|---------------|
| Terminology | `(namespace, terminology_id)` | `ns_terminology_id_unique_idx` |
| Terminology | `(namespace, value)` | `ns_value_unique_idx` |
| Term | `(namespace, term_id)` | `ns_term_id_unique_idx` |
| Template | `(namespace, template_id, version)` | `ns_template_id_version_unique_idx` |
| Template | `(namespace, value, version)` | `ns_value_version_unique_idx` |
| Document | `(namespace, document_id, version)` | `ns_document_id_version_unique_idx` |
| File | `(namespace, file_id)` | `ns_file_id_unique_idx` |

This means `TERM-000001` in namespace `wip` and `TERM-000001` in namespace `backup` are **independent entities**. They have different Registry `entry_id`s, different data, different lifecycles. The entity_id is a human-friendly label scoped to its namespace.

### Tier 3: Parent-Scoped Uniqueness

Some entities are unique within their parent, not just their namespace:

| Entity | Unique Within | Key |
|--------|--------------|-----|
| Term value | Terminology + namespace | `(namespace, terminology_id, value)` |
| Template version | Template family + namespace | `(namespace, template_id, version)` |
| Document version | Document family + namespace | `(namespace, document_id, version)` |

A term value like `"Draft"` can appear in both the `DOC_STATUS` and `PRIORITY` terminologies. A template like `PERSON` can have versions 1, 2, 3 — all with the same `template_id` but different field definitions.

---

## The Registry: Single Source of Truth

The Registry is a **standalone registrar**. WIP services are its primary consumer, but it can be used independently for any identity management need.

### How IDs Are Generated

```
 Service                          Registry
    │                                │
    │  "Register this entity"        │
    │  composite_key: {key: value}   │
    ├───────────────────────────────►│
    │                                │ 1. Hash composite key (SHA-256 of
    │                                │    JSON-serialized key-value pairs)
    │                                │ 2. Search: any entry with this hash?
    │                                │    ├─ YES: return existing entry_id
    │                                │    └─ NO:  generate new entry_id
    │   entry_id, is_new             │
    │◄───────────────────────────────┤
    │                                │
```

The caller learns two things: **what ID to use** and **whether it's new or existing**. This single mechanism drives all create-vs-update decisions across WIP.

### Composite Keys

A composite key is a **dictionary of key-value pairs** that uniquely identifies an entity. Both the keys and values matter — `{"email": "alice@example.com"}` is a different composite key from `{"user_email": "alice@example.com"}`.

The Registry hashes the composite key by serializing the full dictionary to JSON with sorted keys, then computing SHA-256:

```python
# Input: {"namespace": "wip", "identity_hash": "a1b2c3...", "template_id": "TPL-001"}
# Sorted JSON: '{"identity_hash":"a1b2c3...","namespace":"wip","template_id":"TPL-001"}'
# Output: SHA-256 of that JSON string
```

Each entity type uses a specific composite key structure:

| Entity | Composite Key | Upsert Behavior |
|--------|--------------|-----------------|
| Terminology | `{"namespace": "wip", "value": "GENDER"}` | Same value in same namespace → same ID |
| Term | `{"terminology_id": "TERM-001", "value": "Male"}` | Same value in same terminology → same ID |
| Template | `{}` (empty) | Always generates a new ID |
| Document (with identity_fields) | `{"namespace": "wip", "identity_hash": "...", "template_id": "TPL-001"}` | Same identity → same document_id, new version |
| Document (no identity_fields) | `{}` (empty) | Always generates a new document_id |
| File | `{}` (empty) | Always generates a new file_id |

**Empty composite key = always new.** This is intentional for entities where every creation should produce a fresh ID.

### Stable IDs Across Versions

For versioned entities (templates and documents), the entity_id is **stable** — it stays the same across all versions:

```
Template "PERSON":
  ┌─────────────────────────────────────┐
  │ template_id: TPL-000001             │  ← same across all versions
  │ version: 1  │  version: 2           │
  │ fields: ... │  fields: ... (updated)│
  │ status: active │ status: active     │
  └─────────────────────────────────────┘
```

The **true unique key** is `(namespace, entity_id, version)`. Multiple versions can be active simultaneously — this enables gradual migration where some documents use v1 and others use v2.

---

## Identity Hash: Document Deduplication

Templates can declare `identity_fields` — the fields that determine whether two documents represent the same real-world entity. The identity hash is computed by the **Document-Store**, not the Registry. The Registry receives it as an opaque value inside the composite key.

### How the Two Hashes Relate

There are two hashes involved, computed by different services for different purposes:

```
Document-Store                              Registry
    │                                           │
    │  1. Compute identity_hash from            │
    │     identity field values                 │
    │     sha256("email=alice@...")              │
    │     → "a1b2c3..."                         │
    │                                           │
    │  2. Build composite key dict:             │
    │     {"namespace": "wip",                  │
    │      "identity_hash": "a1b2c3...",        │
    │      "template_id": "TPL-001"}            │
    │                                           │
    │  3. POST /entries/register ──────────────►│
    │                                           │ 4. Hash the entire dict
    │                                           │    (JSON → SHA-256)
    │                                           │    → composite_key_hash
    │                                           │ 5. Lookup by composite_key_hash
    │                                           │ 6. Return entry_id, is_new
    │◄──────────────────────────────────────────│
```

| Hash | Computed by | Algorithm | Stored on | Purpose |
|------|------------|-----------|-----------|---------|
| Identity hash | Document-Store | `sha256("field=value\|field=value")` | Document record (`identity_hash`) | Domain concept: "what real-world entity is this?" |
| Composite key hash | Registry | `sha256(json({"namespace":..., "identity_hash":..., "template_id":...}))` | Registry entry (`primary_composite_key_hash`) | Infrastructure concept: "have I seen this registration before?" |

The identity hash is an **input** to the composite key — one of the values in the dictionary. The Registry doesn't know or care that it's a hash; it treats it as an opaque string.

### Identity Hash Algorithm

```python
def compute_identity_hash(data, identity_fields):
    sorted_fields = sorted(identity_fields)
    parts = [f"{field}={data.get(field, '')}" for field in sorted_fields]
    normalized = "|".join(parts)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()
```

Both field names and values are included — `email=alice@example.com` hashes differently from `user_email=alice@example.com`.

### Example

```
Template PERSON:
  identity_fields: ["email"]

Document 1: { "email": "alice@example.com", "name": "Alice" }
  → identity_hash: sha256("email=alice@example.com") = "a1b2c3..."
  → composite key sent to Registry: {"namespace": "wip", "identity_hash": "a1b2c3...", "template_id": "TPL-001"}
  → Registry: NEW → document_id: "019-uuid-001", version: 1

Document 2: { "email": "alice@example.com", "name": "Alice Smith" }
  → identity_hash: "a1b2c3..." (same — same email)
  → same composite key → Registry: EXISTING → document_id: "019-uuid-001", version: 2
  (Same person, updated name → new version, not new document)

Document 3: { "email": "bob@example.com", "name": "Bob" }
  → identity_hash: "d4e5f6..." (different email)
  → different composite key → Registry: NEW → document_id: "019-uuid-002", version: 1
```

Templates with **no identity_fields** use an empty composite key — every submission creates a brand new document. This is correct for event logs, audit entries, and other append-only data.

**Namespace scoping:** The identity hash covers only the field values. Uniqueness is per-namespace because the composite key includes `{"namespace": ...}`. Two documents in different namespaces can share the same identity hash but receive different `document_id`s.

---

## Registry Synonyms

A synonym is an **alternative composite key** (a different set of key-value pairs) that resolves to the same canonical entry. This is one of the Registry's most powerful features.

### What Synonyms Are

Every Registry entry has a **primary composite key** and zero or more **synonyms**. A lookup by any of these key-value dictionaries returns the same `entry_id`:

```
Registry Entry:
  entry_id: "019-uuid-42"
  primary_composite_key: {"namespace": "wip", "value": "PERSON"}
  synonyms:
    - composite_key: {"namespace": "backup", "value": "PERSON"}
    - composite_key: {"vendor": "SAP", "patient_type": "OUTPATIENT"}
```

A query for `{"namespace": "backup", "value": "PERSON"}` returns `019-uuid-42` — the same entry as the primary key. The synonym's key-value structure can be completely different from the primary key's structure.

### Use Case: Cross-Namespace Linking

When you know that entity X in namespace `partner` represents the same real-world thing as entity Y in namespace `wip`, you register X's composite key as a synonym of Y's entry:

```
POST /api/registry/entries/{entry_id}/synonyms
{
  "namespace": "partner",
  "entity_type": "documents",
  "composite_key": { "partner_patient_id": "P-8812" }
}
```

Now a lookup for `{"partner_patient_id": "P-8812"}` resolves to the canonical WIP document.

### Use Case: ID Merging

Two canonical entries turn out to represent the same entity. You can **merge** them by making one a synonym of the other:

1. Choose which entry_id to keep as canonical (typically the newer or more complete one)
2. Merge via `POST /api/registry/synonyms/merge` with `preferred_id` and `deprecated_id`
3. The deprecated entry's synonyms and ID are moved to the preferred entry's `search_values`

Lookups by either ID now resolve to the surviving canonical entry.

### Use Case: Vendor ID Mapping

External systems have their own IDs. Register them as synonyms:

```
POST /api/registry/entries/{entry_id}/synonyms
{
  "namespace": "wip",
  "entity_type": "documents",
  "composite_key": { "vendor": "SAP", "vendor_id": "MAT-4291" }
}
```

When a client receives a vendor ID, it queries the Registry to resolve the canonical WIP ID. The client is responsible for this lookup — WIP doesn't automatically intercept vendor IDs in document data.

### How Synonym Resolution Works

```
 Client                               Registry
    │                                     │
    │  "Lookup by composite key"          │
    │  {"vendor": "SAP",                  │
    │   "vendor_id": "4291"}              │
    ├────────────────────────────────────►│
    │                                     │ 1. Hash the key-value dictionary
    │                                     │ 2. Search primary_composite_key_hash
    │                                     │ 3. Search synonyms.composite_key_hash
    │                                     │ 4. Return matching entry
    │   entry_id: "019-uuid-42"           │
    │◄────────────────────────────────────┤
    │                                     │
```

Both primary and synonym key hashes are indexed for O(1) lookup performance.

---

## Cross-Namespace Behavior

### Design Decision: Namespace-Scoped, Not Global

Early WIP versions enforced globally unique entity IDs (e.g., `terminology_id` unique across all namespaces). This blocked a critical workflow: **restoring a backup into a different namespace on the same instance**.

If namespace `production` has `TERM-000001` and you try to restore a backup containing `TERM-000001` into namespace `backup`, a global unique index rejects it — even though the two entities live in completely separate namespaces.

The fix: uniqueness indexes are scoped to `(namespace, entity_id)`. The same `TERM-000001` can exist in both namespaces independently. Each has its own Registry `entry_id` (which remains globally unique).

### What This Enables

- **Backup & restore** with preserved IDs into any namespace
- **Data migration** between namespaces on the same instance
- **Multi-tenant operation** where tenants may have overlapping ID sequences
- **Fresh import** with ID remapping — WIP-Toolkit generates new IDs and rewrites all internal references, optionally registering old-to-new mappings as synonyms

### What Remains Globally Unique

Only the Registry `entry_id` and namespace `prefix`. These are the cross-cutting identifiers that must never collide.

---

## Error Handling

When a uniqueness constraint is violated:

| Scenario | HTTP Response | Detail |
|----------|--------------|--------|
| Duplicate composite key in Registry | `200` — returns existing entry_id | This is upsert, not an error |
| Duplicate `(namespace, value)` for terminology | `409 Conflict` | "Terminology 'X' already exists" |
| Duplicate `(namespace, term_id)` | `409 Conflict` | "Term ID 'X' already exists" |
| Duplicate `(namespace, terminology_id, value)` for term | `409 Conflict` | "Term value 'X' already exists" |
| Duplicate `(namespace, template_id, version)` | `409 Conflict` | Prevented by service layer |
| Duplicate `(namespace, document_id, version)` | `409 Conflict` | Prevented by service layer |

The Registry returning an existing ID is **not an error** — it's the upsert mechanism working as designed. A `409` means you tried to create an entity that already exists at the domain level (bypassing the Registry's dedup, or using a different composite key that happens to produce the same namespace-scoped entity_id).
