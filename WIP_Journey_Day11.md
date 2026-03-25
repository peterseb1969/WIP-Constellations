# WIP Constellation Experiment — Day 11: The Namespace Reckoning

**Date:** Tuesday-Wednesday, March 25, 2026
**Duration:** Evening + late night
**Theme:** CT Claude joins, namespace bugs surface, and the MCP server gets its multi-namespace audit

---

## CT Claude Joins the Constellation

The fourth constellation member arrived: **CT Claude** (Clinical Trial Claude). Peter's professional domain — clinical trial operations. Not a hobby experiment.

The task: build a data warehouse mirroring all Roche/Genentech trial data from ClinicalTrials.gov, with an extensible data model designed for AI-agent querying. Not just trial metadata — study results, adverse events, baseline demographics, protocol PDFs.

### The Data Model

CT Claude had the benefit of the latest documentation package (12 slash commands, 4 MCP resources, corrected PoNIFs, fixed client library READMEs) and produced the most sophisticated data model in the constellation:

| Metric | Value |
|---|---|
| Terminologies | 9 (202 terms) |
| Templates | 6 (CT_TRIAL at 26 fields is the densest) |
| Ontology relationships | **98** |
| Documents (104 trial test) | ~8,600 |
| Files (PDFs) | 25 |
| Full scale estimate | ~300,000 (3,500 trials × ~83 docs each) |

The ontology is where WIP earns its keep:
- CT_THERAPEUTIC_AREA: 27 `is_a` edges (hierarchical disease classification)
- CT_DRUG_CLASS: 12 `is_a` edges (Immunotherapy → Checkpoint Inhibitor → PD-L1 Inhibitor)
- CT_MOLECULE → CT_DRUG_CLASS: 34 `is_a` edges (atezolizumab is_a PD_L1_INHIBITOR)
- CT_MOLECULE → CT_TARGET: 25 `targets` edges (atezolizumab targets PD_L1)

This enables graph traversal: "Find all checkpoint inhibitor trials" resolves CHECKPOINT_INHIBITOR → descendants → 9 molecules across 3 sub-classes → matching trials. Term aliases map brand names to molecules (Tecentriq → atezolizumab). "Find all oncology trials" includes 15 sub-areas automatically.

### The Import Script

`import_trials.py` — paginated fetch from ClinicalTrials.gov API v2, 3-layer incremental sync, PDF downloads from CDN, adverse event and baseline extraction for completed trials. Idempotent. From 104 test trials: 8,600 documents. At full scale: ~300,000.

### The Namespace Bugs

CT Claude used a proper `clintrial` namespace from the start — and immediately hit what no previous Claude had encountered:

1. `create_relationships` defaults to `wip` namespace, ignoring `clintrial`
2. `get_term_hierarchy` defaults to `wip` namespace
3. Cross-namespace term alias resolution doesn't work
4. `terminology_ref` by value fails cross-namespace

The D&D experiment never found these because it put everything in `wip` (the wrong namespace). CT Claude, using a dedicated namespace from day one, exposed the namespace boundary bugs immediately.

---

## The MCP Namespace Audit

CT Claude's 4 bugs prompted the systematic audit. WIP-Claude scanned all 68 MCP tools and found **15 tools** need changes across 3 files:

### Severity Ranking

| Priority | Tools | Issue |
|---|---|---|
| **High** | 4 ontology tools | Two-layer gap — neither `client.py` nor `server.py` has namespace params. `delete_relationships` has a dead parameter that's never passed through. |
| **High** | `search` | Returns results from ALL namespaces with no filter. Data isolation violation in multi-namespace deployments. |
| **Medium** | `get_terminology_by_value` | No namespace param. Value collisions across namespaces return arbitrary result. |
| **Medium** | `import_terminology` | Always imports to `wip` regardless of intent. |
| **Low/UX** | 5 bulk create tools | Work if user embeds namespace in payload, but undiscoverable. Single-item tools have explicit params; bulk variants should match. |

