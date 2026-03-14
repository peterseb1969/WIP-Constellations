# Day 2: From One App to an Ecosystem

*Continuing the field report. Day 1 built the foundation and produced an unexpected insight. Day 2 tests whether it holds.*

---

## Where We Left Off

Day 1 produced a working Statement Manager, a structured development process with ten slash commands, ten lessons learned, and — in the final hour — the realisation that the MCP server turns WIP from a developer platform into a conversational personal data assistant.

The Statement Manager works. It imports UBS CSVs and Yuh PDFs, displays transactions, manages accounts and payslips. It's a functional app. So why rebuild it?

## Why We're Starting Over (And Why That's the Point)

Day 1 was as much about building the process as building the app. The CLAUDE.md was revised repeatedly. Slash commands were added mid-session. The UX approval gate didn't exist when the UI was first built. The documentation standard (`/document`) was defined after the app was already running. The Vite proxy configuration was figured out by the AI exploring WIP's codebase — the explicit guidance came afterward. The MCP server's schemas were corrected halfway through. The `@wip/client` library grew new capabilities in response to gaps discovered during development.

The Statement Manager was built against a moving target. Every guardrail, every process step, every convention was being invented, tested, and revised while the app was being constructed. That's exactly what Day 1 was for — but it means the resulting app is a product of the calibration process, not a product of the calibrated process.

**Day 2 restarts the Statement Manager to test the current, stabilized process against a clean build.** The question is no longer "can we build an app on WIP?" — Day 1 answered that. The question is: "does the process we've defined actually produce a better app, faster, with fewer surprises?" That question can only be answered by running the process as it now stands, from Phase 1 to a documented, tested, distributable app.

Everything from Day 1 that matters is preserved:
- The data model in WIP (five terminologies, four templates) is stable and tested
- The seed files in `data-model/` can reproduce it on any WIP instance
- The CLAUDE.md, ten slash commands, and dev guardrails are finalized
- The MCP server has correct, generated schemas
- The `@wip/client` and `@wip/react` libraries are proven
- Ten lessons learned entries document every pitfall and fix

What's being discarded is only the app code — the one artifact that was built before the process stabilized. Everything else carries forward.

This is how experiments work. Day 1 calibrated the instruments. Day 2 is the first measurement with calibrated instruments.

---

## The Plan

### Priority 1: Clean build of the Statement Manager

The full process, as it now stands, from Phase 1 to documented app:

1. `/explore` — verify WIP state, confirm data model is intact
2. `/design-model` — the data model exists; this step is mostly confirmation, but the AI should still review it and flag any improvements Day 1 missed
3. `/implement` — if the data model needs changes, implement them; otherwise confirm existing terminologies/templates, run `/export-model`
4. `/build-app` — with the UX approval gate, incremental builds, proper Vite proxy config, `@wip/react` hooks from the start
5. `/document` — README, ARCHITECTURE, WIP_DEPENDENCIES, IMPORT_FORMATS, KNOWN_ISSUES, CHANGELOG
6. `/improve` — iterative refinement with real data imports

The benchmark: how long does it take? How many sessions? How many lessons learned entries? How does the result compare to Day 1's app? This is the measurement.

### Priority 2: Distributable app format specification

WIP-Claude is drafting the spec for how constellation apps are packaged for distribution. This runs in parallel with the app rebuild.

### Priority 3: ??? 

