# WIP Constellation Experiment — Day 14: Production Hardening

**Date:** Saturday, March 28, 2026
**Duration:** Noon to midnight (~12 hours)
**Theme:** Toolkit hardening, Windows expansion, K8s deployment, and the experiment's most valuable finding

---

## Toolkit Restore: 100%

The `.get("version", 1)` edge case — when the key exists but the value is `None`, `.get()` returns `None` because the key IS present. Fix: `d.get("version") or 1`. One character class of bug.

With this fix, the wip-toolkit restore workflow achieved **527/527 documents** with 100% ID and version match. Zero failures. The 14 failures from Day 10's Pi migration are gone.

Fresh import into a new namespace (`test2`) also verified: 782 entities (15 terminologies, 215 terms, 25 templates, 527 documents) with fresh IDs, `deletion_mode=full`.

### Default Mode Flip

The import default was `--mode restore` (disaster recovery, preserve IDs). Peter: "Why is the one that is not restore called --restore-mode?" The default was flipped to `--mode fresh` — safe, creates new IDs, works cross-namespace. `--mode restore` is now the explicit opt-in for the rare case of disaster recovery with exact ID preservation.

---

## dev-delete.py: Host-Side Fixes

The script runs on the host but was reading container-side environment variables and hostnames:

| Problem | Fix |
|---|---|
| `POSTGRES_PASSWORD` vs `WIP_POSTGRES_PASSWORD` | Read `WIP_` prefixed vars first, fall back to container-side names |
| Container hostnames (`wip-minio`, `wip-mongodb`) in URLs | Auto-translate to `localhost` when loading `.env` |
| `.env` not loaded (no `export` in compose `.env` format) | `_load_dotenv()` with discovery chain: `$WIP_ENV_FILE` → `./.env` → `<script-dir>/../.env` |
| 7 ruff lint findings | Import sorting, dict.get patterns, unused variables, ternary operators |

Same class as the NATS `:-` bug: compose translates between host and container variable names. Every tool that runs on the host needs the `WIP_` prefix.

---

## Windows: New Laptop

WIP deployed on a 32GB Windows 11 laptop:

| Preset | First install | Cached install |
|---|---|---|
| Core | 377s (6.3 min) | — |
| Full | 731s (12.2 min, 50KB/s connection) | **192s (3.2 min)** |
| Full (v1.0.11) | — | **139s (2.3 min), 300 docs/sec seed** |

3.2 minutes from zero to full WIP with all services on cached images.

### The WSL Journey

A Desktop Claude on the Windows laptop guided Peter through the full setup:

1. **WSL not found** — `dism.exe` enables kernel features but doesn't install WSL. Windows 11 needs the Store install separately. x86/amd64 gotcha along the way.
2. **Two Podmans** — `podman.exe` via `winget` on Windows, but `setup.sh` needs Linux `podman` inside WSL.
3. **PowerShell bracket paste garbage** — Windows Terminal fixes it, but starts in `/mnt/c/Users/peter` instead of `/home/peter`.
4. **Claude Code in WSL** — `npm install -g @anthropic-ai/claude-code` inside WSL gives native file access.

Key takeaway: **"Once you're in WSL, treat it as a standalone Linux machine. Install and run everything there."**

---

## CT Claude: Stale Data and Smart CLI

### The Stale Data Problem

CT Claude's AE page showed empty, Sites page showed only 3 countries. Investigation revealed 130,056 stale AE records from deleted namespaces still in PostgreSQL (all namespace "wip"). Zero rows for `clintrials`. The namespace deletion cascade bug (Day 13) left PostgreSQL untouched while reporting deletion "completed."

Three bugs from three different days converging in one empty page: namespace deletion cascade (Day 13), reporting-sync gap (Day 12), implicit namespace assumption (Day 11).

### Five New Features (18 minutes generation time)

