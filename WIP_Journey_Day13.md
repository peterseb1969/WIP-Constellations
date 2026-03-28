# WIP Constellation Experiment — Day 13: From Design to Code

**Date:** Thursday, March 27, 2026
**Duration:** Evening session (after work)
**Theme:** Design docs become working features, the experiment approaches its conclusion

---

## The Budget Ceiling

The experiment hit its first real-world constraint: budget. Multiple Claudes running simultaneously — WIP-Claude, CT Claude, D&D Claude, Temp Claudes, Web-Claude, plus the Haiku NL interface — blew the subscription tier. Peter upgraded.

This is a validation metric. The constellation pattern works well enough that it scaled past a resource ceiling. Not a technical ceiling (the Mac handles 182K+ documents), not a process ceiling (slash commands and documentation work), but a financial ceiling. The experiment consumed more AI than the plan anticipated because it was productive enough to justify more AI.

---

## Design Docs → Working Code

Three features designed in Days 10-12 became working code:

### Namespace Deletion (designed Day 10, implemented Day 13)

The fireside design session's architecture made it into code intact:

- **Journal-based deletion** with crash recovery — `NamespaceDeletionService`, `DeletionJournal` model, 4 API endpoints
- **Dry-run mode** — check the blast radius before pulling the trigger
- **Force flag** for inbound references — caller accepts responsibility for broken cross-namespace links
- **Locked namespace status** — immediately unusable after deletion requested
- **Startup recovery** — incomplete deletions resume on service restart
- **Audit trail** — completed journals preserved forever
- **MCP tools** — `delete_namespace`, `update_deletion_mode`
- **41 new tests** — deletion mode, dry-run, full deletion, status/resume, locked namespaces, audit trail, recreate-after-delete

Registry tests: 163 → 204. Every design decision from the Day 10 discussion — the two modes (retain/full), the delete journal as write-ahead log, the cascade order, Registry-last — made it into code and tests.

### Ontology Browser (designed Day 12, implemented Day 13)

The ego-graph browser went with D3-force instead of Cytoscape (different library, same concept):

- Vue page with force-directed graph visualization
- PrimeVue Select with typeahead for terminology picker, AutoComplete for term search
- Cross-namespace relationship traversal
- Click any node to refocus the graph
- API enrichment in Def-Store ontology service for richer graph data

The design doc said "start with client-side fan-out, add backend endpoint later if needed." WIP-Claude added the backend enrichment immediately — the right call when the data was available.

### Universal Synonym Resolution (designed Day 11, design doc Day 13)

The fireside chat vision became a complete design document:

- 10 resolved decisions (D1-D10)
- Auto-synonyms at creation, namespace in composite key, rewrite on import
- Colon notation for terms, additive/non-breaking migration
- Backfill script, resolution before validation
- 5 implementation phases defined, ready to build

From philosophical discussion to actionable implementation plan — and then to working code in the same evening.

### Synonym Resolution: Implemented (Phases 1-3)

WIP-Claude didn't stop at the design doc. Phases 1-3 were implemented:

**Phase 1: Auto-synonym registration.** Every entity now gets a human-readable synonym at creation:
- Terminology: `{namespace, type:"terminology", value}`
- Term: `{namespace, type:"term", terminology, value}`
- Template: `{namespace, type:"template", value}`
- Document: `{namespace, type:"document", template, identity_hash}`

All registrations are best-effort — failure is logged but doesn't block entity creation.

**Phase 2: Resolution layer.** New `POST /api/registry/entries/resolve` endpoint for batch synonym resolution. New `wip-auth/resolve.py` module with single and batch resolution, UUID pattern detection (fast path for canonical IDs), colon notation parsing for terms (`STATUS:approved`), and TTL cache (5 minutes).

**Phase 3: Service integration.** API endpoints now accept synonyms — human-readable values resolved to canonical IDs at the API boundary. Templates, documents, terminologies, and terms all support synonym-based lookups.

**Bug fixes found during implementation:** Both Def-Store and Template-Store `add_synonym()` had field name bugs (`namespace/entity_type` instead of `synonym_namespace/synonym_entity_type`). With `extra='forbid'` on the model, these would have failed with 422. Building the feature was the test that found the bugs.

**Phase 4: Import namespace rewriting.** WIP-Toolkit's restore and fresh import paths now rewrite the namespace field in synonym composite keys when target namespace differs from source. Cross-instance migration with synonym preservation works.

