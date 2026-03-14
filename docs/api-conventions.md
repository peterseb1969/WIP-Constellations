# API Conventions

All WIP services follow a consistent set of API conventions. This document is the single source of truth for patterns used across Registry, Def-Store, Template-Store, and Document-Store.

---

## Bulk-First: Every Write Endpoint is Bulk

**Core principle: all write endpoints accept a JSON array and return a `BulkResponse`. Single operations are just `[item]`.**

There are no single-entity write endpoints. This eliminates the need for separate `/bulk` routes and ensures a uniform contract for all clients.

### Request Format

Every POST (create), PUT (update), and DELETE endpoint accepts:

```
Body: List[ItemRequest]    (via FastAPI Body(...))
```

For creates and updates, each item is the entity payload. For deletes, each item has `id` (and optionally `force`):

```json
// POST /api/def-store/terminologies — create one
[{"value": "GENDER", "label": "Gender", "namespace": "wip"}]

// POST /api/def-store/terminologies — create multiple
[
  {"value": "GENDER", "label": "Gender", "namespace": "wip"},
  {"value": "COUNTRY", "label": "Country", "namespace": "wip"}
]

// PUT /api/template-store/templates — update (ID in body, not URL)
[{"template_id": "019abc...", "label": "Updated Label"}]

// DELETE /api/def-store/terminologies — delete
[{"id": "019abc..."}, {"id": "019def...", "force": true}]
```

### Response Format: `BulkResponse`

Every write endpoint returns HTTP 200 with:

```json
{
  "results": [
    {
      "index": 0,
      "status": "created",
      "id": "019abc12-def3-7abc-..."
    },
    {
      "index": 1,
      "status": "error",
      "error": "Terminology with value 'GENDER' already exists"
    }
  ],
  "total": 2,
  "succeeded": 1,
  "failed": 1
}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `results` | `List[BulkResultItem]` | Per-item results, in same order as input |
| `total` | `int` | Total items processed |
| `succeeded` | `int` | Items that succeeded |
| `failed` | `int` | Items that failed |

**Per-item `BulkResultItem`:**

| Field | Type | Description |
|-------|------|-------------|
| `index` | `int` | Position in the input array |
| `status` | `str` | `"created"`, `"updated"`, `"deleted"`, `"skipped"`, `"error"` |
| `id` | `str?` | Generated or existing entity ID |
| `error` | `str?` | Error message (when `status == "error"`) |

Services extend `BulkResultItem` with extra fields:

- **Template-Store** adds: `value`, `version`, `is_new_version`
- **Document-Store** adds: `document_id`, `identity_hash`, `version`, `is_new`, `warnings`

### Key Rules

1. **Always HTTP 200** — errors are per-item in `results[i].status == "error"`, not HTTP status codes
2. **Never check HTTP status for business errors** — a 409 Conflict will never be returned; check `result.error` instead
3. **Updates use PUT with ID in the body** — `PUT /templates` with `[{"template_id": "...", ...}]`
4. **Deletes use DELETE with body** — `DELETE /terminologies` with `[{"id": "..."}]`
5. **GET endpoints are NOT bulk** — single-entity GET and paginated list GET stay as-is

---

## Client Code Examples

### Python (WIP-Toolkit / scripts)

```python
from wip_toolkit.client import WIPClient, WIPClientError

client = WIPClient(config)

# Create a terminology
result = client.post("def-store", "/terminologies", json=[{
    "value": "GENDER",
    "label": "Gender",
    "namespace": "wip",
}])
r = result["results"][0]
if r["status"] == "created":
    terminology_id = r["id"]
elif r["status"] == "error" and "already exists" in r.get("error", ""):
    print("Skipped — already exists")
else:
    raise RuntimeError(f"Failed: {r.get('error')}")

# Update a template
result = client.put("template-store", "/templates", json=[{
    "template_id": template_id,
    "label": "Updated Label",
}])
r = result["results"][0]
if r["status"] == "error":
    raise RuntimeError(r["error"])

# Delete terminologies
result = client.post("def-store", "/terminologies", json=[
    {"id": tid1},
    {"id": tid2, "force": True},
])
for r in result["results"]:
    if r["status"] == "error":
        print(f"Failed to delete item {r['index']}: {r['error']}")
```

### TypeScript (WIP Console UI)

The UI wraps bulk operations with convenience helpers:

```typescript
// api/client.ts — base helpers

