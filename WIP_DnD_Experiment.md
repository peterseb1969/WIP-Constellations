# The D&D Experiment: From PDF to Queryable World in One Afternoon

*In which a fresh Claude, armed with nothing but documentation, turns a 412-page German PDF into 1,384 structured documents — and then answers questions about them.*

---

## The Setup

Sunday, March 22, 2026. Day 8 of the WIP Constellation experiment. Peter had spent the morning overhauling WIP's documentation package — rewriting slash commands, adding a `wip://ponifs` MCP resource, condensing AI-Assisted-Development.md from 1,270 to 232 lines. The process documentation was the best it had ever been.

Time for the real test: give a fresh Claude a fresh directory and see what happens.

Peter opened a new terminal, ran `create-app-project.sh`, and typed one prompt:

> *I want to build a backend for D&D artifacts — players, NPCs, combat rules, adventures, weapons, spells — you name it. It has to be extensible and needs to leverage all WIP features where it makes sense — so for example relationships and ontologies on top of templates and docs. Events have to be modelled well, etc. You need to analyse a PDF that I will provide to come up with a meaningful list of entities in the PDF, and you need to propose how to model them. You can find the PDF in the docs directory.*

Then Peter left the room.

---

## 5 Minutes and 29 Seconds

When Peter returned 35 minutes later, the Claude had been done for 30 minutes. In 5 minutes and 29 seconds, it had:

- Analysed the 412-page German D&D SRD 5.2.1
- Identified 22 enumeration types and 20 rich document types
- Mapped 21 WIP terminologies with 220 terms
- Designed 20 templates with field definitions, identity fields, and reference relationships
- Identified ontology relationships (Skill→Ability Score, creature type hierarchies)
- Proposed template inheritance (Potion and Spell Scroll extend Magic Item)
- Designed a namespace strategy (`dnd` namespace, reuse system terminologies)
- Mapped 12 WIP features to D&D use cases — terminologies, ontology relationships, template inheritance, document references, array fields, term references, validation rules, file references, Registry synonyms, identity hashing, and reporting/SQL

Nobody told the Claude that WIP has ontology relationships, or template inheritance, or Registry synonyms. It discovered them from `wip://data-model` and independently identified where each one fits the D&D domain. Registry synonyms for German↔English↔D&D Beyond ID mapping. Ontology for skill-to-ability-score relationships. Validation rules for conditional weapon properties. All from reading the documentation.

---

## Phase 2: The Human Adds Value

Peter's contribution was domain refinement, not WIP tutoring:

**The translations question.** The initial design had `name_de` fields on every template — a German name alongside the English canonical name. Peter asked: "This is not extensible, correct? Adding Spanish would require a template update?" The Claude immediately proposed three alternatives and recommended the hybrid approach: a `translations` array field (unlimited languages, zero schema changes) plus Registry synonyms for O(1) lookup.

Mid-design, the Claude caught its own mistake: "Actually, wait — DND_LANGUAGE is for in-game languages (Common, Elvish, Draconic). Real-world languages for UI translations are a different concept." It self-corrected to use the existing seed LANGUAGE terminology (ISO 639-1) instead of conflating in-game and real-world languages.

**The namespace decision.** Peter approved `dnd` as the dedicated namespace. This decision, unfortunately, lived in the conversation and not in DESIGN.md — which became significant later.

**Phase 2 total time: ~15 minutes of discussion.** The Claude did the design work; Peter asked the right questions.

---

## Phase 3: Implementation

21 terminologies, 220 terms, 20 templates. The biggest Phase 3 in the experiment — more than the Statement Manager and Receipt Scanner combined.

**Time: 7 minutes and 33 seconds.** Zero PoNIF mistakes. Zero human WIP tutoring.

The test matrix was the most comprehensive any Claude had run:

| Test | Result |
|---|---|
| Basic document creation (Longsword) | ✅ Created, terms resolved |
| Multi-term array resolution (Fireball → 3 classes) | ✅ All class_lists terms validated |
| 40-field complex document (Aboleth monster) | ✅ All fields, embedded action arrays |
| Versioning (Longsword v1→v2, added description + Spanish) | ✅ Same identity hash, version bumped |
| Document references (Flame Tongue → Longsword) | ✅ Reference resolved |
| Template inheritance (Potion of Healing via DND_POTION) | ✅ Extends DND_MAGIC_ITEM correctly |
| Cross-template references (Champion subclass → Fighter class) | ✅ parent_class resolved |
| Translations array (Spanish added without schema change) | ✅ Zero template modification |

