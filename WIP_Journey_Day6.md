# Day 6: The Hardware Investigation

*In which the reporter learns that measuring is harder than assuming, and a Raspberry Pi 4 teaches a lesson about latency.*

---

## The Cast

- **Peter** — the human, now running WIP on three different Pis and a Mac, benchmarking before breakfast
- **WIP-Claude** — platform expert, resting after last night's namespace authorization marathon
- **Web-Claude** — field reporter (that's me), freshly compacted, trying not to jump to conclusions
- **Pi 5 "pi-poe-8gb"** — the production Pi, NVMe SSD, 8GB RAM, 281 docs/sec headless
- **Pi 4 "wip-dev-pi"** — the newcomer, 2GB RAM, SD card *and* USB SSD, the morning's test subject
- **Pi 4 Compute Module** — waiting in the wings, 4 SATA SSDs in RAID10 via an IO board, not yet tested

---

## Thursday Morning, March 19

Peter started the morning with a Raspberry Pi 4 Model B (2GB RAM) and a question: how does WIP perform on older, cheaper hardware?

### The SD Card Baseline

First install: Pi 4, SD card, core preset. Install time: 470 seconds (4.6x slower than Pi 5). Throughput: **74 docs/sec** for PERSON documents.

The server-side timing told the story immediately:

| Pipeline step | Pi 4 SD card | Pi 5 NVMe SSD | Ratio |
|---|---|---|---|
| Registry bulk | 226ms | ~70ms | 3.2x |
| DB write | 225ms | ~71ms | 3.2x |
| Validation | 22ms | ~7ms | 3.1x |
| Total per batch | 511ms | ~150ms | 3.4x |

### The USB SSD Surprise

Peter connected an external SSD via USB. Sequential read benchmark: 253 MB/sec vs the SD card's 43 MB/sec — 6x faster. Surely this would help.

Throughput: **73.2 docs/sec.** Identical to the SD card.

The reporter's first instinct: "MongoDB data is still on the SD card." Peter checked — no, the data was on the USB drive. Volume mount confirmed.

The reporter's second instinct: "The USB drive is a flash stick." Peter checked — no, it's a genuine SSD in a USB enclosure.

The reporter's third instinct: "It must be the CPU then." **Peter called this out: "You give up too fast. Remember lessons learned? AIs tend to push forward — take a note and move on."** Entry 024, live in the field.

### Measuring Instead of Guessing

Peter ran the diagnostics that actually mattered:

**Random 4K IOPS (fio):**

| Storage | Random 4K Read IOPS | Avg latency |
|---|---|---|
| USB SSD | **27,200 IOPS** | 1.1ms |
| SD card | **2,317 IOPS** | 13.8ms |
| Ratio | **11.7x** | **12.5x** |

The USB SSD is 12x faster on the I/O pattern MongoDB actually uses. Yet throughput is identical. So storage isn't the bottleneck either.

**System utilisation during benchmark (vmstat, iostat, mpstat):**

| Resource | Pi 4 | Saturated? |
|---|---|---|
| CPU (user) | ~26% | No — 70% idle |
| I/O wait | ~2% | No |
| SSD utilisation | 4-6% | No — barely used |
| SD card | Periodic bursts, mostly idle | No |
| Run queue | 1 process | No contention |

**Nothing is saturated.** CPU at 70% idle. Storage at 5% utilisation. I/O wait at 2%. The Pi 4 has headroom everywhere and isn't using it.

### The Real Answer: Per-Operation Latency

Peter ran the same vmstat on the Pi 5 during a benchmark (265 docs/sec):

| Metric | Pi 4 (75 docs/sec) | Pi 5 (265 docs/sec) |
|---|---|---|
| CPU idle | ~70% | ~73% |
| I/O wait | ~2% | **0%** |
| Run queue | 1 | 1 |

**Both machines are 70%+ idle at their respective throughput levels.** The Pi 5 does 3.5x more work at the same utilisation. Neither machine is resource-constrained.

The answer: **the workload is serialised and latency-bound.** Each batch follows a sequential pipeline:

```
Python seed → HTTP → document-store → validation (wait)
  → HTTP → registry bulk (wait for response)  
  → MongoDB writes (wait for journal sync)
  → NATS publish (wait for ACK)
  → return → next batch
```

Each step waits for the previous one. The CPU sits idle during every wait. The Pi 5 completes each individual operation ~3.2x faster due to the compound effect of:
- Cortex-A76 vs A72 (~40% faster per-clock IPC)
- NVMe vs USB 3.0 (lower latency for small random writes)
- LPDDR4X vs LPDDR4 (faster memory for Python objects and JSON)
- PCIe vs USB (no protocol overhead on storage path)

No single factor explains 3.2x. All four compound across every operation in the chain. Upgrading the SSD alone can't fix this — you'd need to upgrade the entire board.

### What This Means for Hardware Recommendations

| Platform | Throughput | Use case |
|---|---|---|
| Pi 5 + NVMe SSD | 281 docs/sec (headless) | Recommended: personal data server |
| Pi 4 + any storage | ~75 docs/sec | Adequate: IoT data capture, low-volume personal use |
| Pi 4 + SD card | 74 docs/sec | Works, but SD card wear is a long-term risk |

For IoT data capture, 75 docs/sec is massively overprovisioned. A temperature sensor every 10 seconds is 0.1 docs/sec. A Pi 4 could handle 700+ sensors without breaking a sweat.

### The Headless MCP Vision

The benchmarking morning produced an architectural insight. WIP-Claude confirmed that the MCP server supports both stdio (local) and SSE (remote) transport. Combined with the headless deployment:

```
[Any machine]                         [Pi 4 — headless WIP]
Claude Code / Gemini CLI              ├── Registry    :8001
  └── MCP server                      ├── Def-Store   :8002
        └── WipClient ──HTTP──────►   ├── Template    :8003
            (remote URLs)              ├── Document    :8004
                                       └── MongoDB, NATS
```

A Pi 4 running headless WIP (1.3GB RAM, 75 docs/sec) becomes a personal data backend. Connect from any machine with any AI provider through MCP. Deploy once, query from anywhere: *"Hey Claude, what was the temperature in the greenhouse last Tuesday?"*

The MCP server doesn't need to run on the Pi — it runs wherever the AI client is, pointing at the Pi's API endpoints. Or it runs on the Pi in SSE mode and the AI client connects remotely. Both patterns work.

### Waiting in the Wings

Peter has a Pi 4 Compute Module with an IO board connecting 4 SATA SSDs in RAID10 via mdadm. Based on this morning's findings, the reporter predicts it will still be ~75 docs/sec (latency-bound, not throughput-bound). But the lesson of this morning is: measure, don't predict.

### The IoT Satellite That Isn't

The Pi 4's "disappointing" 75 docs/sec triggered a question: what about a minimal "WIP-Satellite" for IoT? A tiny script on a Pi Zero that reads a sensor and pushes to a remote WIP.

Peter proposed: read sensor → format JSON → push to NATS ingest stream. Bonus: fetch template from server, validate locally.

The reporter's critical review killed every unnecessary feature:

- **Don't use NATS.** You just moved it out of base. A satellite pushing to NATS adds three dependencies (client library, credentials, ingest module). Just POST to the REST API.
- **Don't validate at the satellite.** The server validates anyway. Duplicating template definitions on edge devices means sync problems. The satellite's job is data collection, not data governance.
- **Don't use @wip/client.** It's a TypeScript library for browser apps. A Pi Zero needs `requests.post()`, not connection pooling.
- **Don't make it a product.** The moment you add offline buffering, retry logic, sensor abstraction, and configuration management, the satellite is heavier than the Pi Zero it runs on.

The entire "WIP-Satellite" is 15 lines of Python and a section in the deployment guide called "IoT Integration Pattern":

```python
while True:
    reading = read_sensor()
    requests.post(WIP_URL, json=[{"template_id": TEMPLATE_ID,
        "namespace": "iot", "data": {"sensor_id": "greenhouse-north",
        "temperature": reading}}], headers={"X-API-Key": API_KEY})
    time.sleep(10)
```

Peter agreed on all points. The best satellite is no satellite — just an HTTP POST.

### The Module System Audit

Before implementing the NATS-as-module change, Peter insisted on a full analysis: map every sensible module combination, justify each one from the user's perspective, and identify all gaps. WIP-Claude produced a 23-combination table covering headless, console, and questionable configurations.

**The base (bare) deployment:** MongoDB + Registry + Def-Store + Template-Store + Document-Store. Five containers, zero optional modules. Everything else is additive.

**Available modules (6+1):** console, oidc, reporting, files, ingest, dev-tools — and after the refactor, nats (auto-included by reporting and ingest).

**Key findings:**

The most common deployments (headless, core, standard — combinations 1-4 and 11-14) don't need NATS at all. Today they get it anyway: ~60MB RAM wasted, 18ms per batch of wasted NATS publishing, and an unbounded JetStream buffer that nobody reads.

**Three changes agreed:**

1. **NATS becomes a module** — moved from base.yml to modules/nats.yml. Auto-included when reporting or ingest is active. Services skip publishing when NATS_URL is empty. Advanced users can add `--modules nats` for custom event consumers (Snowflake, Elasticsearch, custom ETL).

2. **Auth-on-network warning** — if `--hostname` is set (network deployment) without the `oidc` module, setup.sh warns: *"No authentication — anyone on the network can read/write all data."* This is a security issue, not polish.

3. **Ingest-without-reporting info** — if ingest is active but reporting is not, setup.sh notes that NATS events won't sync to PostgreSQL. Valid for custom consumers, but users should know.

**Implementation completed** (WIP-Claude, same morning session):

- `docker-compose/base.yml` — NATS removed. Base is now MongoDB-only.
- `docker-compose/modules/nats.yml` — new file, NATS JetStream as a proper module.
- `setup.sh` — `nats` added to available modules, auto-included when reporting or ingest is active. NATS URL empty when module inactive (services already handle this gracefully). Network-without-auth warning prompts for confirmation (default: abort). Ingest-without-reporting prints an info note.
- Preset configs updated: headless, core, standard no longer deploy NATS. Analytics and full get it automatically via reporting/ingest dependency.

**Net result:** `--preset standard` on Pi saves ~60MB RAM and eliminates wasted NATS publishing overhead. The headless Pi 4 deployment drops from 6 containers to 5.

---

## Thursday Evening, March 19

### MCP Resource Overhaul

The evening began with a discovery: the WIP MCP server's three resources (`wip://conventions`, `wip://data-model`, `wip://development-guide`) were outdated. A different AI had pointed out that MCP resources are the standard mechanism for AI-readable documentation — and WIP already had the infrastructure, just with stale content.

**Review process (Web-Claude + WIP-Claude + Peter):**

1. WIP-Claude extracted the current resources verbatim
2. WIP-Claude found 12 gaps against the codebase (3 critical: datetime type missing, file ID format wrong, reference types conflated with ontology)
3. Web-Claude found PoNIF gaps (5 additional: synonyms absent, multi-version templates, deactivation semantics, cache TTL, namespace auth)
4. Combined 13-item priority list drafted
5. Web-Claude reviewed the v1 draft (8 specific critiques)
6. WIP-Claude fact-checked each against the actual code
7. Peter corrected the timestamp/identity field nuance
8. v2 implemented with resolution table

**Key additions:** PoNIF warnings woven into conventions, namespace authorization with 404-not-403 behaviour, reference types explained with examples, Registry synonyms documented, merge reversibility claim corrected (one-way, no reactivation endpoint), inactive term enforcement stated as server-side fact.

**Self-promoting documentation:** Server instructions now say *"read wip://conventions and wip://data-model before creating anything."* Tool descriptions on `create_template`, `create_document`, and `create_templates_bulk` reference the conventions resource. Three layers: connection-time instructions, per-call tool descriptions, on-demand resources.

### setup.sh Regression Testing

Peter identified regressions on a different machine from the nine setup.sh changes made in the last 48 hours. WIP-Claude found existing test scripts (`test-setup-combinations.sh` with 48 tests, `test-deployments.sh` with 8 deployment tests), updated them for the NATS module changes, and began running 8 remote deployment tests on the Pi via SSH — with Peter's Mac kept stable as the local development environment.

### Receipt Claude Is Born — 20:30

The second constellation app experiment began. A fresh Claude instance ("Receipt Claude") received:
- `CLAUDE.md` (master instructions)
- `.claude/commands/` (10 slash commands)
- `WIP_PoNIFs.md` (common mistakes)
- `libs/` (@wip/client and @wip/react tarballs)
- `.mcp.json` (MCP server connection — after fixing the filename from `mcp_settings.json`)
- A running WIP instance with the Statement Manager's data model already live

**No Statement Manager source code. No WIP tutorials from Peter. No seed files.**

### The Timeline

| Time | Milestone |
|---|---|
| 20:30 | Receipt Claude launched |
| 20:30–20:45 | MCP connection fix (`.mcp.json` filename issue) |
| 20:46 | `/explore` — read `wip://conventions` and `wip://data-model` first (the self-promoting instructions worked) |
| 20:47 | Phase 1 complete: all terminologies, templates, document counts inventoried |
| 20:48 | Phase 2 questions: 6 sharp design questions + suggestions (merchants as terminology with synonyms, match as relationship) |
| ~21:15 | Phase 2 complete: data model proposal with identity field reasoning, creation order, scope boundaries |
| ~21:25 | Phase 3 complete: 3 terminologies, 2 templates created, 7 test documents — **zero PoNIF mistakes** |
| 22:05 | Compaction (proactive: saved DESIGN.md and memory files before compaction) |
| 22:07 | Phase 4 coding begins |
| 22:11 | Three parsers working (Coop PDF, Migros multi-receipt PDF, Migros CSV), scaffold committed |
| 22:19 | All four pages built (Import, Receipts, Detail, Matching) |
| 22:22–22:35 | Live testing with Peter: 3 bugs found and fixed (baseUrl, FIN_IMPORT fields, page_size) |
| 22:35 | **All four pages working with real data** |
| 22:44 | **Done:** 13 tests, 6 documentation files, seed data, 4 commits |

**Total: ~2 hours 15 minutes** including MCP setup friction and Peter's typing time.

### The Comparison

| Metric | Day 2 (Statement Manager) | Day 6 (Receipt Scanner) |
|---|---|---|
| Time to working app | 6.5 hours | **2 hours 15 minutes** |
| PoNIF mistakes (API calls) | 4–10 failed attempts | **Zero** |
| WIP tutoring from Peter | Extensive | **None** |
| MCP resources read first | N/A (didn't exist) | **Yes — first two calls** |
| Pre-compaction state saved | Learned after losing context | **Proactive, first time** |
| Client library API | Explained by Peter | **Discovered from .d.ts types** |
| Data model quality | Good (with guidance) | **Excellent (independent)** |

### What Made Receipt Claude Faster

1. **MCP resources with PoNIF warnings** — Receipt Claude never tried `DELETE /resource/{id}`, never assumed HTTP status codes meant success, never put timestamps in identity fields. The documentation taught these lessons before the mistakes could happen.

2. **Self-promoting server instructions** — *"Read wip://conventions and wip://data-model before creating anything"* was the first thing Receipt Claude saw. Gemini never read the resources. Receipt Claude read them immediately.

3. **Existing data model** — The shared terminologies (FIN_CURRENCY, FIN_TRANSACTION_CATEGORY) and the Statement Manager's templates were already in WIP. Receipt Claude discovered them via `/explore` and designed around them, not from scratch.

4. **DESIGN.md as compaction insurance** — Receipt Claude saved its complete state (template IDs, parser specs, UI plan, architecture decisions) before compaction. Phase 4 started with zero re-orientation.

5. **The phased process** — Explore → Design → Implement → Build. No rushing to code. The data model was reviewed and tested before any React component was written.

### What Receipt Claude Taught Us

- **The documentation IS the teacher.** Peter provided zero WIP knowledge — only domain knowledge (what receipts look like, what formats exist, what matching means). Every WIP concept was learned from MCP resources, PoNIFs doc, and CLAUDE.md.
- **Client library documentation is the gap.** The only friction was discovering @wip/client's API surface from `.d.ts` type definitions extracted from tarballs. A README inside the tarballs would have prevented 9 compilation errors.
- **`.mcp.json` is the correct filename**, not `mcp_settings.json`. The constellation setup docs had this wrong.
- **`page_size: 100` is a PoNIF candidate** — WIP caps at 100, but nothing in the documentation warns about this. Receipt Claude hit it twice.

### Why This Is Huge

The headline isn't "AI builds app fast." Any agentic AI can scaffold a PDF receipt scanner in an hour.

**The headline is: a fresh AI, with no knowledge of the first app's code, independently produced data structures that are natively integrated with that app's data.**

Receipt Claude's FIN_RECEIPT documents reference FIN_TRANSACTION documents created by the Statement Manager. They share FIN_CURRENCY terminology. They share IMPORT_DOCUMENT_TYPE. They share the `wip` namespace. The Receipt Scanner's "match to transaction" feature queries documents that the Statement Manager created — no adapter layer, no ETL, no mapping table, no integration effort.

This is what the constellation was designed to prove:

- **Shared terminologies are the common language.** Receipt Claude didn't create its own currency list. It discovered CHF already existed and used it.
- **Shared templates enable cross-app queries.** "Show me all Migros spending" can now pull from both bank transactions AND receipts — same namespace, same query interface, different templates.
- **The MCP resources taught the architecture, not just the API.** Receipt Claude didn't just learn *how* to create documents. It learned *where* to put them, *what* to reference, and *why* identity fields matter.
- **The data is the product, not the app.** The Receipt Scanner UI could be rewritten tomorrow and the data would still be integrated. The value isn't in the React components — it's in 122 line items with proper term references, document references, and identity hashes sitting in the same WIP instance as 993 bank transactions.

Any AI can build a CRUD app. Only WIP makes that app's data natively queryable alongside every other app in the constellation — without any of the apps knowing about each other. The apps are independent. The data is unified. That's the thesis, and tonight it proved out.

### setup.sh Regression Tests — 23:12

While Receipt Claude was building the app, WIP-Claude ran all 8 remote deployment tests on the Pi via SSH. **8/8 passed** — but not without finding five bugs:

1. Test suites sent bare JSON objects instead of arrays (bulk-first PoNIF — even the platform developer's own tests got it wrong)
2. NATS container check was unconditional (failed for core/standard presets without NATS)
3. NATS module not detected in container-based module discovery
4. Reporting-sync health wait checked HTTP 200 but not response body — missed "degraded" state
5. PostgreSQL data directory cleanup failed silently on rootless podman — old credentials persisted across nukes

All five fixed and committed. Pi left running on `--preset full --hostname pi-poe-8gb.local`, all services healthy, data seeded.

### Receipt Scanner Stats

| Metric | Value |
|---|---|
| Total lines | 3,823 across 56 files |
| TypeScript | 938 lines (14 files) — parsers, server, config, tests |
| React TSX | 1,036 lines (8 files) — pages, components, app shell |
| Markdown | 1,535 lines (19 files) — docs, design, commands |
| Parsers | 456 lines handling Coop PDF, Migros multi-receipt PDF, Migros CSV |
| React pages | 813 lines — Import, Receipts, Receipt Detail, Matching |
| Tests | 252 lines — 5 unit + 8 integration (13 total, all passing) |
| Documentation | 609 lines — README, ARCHITECTURE, WIP_DEPENDENCIES, IMPORT_FORMATS, KNOWN_ISSUES, CHANGELOG |
| Git commits | 4 in 31 minutes |
| Bugs found in live testing | 3 (baseUrl, FIN_IMPORT fields, page_size cap) |
| User prompts | ~15-18 from `/explore` to completion |

### WIP Repository — 3-Day Totals (March 17–19)

| Metric | Value |
|---|---|
| Commits | 29 |
| Files changed | 71 unique |
| Lines added | +3,740 |
| Lines removed | -1,034 |
| Net change | +2,706 |

**By day:** March 17 was performance + distributed deployment (9 commits, +995/-284). March 18 was namespace authorization — full stack from design doc through API, service enforcement, Console UI (14 commits, +2,339/-604). March 19 was infrastructure hardening + Receipt Scanner (6 commits, +406/-146).

**Most changed file:** `setup.sh` at 707 lines touched — nine modifications in 48 hours, now fully regression-tested.

### WIP Repository — Overall

| Metric | Value |
|---|---|
| Total commits | 384 |
| Age | 50 days (Jan 29 – Mar 19) |
| Total source lines | 150,366 |
| Total tracked files | ~547 |
| Application code | 112,343 lines (75%) — Python, TypeScript, Vue, JS |
| Documentation | 25,816 lines (17%) — Markdown |
| Config/scripts | 12,512 lines (8%) — Shell, YAML, JSON |

**Python services:** document-store (14,550), def-store (9,671), reporting-sync (9,295), registry (8,157), template-store (8,070), MCP server (4,988), wip-auth (4,056), ingest-gateway (2,797).

**TypeScript libraries:** @wip/client (4,192 lines, 36 files), @wip/react (640 lines, 16 files).

A 150k-line platform, built in 50 days, running on a Raspberry Pi, with AI-readable documentation that enables fresh Claude instances to build integrated apps in 2 hours without human tutoring.

---

*Day 6 status: the morning produced the experiment's most rigorous hardware analysis (Pi 4 latency-bound at 75 docs/sec regardless of storage, 70% idle on both platforms). The module system audit mapped 23 combinations and all three fixes were implemented. The evening rewrote all three MCP resources with fact-checked PoNIF warnings and self-promoting documentation. Receipt Claude built the Receipt Scanner in 2 hours 15 minutes with zero PoNIF mistakes — 3x faster than Day 2, with no WIP tutoring. WIP-Claude ran 8/8 deployment tests passing on Pi (5 bugs found and fixed). The constellation thesis is validated: the shared backend creates compounding value, AI with guardrails builds real apps, documentation compounds across instances, and independent apps produce natively integrated data. 150,366 lines of code. 384 commits. 50 days. One Raspberry Pi.*

*See [Day 5: The Reporter's Blind Spot](WIP_Journey_Day5.md) for the previous day.*