**Phase 5: Backfill + CLI.** New `wip-toolkit backfill-synonyms <namespace>` command iterates all terminologies, terms, templates, and identity-based documents, building correct auto-synonym composite keys and registering them. Options: `--skip-documents`, `--batch-size`, `--dry-run`. 14 new tests. Design doc updated: all 5 phases marked implemented.

From fireside chat (Day 11) to fully implemented (Day 13). Two evenings.

---

## CI: The Synonym Resolution Broke Everything

The synonym resolution's Phase 3 (service integration) broke CI. Every test that created a terminology, term, template, or document failed: `httpx.ConnectError: All connection attempts failed`. The resolution layer tried to HTTP-call Registry, but CI only runs MongoDB — no Registry service.

The `contextlib.suppress(EntityNotFoundError)` at the API boundary didn't catch it because `ConnectError` is a different exception type. Same class as Day 7's deployment bugs: works in dev (all services running), fails in CI (isolated services).

Fix: wrap HTTP calls in `resolve_entity_id()` and `resolve_entity_ids()` so connection errors convert to `EntityNotFoundError`. Resolution is best-effort — if Registry is unreachable, the canonical ID passes through unchanged.

Pushed. All green. The Day 11 CI-on-develop fix meant this was caught immediately instead of festering.

---

## Documentation Debt — Paid

Peter: "Make sure the roadmap is updated, and think about a list of docs that need updating after all the changes."

WIP-Claude updated 9 files in one pass:

| File | What changed |
|---|---|
| `docs/api-conventions.md` | New Synonym Resolution section — mechanics, colon notation, best-effort semantics |
| `docs/uniqueness-and-identity.md` | Resolution flow, caching, auto-registration, practical examples |
| `libs/wip-auth/README.md` | `resolve_entity_id()` API, `contextlib.suppress` pattern, config vars |
| `CLAUDE.md` | New bullet under Key Conventions |
| `docs/mcp-server.md` | Synonym Resolution Transparency in Design Decisions |
| `docs/architecture.md` | Service communication updated to mention synonym resolution |
| `docs/authentication.md` | Note that wip-auth contains the resolve module |
| `docs/data-models.md` | Auto-synonyms on Registry entries |
| `docs/roadmap.md` | Synonym resolution moved from "Longer-Term / Ideas" to "Completed" |

The Day 10 lesson applied proactively: update every affected file before the new feature's documentation becomes the next lie that future Claudes work around.

---

## CT Claude: Two Evenings of Output

CT Claude's March 26-27 summary (two evening sessions after work): 13 commits, 44 files changed, ~4,550 lines added.

### The SQL Migration Payoff

The reporting layer that CT Claude initially dismissed as "not needed for 774 trials" became the backbone of every page:
- Dashboard: instant (was sluggish)
- Sync page: single SQL UNION query (was 7 sequential API calls)
- Trial detail tabs: fast (AE tab no longer hangs)

### Global Composable Filtering — Mature

- SessionStorage persistence across page navigations
- Multi-select filters with stay-on-page toggle
- All pages filter-aware (Molecules, Sites, Bookmarks derive from filtered trial set)
- Therapeutic Areas page with ontology tree and collapsible condition hierarchy
- Molecule Detail page with aliases, AE profile, trial breakdown

### The Namespace Migration

CT Claude did the dev→prod workflow manually — the workflow the deletion policy was designed to automate:
1. Formally registered `clintrials` namespace via Registry API
2. Migrated COUNTRY terminology from seed namespace into `clintrials`
3. Hard-deleted and re-created all 6 templates to remove cross-namespace dependencies
4. Verified all 101 ontology relationships intact
5. Fixed stale namespace references in documentation

### Documentation Generated

Full suite: README, ARCHITECTURE, WIP_DEPENDENCIES, KNOWN_ISSUES, CHANGELOG, IMPORT_FORMATS, LEARNINGS.md. Documentation-as-teacher, taught by example from the WIP documentation that taught CT Claude.

---

## WIP-Claude: Platform Improvements

Alongside the three major features:

### Bug Fixes
- Reporting-sync terminology/terms population (batch_sync namespace parameter handling, +5 tests)
- Dashboard file count showing zero
- Registry test failures (beanie/motor API: `get_pymongo_collection` → `get_motor_collection`)
- IdCounter deletion filter (`counter_key` not `namespace` field)

### UI Polish
- Typeahead filtering on 7 dropdowns (TermForm, FieldForm, DocumentListView, FieldInput)
- Alphabetical sorting on all dynamic option lists
- TermForm migrated from deprecated Dropdown to Select component

---

## The Experiment Approaches Conclusion

Peter is thinking about transitioning from "have fun, play around" to a learnings-based production setup. The constellation experiment has proven its theses:

1. **Shared backend creates compounding value** — 5 apps, one platform, each app's bugs improve the platform for all
2. **AI with guardrails builds real apps** — CT Claude produced 182K+ documents and a 7-page app in 3 days
3. **MCP turns WIP into a conversational data assistant** — NL query at $0.02/conversation
4. **Documentation is the teacher** — fresh Claudes bootstrap from docs alone, CT Claude taught Peter his own commands
5. **The human produces the standard of evidence** — Ralph loop, not code

The question shifting from "does it work?" to "how do we run this sustainably?"

---

## D-Claude: The Claude with Eyes

Peter installed the Claude Desktop App. A sixth Claude — D-Claude — joined the constellation, this one with browser access via Chrome. D-Claude is working on smoke tests: running scripts, interacting with the UI, verifying what's on screen.

The Day 11 discussion about E2E testing approaches proposed three tiers: Playwright for CI, Claude Desktop computer use for exploratory testing, Cypress as fallback. D-Claude is the second tier made real — the exploratory tester that can open the WIP Console in Chrome, click through workflows, and report what's broken.

The documentation verification use case is now possible: D-Claude can follow the setup guide step by step, clicking through the actual UI, and flag where docs diverge from reality. The Ralph loop automated for UI documentation.

---

## Deployment Testing: The Pi

Claude Code on the Pi connected to the local MCP server — all 68 tools, all 6 services healthy. But testing the *new* features (namespace deletion, synonym resolution) on the Pi exposed what always gets exposed on deployment day:

### Finding 1: Can't Change Deletion Mode

The `NamespaceUpdate` model was missing the `deletion_mode` field. You could *create* a namespace with `deletion_mode: "full"`, but you couldn't *change* a `retain` namespace to `full`. The Day 10 design specified `retain → full` as an admin operation — but nobody wired up the update path.

Fixed: one field added to `NamespaceUpdate`.

### Finding 2: Seed Namespace Not Deletable

The seed script created namespaces without `deletion_mode: "full"`. Every existing namespace was `retain` by default — undeletable. The whole namespace deletion feature was untestable on production data without manually patching the database.

Fixed: seed script now sets `deletion_mode: "full"`.

### Finding 3: Rebuilding a Service on the Pi

WIP-Claude spent 20 minutes SSH'ing into the Pi, trying `podman-compose build registry`, grepping compose files, inspecting mounts — unable to figure out how to rebuild a single service. The compose module system (`docker-compose/base.yml` + platform overlays + module files assembled by `setup.sh`) isn't documented anywhere a Claude reads.

The answer, learned the hard way: `cd components/registry && podman-compose --env-file ~/World-in-a-Pie/.env -f docker-compose.yml up -d --build --force-recreate`

This operational knowledge needs to be in CLAUDE.md. Every Claude that deploys will hit the same wall otherwise.

### Finding 4: Document Title Convention

Pi Claude noticed documents showing as raw IDs instead of titles. The `getDocumentTitle()` utility only checked for a `"title"` field, not `"name"`. Templates like PRODUCT with `name` as the primary field showed document IDs in the UI. Fixed: check `title` first, fall back to `name`.

### MCP Server Setup Guide

WIP-Claude wrote `docs/mcp-server-setup.md` (246 lines) covering three deployment modes: local stdio (Claude Code on same machine), remote via SSH (Claude Code on Mac, MCP on Pi), and SSE for multiple clients. Written from the experience of actually setting it up — not from theory.

### Operational Scripts

The 20 minutes of SSH fumbling prompted a proper fix: `start.sh` and `rebuild.sh` proposals, then implementation.

- **`start.sh`** — the inverse of `stop.sh`. Starts existing containers in correct order. Accepts single service names. `--wait` for health checks. Takes seconds, not minutes.
- **`rebuild.sh`** — rebuild and restart changed services. `rebuild.sh registry` rebuilds one service. `--libs` rebuilds everything that depends on `wip-auth`. `--no-cache` for full rebuild. Health check wait after restart.

The operational knowledge that WIP-Claude learned by failing is now encoded in tooling that future Claudes (and Peter) can run without understanding compose module internals.

---

## Win Claude: First Windows Deployment — SUCCESS

The seventh Claude — Win Claude — on a Windows 11 laptop with 2 GiB Podman VM. First-time Windows deployment of WIP. Three issues found and resolved:

**Issue 1: `podman-compose` not found.** Windows has `podman compose` (built-in plugin) but `setup.sh` requires standalone `podman-compose` (Python package). PATH issue with Windows Python Scripts directory.