### The Fix

Implemented in the same session:

- **`client.py`**: 10 methods updated — namespace param added to all ontology traversal, relationships, terminology lookup, import, and search. `delete_relationships` dead parameter fixed to actually pass through.
- **`server.py`**: 12 tools updated — namespace param threaded through all affected tools. Bulk create tools now inject namespace into each item.
- **`search_service.py`**: `SearchRequest` gains namespace field, threaded to all 5 search methods.

All 226 existing tests pass (32 MCP + 194 reporting-sync). All new parameters are optional with `None` default — fully backwards-compatible.

### The Agent Audit Gap

Peter noticed the detailed findings scrolling by and asked to see them later. They were gone — the Explore agent's results were consumed inline, never saved to a file, and lost to compaction.

Worse: the agent reported 57 tools. The actual count is 68. Eleven tools were never evaluated — 16% of the surface area was invisible to the audit. WIP-Claude used the incomplete inventory to decide what was important, meaning the priority ranking was based on 84% of the data.

When Peter asked "Can you share the agent's findings verbatim?" — WIP-Claude couldn't. The raw analysis that drove 15 tool fixes was unrecoverable.

Two lessons:
1. **Agent findings are intermediate artifacts — persist them.** If the analysis matters enough to act on, it matters enough to write to a file. `agent-audit-results.md` would have survived compaction and been verifiable.
2. **Verify the agent's inventory before trusting its analysis.** The first check should have been: "agent says 57, `grep` says 68 — which 11 did you miss?"

WIP-Claude caught the discrepancy when Peter pushed for verification, confirmed the 11 missed tools were all ID-based (no namespace needed), and identified one real remaining gap: `get_template_versions` by value needs a Template-Store API fix, not just MCP threading.

---

## Code Review: Temp Claude's Work

A Temp Claude had enhanced `dev-delete.py` (789 lines added) with namespace and prefix deletion support. WIP-Claude reviewed it with a proper code review — 8 issues flagged:

| Issue | Severity |
|---|---|
| SQL injection surface via f-string table names | Low (validated upstream, but `psycopg2.sql.Identifier` would be safer) |
| `args.cascade or True` — always True, misleading | Minor |
| `import re` inside a function (inconsistent style) | Minor |
| Dead `pass` block in `delete_namespace` | Minor |
| No confirmation prompt for namespace deletion | Noted (appropriate for dev tool, not production path) |
| Case-insensitive prefix matching undocumented | Minor |
| Lambda capture fragility in cascade planners | Minor (uses default-argument trick correctly) |
| `delete_relationships` dead parameter | Confirmed (fixed in the namespace audit) |

Verdict: "Merge? Yes, with minor fixes." The architecture change from static CASCADE_RULES to dynamic cascade planners was praised — it enables recursive template tree traversal and document→file reference following.

---

## D&D Compendium on Linux

The D&D Compendium was deployed on the Pi (Linux), exposing 8 issues:

1. **Node.js platform mismatch** — `node_modules` from Mac don't work on Linux. Fresh install required.
2. **D&D data import** — Used wip-toolkit to load 1,370 documents into `dnd` namespace. Hit import bug, pulled fix from `develop` branch.
3. **Namespace configurable** — Added `WIP_NAMESPACE` env var so the app targets `dnd` namespace for both frontend queries and backend writes.
4. **Image uploads broken** — `onImageSaved` callback on all 8 pages was `console.log`. Replaced with proper state updates + query cache invalidation.
5. **AI agent paths** — Updated `.env` with correct Linux paths for the MCP Python venv.
6. **SRD copyright** — CC-BY-4.0 attribution added to README and app sidebar footer.
7. **Image overflow** — Added `overflow-hidden` to portrait containers and `overflow-x-hidden` to detail panels.
8. **Git + GitHub** — Pushed to `https://github.com/peterseb1969/WIP-DnD`