One error in the entire Phase 3: array items passed as objects instead of strings in a term-validated field. Fixed by checking the actual terminology values in WIP and retrying. One error across 261 entities created.

---

## The Bulk Load: A War of Attrition

Then Peter said: "Upload all data." And the real adventure began.

### The Pattern

The Claude developed a strategy through trial and error across multiple compaction cycles:

1. **Read templates and terminology values** into main context (the mapping tables)
2. **Launch parallel agents** for PDF parsing and document creation (fire-and-forget)
3. **Let compaction happen** — agents continue running independently
4. **Post-compaction: query WIP** for what survived, identify gaps
5. **Launch more agents** for the remaining data
6. **Repeat**

The critical discovery: **agents survive compaction.** They're independent processes making MCP calls to the local WIP instance. When the main context compacts, the agents keep running and creating documents. This turned compaction from a catastrophe into a feature — launch agents, let compaction happen, query the results.

### The Numbers

| Cycle | Context Used | Documents Created | Compaction? |
|---|---|---|---|
| 1 | 71% | ~150 (equipment) + 100 spells (agents) | Yes — mid-spell-loading |
| 2 | 80% | +245 spells (agents from cycle 1 completing) | Yes — launched 8 agents |
| 3 | 70% | Species, backgrounds, feats + agents running | Yes — launched 7 more agents |
| 4 | 42% | Agent results + launched 3 final agents | Subscription limit hit |
| 5 | 17% | Q&A session (strategy shift to file-based analysis) | No |
| 6 | — | Final agent completions, Q&A corrections | End of session |

### What Was Built

| Entity | Documents | Notes |
|---|---|---|
| DND_SPELL | 354 | Near-complete SRD spell list |
| DND_CLASS_FEATURE | 255 | Level 1-20 progression for all 12 classes |
| DND_MONSTER | 245 | ~60% of SRD bestiary |
| DND_MAGIC_ITEM | 223 | Good coverage |
| DND_ADVENTURING_GEAR | 81 | Complete |
| DND_WEAPON | 38 | Complete (all base weapons with properties) |
| DND_POTION | 31 | Complete (extends Magic Item) |
| DND_TOOL | 25 | Complete |
| DND_MOUNT | 20 | Complete |
| DND_FEAT | 17 | Complete (Origin, General, Fighting Style, Epic Boon) |
| DND_POISON | 14 | Complete |
| DND_SUBCLASS | 13 | One per class |
| DND_ARMOR | 13 | Complete |
| DND_CLASS | 12 | All 12 D&D classes |
| DND_SPELL_SCROLL | 10 | Cantrip through 9th level |
| DND_SPECIES | 9 | Complete |
| DND_HAZARD | 9 | Complete |
| DND_TRAP | 8 | Complete |
| DND_BACKGROUND | 4 | Complete |
| DND_DISEASE | 3 | Complete |
| **Total** | **1,384** | **21 terminologies, 286 terms, 20 templates, 18 ontology relationships** |

All documents include German translations in a structured `translations` array. All term references are validated against WIP terminologies. All document references (subclass→class, magic item→weapon) are resolved.

---

## The Questions: Structured Data Meets Natural Language

Peter (via Web-Claude) prepared 12 questions. The rules: MCP only, no PDF.

### The Answers

**Q1: All spells available to a Wizard at level 5 or below?**
154 spells. Queried `DND_SPELL` where `class_lists` contains WIZARD and `level` in [0-5]. Complete list returned.

**Q2: Which monsters are resistant to fire damage?**
First answer: 3 (wrong — case-sensitive query missed lowercase "fire"). Corrected answer: 10 resistant + 28 immune + Iron Golem with Fire Absorption trait. Correction method: dumped all 245 monsters (1.1M characters) to disk files, ran case-insensitive grep. Zero context consumed for the analysis.

**Q3: Legendary magic items requiring attunement?**
21 items found.

