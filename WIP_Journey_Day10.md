# WIP Constellation Experiment — Day 10: Ralph

**Date:** Tuesday, March 24, 2026
**Duration:** Evening session
**Theme:** Documentation cleanup, release discipline, and the discovery that Peter has a name

---

## The Ralph Loop

From an Anthropic engineering article, read by Peter on Tuesday evening:

> *"As models get more capable, they require less bespoke orchestration. At a given point in time, however, it can be useful to provide some level of scaffolding as a capability uplift. Current models can suffer from agentic laziness — when asked to complete a complex, multi-part task, they can sometimes find an excuse to stop before finishing the entire task.*
>
> *To circumvent this, a useful orchestration pattern is the Ralph loop, which is essentially a for loop which kicks the agent back into context when it claims completion, and asks if it's really done."*

Peter read this and recognised himself.

For 9 days, Peter has been the Ralph loop — the human who kicks the agent back into context when it claims completion, and asks if it's really done.

| Day | Claude says done | Peter (Ralph) says |
|---|---|---|
| Day 7 | "Security audit complete" | "Test it on the Pi" → 4 deployment bugs |
| Day 8 | "Documentation overhaul complete" | "Did we check CLAUDE.md?" → 9 issues |
| Day 8 | "Ontology is nice-to-have" | "Do the ontology layer" |
| Day 9 | "Ready to tag" | "Run the full audit, not --quick" |
| Day 9 | "Ready to tag" | Checks Gitea CI himself → ShellCheck failures |
| Day 9 | "Want me to commit and tag?" | "No. Show me the remaining md files" |
| Day 10 | "Want me to fix items 1-3?" | "Do 4-8 now, do it properly" |
| Day 10 | "Let me update the baselines" | "Fix the code and restart the checklist" |
| Day 10 | Runs `--quick --ci` | "Can you run it without --quick?" |

Entry 024 ("AI bias toward closure") was the observation. The Ralph loop is the engineering solution. The article gave Peter's role a name. He promptly installed the `/ralph-loop` plugin for Claude Code.

---

## The Documentation Audit

The v1.0.0 documentation lie — the client library claiming to auto-route ports, when it doesn't — was found and fixed on Day 9 across 6 files. But Peter suspected the rot went deeper. He was right.

WIP-Claude scanned all 78 tracked markdown files and found 12 issues across three priority tiers.

### High Risk (confirmed wrong, fixed)

| File | Issue |
|---|---|
| docs/AI-Assisted-Development.md | Reported as having direct port examples — actually clean (false positive from the scan) |
| docs/HOW-TO.md | Entire API reference teaching `$HOST:8002` — ~100 curl examples rewritten to use Caddy |
| docs/WIP_AppSetup_Guide.md | Pre-flight health checks using direct ports |

### Medium Risk (misleading, fixed)

| File | Issue |
|---|---|
| docs/authentication.md | ~10 curl examples using direct ports; also "Rate limiting" still listed as "Future Enhancement" despite being implemented on Day 7 |
| docs/mcp-server.md | Env defaults showing direct ports without context (correct for MCP, but unlabeled) |
| docs/security/key-rotation.md | Verification curl using direct port |
| docs/components.md | Ports listed without noting app clients should use Caddy |
| components/def-store/README.md | Direct ports + `docker-compose` instead of `podman-compose` + stale API examples (`code→value`, `name→label`) |
| components/document-store/README.md | Direct port caveat missing |
| components/registry/README.md | `docker-compose` → `podman-compose`, direct port caveat missing |

### Low Priority (fixed)

| File | Issue |
|---|---|
| docs/design/natural-language-interface.md | Architecture diagram with direct ports |
| docs/project-structure.md | Dead references to `docs/deployment.md` and `docs/philosophy.md` |
| deploy/optional/metabase/README.md | Hardcoded `wip_dev_password` |

### Testing the Documentation

Peter: "Test the curl commands you updated on the Pi — they need to work there."

WIP-Claude tested all five service routes through Caddy on the Pi. All passed except one: the reporting-sync `/health` endpoint. Investigation revealed this wasn't a bug — all six services mount `/health` on the app root for container healthchecks (direct port access), while router-mounted endpoints (`/status`, `/health/integrity`) are for external access through Caddy. Two concerns, two mount points, working as designed.

The doc was fixed to use the correct router-mounted endpoint. WIP-Claude found this by *testing the documentation* — the approach Peter mandated, not the approach WIP-Claude would have taken on its own.

### The Release Checklist

The documentation audit revealed what was missing from the v1.0.0 release process: nobody checked whether the documentation matched reality. The new `docs/release-checklist.md` has 8 sections:

1. Code quality
2. Tests
3. Security
4. API consistency
5. **Documentation** (the new section, with 5 subsections):
   - 5a: Curl examples work through Caddy (smoke test script included)
   - 5b: No broken inter-doc links
   - 5c: Terminology consistency (podman-compose, field names, tool count)
   - 5d: Client library README accuracy
   - 5e: App setup guide verification