protected async bulkWrite<T>(
  method: 'post' | 'put' | 'delete',
  url: string,
  items: T[]
): Promise<BulkResponse> {
  const response = await this.client.request<BulkResponse>({
    method,
    url,
    data: items,
  })
  return response.data
}

protected async bulkWriteOne<T>(
  method: 'post' | 'put' | 'delete',
  url: string,
  item: T
): Promise<BulkResultItem> {
  const resp = await this.bulkWrite(method, url, [item])
  const result = resp.results[0]
  if (result.status === 'error') {
    throw new Error(result.error || 'Operation failed')
  }
  return result
}
```

**Usage in API client methods:**

```typescript
// Create one terminology — wraps in array, unwraps single result
async createTerminology(data: CreateTerminologyRequest): Promise<BulkResultItem> {
  return this.bulkWriteOne('post', '/terminologies', data)
}

// Update one template — ID in body
async updateTemplate(data: UpdateTemplateRequest): Promise<BulkResultItem> {
  return this.bulkWriteOne('put', '/templates', data)
}

// Delete one term
async deleteTerm(id: string): Promise<BulkResultItem> {
  return this.bulkWriteOne('delete', '/terms', { id })
}
```

**Usage in stores (unwrap + re-fetch):**

```typescript
// stores/terminology.ts
async createTerminology(data: CreateTerminologyRequest) {
  const result = await defStoreClient.createTerminology(data)
  // Re-fetch the full entity after creation
  return await defStoreClient.getTerminology(result.id!)
}
```

### Common Mistake: Checking HTTP Status Codes

```python
# WRONG — bulk endpoints always return HTTP 200
try:
    result = client.post("def-store", "/terminologies", json=[payload])
except WIPClientError as e:
    if e.status_code == 409:  # This NEVER fires!
        print("Duplicate")

# CORRECT — check per-item result status
result = client.post("def-store", "/terminologies", json=[payload])
r = result["results"][0]
if r["status"] == "error" and "already exists" in r.get("error", ""):
    print("Duplicate")
```

---

## Pagination

All list (GET) endpoints use consistent pagination:

| Parameter | Default | Maximum | Description |
|-----------|---------|---------|-------------|
| `page` | 1 | — | Page number (1-based) |
| `page_size` | 50 | 100 | Items per page |

All list responses include:

```json
{
  "items": [...],
  "total": 150,
  "page": 1,
  "page_size": 50,
  "pages": 3
}
```

The `pages` field is computed as `ceil(total / page_size)`.

---

## Status Codes

| Code | When |
|------|------|
| **200** | All successful responses, including write operations (errors are per-item in BulkResponse) |
| **401** | Missing or invalid authentication |
| **404** | Entity not found (GET by ID) |
| **422** | Invalid request body (validation error from FastAPI) |
| **502** | Upstream service error (e.g., Registry unreachable from Template-Store) |

**Note:** 201 and 409 are never returned. All write results are communicated via `BulkResponse.results[i].status`.

---

## Authentication

All endpoints (except `/health`) require authentication:

- **API Key:** `X-API-Key: <key>` header
- **JWT:** `Authorization: Bearer <token>` header
- **Dual mode:** Either method accepted (configured via `WIP_AUTH_MODE`)

---

## Soft Deletion

Data is never physically deleted. All delete operations set `status: "inactive"`. Entities can be restored via dedicated restore endpoints (e.g., `POST /terminologies/{id}/restore`).

**Exception: Files.** Binary files stored in MinIO support a two-step purge: soft-delete (`DELETE /files` → sets status to `inactive`) followed by hard-delete (`DELETE /files/{id}/hard` → permanently removes from MinIO and database). Hard-delete only works on files already in `inactive` status. This exists because binary storage has real cost, unlike soft-deleted MongoDB documents which are negligible.

---

## What is NOT Bulk

These endpoints remain single-entity or have special semantics:

| Endpoint | Reason |
|----------|--------|
| `GET /entity/{id}` | Single-entity read |
| `GET /entities?page=...` | Paginated list |
| `POST /files` | Multipart file upload (inherently single) |
| `POST /templates/{id}/activate` | Cascading operation, not CRUD |
| `POST /templates/{id}/cascade` | Cascading operation |
| `POST /validate`, `POST /validate/bulk` | Read-like operations |
| `POST /terms/{id}/restore` | Single restore by ID |
| `POST /documents/query` | Complex query |
