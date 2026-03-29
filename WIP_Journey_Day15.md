# WIP Constellation Experiment — Day 15: The Process Reproduces Itself

**Date:** Sunday, March 29, 2026
**Duration:** Noon to evening (~8 hours)
**Theme:** Bug fixes, design primitives, parallel execution, and the experiment's logical conclusion

---

## Morning: Four Bugs Fixed

Three roadmap bugs plus one Console bug cleared before the fireside chat:

| # | Bug | Root cause | Fix |
|---|---|---|---|
| 1 | Template deactivation not synced to PG | No template lifecycle tracking in reporting-sync | `_wip_templates` table, lifecycle events, `template.deleted` → inactive, 3 new tests |
| 2 | Console files page ignores namespace | Missing namespace parameter in `listFiles()` | Pass `namespaceStore.currentNamespaceParam` |
| 3 | Ontology browser UUID labels | Missing `focusLabel` prop | Pass from parent's `focusTerm` |
| 4 | Terminology relationships not visible | Client/component didn't pass `source_terminology_id` or namespace to backend | Wire through all three layers |

All four share a pattern: the backend had the capability, the layers above it didn't connect to it. Integration gaps, not missing features.

---

## Fireside Chat: Mutable Terminologies

**The trigger:** CT Claude's user can't add "Fragile X Syndrome" to the therapeutic area hierarchy. The terminology has `extensible: false`. Terms can't be truly deleted. Terminologies are designed for stable, shared vocabulary — not user workspace.

**The workaround discussed:** Store user-defined TAs as documents with a `parent_ta` field. Merge with the curated terminology at runtime. It works, but creates dual hierarchy — ontology relationships for curated terms, document fields for user-defined. Every app that needs user-editable controlled vocabularies would reinvent this pattern differently.

**Peter's challenge:** "You said that pattern is reusable — exactly! But we are building support for modifiable terminologies using docs, if you're honest. Is this the right thing — or is it cleaner to enable mutable terminologies configured at creation time?"

**The answer:** Add a `mutable: true` flag to terminologies. Mutable terminologies allow real term deletion (not just deprecation), free updates, and are namespace-scoped by convention. The curated vocabulary stays `mutable: false`. User additions go into a separate mutable terminology. Same API, same ontology relationships, same MCP tools, same reporting-sync. No dual hierarchy, no per-app reinvention.