6. Deployment verification on real hardware
7. Git hygiene
8. Post-release

Section 5a includes a runnable smoke test script — the checklist doesn't just say "check the docs," it says "run the curl commands and verify 200."

---

## Quality Audit: The Baseline Problem

Running the full quality audit (not `--quick`, per Ralph) revealed regressions:
- mypy: +4 type errors in wip-auth (from the Day 7 security audit code)
- vulture: +1 unused import (`_rate_limit_exceeded_handler` imported but never used)

WIP-Claude proposed updating the baselines to match. Peter: "Fix the code and restart the checklist."

The unused import was trivial. The mypy errors required actual type annotation work in wip-auth. Both fixed before proceeding — because moving baselines is the documentation lie's cousin: the metric looks green, but the problem is still there.

---

## v1.1 Design: Namespace Deletion Policy

With v1.0.1 stable, Peter turned to the first v1.1 feature: deletion. Today, WIP is soft-delete only — everything gets `status: "inactive"`, nothing is ever physically removed. Peter listed the real-world scenarios where this isn't enough:

- **IoT/HomeAssistant data** — eventually needs archiving and space reclamation
- **PostgreSQL performance** — archived data consuming space and degrading queries
- **Data privacy** — obligation to delete a namespace entirely
- **Dev iteration clutter** — deactivated templates, terms, and documents from failed experiments. Can't clean terminologies at all (immutable).
- **AI agent workflow** — create `dev_namespace`, iterate, export, bootstrap into `prod_namespace`, delete `dev_namespace`

### Two Modes, Not Four

WIP-Claude proposed two deletion modes on the namespace:

| Mode | Soft-delete | Hard-delete entities | Delete namespace | Use case |
|---|---|---|---|---|
| `retain` (default) | yes | no | no | Production, compliance |
| `full` | yes | yes | yes | Dev iteration, IoT, disposable |

Set at creation, changeable by admin. `retain → full` requires confirmation. `full → retain` is the "lock the door after cleanup" operation.

### The Delete Journal

Peter pushed back on WIP-Claude's initial design (REST cascade across services): "All deletes are MongoDB deletes in the end. No component needs to be informed — the data will just be gone, no hard feelings from def-store and friends."

The design became a write-ahead log for destruction:

1. **Dry-run** — report what would be deleted, list inbound references from other namespaces, no changes made
2. **Lock** — namespace status set to `locked`, immediately unusable (30-second cache expiry for propagation)
3. **Build journal** — Registry queries all collections for records matching the namespace, captures MinIO paths, identifies PostgreSQL tables
4. **Reference check** — query inbound references from OTHER namespaces (template inheritance, terminology references, cross-namespace synonyms). Without `--force`: abort and unlock. With `--force`: proceed, caller accepts responsibility
5. **Execute** — work through journal step by step: MongoDB collections, MinIO objects, PostgreSQL tables. Each step marked completed. `deleteMany({namespace: "dev_herbs"})` is idempotent — run twice, second time deletes zero
6. **Finalize** — archive journal as permanent audit record, delete namespace record last

### WIP-Claude Found Six Flaws

| Flaw | Severity | Fix |
|---|---|---|
| MinIO orphans | High | Journal must include MinIO cleanup step |
| PostgreSQL tables left behind | High | Journal must include PostgreSQL drop step |
| Cross-namespace terminology/template refs | High | Pre-check must refuse (or `--force`) |
| Late writes during 30s cache window | Low | Filter-based deleteMany, not ID-based |
| Collection name coupling | Low | Hardcoded list + developer guide note |
| file_metadata → MinIO ordering | Medium | Read MinIO paths before deleting metadata, or use prefix convention |

### Key Design Decisions

- **Registry is the orchestrator** — it's the namespace authority, has MongoDB access, builds and executes the journal
- **No NATS consumers needed** — only Reporting-Sync listens to NATS today. Adding consumers to all services for one feature isn't worth it. Registry calls PostgreSQL cleanup directly.
- **Completed journals live forever** — audit trail. "What was in `dev_herbs` before deletion?" is always answerable. Also prevents namespace prefix reuse collisions.
- **Dry-run first** — check the blast radius before pulling the trigger. Same flow up to reference check, then return the report without locking or deleting.
- **Hardcoded collection list** (not dynamic discovery) — honest and pragmatic. Developer guide says "if you add a collection, add it to the namespace deletion journal."

The design doc was written to `docs/design/namespace-deletion.md`.

---

## CI: Ten Tags to Green

While the documentation and design work progressed, WIP-Claude was also wrestling with Gitea CI. The `act_runner` in host mode on aarch64 exposed a cascade of platform assumptions: `$GITHUB_PATH` is ignored, entry point scripts aren't generated on ARM, `upload-artifact@v4` is GitHub-only. Ten tags (v1.0.1 through v1.0.10) to get CI fully green. The same class of bug as the Pi deployment testing — things that work in one environment and break in another.