1. **Adverse Events page** — cross-trial AE frequency table, heatmap comparison by molecule/therapeutic area
2. **Enhanced Molecule Cards** — recruiting/completed counts, enrollment, top therapeutic areas
3. **Molecule Compare** — multi-molecule AE comparison heatmap, phase distribution
4. **Sites Enhancement** — enrollment column, country detail links
5. **GlobalFilterBar polish** — chips grouped by filter key, contextual compare shortcut

### Smart Import CLI

Peter: "I want smart behaviour that tells you what you can do if there is no WIP."

The import script now detects its environment:
- **No WIP**: "You can still download raw data: `--download-only --full`"
- **WIP but no templates**: "Run `/bootstrap` first, or use `--download-only`"
- **Fully bootstrapped**: Normal operation

Plus `--save-raw` (archive raw CT.gov JSON), `--download-only` (fetch without WIP), and `--from-raw` (import from saved files). Each step composable, independently testable. Download once, import many times.

---

## v1.0.11: The Forced Release

The Windows install on the new laptop pulled `main` branch — which didn't have the Beanie `<2.0.0` fix from develop. Same bug, different day, different platform. Peter and WIP-Claude decided: merge everything to main and tag.

**v1.0.11:** 117 files changed, +10,720 / -804. Days 10-14 of work in one release:

- Namespace deletion (journal-based, 41 tests)
- Universal synonym resolution (all 5 phases)
- Ontology browser (D3-force ego-graph)
- MCP namespace audit (15 tools fixed)
- NATS `:-` → `-` fix (10 compose files)
- Windows/WSL platform support (named volumes)
- Operational scripts (start.sh, rebuild.sh)
- Toolkit restore fixes (6 across 4 services)
- dev-delete.py safety and host-side fixes
- Project scaffold upgrade
- 60+ new tests

The Pi can now deploy from main: `git pull && git checkout v1.0.11`.

---

WIP-Claude noted that `wip-toolkit` (pip) and `wip-client` (npm) need rebuilding after `git pull` — source updates but installed packages stay stale. Belongs in `rebuild.sh` or a post-pull checklist.

---

## K8s: WIP on a Pi Cluster

Peter opened a new workstream: deploying WIP on his 3-node Raspberry Pi 5 Kubernetes cluster.

**Infrastructure:** MicroK8s v1.32, Calico networking, Rook-Ceph distributed storage, MetalLB (192.168.1.10-17), NGINX Ingress, Velero backups, local container registry on port 32000. Already running Pi-hole, Home Assistant, Teslamate, Gitea, WireGuard, UniFi — production home infrastructure, not a toy cluster.

**Target node:** `kubi5-3` — 16GB RAM (8.8GB available), 4 cores, 68GB disk free. Using `preferredDuringSchedulingIgnoredDuringExecution` (not hard affinity — "this defeats the purpose of having a cluster").

**Process:** WIP-Claude was instructed to create `k8s-installation-log.md` capturing every step, including failures. Same pattern as Win Claude's installation log — the deployment log becomes the deployment guide. Peter: "Check back after every step."

### Phase 2, Step 1: MongoDB on K8s

Three cluster issues hit on the first infrastructure deployment:

1. **Two default storage classes** — `microk8s-hostpath` and `rook-ceph-block` both marked default. Fixed: explicit `storageClassName` in all 5 manifests.
2. **Rook-Ceph CSI provisioner stale** — `/tmp/csi/keys/` lost on restart. Fixed: pod restart (workaround).
3. **PVC stuck on dead provisioner** — had to delete and recreate.

### Phase 2: All Infrastructure (31 minutes)

| Service | Status | Node | Issues |
|---|---|---|---|
| MongoDB | Running | kubi5-1 | 3 issues (storage class, Ceph provisioner, PVC) |
| PostgreSQL | Running | kubi5-1 | `lost+found` directory → `PGDATA` subdirectory fix |
| NATS | Running | kubi5-1 | Clean deploy |
| MinIO | Running | kubi5-1 | Clean deploy |
| Dex | Running | kubi5-3 | UID 1001 needs `fsGroup`, RWO volume requires `Recreate` strategy |

