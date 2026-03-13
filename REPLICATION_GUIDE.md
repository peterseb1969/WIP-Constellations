# Replicating the Constellation Experiment

A step-by-step guide for setting up the WIP Constellation development environment. This has been tested on macOS (Apple Silicon) with Claude Code. Adapt paths for Linux.

## Prerequisites

Before starting, you need:

1. **A running WIP instance** — all services (Registry, Def-Store, Template-Store, Document-Store) running locally via Docker/Podman. Follow the WIP repository's setup instructions.
2. **The WIP MCP server** — built and available in the WIP repository at `components/mcp-server/`.
3. **A Python virtualenv** with the MCP server's dependencies installed (the WIP repo's `.venv`).
4. **Claude Code** installed and authenticated (`claude` CLI available in your terminal).
5. **Node.js 20+** for application development (Phase 4).
6. **Git** configured with your name and email.

## Step 1: Clone or create the constellation repository

```bash
mkdir ~/Development/WIP-Constellations && cd ~/Development/WIP-Constellations
git init
git config user.name "Your Name"
git config user.email "your@email.com"
```

Or clone from GitHub if the repository already exists:

```bash
cd ~/Development
git clone https://github.com/yourorg/WIP-Constellations.git
cd WIP-Constellations
```

## Step 2: Create the directory structure

Skip this if you cloned an existing repo that already has these directories.

```bash
mkdir -p .claude/commands
mkdir -p docs/use-cases
mkdir -p apps
mkdir -p shared
```

## Step 3: Place the documentation and configuration files

The repository should contain these files. If cloning, they should already be present. If setting up fresh, copy them from the setup package:

```
.claude/commands/
    explore.md              # /explore — Phase 1 slash command
    design-model.md         # /design-model — Phase 2 slash command
    implement.md            # /implement — Phase 3 slash command
    build-app.md            # /build-app — Phase 4 slash command
    wip-status.md           # /wip-status — inventory check
    add-app.md              # /add-app — add subsequent apps

CLAUDE.md                   # Master instructions (Claude Code reads this automatically)
SETUP_GUIDE.md              # Detailed setup and usage guide
LESSONS_LEARNED.md          # Living experiment log
README.md                   # Project overview

docs/
    AI-Assisted-Development.md      # Copy from WIP repo
    Vision.md                       # Copy from WIP repo (if available)
    WIP_TwoTheses.md
    WIP_DevGuardrails.md
    WIP_ClientLibrary_Spec.md
    use-cases/
        WIP_UseCase_PersonalFinance.md
        WIP_UseCase_Energy.md
        WIP_UseCase_Vehicle.md
        WIP_UseCase_HomeManagement.md
```

Copy the AI-Assisted Development process doc from your WIP repository:

```bash
cp ~/Development/WorldInPie/docs/AI-Assisted-Development.md docs/
```

## Step 4: Connect the WIP MCP server to Claude Code

This is the critical step. The WIP MCP server is a local stdio server that Claude Code starts as a subprocess. **Do not use `.claude/mcp_settings.json`** — local MCP servers are registered via the CLI.

### 4a: Create a launcher script

The MCP server needs to run from the WIP directory with the correct Python environment. A wrapper script handles this cleanly:

```bash
cat > start-wip-mcp.sh << 'SCRIPT'
#!/bin/bash
cd /Users/peter/Development/WorldInPie
PYTHONPATH=components/mcp-server/src WIP_API_KEY=dev_master_key_for_testing .venv/bin/python -m wip_mcp
SCRIPT
chmod +x start-wip-mcp.sh
```

**Adapt the paths for your system:**

| Variable | What to change | Example |
|---|---|---|
| `cd /Users/peter/Development/WorldInPie` | Path to your WIP repository | `cd ~/Development/WorldInPie` |
| `.venv/bin/python` | Path to the Python binary in WIP's virtualenv | `.venv/bin/python` (usually correct) |
| `WIP_API_KEY=dev_master_key_for_testing` | Your WIP API key | Check your WIP `.env` or setup output |
| `PYTHONPATH=components/mcp-server/src` | Path to MCP server source within WIP repo | Usually correct as-is |

**If WIP is running on a different host** (e.g., a Raspberry Pi), add the base URL:

```bash
WIP_BASE_URL=https://wip-pi.local PYTHONPATH=components/mcp-server/src WIP_API_KEY=your-key .venv/bin/python -m wip_mcp
```

If WIP is running locally (Docker on the same machine), no URL is needed — the MCP server defaults to `localhost` on standard ports.

### 4b: Test the launcher manually

```bash
./start-wip-mcp.sh
```

