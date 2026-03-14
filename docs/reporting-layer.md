# Reporting Layer Architecture

**Date:** 2024-01-30
**Status:** All phases complete

## Overview

The Reporting Layer syncs document data from MongoDB to PostgreSQL, enabling SQL-based analytics and BI tool integration. This is a **one-way sync** - PostgreSQL is read-only for external consumers.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REPORTING SYNC ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   WRITE PATH (Real-time via NATS)                                           │
│   ───────────────────────────────                                           │
│                                                                              │
│   Document Store                                                             │
│        │                                                                     │
│        ├──► MongoDB (primary store)                                          │
│        │                                                                     │
│        └──► NATS ──► Sync Worker ──► PostgreSQL                             │
│         (event with    │              (reporting)                            │
│          full doc)     │                                                     │
│                 ┌──────┴──────┐                                             │
│                 │  Transform  │                                             │
│                 │  • Flatten  │                                             │
│                 │  • Upsert   │                                             │
│                 └─────────────┘                                             │
│                                                                              │
│   RECOVERY PATH (Batch)                                                      │
│   ─────────────────────                                                     │
│                                                                              │
│   Scheduler ──► Sync Worker ──► Document Store API ──► PostgreSQL           │
│   (catchup)          │              (batch fetch)                            │
│                      │                                                       │
│               GET /sync/changes?since=...                                   │
│                                                                              │
│   QUERY PATHS                                                                │
│   ───────────                                                               │
│                                                                              │
│   WIP Console ──► Document Store API ──► MongoDB (Table View - existing)    │
│                                                                              │
│   BI Tools ──────────────────────────► PostgreSQL (direct SQL)              │
│   (Metabase, Grafana, Tableau, etc.)                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Sync Trigger** | Event-driven via NATS + Batch fallback | Real-time sync with recovery capability |
| **Update Strategy** | Upsert by document_id with version check | Simple, handles out-of-order events |
| **Data Source** | NATS event contains full document | Self-contained events, no extra fetches |
| **Schema Creation** | Triggered by template save, not document arrival | Schema ready before docs arrive, no race conditions |
| **BI Interface** | Hybrid (direct PostgreSQL + BI tools) | PostgreSQL is data source; Metabase/Grafana are BI tools |

## Important Clarifications

1. **Table View is NOT stored** - The existing `/table/{template_id}` endpoint computes flat rows on-demand from MongoDB. There's no "update" step.

2. **Sync Worker is a separate service** - A new `reporting-sync` service subscribes to NATS and handles all PostgreSQL operations.

3. **Schema creation is proactive** - Tables are created when templates are saved, not reactively on first document. This avoids race conditions and ensures schema is ready.

4. **PostgreSQL is a data source, not a BI tool** - BI tools (Metabase, Grafana, Tableau) connect to PostgreSQL for visualization.

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              COMPLETE FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   TEMPLATE CREATION (schema setup)                                           │
│   ────────────────────────────────                                          │
│   Template Store ──► MongoDB                                                 │
│        │                                                                     │
│        └──► NATS (wip.templates.created) ──► Sync Worker                    │
│                                                      │                       │
│                                                      ▼                       │
│                                              CREATE TABLE doc_{code}         │
│                                              (PostgreSQL schema ready)       │
│                                                                              │
│   DOCUMENT CREATION (data sync)                                              │
│   ─────────────────────────────                                             │
│   Document Store ──► MongoDB (primary store)                                 │
│        │                                                                     │
│        └──► NATS (wip.documents.created) ──► Sync Worker                    │
│                                                      │                       │
│                                              Check template config:          │
│                                              ├─ disabled? → discard          │
│                                              ├─ latest_only? → UPSERT        │
│                                              └─ all_versions? → INSERT       │
│                                                      │                       │
│                                                      ▼                       │
│                                              PostgreSQL (flattened data)     │
│                                                                              │
│   QUERYING                                                                   │
│   ────────                                                                  │
│   WIP Console ──► Document Store API ──► MongoDB (real-time, operational)   │
│                                                                              │
│   BI Tools ──────► PostgreSQL ──────────────► Analytics, cross-template     │
│   (Metabase,                                  joins, aggregations,           │
│    Grafana,                                   dashboards, reports            │
│    Tableau)                                                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Sync Trigger: Event-Driven via NATS

Document Store publishes events to NATS on every document change:

```
Subject: wip.documents.created
Subject: wip.documents.updated
Subject: wip.documents.deleted
```

**Event Payload:**
```json
{
  "event_id": "evt-123",
  "event_type": "document.created",
  "timestamp": "2024-01-30T10:00:00Z",
  "document": {
    "document_id": "0192abc...",
    "template_id": "TPL-000001",
    "template_code": "PERSON",
    "version": 1,
    "status": "active",
    "identity_hash": "a1b2c3...",
    "data": { ... },
    "term_references": { ... },
    "created_at": "2024-01-30T10:00:00Z",
    "created_by": "user-123"
  }
}
```

**Why full document in event:**
- Self-contained: Sync worker doesn't need MongoDB access
- No race conditions: Document state at event time is captured
- Simpler worker: Just flatten and upsert

**Batch fallback** for:
- Initial population of PostgreSQL
- Recovery after sync worker downtime
- Periodic consistency checks

## Update Strategy: Upsert by document_id

PostgreSQL tables use `document_id` as primary key with version checking:

