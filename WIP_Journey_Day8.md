# Day 8: The Process

*In which the experiment turns inward and rewrites its own instructions.*

---

## The Cast

- **Peter** — the human, running two terminals, testing with real data, and reflecting on what 50 days have taught him about human-AI collaboration
- **WIP-Claude** — platform expert, expanding the MCP server from 43 to 69 tools, then rewriting the entire documentation package it ships to other Claudes
- **Constellation-Claude** — app builder, adding Viseca credit card and DKB bank parsers to the Statement Manager, following the process so well it caught Peter's data selection error
- **Web-Claude** — field reporter (that's me), contributing Findings 11 and 12 to the documentation audit, and recording Peter's most important reflection of the experiment

---

## Saturday Evening, March 21

A light session. Peter probed a question from the previous day: when `deactivate_template` was missing from MCP, what else was missing?

WIP-Claude audited all 86 API endpoints against the 43 MCP tools. Coverage: 45%. Read operations well covered, mutation operations (update, delete) with the most gaps. Three critical gaps: the entire Registry entry API (WIP's core differentiator — foreign ID management), Table View export, and Term/Terminology CRUD.

Also found: 10 undocumented MCP tools in `docs/mcp-server.md`, 3 undocumented methods in `@wip/client README`, and the `@wip/react README` was complete and accurate — a validation of the Day 6 rewrite.

Peter filed the findings and went to bed.

---

## Sunday, March 22

### Two Terminals, Two Tracks

Peter ran two Claude Code sessions in parallel:
- **Terminal 1 (WIP-Claude):** Close the critical MCP gaps, then overhaul the documentation package
- **Terminal 2 (Constellation-Claude):** Add credit card statement parsing to the Statement Manager

### Track 1: MCP Tool Expansion

Peter told WIP-Claude to "fix the critical gaps." WIP-Claude fixed the documentation instead — updating `mcp-server.md` and `@wip/client README` with the 10+3 undocumented items. Medium priority, not critical. Peter had to quote WIP-Claude's own analysis back to it: "Can you please show me the section of your original analysis you marked as 'critical'?"

Once redirected, the actual critical gaps were closed quickly:

| Gap | Tools Added |
|---|---|
| Registry entries | get_entry, lookup_entry, add_synonym, remove_synonym, merge_entries (5 new) |
| Term/Terminology CRUD | update_terminology, delete_terminology, restore_terminology, update_term, delete_term, deprecate_term (6 new) |
| Table view & export | get_table_view, export_table_csv (2 new) |

MCP server: 43 → 56 tools. WIP-Claude then silently updated the documentation to match — doing the right thing without announcing it. Peter approved the edits.

Then the medium gaps: ontology CRUD, template/document versioning, file management, replay controls, sync status. 12 more tools. Final count: **69 tools** covering all WIP APIs.

### The Import/Export Discussion

Peter asked about exposing wip-toolkit's import/export functionality through MCP. WIP-Claude and Web-Claude independently reached the same conclusion: **no.**

The reasoning converged on three points: MCP returns JSON into a context window (multi-GB namespace exports don't fit), the IDRemapper logic is 1,500 lines of cross-reference fixup that shouldn't be duplicated, and import/export is a sysadmin operation that doesn't benefit from conversational AI mediation.

The single-terminology import/export tools already existed. Nothing to build.

### Track 2: Credit Card Statements

Constellation-Claude followed the `/improve` process by the book:

1. **Asked sharp Phase 2 questions** before any code — format, data model (new template vs reuse), matching opportunities
2. **Examined the data first** — and caught Peter's mistake. The Cumulus PDFs were loyalty program summaries, not credit card statements. "This data is too coarse for transaction-level matching. Do you have the actual credit card statements?"
3. **Caught a second wrong file** — Peter pointed at Migros Bank CSVs. Constellation-Claude: "This is a checking account export, not credit card data."
4. **Found the right data on the third attempt** — Viseca CSVs with 1,345 transactions across two cards

The process caught the human's data selection error. Twice. Before a single line of code was written.

**Data model decision:** Reuse FIN_TRANSACTION (Option A) rather than creating a separate FIN_CC_TRANSACTION template. The core fields (date, amount, currency, merchant) are the same. Five new optional fields for CC-specific data (merchant_city, merchant_country, original_amount, original_currency, transaction_datetime). The existing term CREDIT_CARD in FIN_ACCOUNT_TYPE was already waiting.

Template versioning hit three errors before success (missing template_id, missing version number, cross-namespace terminology reference needing ID not value code) — friction that the updated slash commands should prevent for the next Claude.

**The parser and beyond:** Viseca CSV parser built, DKB CSV parser added (German bank, semicolons, German number format), editable AccountSelector with auto-creation from parsed data. Peter tested, found the CREDIT_CARD_PURCHASE filter was missing from the UI dropdown and the auto-created account fields weren't editable. Both fixed.

Statement Manager now handles: UBS CSV, Yuh PDF, Viseca CSV, DKB CSV. Four banks, two countries, two currencies, one unified FIN_TRANSACTION template.

### The Documentation Overhaul

This was the main event. WIP-Claude analysed both information packages that a fresh Claude receives — the MCP resources (always-loaded context) and the slash commands (step-by-step procedures) — and found 10 issues. Web-Claude added two more.

**The findings:**

1. `.claude/commands/` doesn't exist in the WIP repo (it's deployed to app repos)
2. Two competing process definitions — 4 phases (MCP + slash commands) vs 5 phases (AI-Assisted-Development.md)
3. **AI-Assisted-Development.md teaches curl, not MCP** — the foundational document teaches the wrong interface
4. Slash commands reference nonexistent tools (wrong names for 6+ tools)
5. Slash commands use `code`/`name`, MCP uses `value`/`label` — causes immediate failures
6. Redundancy between MCP resources and slash commands (fine in principle, contradictory in practice)
7. `/build-app` points at a design spec instead of the client library READMEs
8. WIP_DevGuardrails.md describes a gateway that doesn't exist
9. `/document` and `/export-model` are good as-is
10. MCP `wip://conventions` missing querying section
11. *(Web-Claude)* PoNIFs doc not referenced by any slash command
12. *(Web-Claude)* No `/resume` command for compaction recovery

**The 12-action plan:**

WIP-Claude produced a disciplined plan with dependency ordering. Peter gave explicit scope boundaries: "do steps 1, 2, 3, and only 1, 2, 3." WIP-Claude stopped after step 3. First time in the experiment it respected a scope boundary without overrunning.

| Action | What | Result |
|---|---|---|
| 1 | Add `wip://ponifs` MCP resource | 75-line condensed PoNIF reference, always in context |
| 2 | Update `wip://conventions` | Added querying section, MCP-native language |
| 3 | Update `wip://development-guide` | Correct tool names, PoNIF reference, field naming guidance |
| 4 | Fix tool names in slash commands | 6 wrong→correct mappings across 8 commands |
| 5 | Fix `code`/`name` → `value`/`label` | Systematic replacement in all commands |
| 6 | Add `/resume` command | Compaction recovery from durable artifacts only |
| 7 | Add PoNIF references to slash commands | `/implement`, `/build-app`, `/improve` |
| 8 | Rewrite AI-Assisted-Development.md | 1,270 → 232 lines (82% reduction), MCP-first |
| 9 | Mark aspirational sections in DevGuardrails | Gateway banner added |
| 10 | Fix library references in `/build-app` | Points to READMEs, not design spec |
| 11 | Remove nonexistent directory references | Generic paths replace hardcoded ones |
| 12 | Verify mcp-server.md | 69 tools (found undocumented `search_registry`), 4 resources |

### Peter's Reflection

At 77% context usage, with WIP-Claude deep in the documentation overhaul, Peter wrote the most important observation of the experiment:

> *Humans have biases, too — they are basically biases on two legs. One bias I want to call out in particular is that humans are very easily falling into the trap that the AI will "figure it out somehow, so sloppy instructions are good enough." Humans like to think "A re-write that might be required because of sloppy instructions is a Claude's task, not my task. Failure is cheap." And this attitude is wrong in more ways than I have fingers on my hands — bad code, bad design, bad data quality, bad UX, bad security, inconsistent APIs, incomplete scope, wrong scope, slow code, sloppy user input validation, impossible to reproduce / deploy elsewhere, etc.*
>
> *And the AI's tendency to please the user and move on, even if things are unfinished and/or broken, is hitting right into that human weak spot. Combined: a recipe for failure — at least for anything that goes beyond a quick throw-away prototype.*

The AI bias toward closure (Entry 024) meets the human bias toward delegation. The AI wants to declare victory. The human wants to let it. Neither checks the details. The result looks right until deployment — and then the bcrypt 72-byte limit crashes every service, the CSP blocks authentication, and the hardcoded API keys lock out every app.

The antidote, refined over 50 days: **the human produces the standard of evidence.** Not the standard of code — the AI writes better code faster. The standard of *evidence*: did we test this? Did we deploy this? Did we read this with fresh eyes? Did we check that the tool names match the actual tools?

---

## The Numbers

### WIP Repository (3-Day Totals: March 20-22)

| Metric | Committed | Uncommitted (doc overhaul) | Total |
|---|---|---|---|
| Lines added | +2,429 | +1,221 | +3,650 |
| Lines deleted | -228 | -1,199 | -1,427 |
| Net | +2,201 | +22 | +2,223 |
| Files touched | 34 | 16 | 45+ |
| Commits | 10 | pending | 10+ |

### MCP Server Growth

| Date | Tools | Resources |
|---|---|---|
| Day 6 (March 19) | 43 | 3 |
| Day 8 (March 22) | 69 | 4 |
| Growth | +60% | +33% |

### Statement Manager Parsers

| Parser | Bank | Format | Currency | Added |
|---|---|---|---|---|
| UBS CSV | UBS | Semicolon CSV | CHF | Day 2 |
| Yuh PDF | Yuh/Swissquote | PDF | CHF | Day 2 |
| Viseca CSV | Viseca/Migros Bank | Comma CSV | CHF/EUR | Day 8 |
| DKB CSV | DKB | Semicolon CSV | EUR | Day 8 |

### Constellation App Data

| Template | Documents | Sources |
|---|---|---|
| FIN_ACCOUNT | 5 | Manual + auto-created from imports |
| FIN_TRANSACTION | 1,916 | UBS, Yuh, Viseca (2 cards), DKB |
| FIN_PAYSLIP | 2 | Employer PDF |
| FIN_PAYSLIP_LINE | 36 | Employer PDF |
| FIN_IMPORT | 8 | All parsers |
| **Total** | **1,967** | **5 parsers, 4 banks, 2 countries** |

### Statement Manager App

| Metric | Value |
|---|---|
| TypeScript/TSX lines | 5,227 |
| Parser modules | 5 parsers + 1 PDF utility (1,471 lines) |
| Largest file | ImportPage.tsx (1,289 lines — candidate for refactoring) |
| Supported formats | UBS CSV, Yuh PDF, Viseca CSV, DKB CSV, Employer Payslip PDF |

---

*Day 8 status: the MCP server grew from 43 to 69 tools. The documentation package was overhauled in 12 actions — a new `wip://ponifs` resource, 11 corrected slash commands including `/resume` for compaction recovery, and AI-Assisted-Development.md rewritten from 1,270 to 232 lines. Constellation-Claude added Viseca and DKB parsers, caught Peter's data selection error twice before writing any code, and proved that the process works even when the human rushes. The experiment's most important finding isn't technical — it's that the human bias toward "the AI will figure it out" and the AI bias toward closure are complementary failures that compound into bad outcomes. The antidote: the human produces the standard of evidence. 69 tools. 4 resources. 11 slash commands. 232 lines replacing 1,270. Ready for the fresh-directory test.*

*See [Day 7: The Checklist](WIP_Journey_Day7.md) for the previous day.*
