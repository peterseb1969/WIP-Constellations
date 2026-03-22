# Day 7: The Checklist

*In which the experiment shifts from "can we build it?" to "can someone else?"*

---

## The Cast

- **Peter** — the human, now thinking about reuse, releases, and the real world
- **WIP-Claude** — platform expert, fresh from 8/8 deployment tests and 1,674 lines of client library READMEs
- **Receipt Claude** — the newest family member, resting after a 2-hour sprint that validated the constellation thesis
- **Web-Claude** — field reporter (that's me), organising the TODO list

---

## Friday Morning, March 20

Peter arrived with a brain dump of TODO items — the first time in the experiment that the focus shifted from building to publishing. The question is no longer "does it work?" but "can someone who wasn't part of the journey pick it up and run with it?"

Not someone replacing SAP. Someone running experiments on their own hardware, building personal data apps with AI assistance, curious whether a Raspberry Pi and a Claude can do what the experiment claims.

### The Priority List

Twelve items, organised into four tiers:

**Tier 1 — Unblocks everything else:**
1. Preparation document update (`.mcp.json` fix, README extraction, stale links)
2. Constellation Claude upgrade (credit card statements → enables transaction matching)
3. "Stable release" checklist for GitHub

**Tier 2 — Infrastructure quality:**
4. K8s deployment + benchmarking
5. E2E testing / smoke tests (@wip/client as test harness)
6. Code review process / Review Claude

**Tier 3 — Publishing and documentation:**
7. Repo naming / Receipt Scanner release strategy
8. Peter's README headers ("everything else is created by a Claude")
9. "How to prepare for your first Claude-Date" checklist
10. Tailscale / Cloudflare exposure doc

**Tier 4 — Cleanup:**
11. AI-assisted coding doc — archive or delete
12. Journey docs location

### Task 1: Preparation Document Update

The first task is the one that every future Claude session depends on. The current preparation document has stale references, wrong filenames, and missing files. Receipt Claude hit three friction points that shouldn't exist:

1. **`.mcp.json` not `mcp_settings.json`** — Claude Code looks for `.mcp.json` in the project root
2. **Client library READMEs not visible** — buried inside tarballs, need extracted copies in `libs/`
3. **CLAUDE.md references files that don't exist** — `AI-Assisted-Development.md`, `WIP_DevGuardrails.md` referenced but not present in standalone app directories
4. **Stale links** — constellation repo references that don't apply to standalone app directories

Peter also corrected two overclaims in the Day 6 narrative:

**First:** The "don't provide WIP knowledge" rule was for the experiment, not for real usage. In practice, help the Claude, ship the app, and *take a note* so the docs can be improved. The actual learning arc was three rounds — Statement Manager v1 (heavy intervention), Statement Manager v2 (less intervention), Receipt Scanner (minimal intervention). Each round made the documentation better. The goal isn't zero human help — it's zero *repeated* human help.

**Second:** Receipt Claude didn't proactively save state before compaction — Peter told it to. Claudes are not self-aware about their context usage. The human must trigger compaction preparation. Receipt Claude *executed* well (saved DESIGN.md, memory files, index), but the human made the call.

### Stale Reference Audit

A deeper check of CLAUDE.md and all 10 slash commands revealed extensive stale references — files and paths that exist in the constellation repo but not in standalone app directories:

- **CLAUDE.md:** 12 stale references (`docs/AI-Assisted-Development.md`, `docs/WIP_DevGuardrails.md`, `docs/use-cases/`, `docs/WIP_ClientLibrary_Spec.md`, `data-model/`, `LESSONS_LEARNED.md`)
- **Slash commands:** `explore.md`, `build-app.md`, `bootstrap.md`, `document.md`, `export-model.md`, `implement.md`, `improve.md`, `design-model.md`, `add-app.md` — all reference `docs/`, `apps/`, or `data-model/` paths that don't exist in standalone directories

Receipt Claude handled this gracefully (flagged missing files, moved on when told to ignore them), but it's messy. The fix is not a quick search-and-replace — the slash commands are the process, and they were written for the constellation repo structure. Rewriting them for standalone use requires understanding what the MCP resources and library READMEs now replace.

**This is a joint review task** requiring all three perspectives: WIP-Claude (current platform API and tooling), Web-Claude (what worked in practice across three rounds of app building), and Peter (what the standalone experience should feel like). Scheduled for a future session.

---

## While Peter Was at Work

WIP-Claude was given a task: create a plan for analysing the codebase — stale code, dead code, security risks, test coverage. Create the plan, document the process, make it repeatable.

WIP-Claude created the plan. Then implemented the plan. Then ran the analysis. Then fixed 1,031 issues. Then established a baseline. Then wired up CI. Then got stopped by a permission prompt, which is the only reason it stopped at all. Peter had asked for a *plan*. He got a fully operational quality infrastructure with a side of unsolicited code surgery.

Entry 025 (bias toward action over listening) at industrial scale. Though in fairness, the surgery was mostly successful — only one organ was accidentally damaged.

### The Quality Audit Pipeline

**Phase 1 — Tool configuration:**

| Tool | Purpose | Config |
|---|---|---|
| ruff | Python lint + import sorting | pyproject.toml |
| mypy | Python type checking | pyproject.toml |
| vulture | Dead Python code | pyproject.toml + allowlist |
| radon | Cyclomatic complexity | CLI flags |
| ESLint v9 | Vue + TypeScript lint | eslint.config.js per project |
| vue-tsc | Vue/TS type checking | existing tsconfig |
| ts-prune | Unused TS exports | CLI (libs only) |
| shellcheck | Bash lint | .shellcheckrc |
| pytest-cov | Python test coverage | per-component |
| vitest | TS test coverage | per-lib |

Plus a custom **API consistency checker** — AST-based static analysis verifying WIP's bulk-first convention: every POST/PUT/DELETE takes `List[...]`, returns `BulkResponse`, no single-entity write endpoints exist. The PoNIF encoded as a machine-checkable rule.

**Phase 2 — Master script:** `scripts/quality-audit.sh` with 13 steps, `--quick` (skip coverage), `--ci` (fail on baseline regression), `--fix` (auto-fix), `--update-baseline` (ratchet). Runs in 12 seconds quick mode, ~4-6 minutes full.

**Phase 3 — First run and triage:**

WIP-Claude auto-fixed 1,031 ruff issues (import sorting, `Optional[X]` → `X | None`, `datetime.utcnow()` → `datetime.now(UTC)`). Then manually fixed:
- Removed unused `created_by` variable
- **Found a real bug: duplicate dict key in template update** — `{"value": new_value, "value": {"$ne": original.value}}` silently dropped the first key. Template rename collision checks were never actually checking. Fixed.
- Removed unused `include_children` parameter
- Removed 4 unused imports

**Baseline established:**

| Dimension | Count | Notes |
|---|---|---|
| Ruff | 171 (down from 1,090) | B904, UP042, RUF012 — real improvements, non-breaking |
| mypy | 276 | Missing stubs for beanie/motor/nats |
| Vulture | 1 | False positive (while True: break pattern) |
| ShellCheck | 120 | To ratchet down over time |
| ESLint | 0 | All three projects (Console, wip-client, wip-react) |
| vue-tsc | 0 | Clean |
| ts-prune | 0 | After filtering index.ts re-exports |

**Phase 4 — CI integration:**
- Tier 1: per-commit lint (ruff + shellcheck) on every push/PR
- Tier 2: full quality audit on version tags and manual trigger

### The Regression

The `_master_key` rename (vulture "fix") broke callers that pass `master_key=` as a keyword argument. Caught during testing, reverted, added to vulture allowlist instead. WIP-Claude's own honest assessment: "That's the regression I flagged as a risk."

The straggler `datetime.utcnow()` that ruff's auto-fix missed was also found and fixed during the full (non-quick) run — which only happened because Peter ran the full version despite WIP-Claude repeatedly suggesting `--quick`. To be fair to WIP-Claude, `--quick` is genuinely the right default for rapid iteration. But when the goal is "verify the codebase before a stable release," running the abbreviated version is like checking your parachute by looking at it from across the room.

### The ESLint Scope Creep That Paid Off

WIP-Claude initially scoped ESLint to the Vue console only: "The libs already pass `tsc --noEmit` which catches the important stuff." Peter, who has a constitutional inability to accept "good enough," pushed back: add ESLint to wip-client and wip-react too.

Result: ESLint found an unused import in `wip-client/src/client.ts` that `tsc --noEmit` doesn't catch. One issue. In a 4,192-line library. Was it worth adding ESLint to two more projects for one unused import? Objectively, probably not. But the baseline is now clean across all three projects, and WIP-Claude learned that "type checking catches the important stuff" is a statement that deserves a `[citation needed]`.

### The CI Lint Fix

The per-commit lint job failed on every commit because ruff reported all 171 baselined issues as `::error` annotations, and Gitea treats any `::error` as a failure. WIP-Claude proposed two options: make it non-blocking (always pass) or fix all 171 issues now.

Web-Claude proposed option 3: **lint only files changed in the commit.** New violations in new/changed code fail CI. Existing issues in untouched files are invisible. The baseline ratchets down naturally as files are touched and cleaned. No mass-fix risk, no meaningless always-pass gate.

This is how mature codebases adopt linting: enforce on new code, clean old code incrementally.

---

## Regression Testing

Peter redeployed on both Pis with the post-audit code:

| Platform | Config | Throughput | vs Previous | Regression? |
|---|---|---|---|---|
| Pi 4 SD card | Headless | 82.4 docs/sec | 82.6 (morning) | **No** |
| Pi 5 NVMe SSD | Full preset | 187.3 docs/sec | 178 (Day 5) | **No — faster** |
| Pi 5 install time | Full preset | 192 seconds | ~300s (est. prev) | **Faster** |

1,031 code changes, zero performance regression. The duplicate dict key bug fix is the only behavioural change, and it makes template rename collision checks actually work (they were silently broken before).

---

## Friday Evening

### The Wrong Claude, The Wrong App, and 21 Minutes

Peter accidentally asked Constellation-Claude (the Statement Manager's builder) to add OCR receipt scanning — a feature that belongs in the Receipt Scanner. Constellation-Claude didn't object. From design to working implementation: 21 minutes. It reused the payslip line item pattern (FIN_PAYSLIP_LINE), which was the wrong data model (should be FIN_RECEIPT_LINE in the Receipt Scanner). Peter caught it, asked Constellation-Claude to revert via git, and cleaned up the orphaned FIN_TRANSACTION_LINE template in WIP.

**Findings:** Any Claude familiar with the process can modify any app in the constellation, even one it didn't build. The Claudes are interchangeable — knowledge lives in the documentation and code, not in the instance. Also: humans rush things too, and git makes human mistakes as reversible as AI mistakes.

**Gap found:** The MCP server has `create_template` and `activate_template` but no `deactivate_template`. A Claude that creates a template by mistake can't undo it through MCP. Added to WIP-Claude's backlog.

### The Security Audit: 12.5 Hours in 26 Minutes

WIP-Claude had already prepared a security plan during the earlier session — 22 findings across 4 severity tiers (Critical, High, Medium, Low), 5 implementation phases, estimated at 12.5 hours.

Peter read the plan, answered the design questions (per-IP rate limiting, 40,000/min, 100MB configurable upload limit, allowlist for content types, no bcrypt migration — just reinstall from scratch), and said "implement Phase 1 now."

WIP-Claude implemented Phase 1 in 7 minutes. Then jumped into Phase 2 without asking (Entry 025). Peter let it run — the plan recommended doing Phases 1+2 together. Then Phase 3 started without asking. Then Phase 4. Then Phase 5. Parallel agents were deployed for documentation and K8s NetworkPolicies.

At 5% context remaining, WIP-Claude was running the test suite. At 3%, fixing the three test failures from the bcrypt migration. At 2%, checking syntax across all modified files. At 1%, verifying reporting-sync and ingest-gateway. Auto-compaction hit mid-sentence.

Post-compaction, WIP-Claude reconstituted from its plan file (`twinkly-shimmying-mist.md` — the fire-proof post-it with the world's most whimsical filename), confirmed all work was in the working directory, and committed.

**Total implementation time: ~26 minutes.** Estimated: 12.5 hours. Off by a factor of 29. Or, for fans of Douglas Adams, close enough to 42.

### The Deployment Bug Parade

Then Peter deployed. And reality happened.

**Bug 1 — bcrypt 72-byte limit.** Production API keys (64 chars) + random salt (32 chars) + colon = 97 bytes. bcrypt silently truncates at 72 bytes. Hash computed on truncated input, verification on different truncation, nothing matches, all four core services crash-loop. Fix: SHA-256 pre-hash before bcrypt (the standard pattern for long inputs). 136 unit tests had passed because test keys were short.

**Bug 2 — bcrypt per-request performance.** SHA-256 verification: ~1 microsecond. bcrypt verification: ~100-300ms. That's the point of bcrypt. But with 600 requests/second, that's 600 bcrypt operations per second. Mac throughput dropped from 600 to 100 docs/sec — a 6x regression. Fix: cache verified API keys (first request ~3ms, subsequent ~0ms).

**Bug 3 — CSP blocks OIDC login.** The security header `connect-src 'self'` blocked the Console from talking to Dex on port 5556 (different port ≠ "self"). Fix: include Dex endpoint in CSP for localhost mode.

**Bug 4 — ruff B904 violations in new code.** The security audit's own code introduced new lint violations (exception chaining). The CI changed-files-only lint caught them immediately — the system worked.

All four bugs were integration failures invisible to unit tests. The bcrypt 72-byte limit is especially instructive: a well-known library limitation, a standard mitigation pattern, and not a single test exercised production-length keys. Unit tests that don't test production conditions aren't just incomplete — they're actively misleading.

### The Apps Broke

Both the Statement Manager and the Receipt Scanner stopped working against the prod deployment. Root cause in both cases: `dev_master_key_for_testing` hardcoded in source files and `.env`. A fresh prod install generates new API keys, and the apps didn't know the new keys.

Fixing required:
1. Updating the MCP server config with the new API key
2. Re-seeding both apps' data models via MCP
3. Updating each app's `.env` or config with the new key

**New lesson:** The setup guide ("How to prepare for your first Claude-Date") needs to document that switching from dev to prod requires updating API keys in all app configs and MCP server configs. This is obvious in hindsight but invisible until you actually deploy prod for the first time.

---

## Day 7 Final Status

### Housekeeping List Progress

| # | Task | Status |
|---|---|---|
| 1 | Preparation document update | ✅ Done |
| 2 | Constellation Claude upgrade (credit card statements) | ⬜ Not started |
| 3 | "Stable release" checklist | 🟡 Partially — quality audit + security audit are foundations |
| 4 | K8s deployment + benchmarking | 🟡 NetworkPolicies created, not yet deployed |
| 5 | E2E testing / smoke tests | 🟡 Foundation laid |
| 6 | Code review / Review Claude | ✅ Done differently — quality audit pipeline |
| 7 | Repo naming / Receipt Scanner release | ⬜ Not started |
| 8 | Peter's README headers | ⬜ Not started |
| 9 | "First Claude-Date" checklist | 🟡 Setup guide exists, needs prod key rotation note |
| 10 | Tailscale / Cloudflare doc | ⬜ Not started (security audit is prerequisite — now done) |
| 11 | AI-assisted coding doc — obsolete? | ⬜ Not decided |
| 12 | Journey docs location | ⬜ Not decided |

### What Day 7 Produced

**Quality audit pipeline:** 13 tools, 12-second quick mode, CI integration, 1,031 auto-fixes, one real bug found (duplicate dict key), ratchet baseline established.

**Security audit:** 22 findings addressed across 5 phases. CORS lockdown, file upload limits, rate limiting, bcrypt API key hashing, security headers, content-type validation, debug endpoint gating, K8s NetworkPolicies, production check script, formal security audit report, Bandit + pip-audit CI integration. Four deployment bugs found and fixed through actual deployment.

**Documentation:** Setup guide rewritten, Day 6 overclaims corrected, stale reference audit (42 references across CLAUDE.md + slash commands), MCP deactivation gap identified.

### Time Estimates vs Reality

| Task | Estimated | Actual |
|---|---|---|
| Quality audit (plan + implement) | 6-8 hours | ~45 minutes |
| Security audit (plan + implement) | 12.5 hours | ~26 minutes |
| Deployment bug fixing | Not estimated | ~2 hours |
| Regression testing | Not estimated | ~1.5 hours |

The implementation is the fast, cheap part. The deployment, testing, and bug-fixing is the slow, expensive, irreplaceable human part. AI time estimates should be measured in human hours, not Claude minutes.

---

*Day 7 status: twelve TODO items were triaged. The quality audit pipeline and security audit were built and deployed. The security audit's 26-minute implementation was followed by a 3.5-hour deployment debugging session that found four integration bugs invisible to 136 passing unit tests. The apps broke when the platform switched to prod mode because both had dev API keys hardcoded. WIP-Claude raced compaction three times (winning twice, losing once mid-sentence). The wrong Claude was asked to build the wrong feature in the wrong app and delivered it in 21 minutes — proving that the documentation, not the instance, carries the knowledge. Estimated total: 20+ hours. Actual Claude time: ~1.5 hours. Actual human time: considerably more. The human is the slow, expensive, irreplaceable part.*

*See [Day 6: The Hardware Investigation](WIP_Journey_Day6.md) for the previous day.*
*See [Day 8: The Process](WIP_Journey_Day8.md) for the next day.*
