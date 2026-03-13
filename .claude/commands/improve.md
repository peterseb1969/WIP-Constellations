Improve an existing constellation app. Use this for bug fixes, UX refinements, feature additions, and polish after Phase 4 is complete.

## This is NOT a formal phase

There is no gate, no approval step for starting improvements. But there are rules that prevent waste, regression, and scope creep.

## Rules

### 1. One issue per session
The user describes a single problem or desired change. You propose what you will change and what you will NOT touch. The user approves. You implement. You commit. Session over (or move to the next issue).

Do NOT bundle multiple unrelated fixes. Do NOT "while I'm in here, let me also..." — that's how regressions happen.

### 2. Import real data before refining UI
Many apparent UX problems are actually data problems that only surface with real volumes and real-world messiness:
- A table that looks fine with 5 test transactions is unusable with 500
- A category dropdown that works with 20 terms fails when 3 have similar names
- Date sorting that seems correct breaks when imports span multiple years
- Counterparty names from real bank exports are truncated, messy, or inconsistent

If the app is still running on test data from Phase 3, push the user to import real data first. UI refinement against synthetic data is guesswork.

### 3. Don't rewrite what works
Surgical fixes, not rewrites. If a component works but needs a small change, edit the component — don't regenerate it from scratch. Rewriting introduces new bugs in code that was already working.

If you find yourself wanting to rewrite an entire page or component, stop and ask: is this a design problem (wrong approach, needs rethinking) or a fix (correct approach, needs adjustment)? Only rewrite if it's genuinely a design problem, and confirm with the user first.

### 4. Tests must pass after every change
Before committing any change:
- Run existing tests
- If the change breaks a test, either fix the test (if the test was wrong) or fix the change (if the test caught a regression)
- Never skip or delete a passing test to make a change work

### 5. Start every session with context recovery
You have no memory between sessions. At the start of every improvement session:
- Run `/wip-status` to confirm WIP state
- Read ONLY the files you'll be changing — not the whole app
- Ask the user what needs fixing — don't guess from reading code

### 6. Data model changes go back to the formal process
If an improvement requires:
- A new field on an existing template
- A new terminology or new terms
- A changed identity field
- A new template
- A new reference between templates

Then this is NOT a casual improvement. It's a data model change. Go back to Phase 2 (propose the change, get approval) and Phase 3 (implement via MCP tools, test). Only then continue with the UI change.

This rule exists because data model changes have consequences beyond the current app — they affect versioning, existing documents, cross-app references, and future apps in the constellation.

### 7. Update documentation after every change
After each fix or improvement:
- If you changed page structure or navigation → update ARCHITECTURE.md
- If you added or changed an import format → update IMPORT_FORMATS.md
- If you fixed a known issue → update KNOWN_ISSUES.md (mark as fixed or remove)
- If you added a new WIP dependency → update WIP_DEPENDENCIES.md
- Always update CHANGELOG.md with what changed and why

This doesn't need to be a separate step. Do it as part of the commit.

### 8. Commit after every working change
After each fix or improvement that works:
```
git add -A
git commit -m "fix: [concise description of what changed]"
```
This makes context window exhaustion survivable (see LESSONS_LEARNED.md Entry 004). The next session picks up from the last commit, not from zero.

## Common improvement categories

| Category | Example | Watch out for |
|---|---|---|
| Bug fix | "Date filter returns wrong results" | Don't rewrite the filter — find the specific comparison that's wrong |
| UX refinement | "Move import to the main nav" | Propose the navigation change before implementing. The user has opinions. |
| Missing feature | "Add CSV export for transactions" | Keep it focused — export only, don't redesign the transactions page |
| Data display | "Show counterparty in the transaction list" | Check if the field exists in the template. If not, that's a data model change (Rule 6). |
| Performance | "Transaction list is slow with 1000+ rows" | Pagination, virtual scrolling, or query filtering — not a rewrite |
| Import issues | "UBS CSV has a column we're not parsing" | Might need a new term in a terminology (Rule 6) or just a parser fix |
| Styling | "Buttons are too small on mobile" | Tailwind utility changes only. Don't switch component libraries. |

## When to stop improving and build the next app

There is no formal threshold. But consider moving to the next app (`/add-app`) when:
- Real data is imported and the core views work correctly
- The primary workflow (import → browse → filter) is usable, not perfect
- Known issues are cosmetic, not functional
- You're spending more time polishing than discovering

The constellation's value comes from cross-app analysis, not from perfecting a single app. A working Statement Manager plus a working Receipt Scanner is more valuable than a perfect Statement Manager alone.
