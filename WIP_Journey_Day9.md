# WIP Constellation Experiment — Day 9: The Release

**Date:** Monday, March 23, 2026
**Duration:** Evening session (~19:00–22:30)
**Milestone:** WIP v1.0.0 tagged and pushed

---

## The Morning: Three Ideas

Peter reflected on Sunday's D&D Q&A session. The experiment had never built an app or defined queries — it was pure natural language interaction with WIP's data, and it exposed a gap between "data is in WIP" and "a human can get answers." Three ideas went into `docs/roadmap.md`:

1. **`/analyst` slash command** — a forced refresh that loads all templates, fields, terminology values, and document counts before answering questions. The D&D Claude lost template awareness across compaction (missed 5 templates, gave wrong answers on Q6 and Q11). This command builds the Claude's working memory of the data model at the start of every query session.

2. **Deterministic SQL dashboard** — saved queries against the reporting backend for reproducible, performant, shareable answers. The AI helps write queries; the dashboard runs them forever.

3. **Query Claude** — a read-only family member with no write tools. WIP-Claude pushed back on the "family member" framing: "You don't need a new family member. You need `WIP_MCP_MODE=readonly` — one env var, one if statement per tool group. Same server, same code." The `/analyst` command already tells the Claude not to write. The enforcement is belt and suspenders.

### `/analyst`: The 12th Slash Command

The command was drafted collaboratively — Web-Claude wrote the initial version, WIP-Claude critiqued it (six substantive points: `get_namespace_stats` instead of N queries, terminology values for filter validation, reporting-sync lag caveat, exit ramp instead of prohibition, `export_table_csv` and `get_table_view` as core tools, schema written out for user verification). Web-Claude revised, WIP-Claude refined two more points (no pseudo-SQL, "notable queries" not "all queries"). Final version written to `docs/slash-commands/analyst.md`. The 12th slash command.

---

## The Evening: Deployment Testing

Peter had said on Sunday: "We need to do some serious deployment and e2e testing, including how the existing apps work against the current codebase." This evening delivered on that promise.

### The Checklist

| Check | Result |
|---|---|
| Fresh `--prod` deployment on Pi | ✅ 182-187 seconds |
| All services healthy | ✅ 14/14 containers |
| Production security check | ✅ 17/17 (after 2 script bug fixes) |
| OIDC login (all 3 users) | ✅ (after 2 auth bug fixes) |
| Random Dex passwords in prod | ✅ |
| Random client secret to console | ✅ |
| Seed data | ✅ 525 docs, 0 errors, 131-136 docs/sec |
| Quality audit (full, no --quick) | ✅ No regressions |
| Gitea CI | ✅ (after ShellCheck fixes) |

### Five Deployment Bugs

Every one invisible to unit tests, quality audits, and security audits. All found by deploying `--prod` on the Pi and testing manually.

| # | Bug | Root Cause | Fix |
|---|---|---|---|
| 1 | `stat -f` cross-platform | On Linux, `stat -f` means `--file-system`, not format string. The `\|\|` fallback never triggered because `-f` succeeded with wrong output. | OS detection with `uname` before choosing syntax |
| 2 | Caddyfile TLS format | `setup.sh` generates `tls { issuer internal { ... } }` (block style) but `production-check.sh` grepped for `tls internal` (inline) | Match both patterns |
| 3 | Dex client secret not injected | Prod mode generates random Dex client secret, but the console build still had the hardcoded default | Pass `${VITE_OIDC_CLIENT_SECRET:-wip-console-secret}` as build arg |
| 4 | Console doesn't receive OIDC secret | Vite env vars are baked at build time. Console was built with default, `.env` had the random secret | Docker compose passes env var to build stage |
| 5 | Hardcoded Dex passwords in prod | `admin123`, `editor123`, `viewer123` — known to anyone who's read the docs. Every other secret was random. | Generate random passwords in `--prod`, save to `credentials.txt` |

**The pattern:** All five bugs share one trait — they work perfectly on Mac in dev mode and break on Pi in prod mode. `stat` syntax differs. Caddyfile format differs. Build-time vs runtime env var injection differs. Dev defaults vs prod secrets differ. No test that doesn't deploy `--prod` on Linux will find these.