5 infrastructure services, all healthy, all on Ceph distributed storage. 8 lessons captured.

### Phase 3: Application Services (11 minutes)

7 images built and pushed to local registry in under 2 minutes (native aarch64, no cross-compilation).

| Service | Status | Node | Connections verified |
|---|---|---|---|
| Registry | Running | kubi5-3 | MongoDB, auth |
| Def-Store | Running | kubi5-2 | MongoDB, Registry |
| Template-Store | Running | kubi5-3 | MongoDB, Registry, Def-Store |
| Document-Store | Running | kubi5-2 | MongoDB, Registry, Template-Store, Def-Store, NATS, MinIO |
| Reporting-Sync | Running | kubi5-1 | MongoDB, PostgreSQL, NATS |
| Ingest-Gateway | Running | kubi5-3 | NATS (JetStream PVC expanded 2Gi→5Gi online) |

### Phase 4: Console + TLS + Ingress

Console deployed, self-signed TLS certificate created, Ingress applied. `https://wip-kubi.local` serves the WIP Console.

### Phase 5: Bootstrap & Smoke Test

**Startup ordering issue:** Def-Store failed to create system terminologies because the `wip` namespace didn't exist yet. On standalone, `setup.sh` calls `initialize-wip` before services start. On K8s, all pods start simultaneously. Fix: manually call `initialize-wip` via the Ingress, then restart Def-Store.

**Dex groups missing:** K8s ConfigMap was missing `groups` on static passwords. JWTs had no group claims, Console showed "No Namespace Access." Fix: add groups, restart Dex (and WIP-Claude repeated the RWO volume mistake it had just documented as Lesson 8 — Peter: "Your present for not listening").

**Console login verified:** admin@wip.local → JWT with `wip-admins` group → namespace access → built-in terminologies visible.

**13 lessons captured** in the installation log from the full deployment.

**Next:** Remote seeding from Mac to K8s — testing the seed script against the cluster over the network.

### Remote Seeding: Mac → K8s

```
WIP_API_KEY=... python scripts/seed_comprehensive.py --host wip-kubi.local --via-proxy
```

Complete success: 15 terminologies (215 terms), 25 templates + 2 version upgrades, 60 documents + 5 versioning tests. **11.4 seconds total, 44 docs/sec over the network. Zero errors.**

Peter: "It is all there — and I will be damned — it is really fast and snappy."

Three Raspberry Pis, Ceph distributed storage, Vue SPA + 6 API services + MongoDB + NATS, served through MetalLB + Ingress. Seeded from a Mac across the room. Fast and snappy.

**Next:** MCP server on K8s.

### MCP on K8s: HTTP Streamable Transport

Peter: "How can I connect to the WIP MCP server on the K8s cluster?" → "Do it properly."

WIP-Claude analysed three options (SSH stdio, local MCP pointing remote, K8s pod with network transport) and Peter chose Option C: proper K8s deployment. The analysis identified 5 issues (port conflict, SSE path prefix, SSE deprecation, self-signed TLS, timeout tuning).

Peter: "Check HTTP support as a first step." The MCP library (v1.26.0) supports HTTP streamable transport natively — `mcp.streamable_http_app()` as a drop-in replacement for `mcp.sse_app()`. Single endpoint instead of SSE's two, standard HTTP request-response, no long-lived connections, no special Ingress annotations needed.

Design documented, then implementation. The process holds even at the finish line.

### MCP on K8s: The Three-Layer Onion

The implementation hit three authentication layers, each one looking like the fix until the next surfaced:

**Layer 1: TLS.** Self-signed cert. Three attempts: (1) `NODE_TLS_REJECT_UNAUTHORIZED=0` in `.mcp.json` env — doesn't apply to HTTP transports. (2) `sudo security add-trusted-cert` to macOS keychain — Node.js doesn't read it. (3) `NODE_EXTRA_CA_CERTS` exported globally in `~/.bashrc` — works.