**Expected behaviour:** No output, the process hangs. This is correct — the MCP server communicates via stdin/stdout using JSON-RPC and is waiting for messages. Press `Ctrl+C` to stop it. If you see a Python error instead, fix the paths or dependencies before proceeding.

### 4c: Register the MCP server with Claude Code

```bash
cd ~/Development/WIP-Constellations
claude mcp add wip ./start-wip-mcp.sh
```

### 4d: Remove unrelated MCP servers (optional but recommended)

Claude Code may have cloud-based MCP servers connected (Clinical Trials, PubMed, Google Calendar, etc.). These are unrelated to the constellation experiment and add noise. Remove them:

```bash
claude mcp remove "claude.ai Scholar Gateway"
claude mcp remove "claude.ai Clinical Trials"
claude mcp remove "claude.ai PubMed"
claude mcp remove "claude.ai Google Calendar"
claude mcp remove "claude.ai Gmail"
```

The exact names must match what `claude mcp list` shows. Not all of these may be present on your system.

### 4e: Verify

```bash
claude mcp list
```

Expected output:

```
wip: ./start-wip-mcp.sh  - ✓ Connected
```

If it shows `✗ Failed` or `! Needs authentication`, check:
- Is the WIP instance running? (Docker containers up)
- Is the API key correct?
- Does `./start-wip-mcp.sh` run without errors when tested manually (step 4b)?

## Step 5: Initial commit

```bash
git add -A
git commit -m "Initial setup: documentation, Claude configuration, slash commands"
```

If you have a remote:

```bash
git remote add origin git@github.com:yourorg/WIP-Constellations.git
git branch -M main
git push -u origin main
```

## Step 6: Start the first development session

```bash
cd ~/Development/WIP-Constellations
claude
```

Claude Code starts and automatically reads `CLAUDE.md`. Begin with:

```
> /explore
```

Claude will:
1. Read the AI-Assisted Development doc and LESSONS_LEARNED.md
2. Call WIP MCP tools: `get_wip_status`, `list_terminologies`, `list_templates`
3. Report what exists in WIP and confirm readiness for Phase 2

If the MCP tools work, you'll see real data from your WIP instance. Then continue:

```
> /design-model
```

Claude asks about the domain, you describe what you want to build, it proposes a data model, you review and approve. The process guides everything from there.

## Troubleshooting

### "WIP MCP tools not found"
Claude Code doesn't see the WIP server. Run `claude mcp list` outside of Claude Code to check. If the server isn't listed, re-run `claude mcp add`. If it's listed but shows `✗ Failed`, test the launcher script manually.

### Launcher script hangs with no output
This is correct. The MCP server uses stdio protocol — it produces no terminal output. `Ctrl+C` to stop.

### Launcher script shows Python errors
Common causes:
- **ModuleNotFoundError: No module named 'wip_mcp'** — `PYTHONPATH` is wrong. Check that `components/mcp-server/src/wip_mcp/` exists in your WIP repo.
- **ModuleNotFoundError: No module named 'mcp'** — The MCP SDK isn't installed in the virtualenv. Run `cd ~/Development/WorldInPie && .venv/bin/pip install mcp` (or whatever the MCP server's dependencies are).
- **Connection refused** — WIP services aren't running. Start them first.

### Claude doesn't follow the process / skips gates
The instructions in CLAUDE.md are strong but not infallible. If Claude tries to skip Phase 2 approval or starts writing code before the data model is confirmed, interrupt it explicitly: "Stop. We're still in Phase 2. I haven't approved the data model yet."

### Claude uses the wrong tech stack
If Claude proposes Vue, Svelte, or creates a SQLite database, it either hasn't read CLAUDE.md properly or is ignoring it. Remind it: "Read CLAUDE.md. The tech stack is non-negotiable." This should be rare if CLAUDE.md is present, but watch for it.

## Adapting for a different constellation

The documentation set includes four constellations (Finance, Energy, Vehicle, Home Management), but the process works for any domain. To build a different constellation:

1. Write a use case document following the same pattern as the existing ones (entities, data models, external data sources, cross-app analysis). Place it in `docs/use-cases/`.
2. Use the same CLAUDE.md, slash commands, and process — they are domain-agnostic.
3. Start with `/explore` to inventory what already exists in WIP, then `/design-model` to design your domain's data model.

The whole point of WIP is that it's generic. The constellations described in the use case documents are examples, not limits.

## What to expect

The first session will be slower — Claude is learning the WIP instance, you're learning the process, and there may be configuration hiccups (like the MCP server setup). By the second or third session, the pattern becomes routine: `/wip-status` to rebuild context, then straight into the current phase.

Keep `LESSONS_LEARNED.md` updated as you go. The entries are the experiment's primary output — they capture what works, what doesn't, and what needs to improve.