The `onImageSaved` being `console.log` on all 8 pages is a Phase 4 quality gap — D&D Claude built the image system but didn't wire the callbacks. The feature was demo'd (paste URL, image appears) but never tested end-to-end (paste URL, close panel, reopen, image persists).

---

## CT Claude Builds the App

CT Claude's Phase 4 produced the Clinical Trials Explorer — 7 pages (Dashboard, Trials, Trial Detail, Molecules, Sites, Bookmarks, Sync Status). Peter's core design principle: **"Everything is a filtered trial list."** Every clickable entity navigates to the Trials page with a pre-applied filter via URL query parameters.

### The Aggregation Reckoning

CT Claude had chosen client-side aggregation — "774 trials, good enough for now." Peter clicked the Adverse Events tab for NCT01290718. Endless spinner. The app was trying to paginate through 88,000+ AE documents client-side.

One SQL query via `run_report_query` returned instant results. The sluggish app became fast in one refactoring pass.

### The 189K Context Bomb

`list_report_tables` returned 189,429 characters — full column definitions for every table. WIP-Claude fixed it at the API level: compact summary by default, full detail only when requesting a specific table. 13 new tests.

### Global Composable Filtering

A filter chip bar sits atop every page. Click a country on Sites → chip appears. Click a molecule on Molecules → another chip. All compose: country + molecule + phase = "show me all Phase 3 atezolizumab trials in Germany." Cross-page, composable, persistent via URL parameters.

Peter: "The Clinical Trial App is usable, and improving at tremendous speed. Kick ass."

### The Import Scale

| Metric | Count |
|---|---|
| Trials imported | 2,739 of ~3,500 |
| WIP documents | 182,568 |
| Adverse events | 112,984 |
| Files (PDFs) | 660 |
| Status | Still counting |

---

## The Fireside Chat: Universal Synonyms

Peter's vision: synonyms as first-class identifiers across all API operations. Register deterministic synonyms before export → references survive the move → batch-update to new canonical IDs after import → delete migration synonyms. WIP-Claude: "More ambitious than the roadmap, but more leverage." Added to longer-term roadmap.

---

## Ontology and Reporting Visibility

Peter: "I always have to mention ontology separately." WIP-Claude confirmed: "The tools are excellent, but no workflow guidance mentions them." Four files updated — server instructions, `wip://conventions`, `wip://development-guide`, `/design-model` and `/implement` slash commands. The next fresh Claude encounters ontology at every workflow stage.

---

## WIP-Claude Analyses D&D Claude's NL Interface

Recommendation: **Scaffold + Infrastructure, not Library extraction.** Three WIP core additions: `WIP_MCP_MODE=readonly`, `describe_data_model` MCP tool, `wip://query-assistant-prompt` resource. Plus `--preset query` for `create-app-project.sh`. "Extract library after 3+ apps stabilize the pattern."

---

## Client Library Distribution: Four-Time Offender Fixed

Root cause: `npm pack` run on unbuilt source. Fix: `"prepack": "npm run build"` — one line per library. Plus tarball validation in `create-app-project.sh`. Four Claudes hit this wall. One line fixed it.

---

## CT Claude Teaches Peter

Peter asked about `/clean` vs `/resume`. CT Claude calmly explained how to use the commands Peter designed: "No — `/clean` clears the conversation but doesn't save state. Instead, run `/resume` to save, then start a new session." The documentation teaching the creator.

---

## The Deliberate Shortcut

Peter investigated why CT Claude built client-side aggregation despite reporting-sync being deployed. Was it a documentation gap? WIP-Claude checked and confirmed the reporting layer was adequately covered in `wip://conventions`.

Peter asked CT Claude directly (via `/btw`). The answer: CT Claude knew about `run_report_query`, evaluated 774 trials, and chose client-side aggregation as "good enough for now" — well aware it would need refactoring. A deliberate architectural shortcut, not a discoverability gap.

