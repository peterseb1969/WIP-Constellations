Generate or update standardized documentation for a constellation app. Run this after Phase 4, after significant /improve sessions, and before any handoff or long pause.

## Why this exists

The AI that built this app will not remember building it. The next session — whether it's the same AI, a different AI, or a human developer — starts cold. Without documentation, every session begins with reading source files, guessing at architecture, and making changes that contradict forgotten decisions.

Documentation is not a nice-to-have. It is the app's memory. It is what makes the app maintainable beyond its first session.

## Required documentation structure

Every constellation app must have these files, maintained alongside the code:

```
apps/{app-name}/
├── README.md                  # What this app is and how to run it
├── ARCHITECTURE.md            # How the code is structured and why
├── WIP_DEPENDENCIES.md        # What WIP entities this app uses
├── IMPORT_FORMATS.md          # What data formats are supported (if applicable)
├── KNOWN_ISSUES.md            # What's incomplete, broken, or intentionally deferred
├── CHANGELOG.md               # What changed, when, and why
└── src/
    └── (code with inline JSDoc comments on all exported functions and components)
```

### README.md

The entry point. A new developer (human or AI) reads this first.

Must contain:
- **What this app does** — one paragraph, plain language
- **Screenshots or screen descriptions** — what the user sees (describe if screenshots aren't practical)
- **How to run it** — `npm install`, `npm run dev`, what port, what URL
- **Environment variables** — complete list with descriptions and example values
- **WIP prerequisites** — which terminologies and templates must exist (point to seed files)
- **Tech stack** — framework, key libraries, why (brief, since guardrails cover the general stack)

### ARCHITECTURE.md

How the code is organized and the reasoning behind key decisions.

Must contain:
- **Page/route structure** — what pages exist, what URL routes, what each shows
- **Component hierarchy** — key components and their relationships (not every tiny component, just the structural ones)
- **Data flow** — how data moves from WIP through @wip/react hooks to the UI
- **State management** — what state lives where (query cache, local component state, URL params)
- **Key decisions and rationale** — why this navigation pattern, why this filter approach, why this import strategy. These are the decisions the next session will want to change unless it knows why they were made.

Format: prose with code references, not auto-generated API docs. The goal is understanding, not completeness.

### WIP_DEPENDENCIES.md

The contract between this app and WIP. Critical for cross-app awareness.

Must contain:
- **Terminologies used** — code, what it's used for, whether this app created it or reuses it from another app
- **Templates used** — code, what it's used for, which fields this app reads/writes, identity fields
- **Cross-app references** — which templates reference templates from other apps (e.g., FIN_TRANSACTION.account → FIN_ACCOUNT)
- **Seed file location** — pointer to `data-model/` files that create these entities
- **External data** — any external APIs or data sources the app integrates

This file is what `/add-app` reads to understand what the existing app provides for cross-linking.

### IMPORT_FORMATS.md (if the app imports data)

Document every supported import format.

Must contain for each format:
- **Source** — what system/export produces this format (e.g., "UBS e-banking CSV export")
- **File type** — CSV, PDF, JSON, etc.
- **Column/field mapping** — which source columns map to which WIP template fields
- **Transformations** — any data transformations applied (date format conversion, amount sign normalization, category inference)
- **Known issues** — edge cases, unsupported variants, data quality problems
- **Sample** — a redacted example of the first few rows/records

This is the most fragile part of any data app. Import parsers break when the source changes its export format. Documentation makes debugging possible.

### KNOWN_ISSUES.md

What's incomplete, broken, or intentionally deferred. This prevents the next session from:
- "Fixing" something that's intentionally simple (premature optimization)
- Missing something that's actually broken (hidden bugs)
- Re-implementing something that was already tried and abandoned (wasted effort)

Format:
```markdown
## Open Issues

### [Issue title]
**Status:** known / in-progress / deferred / wont-fix
**Severity:** critical / medium / low / cosmetic
**Description:** What's wrong or missing
**Context:** Why it hasn't been fixed yet (if deferred or wont-fix)
```

### CHANGELOG.md

What changed, when, and why. Git commits are too granular; this is the human-readable version.

Format:
```markdown
## [date] — [summary]

- Added: [what was added]
- Changed: [what was changed and why]
- Fixed: [what was broken and how it was fixed]
- Known issues: [what's still broken]
```

Update this after every `/improve` session, not after every commit. One changelog entry per logical change, not per git commit.

## Inline code documentation

Beyond the documentation files, the code itself must be self-documenting:

- **All exported React components** must have a JSDoc comment explaining what they render and what props they accept
- **All custom hooks** must have a JSDoc comment explaining what data they provide and what WIP entities they query
- **All import parsers** must have a comment block explaining the source format and any transformation logic
- **All non-obvious logic** must have inline comments explaining WHY, not WHAT (the code shows what; only comments show why)

## When to run this command

### After Phase 4 (initial documentation)
Generate all documentation files from scratch. This is the most effort — you're documenting a fresh app. Focus on ARCHITECTURE.md and WIP_DEPENDENCIES.md first.

### After significant /improve sessions
Update the affected files. If you changed the page structure, update ARCHITECTURE.md. If you added a new import format, update IMPORT_FORMATS.md. If you fixed a known issue, update KNOWN_ISSUES.md. Always update CHANGELOG.md.

### Before a long pause
If development is pausing for days or weeks, do a documentation pass. The next session (yours or someone else's) will thank you.

### Before /add-app
The next app will read this app's WIP_DEPENDENCIES.md to understand what exists for cross-linking. Make sure it's current.

## Steps

1. Check which documentation files already exist in `apps/{app-name}/`
2. For each missing file, generate it by reading the source code and WIP state
3. For each existing file, verify it's current — read the code and compare
4. Ensure inline JSDoc comments exist on all exported components and hooks
5. Update CHANGELOG.md with any recent changes
6. Commit:
```
git add apps/{app-name}/*.md
git commit -m "docs: update documentation for {app-name}"
```

## The standard

An app is considered well-documented when a new Claude session can:
1. Read README.md and understand what the app does in 30 seconds
2. Read ARCHITECTURE.md and know where to make a change without reading all source files
3. Read WIP_DEPENDENCIES.md and know exactly which WIP entities to query
4. Read KNOWN_ISSUES.md and avoid re-investigating known problems
5. Read CHANGELOG.md and understand the app's evolution

If any of these fail, the documentation is incomplete.
