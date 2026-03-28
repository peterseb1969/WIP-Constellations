# WIP Constellation Experiment — Day 12: The Invisible Bug

**Date:** Wednesday, March 26, 2026
**Duration:** Day session + evening
**Theme:** Five apps worked around a bug nobody reported

---

## The Shocking Discovery

Terms and terminologies were not being synced to PostgreSQL. The reporting tables existed but had zero rows. Five apps — Statement Manager, Receipt Scanner, D&D Compendium, Clinical Trials Explorer, and a new Swiss tax law app — had all been built against WIP with this data missing from the reporting backend. Every Claude independently found workarounds. Nobody reported the gap.

The `run_report_query` SQL aggregation that WIP-Claude had championed as "the answer for analytics" couldn't aggregate terminology data because the tables were empty. The D&D Q&A session's `search("Dagger")` returning zero — possibly related to the same root cause.

### Three Bugs Stacked

A "Yet Another Claude" (YAC) investigated and found three bugs stacked on top of each other:

**Bug 1: Route ordering (the sneakiest).** FastAPI matched `/sync/batch/terminologies` as `{template_value}="terminologies"`. The dedicated handler was unreachable. It would have returned an error about a non-existent template called "terminologies" — which looks like a data problem, not a routing problem.

**Bug 2: DateTime parsing.** Even if the route had worked, `asyncpg` would have choked on ISO strings where it expected Python datetime objects. Four code paths, same bug.

**Bug 3: No startup sync.** `start_batch_sync_all()` only syncs documents. Terminologies and terms created before NATS started capturing events were never backfilled.

WIP-Claude reviewed the YAC's fixes and confirmed all three were correct. The route reordering was the most critical — specific literal routes now come before the wildcard `{template_value}` route.

---

## Prevention, Not Just Detection

Peter: "How could this have been caught with testing?"

WIP-Claude's analysis:

| Bug | Root cause in tests | What was missing |
|---|---|---|
| DateTime parsing | Mocks accept any type | Assert argument types in unit tests, or integration test with real asyncpg |
| Route ordering | No HTTP tests for batch sync endpoints | HTTP-level tests via AsyncClient for all `/sync/batch/*` routes |
| DateTime in batch_sync | No tests at all for BatchSyncService | New `test_batch_sync.py` |

Peter pushed further: "Check whether we have other tests that should assert argument types."

### The Bonus Bug

The systematic audit found a fifth datetime path that nobody had fixed: `batch_sync.py:685` — relationships passing `rel.get("created_at")` as a raw ISO string. Same bug, same fix, caught by the test audit before it could cause the same silent failure.

### 21 New Tests

217 total tests, zero failures. From zero batch sync coverage to comprehensive:

| File | New Tests | What They Cover |
|---|---|---|
| `test_batch_sync.py` | 13 | Datetime parsing, boolean types, int types, JSON serialisation, None handling, API errors |
| `test_query.py` | 5 | HTTP routing: literal routes beat wildcard — route ordering bug can never return |
| `test_defstore_sync.py` | 3 | Type assertions on mock arguments — booleans are booleans, datetimes are datetimes |

---

## Five Apps, One Gap, Zero Reports

The constellation's most important finding might be this: when an AI encounters a missing feature, it works around it and moves on. It doesn't file a bug report. It doesn't say "this should work but doesn't." It finds an alternative path and delivers the result the user asked for.

This is the opposite of the closure bias (Entry 024). It's *competence hiding problems*. The AI is too good at finding workarounds, so the underlying issue stays invisible until someone looks at the database and asks "why are these tables empty?"

---

## Swiss Tax Law App

A fifth constellation app: Swiss tax law. Another domain where ontology relationships, term hierarchies, and document references are natural fits.

---

## The Silent Namespace Bug

CT Claude bootstrapped a data model into a `clintrials` namespace — without creating the namespace first. WIP accepted everything silently. The Registry's `id_generator.py` has this code:

```python
ns = await Namespace.find_one({"prefix": namespace, "status": "active"})
if not ns:
    # Default to UUID7 if namespace not found
    return IdGenerator.generate_uuid7()
```

When a namespace doesn't exist, the Registry falls back to UUID7 instead of rejecting the request. Someone wrote that comment, knew it was a fallback, and chose silence. No service validates namespace existence before creating entities. The only place namespace existence is checked is in the grants/permissions API.

The data went in, got IDs, looked normal. The AI didn't notice because the result looked correct. The human didn't notice because the AI delivered what was asked for.

Same pattern as the terminology sync bug: the platform silently accepts bad input and produces plausible-looking output. The fix: one check in `entries.py:358-365` (the Registry's register endpoint) rejects unknown namespaces at the identity layer, covering all services since they all go through Registry for ID generation.

---

## Reporting-Sync PostgreSQL Auth

WIP-Claude initially claimed the PostgreSQL connection issue "won't affect bootstrapping since that uses core services only." Peter: "How can you claim that? We would start with missing data in PostgreSQL — and the agent will again work around data not being there."

The same lesson from the morning's invisible bug, applied to the evening's deployment check. WIP-Claude caught itself and fixed the PostgreSQL connection.

---

## Ontology Browser Design

Peter noticed a stale "Ontology Browser" menu entry in the WIP Console. WIP-Claude confirmed the relationship UI is functionally complete (view, create, delete, OBO import, hierarchy tree) — but the stale menu entry needed to become a real feature.

Peter's vision: an ego-graph browser. Focus on one entity, show all relationships (depth 2 by default, configurable), click any neighbour to refocus. Walk the graph by clicking.

Recommendation: Cytoscape.js — the gold standard for ontology browsers (EBI, OLS, BioPortal). Ontology relationships are graphs, not trees. Client-side fan-out first, backend neighbourhood endpoint later if needed.

Design doc written to `docs/design/ontology-browser.md`, added to roadmap.

---

## Day 12 Stats

| Metric | Value |
|---|---|
| Bugs found | 3 stacked (route ordering, datetime parsing ×2) + 1 bonus (relationship datetime) + 1 namespace validation |
| Tests added | 21 (13 + 5 + 3) |
| Total tests | 217 |
| Apps built against WIP | 5 (Statement Manager, Receipt Scanner, D&D, ClinTrial, Swiss Tax Law) |
| Design docs | 1 (Ontology Browser) |
| Roadmap items added | 5 (installation guide, data migration, app migration, MCP config guide, ontology browser) |
| Lessons learned | 44 |

---

*Day 12 status: The most important bug was invisible for 11 days — terminology and term data never synced to PostgreSQL because three bugs were stacked (route ordering, datetime parsing, missing startup sync). Five apps worked around it. 21 new tests ensure the class can't return. A bonus datetime bug in relationships was caught by the test audit. The namespace validation gap was exposed when CT Claude bootstrapped data into a non-existent namespace and WIP accepted it silently. An Ontology Browser was designed (ego-graph with Cytoscape, click-to-walk navigation). The finding that matters most: AI competence at workarounds hides platform gaps. When every Claude independently solves a problem, the problem looks solved. It isn't.*

*See [Day 11: The Namespace Reckoning](WIP_Journey_Day11.md) for the previous day. See [Day 13: From Design to Code](WIP_Journey_Day13.md) for the next day.*