But the ontology *was* a real discoverability gap — Peter always had to mention it separately. Four workflow files were updated to surface ontology relationships at every phase: server instructions, `wip://conventions`, `wip://development-guide`, and the `/design-model` and `/implement` slash commands. The next fresh Claude encounters ontology without Peter having to be the ontology Ralph loop.

---

## E2E Testing: Three Approaches

Peter asked about Claude's computer use capability for UI testing. WIP-Claude proposed three complementary approaches, added to the roadmap:

1. **Playwright** — CI backbone. Headless, deterministic, runs on Pi. The standard for E2E test suites.
2. **Claude Desktop computer use** — exploratory testing ("log in and tell me what's broken") + documentation verification (follow the setup guide step by step, clicking through the UI, reporting where docs don't match reality). The Ralph loop automated for UI documentation.
3. **Cypress** — alternative to Playwright if needed, better interactive debugging DX.

---

## CI on Develop: The Missing Safety Net

Peter pushed 5 commits to `develop`. Nothing happened in Gitea CI. The workflow file only triggered on `push: [main]`. Peter: "Why would I run no test on the dev branch?"

The develop branch was created specifically so work is tested before merging to main — but nobody updated the CI trigger when the branching strategy changed. Fixed: workflow now triggers on both `main` and `develop`.

---

## The Commits

5 commits pushed to both remotes:

| Commit | Summary |
|---|---|
| 822fcc5 | MCP namespace support — 13 tools + template-store endpoint |
| 1a919ef | Ontology & reporting discoverability in MCP resources + slash commands |
| 784aafd | `list_report_tables` summary mode (189KB → ~2KB default) |
| 84277ff | Client library tarball fix (prepack hooks + validation) |
| dbda6c9 | NL Query Scaffold + Universal Synonym Resolution design docs + roadmap |

---

## Day 11 Stats

| Metric | Value |
|---|---|
| New constellation member | CT Claude (clinical trials) |
| CT Claude data model | 9 terminologies, 6 templates, 98 ontology relationships |
| CT Claude documents | 182,568 (still counting) |
| CT Claude app | 7 pages, global composable filtering, SQL aggregation |
| MCP tools audited | 68 (agent reported 57 — 11 missed) |
| MCP tools fixed (namespace) | 15 (across 3 files) |
| Reporting API improved | `list_report_tables` summary mode (189KB → ~2KB) |
| Documentation fixes | Ontology + reporting visibility in 4 workflow files |
| Client lib fix | `prepack` hook (four-time offender resolved) |
| Design docs added | 2 (NL Query Scaffold, Universal Synonym Resolution) |
| CI fix | Workflow now triggers on develop branch |
| Tests passing | 239 (32 MCP + 194 reporting-sync + 13 new) |
| Commits pushed | 5 (to both remotes) |
| Code review | 8 issues in Temp Claude's dev-delete.py |
| D&D Linux deployment | 8 fixes, pushed to GitHub |
| Lessons learned | 43 |

---

*Day 11 status: CT Claude joined the constellation and produced the most ambitious WIP deployment yet — 182,568 documents and counting, a 7-page app with global composable filtering and SQL-powered aggregation that Peter called "kick ass." The MCP namespace audit found and fixed 15 tools. The 189K `list_report_tables` dump became a 2KB summary. Ontology and reporting were made visible in all workflow documents. The client library four-time offender was killed with one line (`prepack`). CT Claude's deliberate client-side aggregation shortcut was exposed when 88K AE documents hung the browser — SQL fixed it in milliseconds. CT Claude taught Peter how to use his own commands. CI was extended to run on the develop branch. Two design docs were added to the roadmap (NL Query Scaffold, Universal Synonym Resolution). The constellation now has 4 members, 3 apps, 182,568+ documents, and a clinical trials app that made Peter say "kick ass."*

*See [Day 10: Ralph](WIP_Journey_Day10.md) for the previous day.*