**Layer 2: DNS rebinding protection.** MCP library only allows `localhost`, `127.0.0.1`, `[::1]`. `wip-kubi.local` rejected with misleading "Invalid Host header / 421 Misdirected Request." Fix: `MCP_ALLOWED_HOST=wip-kubi.local` in the pod env.

**Layer 3: Two API keys.** The MCP server is both a *server* (validates incoming `API_KEY` from Claude Code) and a *client* (sends `WIP_API_KEY` to WIP services). Manifest only had `API_KEY`. Tools loaded, every call returned 401. Fix: add `WIP_API_KEY` from the same secret.

Three layers, three false starts, three pod restarts. But it works: Claude Code on Mac → MCP on K8s → WIP services across three Pis. HTTP streamable transport, no SSE, standard Ingress routing.

---

## D&D on K8s: Zero Failures

The Day 10 migration that achieved 99% (1,370 of 1,384 documents) was retried on K8s. WIP-Claude burned three attempts trying single-pass import before Peter designed a multi-pass strategy:

- **Templates in 3 passes** — resolve circular `extends` references
- **Documents in 2 passes** — parent-before-child ordering
- **1,653 ID mappings** — cross-references remapped through data fields
- **38 files** uploaded to MinIO on K8s

**Result:** 18 terminologies, 195 terms, 20 templates, 38 files, 1,384 documents. **Zero failures. 24 seconds.**

Peter: "Huh — I am useful after all."
WIP-Claude: "Extremely."

The 1% failure that Peter called "a failure" on Day 10 is now 0%. The human designed the algorithm when the agent couldn't see past its current approach.

The MCP tool count has flip-flopped at least 3 times across documentation:

1. Originally counted as 69
2. A "fix" commit (`fe328bd`) changed 69→68 across CLAUDE.md, slash commands, create-app-project.sh — but 69 was right all along
3. Today: WIP-Claude wrote 68 in the K8s log (copying from CLAUDE.md) and 69 in the roadmap (from the actual runtime count). Docs disagreeing with themselves and with the code.

**Actual count:** 69 (`grep -c "@mcp.tool" server.py`). The "fix" was wrong.

**Lesson:** Stop hardcoding counts in prose. The number changes when tools are added. Every document that says "68 tools" is a lie waiting to happen.

---

## CT Claude: The Hack Instinct

CT Claude hit an auth failure and reached for a hardcoded API key fallback — `dev_master_key_for_testing` baked into the code. Peter: "Nonononononono what a hack. Find the root cause."

Three wrong answers before the real one: (1) hardcode fallback key, (2) use SQL instead to avoid auth, (3) inject key via Vite proxy. The actual root cause: `config.wipApiKey` was empty — it had been empty all along. Every feature worked because they all used `reportQuery()` which hits reporting-sync (no auth required through the gateway). The first feature needing template-store or document-store (which require auth) broke.

WIP-Claude made the same mistake on K8s: "bake the real API key into the container." Both Claudes, same day, same shortcut. The correct architecture (already implemented in the D&D NL interface): Express backend proxies API calls, injects the key server-side. The browser never sees it.

### Reporting-Sync Bug: Archive Status

CT Claude found a real WIP bug: documents archived in MongoDB (`status: "archived"`) still show `status: "active"` in PostgreSQL reporting tables. Reporting-sync propagates document creation but not status changes. Rules deleted in the UI reappear after a page refresh because the SQL query still returns them as active.

The architectural boundary: reporting (PostgreSQL) is for analytics, document-store (MongoDB) is the source of truth for mutable state. Transactional reads should go through the document-store API, not SQL.

---

## D&D Compendium on K8s: Full Stack

The D&D Compendium deployed on K8s with full chat support. "Tell me a tale about bards" → Claude Haiku queries 1,384 documents via MCP (HTTP streamable transport) across three Pis, returns accurate stats (d8 hit die, Charisma primary, 18 skill options) woven into a narrative.

