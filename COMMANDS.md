# Slash Command Reference

Quick guide to the 10 commands in `.claude/commands/`. Use them in Claude Code by typing `/{command-name}`.

## The Lifecycle

**The main flow (first app):**

```
/explore
   |
   v
/design-model .......... GATE: user approves data model
   |
   v
/implement
   |
   v
/export-model .......... save data model to git
   |
   v
/build-app ............. GATE: user approves UX plan
   |
   v
/document
   |
   v
/improve ............... repeat as needed
```

**Adding the 2nd, 3rd, ... app:**

```
/add-app
   |
   v
(same flow: design-model -> implement -> export-model -> build-app -> document -> improve)
```

**Use at any time:**

```
/wip-status ............ start of EVERY session (the AI has no memory)
/bootstrap ............. one-time: set up a fresh WIP instance from seed files
```

## When to Use What

| Command | When | What it does | Gate? |
|---|---|---|---|
| `/wip-status` | **Every session start.** Always. No exceptions. | Queries WIP via MCP tools, lists all terminologies, templates, document counts. Rebuilds the AI's awareness of what exists. | No |
| `/explore` | Starting work on a new WIP instance for the first time. | Reads process docs and LESSONS_LEARNED.md, connects to WIP, inventories everything, checks for existing seed files. | Yes — don't proceed until WIP concepts are understood and all data is inventoried |
| `/design-model` | Starting a new app (or redesigning an existing one). | Gathers domain requirements, checks what WIP already has, proposes terminologies + templates + identity fields + references. | **Yes — user must explicitly approve before any implementation** |
| `/implement` | After user approves the data model. | Creates terminologies and templates in WIP via MCP tools, tests with real documents, verifies versioning and references. Ends with `/export-model`. | Yes — all tests must pass |
| `/export-model` | After `/implement`, or after any data model change. | Captures current WIP terminologies and templates as JSON seed files in `data-model/`. Makes the data model reproducible. | No |
| `/build-app` | After data layer is verified in WIP. | Proposes UX plan (gate!), then scaffolds and builds the React app incrementally. Uses @wip/client and @wip/react at runtime. | **Yes — user must approve UX plan before coding starts** |
| `/document` | After `/build-app`, after significant changes, before any pause. | Generates/updates README, ARCHITECTURE, WIP_DEPENDENCIES, IMPORT_FORMATS, KNOWN_ISSUES, CHANGELOG. | No |
| `/improve` | After the app is built and documented. Ongoing. | One issue per session. Propose before implementing. Commit after each fix. Data model changes go back to `/design-model`. | No formal gate, but rules: propose first, one issue at a time |
| `/bootstrap` | Setting up a fresh WIP instance. | Reads seed files from `data-model/` and creates all terminologies and templates in WIP. Idempotent — safe to re-run. | No |
| `/add-app` | Adding the 2nd, 3rd, etc. app to the constellation. | Inventories existing WIP data, identifies reuse opportunities, then follows the standard cycle (design → implement → build → document). | Same gates as the standard cycle |

## Common Scenarios

**"I just cloned the repo and want to start developing"**
```
/bootstrap        → set up WIP from seed files (if WIP is empty)
/wip-status       → verify everything is in place
/build-app        → start building (if data model already exists)
```

**"New Claude Code session, continuing work on an existing app"**
```
/wip-status       → rebuild awareness
/improve          → fix/enhance one thing at a time
```

**"Starting a brand new app in the constellation"**
```
/wip-status       → see what already exists
/add-app          → follows the full cycle with reuse awareness
```

**"The WIP instance was rebuilt / I moved to a new Raspberry Pi"**
```
/bootstrap        → recreate data model from seed files
/wip-status       → verify
```

**"I changed a terminology or template"**
```
/export-model     → update seed files to match WIP
git commit        → make the change reproducible
```

**"The app is feature-complete, pausing for a while"**
```
/document         → ensure all docs are current
git commit        → save everything
```
