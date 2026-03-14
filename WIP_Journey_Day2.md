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

*(Fill in as the day progresses. Same honest narrative style as Day 1.)*

### Morning

*(TBD)*

### Afternoon

*(TBD)*

---

## What Went Wrong

*(Capture honestly, as before. Every failure is a lesson learned entry.)*

---

## What We Learned

*(Synthesize at the end of the day. Update LESSONS_LEARNED.md in parallel.)*

---

## By the Numbers

*(Update at end of day.)*

**Carried forward from Day 1:**
- 5 terminologies, 4 templates in WIP (unchanged — data model is stable)
- 10 slash commands, 11 lessons learned entries
- Process, guardrails, and documentation framework established

**Day 2 additions:**
- *(TBD)*

---

## Open Questions Going Into Day 3

*(What's unresolved? What needs more thought? What's the next experiment?)*

---

*Day 2 status: (update at end of day)*