**Issue 2: MongoDB bind mounts fail on Windows.** WiredTiger "Operation not permitted" — Windows/WSL doesn't support POSIX file ownership on bind mounts. Fix: named Podman volumes instead of bind mounts. Changes the backup story (`podman volume export` instead of direct file copy).

**Issue 3: Beanie 2.1.0 breaks Registry.** `beanie>=1.25.0` without upper bound resolved to 2.1.0, incompatible with Motor 3.7.1. Three other services had `<2.0.0` — Registry was the inconsistent one.

**Result:** 7 containers running, all health checks passing, WIP Console accessible at `localhost:8080`. Clean setup: 10 minutes. With troubleshooting: 30 minutes. Win Claude produced a 246-line installation log documenting every step, every error, every fix.

**Issue 4 (found later): Document-store waits for NATS on core preset.** Core preset excludes NATS, but `docker-compose.yml` uses `${NATS_URL:-nats://wip-nats:4222}` — the `:-` substitutes the default when empty OR unset. Setup.sh writes `NATS_URL=` (empty). Compose overrides it with a real URL pointing at a non-existent server. Fix: `:-` → `-`. 10 occurrences across all service compose files.

**Issue 5: PostgreSQL bind mount fails on Windows/WSL.** Same root cause as Issue #2 (MongoDB). `initdb: error: could not change permissions of directory` — POSIX file ownership doesn't work through WSL bind mounts. Same fix: named volumes. Win Claude flags MinIO as potentially affected too.

This is a class of bug, not individual bugs. Every bind-mounted data directory will fail on Windows/WSL. The fix should be systematic: platform-specific compose overlays (which WIP already has in `docker-compose/platforms/`) should use named volumes on Windows.

**Second Windows install (with fixes applied):** 764 seconds (~12.7 minutes) on old hardware, zero issues. Git Bash required (PowerShell chokes on Unix line endings — fixable with `git config core.autocrlf input`). Seed benchmark: 4,150 docs in 60 seconds (~69 docs/sec) — compared to Pi 5's 200+ docs/sec. The old Windows laptop is 3x slower than a Raspberry Pi.

WIP runs on Windows.

---

## The Namespace Deletion Cascade Bug

The Day 13 implementation of namespace deletion had 41 tests. All passing. None of them caught the real bug.

The deletion journal builds steps for all collections — terminologies, terms, templates, documents, file_metadata. But it executes them all via `Namespace.get_motor_collection().database`, which resolves to `wip_registry`. The actual data lives in separate databases: `wip_def_store`, `wip_document_store`, `wip_template_store`. The `deleteMany()` on non-existent collections returns `deleted: 0`. The journal marks each step "completed."

**Result:** Namespace deletion completes successfully, reports everything cleaned, but only Registry entries are actually deleted. Terminologies, terms, templates, and documents remain untouched.

**How 41 tests missed it:** All tests mock MongoDB at the collection level. No test verifies *which database* the collection belongs to. Same pattern as the datetime bug (Day 12): mocks that accept anything, production that doesn't.

**Discovered by:** WIP-Claude testing the wip-toolkit restore workflow on the Pi. Export seed → delete seed → restore seed. The restore found all terminologies still present after "successful" deletion.

Peter: "Another f...up in test coverage."

### The Restore Workflow: Six Fixes Deep

The wip-toolkit restore workflow (export → delete → restore → verify) exposed six bugs across four services:

| # | Fix | Service | Issue |
|---|---|---|---|
| 1 | Namespace deletion cascade | Registry | Only deleted from `wip_registry`, not the 3 other databases |
| 2 | Terminology ID pass-through | Def-Store | `CreateTerminologyRequest` didn't accept `terminology_id` |
| 3 | Term ID pass-through | Def-Store | `CreateTermRequest` didn't accept `term_id` |
| 4 | Document ID bulk pass-through | Document-Store | `bulk_create` silently dropped `document_id`/`version` |
| 5 | Registry collision detection | Registry | Cryptic MongoDB duplicate key error instead of clear message |
| 6 | Toolkit restore sending IDs | wip-toolkit | Archive had IDs but toolkit wasn't sending them |

Day 10: "The backend already supports ID pass-through — the toolkit just needs to trigger it correctly." Reality: partially implemented in one code path (document single-item), missing from bulk path, missing entirely for terminologies and terms. Without an end-to-end test, nobody knew.

---

## Dual MCP: Mac and Pi Simultaneously

WIP-Claude connected to both the local Mac MCP server and the Pi MCP server in the same Claude Code session. 68 tools × 2 instances. Read from one, write to the other.