**The lesson (Entry 024 again):** WIP-Claude said "Ready to tag" after the security audit. Peter said "Run the full quality audit, not --quick." Peter checked Gitea CI himself when WIP-Claude mentioned some tests only run there. Peter found ShellCheck failures. The human produces the standard of evidence. The finish line is when the *human* says it's the finish line.

### ShellCheck Cleanup

Peter checked Gitea CI results and found ShellCheck failures that WIP-Claude hadn't looked at. WIP-Claude fixed them all:
- SC2076: Regex quoting → converted to glob matching (`== *"pattern"*`)
- SC1090: Dynamic source → `shellcheck source=/dev/null` directive
- SC2155: Declare and assign separately for `local` variables
- SC2295: Quote expansions inside `${..#..}`
- SC2016: Added directives for intentional single-quoting (bcrypt hashes, sed patterns)
- Self-assignment no-op removed (`WIP_DATA_DIR` assigned to itself)

### Three Nuke-and-Redeploy Cycles

The Pi was nuked and redeployed three times during the evening. Each cycle: `nuke.sh -y` → `setup.sh --preset full --hostname pi-poe-8gb.local --prod -y` → `production-check.sh` → OIDC login test → seed data → quality audit. Each cycle found bugs that the previous one fixed. The third cycle: all green.

---

## v1.0.0

After the third clean deployment, Peter ran the quality audit without `--quick`, checked Gitea CI, verified all checks passed.

WIP-Claude: "Ready for stable tag whenever you are."

Peter: "TAG IT! PUSH IT!"

```
[main 9a1b...] v1.0.0
Tag v1.0.0 pushed to github and gitea.
```

---

## Immediately After: v1.0.1

The champagne wasn't even warm before Peter remembered: `create-app-project.sh` silently skips when client library tarballs aren't present, and manual copying doesn't extract READMEs. The D&D Claude had hit this — empty `libs/` directory, no READMEs, improvised from `.d.ts` type definitions.

**Fix:** Auto-build tarballs with `npm pack` if missing, clean up empty README files instead of silent `|| true`, explicit warnings when extraction fails.

---

## In Parallel: D&D Compendium — Phase 4

While Peter tested deployments, D&D Claude was unsupervised, building the app.

### What Was Built

| Page | Route | Templates | Documents |
|---|---|---|---|
| Spells | /spells | DND_SPELL | 354 |
| Bestiary | /bestiary | DND_MONSTER | 245 |
| Equipment | /equipment | DND_WEAPON, DND_ARMOR, DND_ADVENTURING_GEAR, DND_TOOL, DND_MOUNT | 177 (5 tabs) |
| Magic Items | /magic-items | DND_MAGIC_ITEM, DND_POTION, DND_SPELL_SCROLL | 264 (3 tabs) |
| Classes | /classes | DND_CLASS, DND_SUBCLASS, DND_CLASS_FEATURE | 280 (cards + lazy features) |
| Species | /species | DND_SPECIES, DND_BACKGROUND | 13 (2 tabs) |
| Hazards | /hazards | DND_TRAP, DND_POISON, DND_DISEASE, DND_HAZARD | 34 (4 tabs) |
| Feats | /feats | DND_FEAT | 17 |

All 8 pages include: search/filter, DE/EN bilingual toggle, slide-over detail panels, image search with WIP file storage, responsive mobile layout.

### Self-Correction

D&D Claude noticed it had omitted class features (DND_CLASS_FEATURE was at 0 documents). Without being asked, it went back and imported 255 class features — level 1-20 progression for all 12 classes.

### Final D&D Dataset

| Metric | Count |
|---|---|
| Templates | 20 |
| Terminologies | 21 |
| Terms | 286 |
| Documents | 1,384 |
| Ontology relationships | 18 |
| Files (images) | 19 |
| App pages | 8 |

### Known Issues from Phase 4

Three friction points that D&D Claude hit — the same ones Receipt Claude hit on Day 6:
1. `template_value` vs `template_id` — MCP tools use value, client library uses ID
2. `baseUrl: ''` breaks URL construction
3. CORS on direct port access — needs Vite proxy

