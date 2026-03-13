# Constellation Repository Setup Guide

This guide explains how to structure the constellation repository and configure Claude for AI-assisted development on WIP.

## Architecture Overview

The AI interacts with WIP through two interfaces at different stages:

```
Development time (Phases 1–3):          Runtime (Phase 4):

┌──────────┐    MCP Protocol    ┌──────────────┐    HTTP/REST    ┌─────┐
│  Claude   │ ◄──────────────► │ WIP MCP      │ ──────────────► │ WIP │
│  (AI)     │                   │ Server       │                 │ APIs│
└──────────┘                    └──────────────┘                 └─────┘

                                ┌──────────────┐    HTTP/REST    ┌─────┐
                                │ Running App  │ ──────────────► │ WIP │
                                │ (@wip/client)│                 │ APIs│
                                └──────────────┘                 └─────┘
```

**WIP MCP Server** — Claude's development-time interface. The AI calls tools like `list_terminologies`, `create_template`, `validate_document` to explore WIP, build data models, and test. The MCP server absorbs WIP's bulk-first API complexity — the AI never composes raw HTTP calls or parses bulk response envelopes.

**@wip/client** — The application's runtime interface. The finished app uses this TypeScript library to interact with WIP on behalf of end users. Same bulk abstraction, same error normalisation, but running in the browser or Node.js as part of the deployed application.

Both interfaces talk to the same WIP instance. Data created via MCP tools during development is immediately available to the running application via @wip/client, and vice versa.

## Repository Structure

```
constellation/
├── CLAUDE.md                           # ← Claude Code reads this automatically
├── .claude/
│   └── commands/
│       ├── explore.md                  # /explore — Phase 1: connect to WIP, inventory
│       ├── design-model.md             # /design-model — Phase 2: data model design
│       ├── implement.md                # /implement — Phase 3: create terminologies, templates, test
│       ├── build-app.md                # /build-app — Phase 4: scaffold and build the UI
│       ├── wip-status.md               # /wip-status — check current WIP state
│       └── add-app.md                  # /add-app — add a new app to the constellation
├── LESSONS_LEARNED.md                  # Living document: experiment observations and bugs
├── docs/
│   ├── AI-Assisted-Development.md      # The development process (from WIP project)
│   ├── WIP_TwoTheses.md               # Vision and experiment framing
│   ├── WIP_DevGuardrails.md            # UI stack, container patterns, testing contract
│   ├── WIP_ClientLibrary_Spec.md       # @wip/client and @wip/react specification
│   └── use-cases/
│       ├── WIP_UseCase_PersonalFinance.md
│       ├── WIP_UseCase_Energy.md
│       ├── WIP_UseCase_Vehicle.md
│       └── WIP_UseCase_HomeManagement.md
├── apps/
│   ├── statements/                     # First app: Statement Manager
│   │   ├── app-manifest.json
│   │   ├── Dockerfile
│   │   ├── docker-compose.yml
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── src/
│   │   └── tests/
│   ├── receipts/                       # Second app: Receipt Scanner
│   └── ...                             # Future apps
├── shared/
│   └── tailwind-preset.ts              # Shared design tokens (imported by all apps)
├── docker-compose.yml                  # Ecosystem compose (all apps + gateway)
└── README.md                           # Project overview
```

## How the Configuration Works

### CLAUDE.md
Claude Code automatically reads `CLAUDE.md` at the start of every session. It contains:
- The golden rule (never bypass WIP)
- The two-interface model (MCP for development, @wip/client for runtime)
- The mandatory phased process with gates
- The tech stack (non-negotiable)
- WIP concepts the AI must understand
- Pointers to detailed documentation

**Keep it concise and directive.** Claude Code has limited context at session start; dense instruction files are more effective than verbose ones.

### WIP MCP Server
The MCP server is the AI's primary interface to WIP during Phases 1–3. It must be configured in Claude Code's MCP settings before starting development.

**Configuration for Claude Code** (in `~/.claude/mcp_settings.json` or project-level `.claude/mcp_settings.json`):

```json
{
  "mcpServers": {
    "wip": {
      "command": "python",
      "args": ["-m", "wip_mcp_server"],
      "env": {
        "WIP_HOST": "https://wip-pi.local",
        "WIP_API_KEY": "your-api-key"
      }
    }
  }
}
```

Or, if the MCP server is running as a remote SSE endpoint:

```json
{
  "mcpServers": {
    "wip": {
      "type": "sse",
      "url": "http://wip-pi.local:8010/sse"
    }
  }
}
```

**Available MCP tools** (the AI discovers these automatically):