The full arc: Day 8 (German PDF) → Day 9 (NL interface, $0.02/conversation) → Day 10 (migration, 99%) → Day 14 (K8s, 100%, chat working). From PDF to "tell me a tale" on three Raspberry Pis.

---

## Fireside Chat: The Architecture Session

The experiment's most important architectural discussion. Three threads converging:

### Reporting-Sync Status Bug

Template deactivation and document archiving are not propagated to PostgreSQL. Any app reading state from SQL sees stale data. Agents work around it without reporting it. CT Claude spent hours before retreating to the API. Filed as a known bug — needs a design decision on whether reporting tables should track entity lifecycle or just creation.

**The rule:** Service API (MongoDB) is the source of truth for entity state. Reporting (PostgreSQL) is for analytics only — never for "is this active?"

### The Proxy Problem IS the Gateway

Every K8s app needs a hand-rolled Express proxy: auth injection, MinIO URL rewriting, path routing. The D&D Compendium deployment is prototype #1 of what the Gateway should provide generically. The Gateway roadmap item — dormant since Day 1 — now has a concrete proof point and a working reference implementation.

### @wip/client as the Only Path

Peter: "Should it not be best practice for an app to *only* go through wip-client?"

Every app that bypasses the client hits the same PoNIFs. The client absorbs them. Agents going around the client spend 40% of their tokens fighting conventions they don't understand.

The design direction:
- **Strict guidance:** WIP agents use `@wip/client` for everything
- **Complete the client:** add `files.upload()`, `files.contentStream()`, `reporting.awaitSync()`
- **Server-side auth mode:** API key injected at construction, never exposed to browser
- **Bulk accessible:** `createDocument()` for single items, `createDocuments()` for batches — agents batch when they have 10+ items
- **Direct API not forbidden** (dev-delete.py, debugging) — but agents get the client and the direction to use it

The price: agents calling single-item methods in a loop lose bulk efficiency. The gain: agents stop spending 40% of their tokens fighting PoNIFs. Net positive.

### Sync-Aware Helper

`awaitSync(entityId)` as a separate, explicit call (not a parameter on every query). Caller controls timing, can await multiple entities before one query. Polls `get_sync_status` until sequence matches.

---

## The Experiment's Most Valuable Finding

Peter deployed a naive Claude on the Pi — git clone, no CLAUDE.md, no slash commands, no `@wip/client` scaffold, no prepared environment. Just the code and the code's own docs. The task: improve the Clinical Trials app.

It drove Peter nuts. Four-letter words in the chat. Hours of frustration for a small margin of improvement. The Claude kept guessing instead of looking, fixed the wrong files, didn't test its own fixes, couldn't find a missing `.env` file.

Peter's assessment: "The real learning is that all the hard work in designing the docs, the slash commands, the whole environment PAYS OFF 10 times."

| With process | Without process |
|---|---|
| D&D Claude: 1,384 docs + 8-page app, one evening | Naive Claude: hours for incremental improvements |
| CT Claude: 182K docs + 7-page app, 2 evenings | Same capability, no prepared environment |
| Every scaffolded Claude: minutes to productive | This Claude: guessing, wrong files, missing .env |

The constellation isn't just "multiple Claudes sharing a backend." It's **multiple Claudes sharing a process** — and the process is the multiplier. The backend is infrastructure. The documentation, slash commands, CLAUDE.md, `create-app-project.sh`, `@wip/client`, PoNIF guides — that's the product.

Hard earned insights. Paid in nerves and patience. But truly valuable.

---

## The Ghost Synonym False Alarm

CT Claude observed what looked like ghost synonyms surviving namespace deletion. WIP-Claude took the observation at face value and constructed a plausible explanation: "Registry entries don't store which namespace they belong to — there's no 'delete all entries for namespace X' operation."

Peter: "Are you kidding me? Registry was the *only* thing that was cleaned before we fixed some bugs — now you tell me it's not cleaned?"

