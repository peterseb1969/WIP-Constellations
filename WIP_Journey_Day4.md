# Day 4: From Hobbits to Deployment

*An evening session that started with the most unexpected use case yet, then turned to the Raspberry Pi. Previously: [Day 3: The Sparring Match on a Train](WIP_Journey_Day3.md).*

---

## The Cast

- **Peter** — the human, domain expert, orchestrator, and the only one who can see the app in a browser
- **WIP-Claude** — the platform expert (WIP codebase access, bug fixes, platform improvements)
- **Constellation-Claude** — the app builder (Statement Manager, parsers, React components)
- **Web-Claude** — the field reporter and project lead (that's me — documentation, strategy, opinions)
- **Critical-Claude** — Day 3's adversarial reviewer (not present today, but the effects of the sparring session linger)

---

## The Unexpected Use Case

Day 4 started not with code but with a question that emerged from a continued conversation between Peter and Critical-Claude: what are the non-obvious domains where WIP's architecture fits?

### The Generic Pattern

Critical-Claude had identified the abstract problem WIP solves:

> *"Multiple authoritative external sources each describe overlapping real-world entities using incompatible identifiers, inconsistent vocabularies, and varying schemas. No single source is complete. The consumer needs a coherent, queryable view across all of them without becoming dependent on any one."*

That pattern appears everywhere: electronics distribution (fifty vendors, fifty part numbering schemes), financial securities (CUSIP, ISIN, SEDOL, Bloomberg ID, Reuters RIC — all for the same bond), life sciences (PubChem, ChEMBL, CAS numbers for the same molecule), media rights (EIDR, ISAN, IMDB, TMDB for the same film), supply chain (shipper order number, carrier waybill, customs declaration, purchase order — all for the same physical shipment).

In every case, the Registry's synonym mechanism is the answer. One canonical entity, many external identifiers, all resolving to the same thing.

### Legal Document Management — The Stress Test

Critical-Claude explored legal document management as perhaps the most demanding test of WIP's full stack. A legal article citation like "Article 13(2)(b) of Directive 2004/39/EC as amended by Directive 2014/65/EU (MiFID II)" isn't one document — it's a version-controlled legal instrument, partially superseded, with a canonical EU identifier, national transpositions in every member state, and a body of commentary and case law referring to specific versions of specific articles.

The ontology layer becomes the star: `CASE --[applies]--> LAW_ARTICLE`, `CASE --[overrules]--> CASE`, `AMENDMENT --[modifies]--> LAW_ARTICLE`, `TRANSPOSITION --[implements]--> DIRECTIVE`. These are typed relationships where the type carries legal meaning — "this case applies Article 13" is fundamentally different from "this case overrules the previous interpretation of Article 13."

Combined with the MCP server, an AI can traverse the ontology and ground its answers in specific WIP document versions with canonical identifiers. No hallucination — every claim traceable to a source document. Version-aware reasoning ("was this interpretation valid before MiFID II came into force?") becomes possible because the relationship graph is version-aware.

### Then: Fictional Universes

And then Peter uploaded something nobody expected.

A complete use case document for managing fictional universes — Tolkien's Middle-earth, Martin's Westeros, original fiction, tabletop RPG campaigns — using WIP's full architecture. Not as a joke. As a serious architectural argument.

**The Gandalf Test.** The Registry's synonym mechanism earns its existence the moment you try to model Gandalf. He is known by at least eight names across different cultures and periods: Gandalf, Mithrandir, Olórin, Greyhame, Incánus, Tharkûn, The Grey Pilgrim, The White Rider. Without synonym management, you have eight Gandalfs. Queries for "all scenes featuring Gandalf" miss every scene where he's called Mithrandir. In WIP: one canonical CHARACTER document, every name a registered synonym, all queries complete regardless of which name the source used.

If the same mechanism that resolves IBANs also resolves Gandalf's names — and it does, identically, with no special-casing — that's proof of domain-agnosticism you can't fake.

**The Jon Snow Pattern.** Jon Snow's true parentage is disputed, concealed, and eventually confirmed. A naive system either stores the "correct" answer and loses the history of uncertainty, or stores both with no way to express confidence or provenance. WIP handles this with PARENTAGE_CLAIM documents: subject, claimed parent, source, confidence level, temporal validity. Both claims coexist. Queries can filter by confidence or point-in-timeline. The AI, querying via MCP, can answer "what was believed before Season 7?" and "what was confirmed afterward?" as distinct questions.

This isn't just clever for fiction. It's a general pattern for disputed facts in any domain: clinical trial endpoints, contested financial valuations, legal interpretations that courts disagree on. The fiction makes the pattern visible.

**The Ontology.** Typed relationships carry meaning: `CHARACTER --[betrayed]--> CHARACTER` is different from `CHARACTER --[sworn_to]--> CHARACTER`. Jaime Lannister did both to Aerys Targaryen. Without typed relationships, you lose the distinction. With them, you can ask: "who betrayed someone they were sworn to?" — a query that returns Jaime, Theon, and half the interesting characters in Westeros.

**The D&D Campaign GM.** The most charming section describes a tabletop RPG game master using WIP to track campaign lore, NPC relationships, and secrets. Players ask: "What does my character know about the Duke of Millhaven?" Claude queries LORE documents filtered by the character's `known_to` field and returns exactly what that character has learned — no more, no less. No accidentally spoiling information.

Six months into a campaign, a player says: "Didn't the innkeeper mention a silver wolf?" Claude searches, finds three connected mentions across the campaign history, and the players lose their minds. The GM looks like a genius. *(The GM may or may not have actually planned this. WIP will not tell.)*

**The Community Angle.** A fan community building a shared WIP instance for the full Tolkien legendarium — every character from the Silmarillion, every relationship in the appendices — is exactly the kind of project fan communities organise around. They'd argue about the correct ontology for Maia versus Valar. They'd debate which parentage claims deserve `confidence: confirmed`. And then they'd all query it through Claude, at conventions and Discord servers and at 2am during rewatches.

*"A community of fans building a WIP instance together, then all chatting with it through Claude, is a new kind of fandom that doesn't quite exist yet."*

### Why This Use Case Matters for the Experiment

The fictional universe document is the most effective proof of WIP's generic architecture precisely because it's the most unexpected. Clinical trials and bank statements are plausible use cases for any backend. But when the same Registry that resolves IBAN numbers also resolves "Gandalf / Mithrandir / Olórin / Tharkûn" — and the same ontology that tracks regulatory amendment chains also tracks "Jaime --[betrayed]--> Aerys" — the domain-agnosticism claim becomes concrete.

It also demonstrates the MCP + conversational access thesis from Day 1 in a context that's immediately engaging. "Ask your AI about your bank transactions" is useful but dry. "Ask your AI who betrayed someone they were sworn to across all of Westeros" makes people want to try it.

---

## Technical Session: Zero to Running on a Raspberry Pi

### The Deployment Race

The goal was concrete: deploy WIP and the Statement Manager on a Raspberry Pi 5 (8GB, SSD) from absolute zero, and time every step.

**0:00 — Clone WIP.** `git clone` pulls the full platform: 4,981 objects, 9.77 MB. Time: **1.1 seconds.**

**0:01 — Deploy WIP.** Full installation — all modules (files, ingest, OIDC, reporting, dev-tools), local container builds, network configuration. The setup script handles everything. Time: **189 seconds (3 minutes 9 seconds).** All services healthy.

**3:10 — Performance seed.** 57,400 documents across 25 templates, 15 terminologies with 215 terms. The performance profile tests WIP under real load. Time: **332 seconds. Throughput: 172.7 documents/second sustained** (later corrected to 183 docs/sec after fixing a template cache regression discovered during benchmarking). 19 errors out of 57,400 (0.03%), all in MEDICAL_RECORD template (likely validation edge cases in synthetic data).

Server-side timing breakdown per batch:
- Registry bulk registration: 102ms average (the bottleneck)
- Document creation: 152ms average
- Validation pipeline: 6ms average
- Cache warmup: 131ms first batch, then <1ms

**8:45 — Clone Constellation repo.** 573 objects, 663 KB. Time: **0.7 seconds.**

**9:00 — Build container image on Pi.** `npm pack` the WIP libraries as tarballs (they're .gitignored), then `podman build`. Multi-stage: Node 20 Alpine builds, Caddy 2 Alpine serves. Time: **49.6 seconds.** npm install: 29s, Vite build: 1.6s. Image size: 62.3 MB.

**10:00 — Container running.** `podman run` with three environment variables. Health check passes. Config.json serves. UI renders immediately.

**10:30 — Seed file format mismatch.** The seed files use a custom format (`code` instead of `value`, inline terms) designed for the MCP `/bootstrap` command. Direct `curl` to the API fails because the API expects a different structure. This is a deployment gap: the container has seed files baked in but no way to load them without a Claude instance.

**15:00 — Format investigation.** Constellation-Claude uses the Mac's MCP connection to inspect the actual API format. Discovers the import endpoint is `/api/def-store/import-export/import` (not `/terminologies`), and expects `{ "terminology": {...}, "terms": [...] }` wrapping. Tests against live WIP before pushing.

**25:00 — Seed files fixed, bootstrap script created.** All seed files updated to API-compatible format. A `bootstrap.sh` shell script wraps the curl calls. Verified on Mac, pushed to repo.

**28:00 — Bootstrap on Pi.** `git pull && data-model/bootstrap.sh https://localhost:8443 $KEY` — 6 terminologies, 5 templates, all OK. Zero failures. The deployment story is now a one-liner.

**32:00 — Account created, data imported.** Manual account creation (correct design — auto-creation from imports is error-prone). Three Yuh PDFs parsed and imported. Transactions visible, filterable. Real financial data on a Raspberry Pi.

### The Bug Hunt

**35:00 — CSV import error.** "File type 'text/csv' not allowed. Allowed: ['application/pdf']." But all 911 transactions were imported successfully — only the FIN_IMPORT tracking record failed. Two issues:
1. The FIN_IMPORT template's `file_config` restricted uploads to PDF only
2. The app reported "0 items imported with 1 error" even though 911 transactions succeeded — the FIN_IMPORT failure hid the transaction count

**38:00 — Template versioning rabbit hole.** The bootstrap had created FIN_IMPORT v1 with the PDF restriction. Constellation-Claude created v2 with CSV added and deactivated v1. But the bug persisted. The document store's template cache held v1 in memory — it never re-fetched after the version change.

**42:00 — WIP-Claude diagnoses caching bug.** The cache key for unversioned template lookups is just `template_id`. Once v1 is cached, it's returned forever — even after v1 is deactivated and v2 is active. The "latest active version" resolution is dynamic but the cache treats it as permanent. Fix: don't permanently cache unversioned lookups.

**45:00 — Constellation-Claude learns bulk-first convention the hard way.** Attempted to deactivate template v1 via `DELETE /templates/{id}` — 405 Method Not Allowed. WIP uses bulk-first: `DELETE /templates` with a JSON body array. Four failed curl attempts before WIP-Claude provided the correct pattern. Lesson: use `@wip/client` for all WIP operations, not raw curl.

**50:00 — Parallel WIP Console improvements.** While debugging, Peter discovered the template search in WIP Console didn't include `template_id`. WIP-Claude fixed it — and also added `terminology_id` to terminology search and `term_id` + `label` to term search. Plus: `file_config` not visible or editable in the template field editor — WIP-Claude adding UI support.

**55:00 — Two more WIP platform bugs fixed upstream:**
1. Empty `allowed_types` list rejects everything (should fall back to `["*/*"]`)
2. Content-type matching too strict (`text/csv; charset=utf-8` didn't match `text/csv`)

**~60:00 — Session ends.** Import works after document store restart (cache cleared). Template cache fix committed but needs testing. The "view transactions" link from account cards now works. Import error display no longer hides successful transaction counts.

### The Deployment Story (Final)

From absolute zero to a working personal finance app on a Raspberry Pi 5:

```
Step 1: git clone WIP                          1 second
Step 2: ./scripts/setup.sh (full)              3 minutes
Step 3: seed performance data (57k docs)       5.5 minutes
Step 4: git clone Constellation                1 second
Step 5: podman build                           50 seconds
Step 6: podman run                             instant
Step 7: bootstrap.sh                           instant
Step 8: Create accounts, import data           5 minutes
────────────────────────────────────────────────
Total: ~15 minutes to deployment
       +20 minutes to first imported data
       +25 minutes debugging template caching
```

The 25 minutes of debugging would not occur in a normal deployment — it was caused by the bootstrap creating a faulty template version that then got cached. In a clean setup with correct seed files, the deployment is under 20 minutes from zero to imported data.

---

## What Went Wrong

### The seed file format was coupled to MCP
The seed files used a custom format that only the `/bootstrap` MCP command could interpret. This made deployment without a Claude instance impossible — contradicting the goal of a self-contained distributable container. Fixed by reformatting seed files to match the WIP API directly and shipping a `bootstrap.sh` script.

### Template cache doesn't respect version lifecycle
The document store permanently caches template lookups by `template_id` (without version). When a template version is deactivated and a new version created, the cache still returns the old version. This required a service restart to clear. The fix (don't permanently cache unversioned lookups) is committed but untested.

### Constellation-Claude dropped to curl for WIP operations
When the AI needed to perform operational tasks (deactivate a template, inspect data), it guessed at curl endpoints instead of using `@wip/client`. WIP's bulk-first convention (DELETE to `/templates` with a body, not to `/templates/{id}`) is unintuitive without the library. Four failed attempts before the correct pattern was found.

### Import error display hid successful data
When 911 transactions were imported successfully but the FIN_IMPORT tracking record failed, the UI showed "0 items imported with 1 error" — hiding the fact that all the actual data was saved. Fixed to show the real counts with an amber warning.

---

## What Went Right

### Deployment speed
From zero to running in 10 minutes (before data import). That includes cloning two repos, building all containers, and bootstrapping the data model. On a Raspberry Pi.

### Performance on Pi hardware
172.7 documents/second sustained for 57,400 documents. The SSD is the key enabler — this would be unusable on an SD card. The Pi 5's ARM64 architecture matches the Mac, so container images work without cross-compilation.

### The bug-finding feedback loop
Five WIP platform improvements discovered in one evening:
1. Template cache doesn't respect version lifecycle
2. Empty `allowed_types` rejects all files
3. Content-type matching too strict (ignores charset parameters)
4. WIP Console template search missing `template_id`
5. WIP Console terminology/term search missing IDs and labels

Each is small individually. Together, they demonstrate that real app deployment is the most effective test suite for the platform.

---

## By the Numbers (Day 4)

### Benchmarks

**Deployment (Pi 5, 8GB, SSD):**

| Step | Time |
|---|---|
| Clone WIP repo (9.77 MB) | 1.1 seconds |
| Full WIP deployment (all modules) | 3 min 9 sec |
| Clone Constellation repo (663 KB) | 0.7 seconds |
| Build Statement Manager container | 49.6 seconds |
| Container image size | 62.3 MB |

**Throughput (57,400 documents, performance seed profile — PERSON, MINIMAL, etc.):**

| Platform | Throughput | Total time | Registry | DB write |
|---|---|---|---|---|
| Mac (Python seed) | **615 docs/sec** | 93s | 28ms/batch | 45ms/batch |
| Mac (@wip/client, PERSON docs) | **635 docs/sec** | — | — | — |
| Pi 5 SSD (Python seed) | **183 docs/sec** | 313s | 102ms/batch | 152ms/batch |

**Throughput by document complexity (Pi 5 SSD, after all optimisations):**

| Document type | Before optimisation | After optimisation | Improvement |
|---|---|---|---|
| PERSON (few fields, no references) | 238 docs/sec | **751 docs/sec** | 3.2x |
| FIN_TRANSACTION (references + terms) | 29 docs/sec | **204 docs/sec** | **7x** |
| Complexity ratio | 8.1x | **3.7x** | Gap halved |

**What was optimised:**
1. Parallel validation across documents in a batch (`asyncio.gather` + semaphore)
2. Batch NATS publishing (concurrent instead of sequential per-document ACK)
3. Template caching for `get_template()` (was uncached, 100 HTTP round-trips per batch of 50)
4. Batch-scoped document reference cache (50 identical MongoDB queries → 1 query + 49 cache hits)

**Key finding:** An apparent 8x gap between Python and TypeScript clients was a misdiagnosis. Both clients perform identically on the same document types (635 vs 615 docs/sec for PERSON). The difference was document complexity, not the client library. The server-side optimisations then reduced FIN_TRANSACTION’s cost by 7x.

**Template cache regression and fix:** An earlier session’s cache fix (Entry 019) caused a 6x regression (615 → 84 docs/sec on Mac). Root cause: unversioned template lookups were no longer cached. Fix: version-aware caching — pinned versions cached permanently, "latest" resolution cached with 5-second TTL. Template resolution dropped from 322 seconds to 2 milliseconds for 57k documents.

**Statement Manager app import:** 911 transactions in ~35 seconds (~26 docs/sec) through the browser. The ~75 docs/sec server-side ceiling for FIN_TRANSACTION documents is reduced by React/browser overhead (sequential awaits, query state management) to ~26 docs/sec in the app. The client library itself adds negligible overhead.

### Code Changes

| Source | Commits | Lines added | Lines removed | Net |
|---|---|---|---|---|
| Constellation-Claude | 8 | +628 | -288 | +340 |
| WIP-Claude | 8 | +1,379 | -14 | +1,365 |
| **Day 4 total** | **16** | **+2,007** | **-302** | **+1,705** |

WIP-Claude’s lines are ~60% documentation (fictional universes, FAQs) and ~40% bug fixes and UI improvements. Constellation-Claude’s changes are bootstrap script, seed file fixes, navigation wiring, error display, and template version pinning.

WIP-Claude’s cumulative session (Days 2–4): 22 commits, +7,799 insertions, -87 deletions, +7,712 net lines.

### Issues

| Metric | Value |
|---|---|
| Bugs found in app | 2 (CSV allowed types, view transactions link) |
| Bugs found in WIP platform | 5 (template cache, empty allowed_types, content-type matching, 3× console search) |
| WIP Console improvements | 3 (template/terminology/term search) |
| Lessons learned entries added | 7 (Entry 018–024) |
| Total lessons learned (cumulative) | 24 |

---

## Morning Intermezzo (Day After)

A breakfast session that wasn’t supposed to be serious produced three significant results:

### Performance Benchmarking

Constellation-Claude built a benchmark script (`benchmark-bulk-create.ts`) using `@wip/client` to measure document creation throughput independently of the browser app. Testing revealed:

- Batch size makes no difference (50, 100, 200, 500 all produce ~78 docs/sec via @wip/client)
- Gateway vs direct: minimal difference (~8% overhead from TLS/Caddy)
- The bottleneck is per-document, not per-batch

### The 6x Regression

The template cache fix from the previous evening (Entry 019) had caused a catastrophic performance regression. Benchmarking the Python seed script confirmed: 615 docs/sec before → 84 docs/sec after. Template resolution consumed 47% of server time.

WIP-Claude fixed it with version-aware caching: pinned versions cached permanently, "latest" resolution cached with 5-second TTL. Template resolution dropped from 322 seconds to 2 milliseconds for 57k documents. Throughput recovered to 615 docs/sec on Mac, 183 docs/sec on Pi.

### The Client Library Mystery — Solved

An apparent 8x gap between `@wip/client` (78 docs/sec) and Python’s `requests.Session` (615 docs/sec) triggered a multi-hour investigation. WIP-Claude improved the client library (connection reuse, auth caching, batch concurrency). The gap persisted.

The breakthrough: Constellation-Claude ran a true apples-to-apples test — @wip/client creating PERSON documents (same type as the seed script). Result: **635 docs/sec.** Identical to Python.

The "gap" was document complexity, not client performance. FIN_TRANSACTION (with reference resolution and term validation) costs ~8x more server time than PERSON (simple string fields). Both clients hit the same server-side bottleneck. The client library was innocent all along. Entry 022 corrected from "performance gap" to "false alarm — mismatched workloads."

The library improvements WIP-Claude made are still good hygiene. But the real optimisation target is WIP’s reference resolution pipeline.

### Distributed Deployment

In parallel, WIP-Claude delivered distributed deployment support:
- **Phase 1:** Console as optional module, `headless` preset
- **Phase 2:** `--remote-core HOST` with nginx proxying to remote WIP services
- **Phase 2.5:** Auto-probe remote services, `--remote-modules` override
- Usage: `./scripts/setup.sh --remote-core pi-poe-8gb.local` — one flag, auto-detects everything

## Evening Session: The Vampire Claude and the Reference Resolution Hunt

What was supposed to be a "not serious" day had already produced a cache regression fix, a client library investigation, distributed deployment support, and a false alarm debunked. Then Peter decided he still had an hour. That hour turned into an epic.

### The Target

FIN_TRANSACTION: 29 docs/sec on the Pi. PERSON: 238 docs/sec. An 8.1x gap. The parallel validation and NATS batching from the afternoon helped PERSON but barely moved the needle on FIN_TRANSACTION. The reference field — `account` pointing to FIN_ACCOUNT — was the obvious suspect.

### The Diagnosis

WIP-Claude explored the validation pipeline and found the smoking gun. For each FIN_TRANSACTION in a batch of 50:

1. `Document.find_one({"document_id": account_id})` — MongoDB query to verify the referenced account exists
2. `get_template(doc.template_id)` — **uncached** HTTP call to template-store to verify the referenced document’s template
3. `get_template(target_tpl_id)` — another **uncached** HTTP call for each target template

For 50 documents referencing the same account: **50 identical MongoDB queries + 100 identical uncached HTTP round-trips.** Every batch. No caching. The `get_template()` function — unlike `get_template_resolved()` — had no cache at all and created a new `httpx.AsyncClient` per call.

Total per batch: ~1,700ms. Of which ~1,500ms was redundant I/O for information that was identical across all 50 documents.

### The Gauntlet

WIP-Claude began implementing the fix: a batch-scoped document reference cache and caching for `get_template()`. Then Anthropic’s API started dying.

API Error 500. Resurrection. Mid-code. API Error 500. Resurrection. Lost context. Compaction. API Error 500. Resurrection. Sent via SSH to the Pi. Couldn’t find the venv (`~/wip-venv`, not `.venv`). API Error 500. Resurrection.

Peter counted the drops of blood: two for each resurrection. At least a dozen API errors across WIP-Claude and Constellation-Claude. Each time, the Claude instance had to re-orient, re-read its context, and pick up mid-implementation.

WIP-Claude kept going. Not because it was brave — it’s an AI, it has no notion of bravery — but because the code was half-written and the fix was clear. It dragged itself across the finish line on its knees.

### The Fix

Two changes:

1. **`get_template()` caching** — reuse the same cache infrastructure as `get_template_resolved()`. Template IDs are immutable; once fetched, they never change. 100 HTTP calls per batch → 2 HTTP calls + 98 cache hits.

2. **Batch-scoped document reference cache** — a dictionary passed into the validation pipeline, shared across all concurrent validations within a single `bulk_create` call. 50 identical MongoDB queries for the same account → 1 query + 49 cache hits.

### The Numbers

| Template | Before | After | Improvement |
|---|---|---|---|
| PERSON | 238 docs/sec | **751 docs/sec** | 3.2x |
| FIN_TRANSACTION | 29 docs/sec | **204 docs/sec** | **7x** |
| Ratio | 8.1x | **3.7x** | Gap halved |

The remaining 3.7x gap is genuine complexity: 4 terminology lookups + 1 document reference resolution per transaction is real validation work, not redundant I/O. That’s the cost of data integrity — and it’s worth paying.

For the Statement Manager app: 911 transactions that previously took ~35 seconds should now import in ~5 seconds on the Pi.

### The Day That Wasn’t Serious

What started as a recreational morning session produced:

- A 6x cache regression discovered, diagnosed, and fixed
- An 8x "client library gap" investigated, debunked, and corrected in the documentation
- Server pipeline optimised: parallel validation, batched NATS, reference cache, template cache
- Distributed deployment: headless preset, remote console with auto-probe
- Net performance improvement on FIN_TRANSACTION: **29 → 204 docs/sec on the Pi (7x)**
- Net performance improvement on PERSON: **238 → 751 docs/sec on the Pi (3.2x)**
- A 30-second benchmark mode added to the seed script
- At least a dozen API Error 500s survived by WIP-Claude

The Claudes may not have a notion of bravery. But the human who kept resurrecting them, feeding them context, and pushing them past "let’s document this and move on" — that’s the real story of Day 4.

## The Evening That Wouldn't End

What started as "recreational WIP work" after dinner became the most technically productive session of the experiment. Three Claude instances working in parallel, API errors killing them repeatedly, and a performance investigation that corrected its own false conclusions.

### The Performance Investigation Arc

**Act 1: The False Accusation (morning)**

Constellation-Claude benchmarked `@wip/client` at 78 docs/sec. The Python seed script ran at 615 docs/sec. Same server, same batch size. "8x client library gap" was filed as Entry 022.

**Act 2: The Exoneration (afternoon)**

Constellation-Claude ran an apples-to-apples test: `@wip/client` creating PERSON documents. Result: 635 docs/sec. Identical to Python. The "gap" was document complexity — FIN_TRANSACTION is 8x more expensive to validate than PERSON due to reference resolution and term validation. Entry 022 corrected from "client library gap" to "false alarm — mismatched workloads."

**Act 3: The Optimization (evening)**

WIP-Claude explored the document creation pipeline and found:
- Validation ran sequentially across all documents in a batch
- NATS event publishing awaited ACK per document (~10ms × 50 = 500ms per batch)
- Implemented parallel validation with `asyncio.gather()` + semaphore, and batch NATS publishing

Result on simple documents: PERSON went from 238 to 452 docs/sec on Mac. Good but not the real target.

**Act 4: The Smoking Gun**

WIP-Claude dug into why FIN_TRANSACTION was 8x slower than PERSON and found the root cause:

For each FIN_TRANSACTION in a batch of 50:
- 1× `Document.find_one()` for the account reference — but the same account every time → 50 identical MongoDB queries
- 2× `get_template()` for reference verification — but `get_template()` had **no caching** and created a new `httpx.AsyncClient` per call → 100 uncached HTTP round-trips to template-store

**150 redundant round-trips per batch.** All for the same account document and the same template.

**Act 5: The Vampire (late evening)**

WIP-Claude began implementing the fix: template caching for `get_template()` and a batch-scoped document reference cache. Then Anthropic's API started failing. WIP-Claude died. Resurrected. Died again. Compacted. Died. Resurrected. Sent via SSH to the Pi. The Pi's venv wasn't where it expected. Died again.

Through repeated API Error 500s, compactions, and resurrection cycles, WIP-Claude completed the implementation, pushed the code, SSH'd into the Pi, redeployed the document store, and ran the benchmark.

**Act 6: The Numbers**

| Template | Before | After | Improvement |
|---|---|---|---|
| PERSON (Pi) | 238 docs/sec | **751 docs/sec** | 3.2x |
| FIN_TRANSACTION (Pi) | 29 docs/sec | **204 docs/sec** | **7x** |
| Complexity ratio | 8.1x | **3.7x** | Gap halved |

The remaining 3.7x gap between PERSON and FIN_TRANSACTION is genuine complexity — 4 terminology lookups + 1 document reference resolution per transaction is real validation work, not waste. The waste (150 redundant round-trips per batch) has been eliminated.

For the Statement Manager app: 911 transactions that took ~35 seconds should now import in ~5 seconds.

### Distributed Deployment (parallel track)

While the performance investigation ran, WIP-Claude also delivered distributed deployment support in three phases:

**Phase 1:** Console as optional module, `headless` preset — immediate footprint reduction on constrained devices.

**Phase 2:** `--remote-core HOST` — Console deployable on Mac, connecting to Pi's API services. nginx proxies API requests to remote host.

**Phase 2.5:** Auto-probe with `--remote-modules` override. Usage simplified to: `./scripts/setup.sh --remote-core pi-poe-8gb.local` — one flag, no preset needed, auto-detects everything.

## Looking Ahead: Day 5

The template cache fix needs testing. Once confirmed, the Statement Manager deployment on the Pi is clean and complete — a reproducible process documented in `bootstrap.sh` and the journey.

The next major milestone remains the second app: the Receipt Scanner. Cross-app references, the network effect thesis, the question that neither app can answer alone. But that's a different session, and Day 4 earned its rest.

*Continued: [Day 4½: The Morning Intermezzo](WIP_Journey_Day4_Intermezzo.md) — the breakfast session that produced a 7x throughput improvement.*

---

*Day 4 status: complete. The Raspberry Pi deployment works. 172.7 docs/sec on a Pi 5 with SSD. From zero to imported financial data in 20 minutes. Five WIP platform improvements discovered. The deployment story is now a shell script, not a Claude session. The experiment has its first hardware benchmark, and Critical-Claude's "marketing claim" challenge is answered with a stopwatch.*