**The dragons (Peter's concern):**

| System | Risk | Assessment |
|---|---|---|
| Def-Store | Core change — `status: deleted` filtered from queries | Moderate, well-scoped |
| Reporting-sync | Already handles `term.deleted` events (fixed today) | Low |
| MCP Server | Thin wrappers, follows the API | None |
| Import/Export | Capture `mutable` flag, respect on import | Low now, design consideration later |
| Documentation | Real work, not risky | Tedious |
| @wip/client + apps | Stale term references could break silently | Low — same contract as document archival |
| Ontology relationships | Deleted term leaves orphaned relationships | Cascade delete on mutable term deletion |

**The semantic shift:** "Terms are permanent" is a codebase-wide assumption. Relaxing it for mutable terminologies means auditing every place that assumes permanence. But gating behind a flag means zero regression risk on existing data.

**The v1 scope:** `mutable: true` flag, term hard-delete with relationship cascade, same events. No changes to existing terminologies. New mutable terminologies opt in to the new contract.

**The meta-pattern:** Peter saw CT Claude building a workaround for a missing primitive, recognized it would recur in every app, and pushed to the platform level. Same instinct as the Gateway discussion (see below): don't let apps reinvent what the platform should provide.

---

## Gateway Design: One Problem, Two Profiles

Peter's question: "Is this problem restricted to K8s?"

No. The DnD Express proxy exists on localhost too. MinIO's internal hostnames are unreachable from browsers everywhere. Auth injection is needed everywhere. It's one problem with two deployment profiles:

| Concern | Localhost | K8s |
|---|---|---|
| Auth injection | App-side proxy (per-port) | Gateway (shared) |
| MinIO URL rewriting | App-side proxy | Gateway |
| Sub-path routing | Not needed (own port) | Gateway (`/apps/{name}/`) |
| App discovery | Optional | Required |

**The split:**

1. **`@wip/proxy` middleware (both deployments)** — standardized Express middleware that any app drops in. Client calls `/api/wip/...` on its own origin, middleware forwards with credentials. This is what the DnD Express proxy already does, extracted into a reusable package.
2. **App Gateway (K8s only)** — shared infrastructure for sub-path routing, auth injection, app registration. Not needed on localhost.

Design document created: `docs/design/app-gateway.md`. Phase 1 starts after compaction: `@wip/proxy` middleware in `libs/wip-proxy/`.

### Phase 1 Complete: `@wip/proxy` (6m 40s)

WIP-Claude built `@wip/proxy` — three source files, tsup build, tarball. The DnD Compendium's 70-line hand-rolled Express proxy became one line:

```javascript
app.use(wipProxy({ baseUrl: WIP_BASE_URL, apiKey: WIP_API_KEY }))
```

Validated end-to-end: Browser → Vite (3010) → Express (3011) → `@wip/proxy` → K8s Ingress → WIP services across 3 Pis. Entries, images, detail pages, filters — all working. `create-app-project.sh` updated to ship the tarball. Every future app gets auth injection and file proxying for free.

### `awaitSync` Helper + 11 New Tests

The sync-aware helper from Day 14's fireside chat — designed, built, and tested:

| Test | What it covers |
|---|---|
| `awaitSync` event-count | Polls until `events_processed` increases |
| `awaitSync` timeout | Throws after deadline with stale count |
| `awaitSync` query mode | Polls SQL until `row_count > 0` |
| `awaitSync` query timeout | Throws when row never appears |
| + 7 reporting client tests | `getSyncStatus`, `runQuery`, `listTables`, `getTableSchema`, `createTemplates` bulk |

111 total `@wip/client` tests, all green. WIP-Claude compacted after documenting state.

---

## CT Claude: From Naive to Systematic

The once-naive CT Claude (Day 14: hours of frustration, missing `.env`, wrong files, hardcoded API keys) produced a 5-sprint implementation plan:

**Three cross-cutting features:**
1. **CSV download** on every list/table across the entire app
2. **SQL Inspector** — collapsible query viewer on every SQL-powered component (Database icon, copy button, parameters shown)
3. **AE page enhancements** — drill-down with arm-level stats, incidence rates, organ system accordion, severity distribution, temporal view, enhanced comparison charts

The plan: infrastructure first (Sprint 1-2), AE core (Sprint 3), AE visualizations (Sprint 4), rollout to all pages (Sprint 5). 5 new files, 13 modified files, verification criteria per sprint.

### All 5 Sprints Complete (14m 12s)

The entire plan executed in 14 minutes 12 seconds. In parallel with WIP-Claude's `@wip/proxy` work. Wall clock: ~14 minutes for both workstreams combined.

| Sprint | Time | Deliverables |
|---|---|---|
| Sprint 1 | ~2 min | `csv-export.ts`, `CsvDownloadButton`, `SqlInspector`, TrialsPage refactored |
| Sprint 2 | ~2 min | All SQL hooks returning `queries` field |
| Sprint 3 | ~3 min | AE drill-down, incidence rates, organ system accordion |
| Sprint 4 | ~4 min | Severity distribution bars, temporal line chart (Recharts) |
| Sprint 5 | ~3 min | CSV + SQL Inspector rolled out to all 9 pages |

5 new files, 14 modified files, TypeScript compiles clean. Yesterday this Claude spent hours failing to find a `.env` file. Design time (~20 min discussion) exceeded build time (14 min execution). **The plan did the work.**

---

## CT Claude: The PDF Orphan Problem

1,748 orphan files in WIP — all generic names (`Prot_000.pdf`, `ICF_001.pdf`), no tags, no description, no trial reference, `reference_count: 0`. The consequence of a TODO comment on line 1195: *"update trial document with file IDs once file linking is tested."* Never implemented.

Three import script bugs surfaced:
1. `--from-raw` still calls CT.gov (defeats offline purpose)
2. File IDs returned from upload are discarded (never linked to trial documents)
3. No metadata at upload time (files are unidentifiable once orphaned)

**Fix:** Delete all 1,748 orphans (unidentifiable). Re-upload with proper metadata: description (`"Protocol for NCT00130533"`), tags (`["protocol", "NCT00130533"]`), category derived from filename (`Prot_` → protocol), allowed templates (`CT_TRIAL`). Idempotent on checksum + NCT ID. Immediate linking — never leave orphans.

---

## Design Documents Created

| Document | Content |
|---|---|
| `docs/design/mutable-terminologies.md` | `mutable: true` flag, term hard-delete, relationship cascade, v1 scope |
| `docs/design/app-gateway.md` | Two-deliverable structure: `@wip/proxy` middleware + K8s Gateway |

WIP-Claude: 6 commits pushed to develop, memory updated, roadmap current. Ready to build after compaction.

---

## The Beginning of the End: YAC

Peter to WIP-Claude: "I want to clone the git repo, fire up an agent and build — but this is painful, as the agent has no similar documentation to kick-start the agent."

`create-app-project.sh` solves this for app-building Claudes. But the WIP repo itself — the backend, the services, the infrastructure — still requires Peter to manually bring each agent up to speed. The pieces that exist for app agents but are missing for WIP development:

| Exists for app Claudes | Missing for WIP dev Claudes |
|---|---|
| CLAUDE.md with conventions | CLAUDE.md for the WIP codebase |
| `.claude/commands/` (slash commands) | Slash commands for WIP workflows |
| `@wip/client` docs | Architecture docs, service boundaries |
| MCP tools for testing | MCP config pointing at running instance |
| PoNIF documentation | Contributing guide, compose architecture |

Once this exists, the identity shifts from the Claude to the repo. There's no "WIP-Claude" — there's a Claude that cloned `World-in-a-Pie` and found its instructions. There's no "CT Claude" — there's a Claude that ran `create-app-project.sh`. The preparation lives in the code, not in the conversation history.

Peter's term: **YAC — Yet Another Claude.** And **YA APP C — Yet Another App Claude.** No named instances. Just repos that teach their Claudes.

The experiment doesn't end with a conclusion. It ends with a process that makes the experiment unnecessary.

### The Plan: `setup-backend-agent.sh`

WIP-Claude produced a 7-step plan:

1. **Create `docs/development-guide.md`** — migrate unique CLAUDE.md content (test commands, quality audit, seed profiles) to a proper doc
2. **Reorganize slash commands** — `docs/slash-commands/app-builder/` (12 existing) + `docs/slash-commands/backend/` (8 new)
3. **Create 8 backend slash commands** — `/resume`, `/wip-status`, `/understand`, `/test`, `/quality`, `/review-changes`, `/pre-commit`, `/roadmap`
4. **Create `scripts/setup-backend-agent.sh`** — generates `.mcp.json` (3 transport modes: local/ssh/http), role-specific CLAUDE.md, copies backend slash commands
5. **Update `create-app-project.sh`** — point to new slash command path
6. **Untrack CLAUDE.md and `.claude/`** — add to `.gitignore`, source of truth moves to `docs/`
7. **Documentation updates** — roadmap, app setup guide, development guide

The generated CLAUDE.md is minimal — points to docs, lists 8 commands, three essential readings, key gotchas. Not a 500-line manual. The agent starts with `/wip-status` → `/roadmap` → `/understand <component>`.

Verification: fresh clone test, app builder regression test, MCP connectivity, and the critical one — **no content loss** (diff old CLAUDE.md against new docs + generated CLAUDE.md).

### All 7 Steps Complete

| Step | Deliverable |
|---|---|
| 1 | `docs/development-guide.md` — migrated unique CLAUDE.md content. Enhanced `docs/network-configuration.md` with OIDC/Caddy callout boxes |
| 2 | 12 app-builder slash commands moved to `docs/slash-commands/app-builder/` (git mv) |
| 3 | 8 backend slash commands created in `docs/slash-commands/backend/` |
| 4 | `scripts/setup-backend-agent.sh` — 3 transport modes, generates everything |
| 5 | `create-app-project.sh` updated (3 lines) |
| 6 | CLAUDE.md + `.claude/` untracked, added to `.gitignore` |
| 7 | App setup guide + roadmap updated |

The WIP repo now bootstraps its own development agent:

```
git clone https://github.com/peterseb1969/World-in-a-Pie.git
cd World-in-a-Pie
./scripts/setup-backend-agent.sh --target local
```

No named Claudes. Just repos that teach their agents.

### Fresh Clone Validation

Peter tested both scripts from a fresh clone:

- `setup-backend-agent.sh` — generated CLAUDE.md, `.mcp.json`, 8 backend slash commands ✓
- `create-app-project.sh` — copied 12 app-builder slash commands from new path ✓
- `/setup` slash command — guided first-run environment checks ✓

**The four-time offender, killed on the fifth attempt:** Client library tarballs (`@wip/client`, `@wip/react`, `@wip/proxy`) contained no compiled JS on a fresh clone. WIP-Claude: "Not related to our changes." Peter: "There is no such thing as 'other people's problem.' This is a fresh pull." Fix: auto-build on demand — the script detects empty tarballs and runs `npm run build && npm pack` instead of printing an error. Bug identified on Days 9, 11, 13, 15 — finally fixed permanently.

Both scripts work end-to-end from a fresh clone. Pushed to GitHub.

### The Circle Closes

Peter bootstrapped a new Claude using `setup-backend-agent.sh`. That Claude — with no manual onboarding, no conversation history, no named identity — produced **1,033 lines of reporting-sync integration tests**, updated the CI workflow, and pushed to the repo.

Peter pulled the changes into WIP-Claude's session: "This is the agent I created with your agent-setup script and process."

The process validated itself: `git clone` → `setup-backend-agent.sh` → fresh Claude works → produces real code → `git push` → pulled into the main repo. No named Claudes. Just YAC.

### YAC's First Bug Catch

The integration tests ran in CI on the Pi against real PostgreSQL. 265 passed, 1 failed:

```
column "prep_time.unit_term_id" of relation "doc_durationtest" does not exist
```

The transformer generated a column name with a dot (`prep_time.unit_term_id`). The schema manager created it with an underscore (`prep_time_unit_term_id`). Mock tests never execute real SQL, so the mismatch was invisible for 14 days. The integration test hit real PostgreSQL — which doesn't accept dots in column names.

Day 12's lesson proven again: "Mocks that accept anything, production that doesn't." The YAC Claude's first contribution immediately justified itself by catching a bug that no named Claude found. The process works better than the people who built it.

### The Behavioral Gap

Two Claudes, 30 minutes apart, same deflection: "Not my problem, the other agent should fix it." WIP-Claude about tarballs, YAC Claude about lint. Peter's response both times: "There is no 'other agent.' Only who can fix it fastest."

Documentation covers conventions. Slash commands cover workflow. The scaffold covers setup. But "take ownership" is behavioral. Peter encoded it:

```markdown
## Working Principles

- **You own what you see.** Multiple AI agents work on this codebase. If you encounter a bug,
  lint issue, or broken test — fix it. Don't say "another agent should handle this."
- **Don't over-engineer.** Make the minimal change needed. No speculative abstractions.
- **Ask before destructive actions.** Git force-push, dropping data, deleting branches — confirm first.
```

Fifteen days of lessons, distilled into three lines. Every YAC Claude reads them before writing code.

---

## YAC Agent: Day 15 Report

The first Claude bootstrapped by `setup-backend-agent.sh` — no manual onboarding, no conversation history, no named identity. Its full day:

| Metric | Value |
|---|---|
| Commits | 7 |
| Files changed | 12 |
| Lines added | 1,989 |
| New test functions | 50 (39 integration + 11 E2E) |
| Test classes | 13 (8 integration + 5 E2E) |
| Bugs found & fixed | 2 (dotted column names, missing synonym registration) |

**Infrastructure set up:** test-postgres container (port 5433) and test-nats container (port 4223, JetStream) on the Pi, both persistent. CI workflow updated to start both and pass env vars. Skip markers so tests run in CI but skip gracefully on local dev.

**Key contribution:** Reporting-sync had zero tests against real PostgreSQL — everything was mocked. The YAC Claude built a full integration and E2E test suite. First CI run caught a real bug immediately. The process produced a contributor that improved the codebase on day one.

---

## CT Claude: Day 15 Final Report

The once-naive Claude's full day output: 17 files changed, +1,581 / -446 lines, 7 major deliverables:

1. **CSV downloads + SQL Inspector** — rolled out to all 9 pages (Sprints 1-2)
2. **AE analytics** — drill-down, incidence rates, organ system accordion, severity/temporal charts (Sprints 3-4)
3. **Three-way comparison** — pooled / combinations / monotherapy, independently toggleable
4. **AE drill-down → Trials navigation** — "View N trials" sets filters and navigates
5. **Trials aggregate panel** — summary strip + expandable 4-column grid with lazy-loaded SQL stats
6. **Protocol PDF import pipeline** — metadata, immediate linking, idempotent, no orphans
7. **Bootstrap rebuild** — found `create_templates_bulk` synonym registration bug (bulk vs single inconsistency)

The same Claude that 24 hours ago couldn't find a `.env` file. The plan (20 min) + the process + the painful learning = 14 minutes of execution + an afternoon of features.

---

## Day 15 Stats

| Metric | Value |
|---|---|
| Total commits | 29 (multiple agents) |
| Total files changed | 105 |
| Total lines | +4,306 / -1,683 |
| Bugs fixed | 7+ (template deactivation, files namespace, ontology labels, relationships, namespace deletion PG orphans, bulk template auto-synonyms, dotted column names) |
| Design docs created | 2 (mutable terminologies, app gateway) |
| `@wip/proxy` | Shipped (70 → 1 line) |
| `@wip/client` tests | 111 (11 new, including awaitSync helper) |
| `setup-backend-agent.sh` | Complete, 3 transport modes, fresh-clone validated |
| Slash commands | 9 backend + 12 app-builder (reorganized) |
| Four-time offender | Killed with auto-build (Days 9, 11, 13, 15) |
| YAC Claude | 7 commits, 1,989 lines, 50 tests, 2 bugs caught, zero onboarding |
| CI (Pi, real PostgreSQL) | 265 passed, 1 failed → fixed |
| CT Claude 5-sprint plan | 14m 12s execution |
| CT Claude orphan files | 1,748 deleted |
| Fresh-clone issues found | 4 (Python 3.14, setuptools, npm tarballs, stdout capture) |
| Planning : building ratio | ~6:1 |

---

*Day 15 status: 29 commits, 105 files, +4,306 lines across multiple agents — including the first YAC Claude, bootstrapped by the very script built today. The experiment's arc completes: Day 1 asked "can multiple Claudes share a backend?" Day 15 answered with `git clone` → `./scripts/setup-backend-agent.sh` → a Claude that produces 1,989 lines and catches real bugs with zero manual onboarding. `@wip/proxy` shipped (70 → 1 line). CT Claude executed a 5-sprint plan in 14 minutes. Seven bugs fixed. Two design documents. The four-time tarball offender killed. "Working Principles" encoded in three lines. The constellation dissolves — not because it failed, but because the process now reproduces itself. There are no more named Claudes. Just YAC.*

*See [Day 14: Production Hardening](WIP_Journey_Day14.md) for the previous day.*