| Tool | Phase | Purpose |
|---|---|---|
| `get_wip_status` | 1 | Health check of all WIP services |
| `list_namespaces` | 1 | Discover namespace structure |
| `list_terminologies` | 1, 2 | Inventory existing vocabularies |
| `list_templates` | 1, 2 | Inventory existing schemas |
| `get_template_schema` | 2 | Inspect a template's fields and structure |
| `search_terms` | 2 | Search terms within a terminology |
| `create_terminology` | 3 | Create a new terminology |
| `create_terms` | 3 | Add terms to a terminology |
| `import_terms` | 3 | Bulk import terms (CSV/JSON) |
| `create_template` | 3 | Create a new template |
| `create_document` | 3 | Create/upsert a document |
| `validate_document` | 3 | Dry-run validation without creating |
| `query_documents` | 3+ | Query documents by template and filters |
| `get_ontology_relationships` | 2, 3 | Traverse term relationships |
| `get_api_conventions` | 1 | WIP's API patterns (for understanding) |

### Custom Slash Commands
The `.claude/commands/` directory defines custom commands that guide Claude through the development process:

| Command | When to Use | What It Does |
|---|---|---|
| `/explore` | Starting work on a new WIP instance | Phase 1: use MCP tools to discover and inventory WIP |
| `/design-model` | Starting a new app | Phase 2: gather requirements, validate against existing data, propose model, wait for approval |
| `/implement` | After data model is approved | Phase 3: use MCP tools to create terminologies, templates, test documents |
| `/build-app` | After data layer is verified | Phase 4: scaffold app, build UI with @wip/client, containerize, test |
| `/wip-status` | Start of any session | Quick inventory via MCP tools — rebuilds session awareness |
| `/add-app` | Adding a 2nd, 3rd, etc. app | Reuse-aware process for incremental constellation growth |

**Usage in Claude Code:**
```
> /explore
> /design-model
> /implement
> /build-app
```

## Setup Steps

### 1. Create the repository
```bash
mkdir constellation && cd constellation
git init
```

### 2. Copy the configuration files
Place the files from this setup package:
- `CLAUDE.md` → repo root
- `.claude/commands/*.md` → `.claude/commands/`
- Documentation files → `docs/` and `docs/use-cases/`

### 3. Copy AI-Assisted-Development.md from WIP
This file lives in the WIP repository. Copy it into `docs/`:
```bash
cp /path/to/wip/docs/AI-Assisted-Development.md docs/
```

### 4. Configure the WIP MCP server
Follow the instructions in `REPLICATION_GUIDE.md` to create the launcher script and register the MCP server with Claude Code. The short version:

```bash
# Create launcher script (adapt paths for your system)
cat > start-wip-mcp.sh << 'SCRIPT'
#!/bin/bash
cd /path/to/your/wip-repo
PYTHONPATH=components/mcp-server/src WIP_API_KEY=your-api-key .venv/bin/python -m wip_mcp
SCRIPT
chmod +x start-wip-mcp.sh

# Register with Claude Code
claude mcp add wip ./start-wip-mcp.sh

# Verify
claude mcp list
```

### 5. Create shared Tailwind preset
Create `shared/tailwind-preset.ts` with the design tokens from WIP_DevGuardrails.md Guide 2. All apps extend this preset.

### 6. Start developing
```bash
# In Claude Code:
> /explore          # Connect to WIP via MCP, inventory existing data
> /design-model     # Design the Statement Manager data model
> /implement        # Create terminologies and templates via MCP tools
> /build-app        # Build the Statement Manager UI with @wip/client
```

## Tips for Working with Claude

### Be explicit about gates
When Claude presents a data model (Phase 2), review it carefully. Say "approved" to proceed or ask questions. Claude is instructed to wait — but reinforcing this with clear language helps.

### Use /wip-status at every session start
Claude has no memory between sessions. The MCP tools give it instant access to WIP's current state, but only if it actually calls them. `/wip-status` ensures this happens before any work begins.

### The MCP server is for exploration and creation, not for app code
A common confusion: the MCP server is Claude's tool during development. The running application does NOT use the MCP server — it uses `@wip/client`. If Claude starts writing app code that calls MCP tools, correct it.

### Course-correct early
If Claude starts down a wrong path (wrong tech choice, skipping a step, inventing a local database), interrupt immediately. The CLAUDE.md instructions and MCP tools significantly reduce deviation, but the human remains the authority.

### Contribute to lessons learned
The `LESSONS_LEARNED.md` file in the repo root is a living record of the experiment. When something goes wrong (or unexpectedly right), add an entry. The format is structured: date, category, phase, severity, what happened, why it matters, and what was done. These entries are primary evidence for the Two Theses evaluation.

### Track what works and what doesn't
This is an experiment. Note which instructions Claude follows well, which it ignores, and where it struggles. Note especially whether the MCP server reduces errors compared to raw API usage. This feedback improves the configuration over time and contributes to the Thesis 2 evidence.

## Relationship to WIP

This repository is separate from WIP's repository. The boundary is clean:

- **WIP repo** contains: WIP services, WIP MCP server, @wip/client library, client library spec, WIP Console
- **Constellation repo** contains: use case docs, app code, development configuration (CLAUDE.md, commands), this setup guide

The interfaces between the two repos are:
- **@wip/client** (npm package) — used by running applications
- **WIP MCP server** (MCP protocol) — used by the AI during development
- **WIP HTTP APIs** — the underlying interface that both of the above consume