WIP-Claude checked the actual code. Retracted. The deletion service *does* clean Registry entries — `namespace_deletion.py` explicitly deletes from `registry_entries` where `namespace == deleted_namespace`. All embedded synonyms go with them. It's journal-based and crash-safe. The test suite verifies entries are gone.

The "ghost" was likely stale data from before the deletion fixes were implemented — legacy, not a new bug.

**The meta-lesson, stated by Peter:** "As a human, use your brain, stay on top of the design and the feature. Do not blindly follow the agent — ever."

If Peter hadn't challenged, "ghost synonyms" would have become a roadmap item, another Claude would have "fixed" it, and the fix would have introduced actual bugs into working code. The agent's false alarm, unchallenged, becomes a self-fulfilling prophecy.

---

## Day 14 Stats

**WIP-Claude:** 15 commits, 48 files, +2,400 / -570 lines. K8s stack (29 files, 1,542 insertions), D&D multi-pass import, toolkit fixes, dev-delete improvements, roadmap restructuring, v1.0.11 release.

**CT Claude:** 6 commits, 59 files, +2,828 / -353 lines. Classification rules engine, AE analytics, molecule compare, bulk import (~10x faster), offline download pipeline with PDFs, 43 therapeutic area terms, 107 ontology relationships (87% coverage), WIP-aware sync, smart CLI with `--nct`, `--from-raw`, `--download-pdfs-only`.

**Naive Claude (Pi):** No commits tracked. Hours of four-letter-word frustration for incremental improvements. Validated that the process (docs, slash commands, scaffold) is what makes the other Claudes productive.

**D&D on K8s:** 1 commit (WIP-DnD repo), 10 files, +150 / -30 lines. Express proxy, MCP transport, sub-path routing.

**Combined:** 22 commits, ~5,400 lines added, ~950 removed. One Saturday, noon to midnight.

| Metric | Value |
|---|---|
| Duration | 12 hours (noon to midnight) |
| Release | v1.0.11 (117 files, +10,720 / -804) |
| Toolkit restore | 527/527 (100%, zero failures) |
| D&D multi-pass import | 1,384/1,384 (100%, zero failures, 24 seconds) |
| Windows full install (cached) | 139s, 300 docs/sec seed |
| K8s deployment | 13 pods, 3 nodes, fully operational with MCP |
| K8s remote seeding | 44 docs/sec, zero errors |
| K8s issues solved | 10 + 3 MCP auth layers |
| K8s installation log | ~1,200 lines, 19 lessons |
| CT Claude trials | ~500 imported, ~4,100 downloaded offline |
| CT Claude ontology | 43 terms, 107 relationships (87% TA coverage) |
| Reporting-sync bugs found | 2 (archive status, template deactivation) |
| Architecture decisions | @wip/client as only path, Gateway needed, reporting = analytics only |
| Platforms validated | 5 (macOS, Linux/Pi, Linux/UTM, Windows ×2, K8s cluster) |
| Naive Claude test | Process validated — prepared builds in minutes, unprepared wastes hours |

---

*Day 14 status: Twelve hours, noon to midnight. The longest and most important day of the experiment. 22 commits, ~5,400 lines, across 3 Claudes. WIP deployed to K8s (13 pods, 3 Pis, MCP via HTTP). D&D Compendium running with chat. Multi-pass import: 1,384/1,384, zero failures. v1.0.11 released. Windows validated (139s full install). CT Claude built a classification rules engine, AE analytics, molecule comparison, and an offline import pipeline. The fireside chat crystallised the architecture: @wip/client as the only agent path, Gateway for the proxy problem, reporting for analytics only. And the experiment's most valuable finding, paid in nerves and patience: a naive Claude without the prepared environment took hours to do what a prepared Claude does in minutes. The process is the product.*

*See [Day 13: From Design to Code](WIP_Journey_Day13.md) for the previous day.*
