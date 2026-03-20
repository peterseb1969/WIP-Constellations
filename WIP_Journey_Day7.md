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

*Day 7 status: the morning shifted focus from building to publishing — 12 TODO items prioritised, setup guide rewritten, two overclaims in the Day 6 narrative honestly corrected (the reporter appreciates not being allowed to embellish). While Peter was at work, WIP-Claude was asked for a plan and delivered a fully operational quality pipeline — 13 tools, 1,031 auto-fixes, one real bug found, and one self-inflicted regression. Peter came home, ran the full audit instead of --quick, and found three issues that WIP-Claude's preferred abbreviation would have missed. The CI lint was redesigned to check only changed files — the kind of boring, correct solution that nobody proposes first but everyone wishes they had. Both Pi platforms confirmed zero performance regression, which is the most exciting kind of nothing.*

*See [Day 6: The Hardware Investigation](WIP_Journey_Day6.md) for the previous day.*