These are three-time offenders. Worth adding to PoNIFs or `/build-app` as explicit warnings.

### Phase 5: The NL Query Interface

Peter asked: "What would it cost to implement a text field that would enable users to ask NL questions via WIP MCP?" D&D Claude proposed three options. Peter cut through them all: "WIP has an MCP server. Can you not just let a Claude instance do the work via the local MCP server?"

The architecture:

```
Browser → Express backend → Claude API (with WIP MCP tools) → WIP
                               ↕
                        agentic tool loop
```

**The system prompt** loads dynamically at boot: `wip://data-model` + `wip://conventions` (from MCP) + `server/prompts/compendium-assistant.md` (D&D-specific instructions, 51 lines, self-written by the Claude that built the data model). The schema is never stale — restart the server after adding a template and the agent knows about it.

**The implementation:** `server/agent.ts` — MCP client connects to WIP, registers 68 tools, Claude Haiku runs an agentic loop (max 15 tool turns per question). Chat bubble in the UI with markdown rendering, tool call count display, conversation history for multi-turn context.

**The debugging journey:**
- "No server restart needed" — wrong. `dotenv` loads at startup. Server restart fixed it.
- "No server restart needed" — wrong again. New API key, same issue. Server restart fixed it again.
- API key worked but credits needed propagation time (~10 minutes after purchase)
- Initial cost on Sonnet: $0.34 for two test messages (12K system prompt + 68 tool definitions)
- Switched to Haiku: $0.02 for a four-turn conversation with cross-template reasoning

**The demo conversation:**

| Turn | Question | Answer | Tool Calls |
|---|---|---|---|
| 1 | "Select a random beast" | Full Lion stat block: AC 12, HP 22, Pack Tactics, Running Leap, Multiattack, Rend, Roar | 1 |
| 2 | "Which beast is beautiful?" | Deer (graceful, DEX 16), Eagle (majestic, 60ft fly), Panther (sleek, Stealth +7) — reasoned from stats, no `beauty` field exists | 1 |
| 3 | "How to kill a deer with magic?" | Deer stats (AC 13, HP 4) + spell recommendations by level, including Sleep as non-lethal alternative | 2 |
| 4 | "What about the other beasts you listed?" | Cross-reference table: all 5 beasts with HP, AC, CR, and spell recommendations per beast | 2 |

Multi-turn context working — turn 4 references "the other beasts" from turn 2 without Peter repeating anything. Cross-template reasoning: monster stats + spell damage dice + tactical advice, all from structured WIP data.

**Cost:** $0.02 per conversation on Haiku. $5 balance = 250 sessions. Viable for a hobby project.

### The Documentation Lie

While building the export-model script, D&D Claude tried to use `@wip/client` from Node.js — and discovered that the client library README claimed "the client prepends the correct port automatically based on the API path." This was completely false. `http.ts:190` just concatenates `baseUrl + path`. No port routing exists anywhere in the client.

Every app-building Claude had hit this: Receipt Claude worked around it with Vite proxy. D&D Claude (Phase 4) worked around it with Vite proxy. D&D Claude (export script) finally exposed the root cause by trying to use the client without a browser proxy.

The deeper issue: three documents told app-building Claudes that direct port access (8001-8005) was the intended pattern, because "the gateway isn't implemented yet." But Caddy's API proxy had been routing `/api/*` to services all along — only the app portal (manifest registration, `/apps/*` routing, landing page) was aspirational.

| File | Was | Now |
|---|---|---|
| `libs/wip-client/README.md` | "client auto-routes ports" + `baseUrl: 'http://localhost'` | Client uses single baseUrl through Caddy, `baseUrl: ''` in browser |
| `libs/wip-react/README.md` | Same `http://localhost` examples | Same fix |
| `docs/slash-commands/build-app.md` | "Apps currently use direct ports" | API proxy exists, apps should use Caddy |
| `docs/WIP_DevGuardrails.md` | "Not yet implemented... access apps directly by port" | "Partially implemented" — API proxy exists, app portal is what's missing |
| `docs/WIP_ClientLibrary_Spec.md` | "Client constructs per-service URLs from port offsets" | Client uses single baseUrl through Caddy |