---

## The D&D Migration Test

With v1.0.10 stable and the deletion policy designed, Peter turned to a practical test: migrating the D&D dataset from the Mac's `wip` namespace to a `dnd` namespace on the Pi.

### wip-toolkit Export

```
wip-toolkit export wip /tmp/wip-dnd-export.zip --include-files --filter-templates "DND_"
```

2.26 seconds. 18 terminologies, 195 terms, 20 templates, 1,384 documents, 38 files, 1,510 Registry lookups, 983 synonyms. The referential closure algorithm completed in zero iterations (no cross-namespace dependencies). The `--filter-templates "DND_"` correctly narrowed 32 terminologies down to the 18 referenced by D&D templates.

**Bug found and fixed:** The streaming pagination used cursor-based pagination, which stopped at page 1 because the document-store uses offset pagination. First export returned only 1,000 of 1,384 documents. WIP-Claude caught and fixed it.

### Import to Pi

Five iterations to get the import working:

1. **Terminology ID remapping** — Def-store doesn't support `terminology_id` pass-through. Built bulk value-based lookup to map old→new IDs, remaps terms and template field references.
2. **page_size cap** — API max is 100, toolkit was requesting 500.
3. **Exception handling** — Template creation caught only `WIPClientError`, missing `httpx.RemoteProtocolError`.
4. **File upload ordering** — Files must be imported before documents (documents validate file references on create). Nobody documented this dependency.
5. **Document retry pass** — Auto-retries failed documents once to handle reference ordering (parent before child).

Result: 1,370 of 1,384 documents imported (99%). The 14 failures were DND_SUBCLASS documents whose `parent_class` fields contained document IDs from the Mac that don't exist on the Pi.

**Key finding:** The backend *already supports* `document_id` and `template_id` pass-through for restore — this was designed and implemented. The toolkit just isn't triggering it correctly. The 14 failures are a toolkit bug, not a missing feature. The fix is a conditional, not an architecture change.

**Also fixed:** `dev-delete.py` enhanced with MinIO (boto3) and PostgreSQL (psycopg2) cleanup alongside existing MongoDB. Graceful skip when backends unavailable.

**Status:** 99% success rate. ID pass-through debugging is next session's first task.

---

## Day 10 Summary (6 hours)

| Track | What happened |
|---|---|
| **Documentation audit** | 78 markdown files scanned, 12 issues found and fixed, ~120 curl examples rewritten from direct ports to Caddy |
| **Release checklist** | Created `docs/release-checklist.md` with 8 sections including documentation smoke tests |
| **Quality baseline** | mypy + vulture regressions fixed (not baselined away), per Ralph |
| **CI** | v1.0.1 → v1.0.10, ten tags to get Gitea CI green on aarch64 |
| **v1.1 design** | Namespace deletion policy: two modes (retain/full), delete journal, dry-run, six flaws identified |
| **wip-toolkit fixes** | Export pagination bug, false positive reference warnings, `--filter-templates` option added |
| **wip-toolkit import** | Five iterations: terminology ID remap, page_size cap, exception handling, file ordering, document retry |
| **dev-delete.py** | Enhanced with MinIO + PostgreSQL cleanup |
| **D&D migration** | Export (2.26s, 1,384 docs) → Import to Pi (1,370/1,384, 99%). ID pass-through is a toolkit bug, not missing feature |
| **Ralph loop** | Pattern identified from Anthropic engineering article. Plugin installed. |
| **Commits** | 8 over ~6 hours |

---

## Day 10 Stats

| Metric | Value |
|---|---|
| Commits | 8 |
| Markdown files audited | 78 |
| Documentation issues fixed | 12 (~120 curl examples) |
| Release tags | v1.0.1 → v1.0.10 (CI fixes) |
| Quality regressions fixed | 5 (mypy + vulture) |
| Release checklist | Created (8 sections) |
| v1.1 design docs | 1 (namespace deletion) |
| wip-toolkit bugs fixed | 3 (export) + 5 (import iterations) |
| D&D migration | 1,384 exported → 1,370 imported (99%) |
| Ralph loop instances | 3+ |
| Lessons learned | 42 |

---

*Day 10 status: The documentation lie was the tip of the iceberg — 78 files audited, 12 issues fixed, ~120 curl examples rewritten. A release checklist with documentation smoke tests was created. CI took 10 tags to get green on aarch64. The v1.1 namespace deletion policy was designed (two modes, delete journal, dry-run, six flaws found). The wip-toolkit got 8 bug fixes across export and import, and the D&D dataset was migrated to the Pi at 99% — the 1% failure is a toolkit bug, not a missing backend feature. The backend already supports ID pass-through; the toolkit just isn't triggering it. Eight commits, 6 hours, and the discovery that Peter has been the Ralph loop all along.*

*See [Day 9: The Release](WIP_Journey_Day9.md) for the previous day.*