**Q4: Which creatures are Undead?**
10 creatures listed (Lich, Ghast, Ghoul, Shadow, Specter, Zombie, Ogre Zombie, Crawling Claw Swarm, Crypt Fiend, Will-o'-Wisp).

**Q5: All Transmutation spells?**
62 spells listed.

**Q6: Weapons with the Finesse property?**
First answer: "Not queryable — weapons weren't modeled." Wrong — 38 DND_WEAPON documents existed but post-compaction context didn't know about them. Search tool returned zero for "Dagger", "Rapier", "Longsword" (indexing gap). Eventually found via `query_by_template("DND_WEAPON")`. Corrected answer: 6 Finesse weapons (Dagger, Dart, Rapier, Scimitar, Shortsword, Whip).

**Q7: Find the monster called "Betrachter" (German for Beholder)?**
Correctly reported: Beholder is Wizards of the Coast Product Identity, excluded from the Creative Commons SRD. Not a data gap — a licensing boundary.

**Q8: German name for Fireball?**
"Feuerball" — retrieved from the `translations` array. The multilingual design works.

**Q9: Spells dealing Thunder damage?**
3 spells (Storm of Vengeance, Shatter, Thunder Wave).

**Q10: Large+ monsters with CR > 10?**
30 monsters in a formatted table. 16 Adult/Ancient Dragons, Dragon Turtle, Kraken, Pit Fiend, Iron Golem, Purple Worm, and more.

**Q11: Total documents in the dnd namespace?**
952 counted (actually 1,384 — the tally missed 5 templates and 177 documents due to compaction context loss).

**Q12: Full Aboleth stat block?**
Complete: AC 17, HP 135, all ability scores, saving throws, skills, CR 10, 3 actions (Multiattack, Tentacle, Enslave), 3 legendary actions (Detect, Tail Swipe, Psychic Drain), special traits (Mucous Cloud, Probing Telepathy, Amphibious), and disease mechanics. The 40-field monster template delivered exactly what it was designed for.

**Final score: 12/12 answered, 2 required correction (Q2 casing, Q6 missing template awareness), 1 correctly identified as outside scope (Q7 Beholder IP).**

---

## Honest Assessment

### What Worked Brilliantly

**The documentation package is proven.** A fresh Claude with zero WIP knowledge independently discovered and correctly used 12 WIP features: terminologies, term aliases, ontology relationships, template inheritance, document references, identity hashing, array fields, term references, validation rules, file references, Registry synonyms, and reporting. Every one learned from `wip://data-model` and `wip://conventions`. No human tutoring required.

**The phased process prevented mistakes.** Phase 2 (design) caught the `name_de` extensibility problem before any code was written. The translations array with seed LANGUAGE terminology was designed, approved, and implemented correctly — and it worked when Q8 asked for the German name of Fireball. The process isn't overhead; it's investment.

**The data quality is remarkably high.** 1,384 documents parsed from a German PDF, with validated term references, resolved document references, German translations, and ontology relationships. One parsing error in 261 Phase 3 entities. The PoNIFs resource prevented the systematic errors that plagued Statement Manager v1.

**The agent fire-and-forget pattern is a genuine technique.** Agents survive compaction. This transforms the context limit from a hard wall into a pagination mechanism — launch agents, let compaction happen, query the survivors, repeat. Not documented anywhere, discovered empirically.

### What Didn't Work

**The namespace strategy was lost to compaction.** The Phase 2 design specified a `dnd` namespace. Every document landed in `wip` instead, mixed with seed data. The decision was in conversation, not in DESIGN.md. Every compaction wiped the intent. The `/design-model` slash command should mandate writing namespace decisions to a durable artifact.

**Full-text search has significant gaps.** `search("Dagger")` returned zero despite 38 weapons existing. `search("Longsword")` zero. `search("Rapier")` zero. The reporting-sync may not be indexing all document fields for full-text search. This is a real product gap — if search doesn't find documents that exist, users lose trust.

**Query results are context bombs.** Every `query_by_template` call returns full documents. A 40-field monster at 2K+ characters × 100 results = 200K+ characters. Three such queries fill the context window. The file-dump-and-grep workaround is clever but shouldn't be necessary. Field projection (`SELECT name, challenge_rating FROM monsters WHERE size = 'LARGE'`) is a must-have for analytical queries.

**Term casing inconsistency slipped through validation.** `damage_resistances: ["fire"]` and `["FIRE"]` both passed validation. The terminology has "FIRE" as the canonical value. Array term fields should enforce canonical casing.

**Post-compaction template awareness is incomplete.** After compaction, D&D Claude's tally missed 5 templates and 177 documents. The `/resume` command should enumerate all templates in WIP, not rely on what the summary remembers.

**The bulk load would have been more efficient with an extract-then-load pattern.** Parsing the PDF and creating documents in the same pass means compaction loses both the parsing work and the in-flight creations. Extracting to JSON files first (durable on disk), then loading from files (resumable), would have eliminated re-parsing across compaction cycles.

### The Bigger Picture

This experiment answered a question that no benchmark can: **can an AI turn unstructured domain knowledge into a structured, queryable, validated data system — without being taught how the system works?**

The answer is yes, with caveats. The AI needs:
- A well-documented platform (MCP resources, PoNIFs, slash commands)
- A phased process that prevents rushing to code
- A human for domain decisions (not platform decisions)
- Tolerance for compaction cycles and iterative refinement

What it doesn't need: tutorials, examples, hand-holding, or access to other apps' source code. The documentation IS the teacher. The process IS the quality gate. The human IS the standard of evidence.

The D&D experiment produced 1,384 documents, 21 terminologies, 286 terms, 20 templates, and 18 ontology relationships from a 412-page German PDF. The first prompt to the last query answer spanned about 5 hours, including compaction cycles, a 2-hour subscription limit pause, and Peter leaving the room for 35 minutes during the most productive 5.5 minutes of the session.

If someone told you that a developer's Mac running 5 microservices could store, validate, version, and serve D&D's entire SRD as structured data — with multilingual support, ontology relationships, and term-validated fields — and that the data model was designed and populated by an AI that learned the platform from documentation alone, in an afternoon... you'd probably ask to see the receipts.

Here they are. 1,384 of them.

*(And when the wip-toolkit migrates this dataset to a dedicated `dnd` namespace on the Raspberry Pi, it'll prove that too.)*

---

## Technical Findings for WIP Development

These findings should be addressed before or shortly after the stable release:

1. **Field projection on queries** — add a `fields` parameter to `query_by_template` and `query_documents` to return only specified fields. Priority: High. Impact: transforms analytical capability.

2. **Full-text search indexing** — investigate why `search("Dagger")` returns zero for existing DND_WEAPON documents. The reporting-sync may not be indexing all templates or all fields. Priority: High. Impact: search reliability.

3. **Term casing normalisation** — enforce canonical case from the terminology when validating term references in array fields. `["fire"]` should be rejected or auto-corrected to `["FIRE"]`. Priority: Medium. Impact: data consistency.

4. **Namespace in DESIGN.md** — the `/design-model` slash command should mandate writing the namespace decision to DESIGN.md. Priority: Medium. Impact: prevents namespace drift across compaction.

5. **`/resume` template inventory** — the compaction recovery command should enumerate all templates in WIP with document counts, not rely on conversation memory. Priority: Medium. Impact: post-compaction awareness.

6. **Extract-then-load guidance** — for bulk PDF imports, the process should recommend extracting to JSON files first (durable artifacts), then loading from files (resumable). Priority: Low. Impact: efficiency for large imports.

---

*This document records the D&D SRD 5.2.1 experiment conducted on Days 8-9 of the WIP Constellation experiment (Sunday-Monday, March 22-23, 2026). It is both a success story and a technical findings report. The data remains in the WIP instance, now queryable through an 8-page React app with AI-powered natural language search.*

### What's Next

The D&D Q&A session exposed the gap between "data is in WIP" and "a human can get answers." Three ideas emerged on Monday morning — and by Monday evening, one was built:

**Built: AI-powered NL query interface.** A chat bubble in the D&D Compendium where users type natural language questions. The backend connects a Claude Haiku instance to WIP's MCP server (68 tools), loads `wip://data-model` and `wip://conventions` dynamically at boot, and runs an agentic tool loop. Multi-turn conversation with memory. Cost: $0.02 per conversation on Haiku.

The demo: "Select a random beast" → full Lion stat block (1 tool call). "Which beast is beautiful?" → reasoned from proxy stats, no beauty field exists (1 tool call). "How to kill a deer with magic?" → cross-template query: monster stats + spell damage + tactical advice (2 tool calls). "What about the other beasts?" → comparison table of all 5 beasts from turn 2 (2 tool calls). Four turns, $0.02, structured data turned into game advice.

The system prompt was written by the D&D Claude itself — 51 lines documenting all 20 templates, query tips, and formatting guidelines. The Claude that designed the schema wrote the instructions for the next Claude to query it.

**Planned:** `/analyst` slash command (done — the same pattern for Claude Code), `WIP_MCP_MODE=readonly` (env var to enforce read-only), deterministic SQL dashboard (saved queries without AI cost).

*See [Day 8: The Process](WIP_Journey_Day8.md) for the documentation overhaul. See [Day 9: The Release](WIP_Journey_Day9.md) for the v1.0.0 tag, D&D Phase 4, and the NL query interface.*