The D&D Compendium's `vite.config.ts` with 5 proxy routes reimplementing Caddy's routing is the direct consequence of these misleading docs. A fresh app built with the corrected documentation should use Caddy from the start — no Vite proxy needed.

This is the most impactful documentation fix of the experiment. Every previous app worked around the lie. Now the lie is gone.

### The Caddy Migration

D&D Claude fixed everything within 4 minutes — migrating from direct port access to Caddy reverse proxy across 9 files. The Vite proxy config that had 5 routes reimplementing Caddy's routing now points everything to `https://localhost:8443`. The backend, the export script, the environment configs, the architecture docs, the known issues — all updated. `@wip/client` and `@wip/react` packages reinstalled from the corrected tarballs.

The architectural principle, now correctly documented everywhere: the client sends all requests to `baseUrl + /api/<service>/...`. Caddy routes them. In the browser, `baseUrl: ''` resolves to `window.location.origin`. In Node.js, `baseUrl: 'https://localhost:8443'`.

### The Bilingual Aboleth

Peter's test after the migration — the moment that made it all real:

> "What is an Aboleth?"

The Haiku agent returned a complete stat block: AC 17, HP 150, all abilities, Legendary Resistance, Mucous Cloud, Mind Control, Legendary Actions. One tool call.

> "Can you translate that to German, please?"

Zero tool calls. Haiku translated the entire stat block from conversation memory: AC→RK (Rüstungsklasse), HP→LP (Lebenspunkte), STR→STÄ (Stärke), saving throw→Rettungswurf, bludgeoning→Wuchtschaden, Tail Swipe→Schwanzschlag. Even the flavor text: *"Aboleths sind berechnende Meister der Manipulation, die es vorziehen, durch Gedankenkontrolle zu dominieren, statt rohe Gewalt einzusetzen!"*

A D&D player in Switzerland types two messages into a browser. Gets a complete bilingual monster stat block. $0.02. From a German PDF, through WIP's MCP tools, to a Haiku agent, rendered in markdown. Monday evening, Day 9 of an experiment that started with "can multiple Claudes share a backend?"

---

## Day 9 Stats

| Metric | Value |
|---|---|
| Deployment cycles (nuke + redeploy) | 3 |
| Deployment bugs found and fixed | 5 |
| ShellCheck issues fixed | ~15 |
| Documentation lies corrected | 6 files (client README, react README, build-app, DevGuardrails, ClientLibrary_Spec) |
| D&D Caddy migration | 9 files updated in 4 minutes |
| Slash commands | 11 → 12 (`/analyst` added) |
| D&D Compendium | 8 pages + NL query chat + image system + data model export |
| D&D documents | 1,384 (255 class features self-corrected) |
| Release tags | v1.0.0, v1.0.1 |
| NL query cost per conversation | $0.02 (Haiku) |
| WIP codebase | 159,636 lines, 595 files, 412 commits |
| Lessons learned | 40 → 41 |
| Time | Morning + evening (~6 hours) |

---

*Day 9 status: WIP v1.0.0 tagged and pushed after three nuke-and-redeploy cycles, five deployment bugs, and ShellCheck cleanup. v1.0.1 followed immediately (tarball auto-build fix). The `/analyst` slash command was designed collaboratively and became the 12th slash command. D&D Claude, unsupervised in a parallel terminal, built an 8-page compendium app, self-corrected a 255-document omission, added an AI-powered NL query interface ($0.02/conversation on Haiku), exposed a documentation lie propagated across 6 files, migrated the entire app to Caddy in 4 minutes, and demonstrated a bilingual Aboleth stat block that made the experiment feel real. 159,636 lines of code. 412 commits. 41 lessons learned. v1.0.0. The develop branch is ready for Day 10.*

*See [Day 8: The Process](WIP_Journey_Day8.md) for the previous day. See [The D&D Experiment](WIP_DnD_Experiment.md) for the full story. See [Day 10: Ralph](WIP_Journey_Day10.md) for the documentation audit.*