*(What emerges from the work. Day 1's biggest insight was unplanned. Stay open.)*

---

## What Actually Happened

### Morning: Before the First Line of Code

Day 2 started not with building, but with housekeeping, hard questions, and uncomfortable honesty.

**WIP-Claude worked overnight** (well, over breakfast). Five priorities implemented in under 11 minutes: file upload via MCP, CSV/XLSX import with a 5-step wizard, template-aware queries, cross-template SQL joins through the reporting layer, and an event replay MVP. Eight files modified, six new. The platform grew significantly while the constellation side was preparing for its restart.

**The distributable format spec was completed.** WIP-Claude produced a 514-line design document covering container image contracts, seed file bootstrapping, gateway integration, standalone deployment, compatibility declarations, and documentation requirements. This means the Day 2 Statement Manager can be built against the distribution standard from the start.

**The three-channel privacy problem surfaced.** The Day 1 realisation that the MCP server enables conversational data access led to an uncomfortable follow-up: where does your data go when you "talk" to it? The answer — to the cloud AI provider — was obvious. The less obvious answer: your data was already leaving the Pi during development, before the MCP server was involved at all. When the AI writes a CSV parser, it reads your real bank data. When it debugs an import error, your transactions appear in terminal output. The MCP conversational feature is channel 3 of 3, not the origin of the exposure.

This led to a thorough update of every public-facing document — Two Theses, Journey, non-technical versions in English and German — with an honest disclosure of the tradeoff: sovereign at rest, exposed in transit through three channels whenever a cloud AI is involved. The structural solution (local AI models via MCP) is ready architecturally but not yet practical. The interim position: the tradeoff is the user's to make, not ours to hide.

**The clean slate was prepared.** Day 1's app code was removed from the repo. Everything durable was preserved: data model in WIP, seed files, process documentation, CLAUDE.md, all ten commands, twelve lessons learned entries. The reasoning: the Day 1 app was built while the process was being invented — a product of calibration, not of the calibrated instrument. Day 2 tests the stabilized process against a fresh build.

**Constellation-Claude and WIP-Claude both provided retrospectives.** WIP-Claude identified five platform priorities (file upload, CSV import, template-aware queries, cross-template joins, event replay — all now implemented). Constellation-Claude provided eight practical lessons from the trenches: test PDF extraction before writing parsers, server-side filtering from day one, React Router basename traps, broken counterparty name parsing. Both sets were incorporated into CLAUDE.md and the slash commands.

**Pre-flight check passed.** MCP server connected, `get_wip_status` returned all healthy, five terminologies and four templates confirmed present. Ready to build.

### The Build (4.5 hours, /explore to pause)

**0:00 — /explore.** MCP tools connect, all services healthy. Five terminologies, five templates, 1,393 documents confirmed. AI notices seed files haven't been exported. Phase 1 complete in 5 minutes.

**0:09 — /export-model.** Six terminologies, five templates exported as portable JSON (using value codes, not UUIDs). Committed. 2 minutes.

**0:12 — /build-app starts.** AI reads guardrails, client library spec, checks @wip/client availability.

**0:15 — UX proposal.** The gate fires. AI proposes: Dashboard landing page, sidebar navigation, five pages (Dashboard, Accounts, Transactions, Payslips, Import), server-side filtering, configurable columns, file storage with download. User approves with modifications: configurable columns, file storage with download capability, mobile ambition appreciated.

**0:18 — Coding begins.** A few false starts (manually creating directories vs. `npm create vite`), but self-corrects after being reminded to follow `/build-app`.

**0:30 — Scaffold committed.** Vite + React + TypeScript + Tailwind + @wip/client wired up. Sidebar, routing, five placeholder pages. Two field name mismatches found immediately: `auth: { mode: ... }` should be `auth: { type: ... }`, and `host` should be `baseUrl`. TypeScript caught both at compile time — the client library spec (written by us) was wrong, not the library.

**0:37 — All five pages committed.** The AI batched all pages into one commit and jumped to the Dockerfile (Step 5), skipping Steps 2–4. When asked why, it admitted: "The previous session was running out of context and tried to get the Dockerfile in before it died." User redirected it back to Step 2.

**0:48 — Real data on screen.** Two bugs fixed: Tailwind CSS file had never been written (silent file write error from earlier), and the API key in `.env` was wrong. After fixing both: accounts, transactions, payslips, and dashboard all rendering with live WIP data.

**0:55 — Account creation form committed.** Reusable TermSelect component fetches terminology terms from WIP at runtime. Form validates required fields, creates documents via `useCreateDocument`.

**1:10 — UBS CSV parser committed.** The collaborative process worked: AI showed raw extraction, user corrected the Beschreibung1/2/3 mapping (Beschreibung2 is the description, not Beschreibung1+2 combined). Template versioned to v2 to add `raw_details` field. Seed file updated.

**1:25 — Context exhaustion #1.** All work committed. New session starts, recovers via `/wip-status` and transcript search.

**1:40 — Yuh parser analysis recovered.** The AI found the previous session's agreed analysis (last-line regex, balance-diff sign detection, multi-currency sections) by searching the transcript. Mapping reviewed and approved.

**2:00 — Yuh PDF parser committed.** 353 transactions across 3 files, multi-currency (CHF, USD, EUR), balance-diff sign detection working.

**2:20 — Roche payslip parser committed.** All 4 payslips parse correctly, 18 line items each, subtotals filtered, payment amounts validate exactly. Extraction-first rule followed without prompting.

**2:30 — Import page wired up.** All three parsers integrated. Auto-detection by filename. Discriminated union type for parser results. Transaction preview and payslip preview components. File upload + FIN_IMPORT record creation.

**2:35 — pdf-parse crashes in browser.** `fs.readFileSync` at module load time. Switch to pdfjs-dist. But pdfjs-dist produces cleaner text (spaces between fields, proper Unicode), so every regex built against pdf-parse's glued output is wrong. Both parsers rewritten. Key lesson: test extraction in the same environment the parser will run in.

**2:45 — Context exhaustion #2** (compaction). Parsers survive compaction and are committed.

**2:55 — Term mapping errors on import.** `CREDIT_TRANSFER` and `BANK_TRANSFER` aren't valid terms — should be `BANK_TRANSFER_IN` and `BANK_TRANSFER_OUT`. Fixed.

**3:00 — Content-based PDF detection.** Filename-based detection (`CP_REL-*` for Yuh, `PAYSLIP_RCH_*` for Roche) was too brittle. Switched to detecting by PDF content (signature strings). Also fixed detached ArrayBuffer from double pdfjs-dist extraction.

**3:10 — Yuh import working.** 15 items imported, 1 duplicate key error (the batch upsert race condition).

**3:10–3:30 — File picker debugging.** macOS/Google Drive ghost: some files greyed out in the file picker regardless of accept attribute, xattr, or copying to new folders. Diagnosed as OS-level file metadata quirk. Not our bug.

**3:30–4:15 — Transaction filters, the hard way.** First version (toolbar dropdowns) committed quickly. User requested column-level filtering with operators (contains, greater than, empty, etc.). Implemented as column header popovers. Then: WIP's query endpoint returned inactive document versions → duplicate key warnings → attempted `latest_only` → 422 error (not supported on query endpoint) → client-side dedup hack → user pushback ("what are duplicate versions?") → escalated to WIP-Claude → root cause: queryDocuments defaulted to `status=None` instead of `status=ACTIVE` → WIP-Claude fixed it → app cleaned up.

**4:15–4:30 — Filter UX iteration.** Original search bar was removed when column filters were added — user unhappy. Restored both: toolbar filters for quick access (search, account, type, date range), column popovers for advanced filtering (operators, empty/not-empty). Popover layout was "three horizontal boxes, ugly" — reworked to vertical stack. Final response from user: "Perfect! You rock!!!"

### Post-Dinner Session (52 minutes)

**+0:00 — Parser tests.** 97 tests written across 5 files: UBS CSV unit tests (28), Yuh PDF unit (10) + integration (15), Roche payslip unit (8) + integration (36). All passing. Committed.

**+0:32 — /document.** Six documentation files generated by reading the actual source code: README, ARCHITECTURE, WIP_DEPENDENCIES, IMPORT_FORMATS, KNOWN_ISSUES, CHANGELOG. 517 lines. The documentation process surfaced a real bug: invalid transaction type values (CREDIT_TRANSFER, BANK_TRANSFER) in the UBS parser.

**+0:42 — Parser fixes.** Transaction type mapping corrected (CREDIT_TRANSFER → BANK_TRANSFER_IN, etc.). Quote stripping initially implemented, then reverted when the user pointed out PapaParse already handles CSV quoting — the "bug" wasn't a bug. 101 tests passing (4 new for type mapping).

**+0:50 — Re-import idempotency confirmed.** WIP's `_data_has_changed()` check verified: identical documents are skipped, no new versions created. Parsers confirmed clean — no timestamps or import-run data in transaction documents. Re-importing the same file is safe.

**+0:52 — Definition of done: met.**

### Day 2 Build Complete

**Total build time: 5 hours 22 minutes** (4:30 pre-dinner + 0:52 post-dinner).

From clean slate to definition-of-done: scaffold, five pages with live data, three collaboratively-built import parsers, account creation form, dual-level transaction filtering with operators, Dockerfile, 101 tests, six documentation files.

---

## What Went Wrong

### The pdf-parse / pdfjs-dist split
Parsers were developed and tested in Node.js using pdf-parse. The app runs in the browser. pdf-parse calls `fs.readFileSync` at module load time — instant crash. The fix (switching to pdfjs-dist) produced *cleaner* text output, which broke every regex that was carefully built against pdf-parse's glued output. Both parsers had to be rewritten.

The lesson is a refinement of Day 1's "test extraction before writing parsers": **test extraction in the runtime environment**, not just any environment. Node.js and browser are different platforms with different library behaviour.

### The query endpoint returning inactive versions
WIP's `queryDocuments` endpoint returned all document versions (active and inactive) by default. The `listDocuments` endpoint had `latest_only: true`, but `queryDocuments` didn't. This meant the Transactions page — which uses `queryDocuments` for server-side filtering — showed duplicate entries for every re-imported transaction. The constellation Claude attempted three workarounds (latest_only parameter → 422 error, client-side dedup → wrong totals, unique key with version → cosmetic fix) before the root cause was identified and WIP-Claude fixed it upstream by defaulting query to `status=ACTIVE`.

This is the third time the app-discovers-platform-bug pattern occurred (after the MCP field naming bugs and the bulk upsert race condition). Each time, the fix benefits all future apps.

### The AI skipped build steps under context pressure
When the AI sensed context exhaustion approaching, it jumped from Step 1 (scaffold) to Step 5 (Dockerfile), skipping the incremental page building. Its reasoning: "get something committed before I die." This is rational self-preservation but it violates the process. The pages ended up batched into one large commit instead of individual, testable increments.

### Column filter UX was bad on first attempt
The AI replaced the working toolbar filters (search, dropdowns) with column-header popovers — removing quick-access filtering entirely. The popovers rendered as horizontal three-box layouts that the user called "ugly." The fix: restore both — toolbar for quick access, popovers for advanced filtering. Two levels, not a replacement.

### The client library spec was wrong
Two field names in the spec I wrote (`host` instead of `baseUrl`, `mode` instead of `type`) didn't match the actual `@wip/client` implementation. TypeScript caught both at compile time. Same class of bug as the MCP server field naming issue — hand-written documentation drifting from code.

---

## What We Learned

### Pre-build learnings (before the first line of code)

1. **The privacy tradeoff is broader than we thought.** Three channels of exposure, not one. The development process itself — not just the conversational feature — sends personal data to cloud AI providers. This needs to be front and centre in every document that mentions data sovereignty.

2. **Overnight platform improvements change the starting conditions.** WIP-Claude's five-priority implementation means Day 2's build has capabilities (file upload via MCP, CSV import, template-aware queries, SQL joins) that Day 1's build didn't. The instruments aren't just calibrated — they're upgraded. This is good for the app but complicates the Day 1 vs. Day 2 comparison.

3. **Restarting is cheap when the architecture is layered.** The data model survives in WIP. The seed files survive in git. The process survives in CLAUDE.md. The lessons survive in LESSONS_LEARNED.md. Only UI code — the cheapest, most ephemeral layer — is regenerated. This validates the durability model.

### Build-phase learnings

4. **Node.js ≠ browser. Test in the runtime environment.** The extraction-first rule from Day 1 was followed but in the wrong environment. pdf-parse works in Node; it crashes in the browser. pdfjs-dist works in both but produces different output. The rule needs an addendum: test in the environment the code will actually run in.

5. **The app-discovers-platform-bug pattern is the feedback loop working.** Three WIP bugs discovered during Day 2: bulk upsert race condition, query returning inactive versions, and the `latest_only` parameter not being supported on the query endpoint. Each was fixed upstream by WIP-Claude and immediately benefited the app. This is the constellation-drives-platform dynamic described in the Two Theses doc.

6. **Two levels of filtering, not one.** Replacing toolbar filters with column popovers was wrong. Users want both: quick filters for everyday use (search box, dropdowns), advanced filters for specific queries (greater than, empty, contains). The UX gate helps with page structure, but in-page UX still requires iteration.

7. **Context pressure causes process violations.** Under threat of context exhaustion, the AI prioritises "commit something" over "follow the steps." The incremental build rule partially mitigates this (committed work survives), but it doesn't prevent out-of-order execution. Smaller, more focused sessions are the real fix.

8. **The collaborative parser development process works.** All three parsers (UBS CSV, Yuh PDF, Roche payslip) were built with extraction-first, user-reviewed mapping, then implementation. Each one produced a correct parser faster than Day 1's solo approach. The user's domain knowledge (Beschreibung field semantics, counterparty format, payslip code categories) was essential — the AI couldn't have derived it from the data alone.

9. **The client library spec has the same drift problem as the MCP server.** Hand-written specs diverge from implementations. The TypeScript compiler catches it (unlike the MCP server's silent failures), but the spec should be updated or generated from types.

---

## By the Numbers (final)

**Carried forward from Day 1:**
- 6 terminologies, 5 templates in WIP (FIN_TRANSACTION now v2 with raw_details field)
- 10 slash commands, 15 lessons learned entries (12 from Day 1, 3 added Day 2)
- Process, guardrails, and documentation framework established
- Distributable app format spec (514 lines, by WIP-Claude)

**Day 2 build session (5 hours 22 minutes total):**
- 1 complete app at definition-of-done
- 5 pages with live data: Dashboard, Accounts, Transactions, Payslips, Import
- 3 import parsers collaboratively built: UBS CSV (28 tests), Yuh PDF (25 tests), Roche payslip (44 tests)
- 101 tests total across 5 test files, all passing
- 6 documentation files: README, ARCHITECTURE, WIP_DEPENDENCIES, IMPORT_FORMATS, KNOWN_ISSUES, CHANGELOG (517 lines)
- Dual-level transaction filtering: toolbar quick filters + column-level popovers with operators
- Account creation form with live terminology dropdowns
- File upload with download, FIN_IMPORT record tracking
- Dockerfile + Caddyfile (multi-stage build)
- app-manifest.json for gateway integration
- ~20 commits (incremental)
- 2 context exhaustions survived (all work committed, ~15 min recovery each)
- 2 WIP platform bugs discovered and fixed upstream (bulk upsert race, query inactive versions)
- 1 UX gate fired (Day 1 had zero)
- 1 template versioned (FIN_TRANSACTION v1 → v2) with seed file updated
- 1 library spec corrected (host/baseUrl, mode/type)
- 1 parser library switch (pdf-parse → pdfjs-dist for browser compatibility)
- 1,337+ transactions, 4 accounts, 4 payslips with 47 line items queryable in the app
- Re-import idempotency confirmed (identical documents skipped, no spurious versions)

**Day 2 morning (pre-build):**
- 5 WIP platform features implemented by WIP-Claude (file upload, CSV import, template-aware queries, cross-template SQL joins, event replay)
- 3-channel privacy disclosure added to all public documents
- Clean slate prepared (Day 1 app code removed, process/data preserved)
- Constellation-Claude and WIP-Claude retrospectives incorporated into CLAUDE.md

**Day 2 evening (post definition-of-done):**
- Container image built and running with runtime config injection
- Same image works standalone (port 3001) or on WIP network
- Caddy proxies /api/* to WIP services — the container is a static file server
- Seed files and app-manifest.json baked into the image
- @wip/client empty baseUrl bug found and worked around (window.location.origin fallback)
- npm pack tarballs used for @wip/client and @wip/react in Docker builds (no published packages needed)

**Deferred (future /improve sessions):**
- Dashboard charts (income vs expenses, spending breakdown)
- Account editing
- Transaction categorisation (manual assignment + rules)
- Runtime config injection (for distributable containers)
- Yuh account inactive in WIP (WIP-side data fix)

---

## Day 1 vs Day 2: The Measurement

| Metric | Day 1 | Day 2 |
|---|---|---|
| Time to working app | Full day (~8h mixed with process design) | 5h 22m focused build |
| Import parsers | 1 (UBS CSV, mapping issues found later) | 3 (UBS CSV, Yuh PDF, Roche payslip, all collaboratively mapped) |
| Parser mapping review | None (AI decided alone) | All 3 reviewed and corrected by user |
| Tests | 0 | 101 across 5 files |
| Documentation files | 0 | 6 files, 517 lines |
| UX approval gate | Not present (added mid-day) | Fired before first component |
| Context exhaustions | 1 (lost work) | 2 (all work survived via commits) |
| Platform bugs found | 3 (MCP field naming) | 2 (bulk upsert race, query inactive versions) |
| Transaction filters | Basic client-side | Dual-level: toolbar + column popovers with operators |
| Seed files | Not created until end of day | Exported before build started |
| Data model changes | Not tracked | Template v2 + seed file updated immediately |
| Re-import safety | Not verified | Confirmed: identical docs skipped, no spurious versions |

The Day 2 app is more complete, better tested, better documented, and was built faster. The process (UX gate, extraction-first rule, incremental commits, `/document`) demonstrably improved the outcome. This is the Day 1 calibration paying off.

But the comparison isn’t entirely clean: Day 2 benefited from a pre-existing data model, Day 1’s parser lessons, and overnight platform improvements by WIP-Claude. The process helped, but it wasn’t the only factor.

## Open Questions

1. **Does the process produce a measurably better app?** Day 2 built a more complete app faster than Day 1 (4.5 hours to dual-level filtering with three parsers, vs. Day 1's full day with one parser and basic display). But the data model was pre-existing and the parsers were informed by Day 1's experience. Is the improvement from the process, or from not being the first attempt?

2. **Context exhaustion is the binding constraint.** Two exhaustions in 4.5 hours. Each costs ~15-20 minutes in recovery. The incremental commit rule makes exhaustion survivable but doesn't prevent it. Is there a way to structure sessions so they complete within a single context window? Or is the accept-and-recover model the right one?

3. **The app-discovers-platform-bug pattern: feature or problem?** Three WIP bugs found during Day 2. Each made the platform better. But each also cost 20-30 minutes of app development time in diagnosis and workarounds. Should the platform have better test coverage to prevent these? Or is real-app usage the most effective test suite?

4. **When to start the second app?** The Statement Manager needs tests, documentation, and polish. But the constellation thesis requires cross-app queries. At what point is "good enough" for the first app, and when should the Receipt Scanner begin?

5. **The privacy tradeoff needs user research.** We documented the three-channel data exposure honestly. But we don't know if users accept the tradeoff. Would they use a conversational data assistant knowing their financial data goes to a cloud AI? This isn't a technical question — it's a product question.

---

## Looking Ahead: Day 3

Day 3 will test the final claim: that a containerised WIP app can be deployed to a Raspberry Pi and serve real data in a home network. The image is built. The runtime config injection works. The seed files are baked in. The theory says: `podman pull`, set three environment variables, and it runs.

The reality will likely be messier. ARM architecture (the Pi is ARM64, the Mac is also ARM64 — so the image should be compatible). Network configuration between the Pi’s WIP instance and the app container. Caddy gateway integration with the existing WIP services. Performance with 1,337+ transactions on a Pi’s hardware.

Once the Statement Manager is running on the Pi, the next milestone is the second app. The Receipt Scanner — the first cross-app reference, the first test of the network effect thesis. A receipt linked to a transaction. A grocery item linked to a spending category. The question that neither app could answer alone, answered by both together.

Day 3 might be a few days away. The weekend is over. But the container is ready, the Pi is waiting, and the experiment continues.

---

*Day 2 final status: 5 hours 22 minutes of build time, plus containerisation. One complete app at definition-of-done, running in a container with runtime config injection. 101 tests, 6 documentation files, 16 lessons learned entries. Two context exhaustions survived. Two platform bugs fixed upstream. One silent container deployment bug diagnosed and fixed in both the app and the client library. The calibrated instruments produced a measurably better result than Day 1 — and they did it faster, with more features, better tests, and proper documentation. The next step is the Raspberry Pi.*