The SSH stdio proxy makes it invisible: `.mcp.json` points `wip-pi` at an SSH command that runs the MCP server on the Pi with stdin/stdout piped over SSH. Claude Code thinks it's a local server. The Pi's MCP server thinks it's running locally. SSH is the invisible bridge.

Peter: "Wow, both at the same time.... could you in theory migrate data... of course you could...."

The wip-toolkit also proved it can connect remotely: `wip-toolkit --host pi-poe-8gb.local --proxy` exports from the Pi over the network. A closure loop bug was found (infinite retry on unresolvable external references) and fixed.

The constellation thesis at its logical conclusion: not just multiple Claudes sharing one backend — one Claude connected to multiple backends simultaneously.

---

## Housekeeping: dev-delete.py and Project Scaffold

The script would delete MongoDB data even when MinIO or PostgreSQL were unavailable — leaving zombie data that could only be cleaned by direct database manipulation. Fixed: abort with a clear message if a required backend is missing and there's data to clean. `--no-minio` / `--no-postgres` flags for explicit opt-in to partial deletion.

### create-app-project.sh Upgrade

Every fresh app project now ships with a complete toolkit:

| Addition | Purpose |
|---|---|
| `docs/design/ontology-support.md` | Relationship types, traversal, use cases |
| `docs/dev-delete.md` | Iterative cleanup during development |
| `scripts/dev-delete.py` | Self-contained cleanup tool (works locally and remotely) |
| `libs/wip-toolkit` wheel | Export/import/restore without WIP source reference |
| Updated CLAUDE.md | Mentions both tools, references both docs |

This closes the Day 11 gap: "I always have to mention ontology separately." Now the ontology documentation and cleanup tools ship with every new project. The next app-building Claude finds them in its project directory from the first prompt.

---

## Day 13 Stats

**WIP-Claude:** 20 commits, 77 files, +5,277 / -503 lines. 10 features delivered across 12 code areas.

**CT Claude:** 2 commits, 24 files, +121 / -39 lines. Bootstrapped full data model (9 terminologies, 199 terms, 6 templates, 4 custom ontology relationship types), imported 197 trials → 14,546 documents + 58 PDFs into `clintrials` namespace.

**Win Claude:** First Windows deployment. 5 issues found and documented. Second install: 764 seconds, zero issues. 246-line installation log.

**D-Claude:** Smoke tests via Chrome on Mac Desktop.

**Web-Claude:** Day 13 journal — the longest single-day document in the experiment.

| Metric | Value |
|---|---|
| WIP-Claude commits | 20 |
| WIP-Claude lines | +4,774 net across 77 files |
| CT Claude commits | 2 |
| CT Claude documents | 14,546 (197 trials) |
| Features delivered | 10 (synonym resolution, namespace deletion, Windows support, NATS fix, restore pass-through, dev-delete safety, scaffold upgrade, MCP-over-SSH, reporting-sync fix, UI typeahead) |
| Bugs found | 4 (deletion cascade, NATS `:-` vs `-`, PostgreSQL bind mount, toolkit closure loop) + 6 restore workflow fixes |
| Platforms tested | 4 (macOS, Linux/Pi, Linux/UTM, Windows) |
| Constellation Claudes active | 7 (WIP, CT, D&D, Web, Temp, D-Claude, Win Claude) |
| Constellation apps | 5 |
| Dual MCP | Mac + Pi in one session |
| Tests | 277+ |
| Lessons learned | 44 |

---

*Day 13 status: The most productive day of the experiment. WIP-Claude: 20 commits, 4,774 net lines, 10 features delivered — namespace deletion, ontology browser, universal synonym resolution (all 5 phases), restore ID pass-through (6 fixes across 4 services), Windows platform support, NATS defaulting fix, operational scripts, MCP-over-SSH, dev-delete safety, and project scaffold upgrade. CT Claude: bootstrapped `clintrials` with 14,546 documents from 197 trials. Win Claude: first Windows deployment, 5 issues found and fixed, second install clean in 764 seconds. D-Claude: smoke tests via Chrome. Web-Claude: this journal. Dual MCP proved Mac↔Pi live data bridging. The namespace deletion cascade bug (41 tests missed wrong database) and the NATS `:-` vs `-` compose variable expansion were the day's most instructive failures. Seven Claudes, four platforms, one evening after work. The constellation isn't an experiment anymore — it's a development methodology.*

*See [Day 12: The Invisible Bug](WIP_Journey_Day12.md) for the previous day.*