```sql
INSERT INTO doc_person (document_id, version, status, first_name, last_name, ...)
VALUES ($1, $2, $3, $4, $5, ...)
ON CONFLICT (document_id)
DO UPDATE SET
  version = EXCLUDED.version,
  status = EXCLUDED.status,
  first_name = EXCLUDED.first_name,
  ...
WHERE doc_person.version < EXCLUDED.version;  -- Only if newer
```

**Version check** handles:
- Out-of-order event delivery
- Duplicate events (idempotent)
- Retry scenarios

## Template-Level Sync Configuration

**CRITICAL:** Sync behavior is configured per template but is **version-independent** (doesn't change when template is updated).

Templates gain a new `reporting` configuration section:

```json
{
  "code": "PERSON",
  "name": "Person",
  "identity_fields": ["email"],
  "fields": [...],
  "rules": [...],
  "reporting": {
    "sync_enabled": true,
    "sync_strategy": "latest_only",
    "table_name": "doc_person",
    "include_metadata": true,
    "flatten_arrays": true,
    "max_array_elements": 10
  }
}
```

**Sync Strategy Options:**

| Strategy | Behavior | Use Case |
|----------|----------|----------|
| `latest_only` | UPSERT overwrites, one row per document_id | Most common - current state only |
| `all_versions` | INSERT all versions, keep history | Audit requirements |
| `disabled` | Don't sync to PostgreSQL | Transient/temporary data |

## PostgreSQL Schema Management

**Auto-generated tables** from template definitions:

```sql
CREATE TABLE doc_person (
    -- System columns (always present)
    document_id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL,
    template_version INTEGER NOT NULL,
    version INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,
    identity_hash TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    created_by TEXT,
    updated_at TIMESTAMP,
    updated_by TEXT,

    -- Data columns (from template fields)
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    birth_date DATE,
    gender TEXT,                    -- Term value (original)
    gender_term_id TEXT,            -- Resolved term_id

    -- Nested objects flattened
    address_street TEXT,
    address_city TEXT,
    address_postal_code TEXT,
    address_country TEXT,
    address_country_term_id TEXT,

    -- Original JSON for complex queries
    data_json JSONB,
    term_references_json JSONB
);

CREATE INDEX doc_person_template_id_idx ON doc_person(template_id);
CREATE INDEX doc_person_status_idx ON doc_person(status);
CREATE INDEX doc_person_created_at_idx ON doc_person(created_at);
```

**Type Mapping:**

| WIP Field Type | PostgreSQL Type |
|----------------|-----------------|
| string | TEXT |
| number | NUMERIC |
| integer | INTEGER |
| boolean | BOOLEAN |
| date | DATE |
| datetime | TIMESTAMP |
| term | TEXT (value) + TEXT (term_id) |
| object | Flattened with prefix |
| array | See Array Handling |

**Array Handling:**

| Option | Behavior | Config |
|--------|----------|--------|
| Flatten | Multiple rows per document | `flatten_arrays: true` |
| JSON | Store as JSONB column | `flatten_arrays: false` |
| Truncate | First N elements only | `max_array_elements: 10` |

## Schema Evolution

When template fields change:

1. **New field added:** `ALTER TABLE ADD COLUMN` (nullable)
2. **Field removed:** Column remains (historical data preserved)
3. **Field type changed:** New column with suffix `_v{version}`, old preserved
4. **Template deleted/deactivated:** Table remains, no new inserts

**Migration tracking table:**
```sql
CREATE TABLE _wip_schema_migrations (
    template_code TEXT NOT NULL,
    template_version INTEGER NOT NULL,
    migration_sql TEXT NOT NULL,
    applied_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (template_code, template_version)
);
```

## API Endpoints

**Base URL:** http://localhost:8005

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check (nats/postgres status) |
| GET | `/status` | Sync worker status |
| GET | `/metrics` | Comprehensive metrics (latency, throughput, per-template stats) |
| GET | `/metrics/consumer` | NATS consumer info (queue depth, pending) |
| GET | `/alerts` | Active alerts and configuration |
| PUT | `/alerts/config` | Update alert thresholds and webhook |
| POST | `/alerts/test` | Manually trigger alert check |
| GET | `/schema/{template_code}` | View generated schema for template |
| POST | `/sync/batch/{template_code}` | Trigger batch sync for one template |
| POST | `/sync/batch` | Trigger batch sync for all templates |
| GET | `/sync/batch/jobs` | List all batch sync jobs |
| GET | `/sync/batch/jobs/{job_id}` | Get specific job status |
| DELETE | `/sync/batch/jobs/{job_id}` | Cancel a running job |
| DELETE | `/sync/batch/jobs` | Clear completed jobs from memory |

## Configuration

```yaml
# reporting-sync/config.yaml
nats:
  url: nats://localhost:4222
  stream: WIP_EVENTS
  consumer: reporting-sync

postgresql:
  host: localhost
  port: 5432
  database: wip_reporting
  user: wip
  password: ${POSTGRES_PASSWORD}

sync:
  batch_size: 100
  retry_attempts: 3
  retry_delay_ms: 1000

template_store:
  url: http://localhost:8003
  api_key: ${API_KEY}
```

## Implementation Status

All phases complete:

- ✅ Phase 1: Infrastructure (PostgreSQL, NATS, service skeleton)
- ✅ Phase 2: Event Publishing (NATS events from Document/Template Store)
- ✅ Phase 3: Schema Management (DDL generation, migrations)
- ✅ Phase 4: Sync Worker (NATS consumer, transformer, upsert)
- ✅ Phase 5: Batch Sync (job management, progress tracking)
- ✅ Phase 6: Template Configuration (UI for sync settings)
- ✅ Phase 7: Monitoring & Alerts (metrics, thresholds, webhooks)
