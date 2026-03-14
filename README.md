# WIP Constellation

Applications built on [World In a Pie (WIP)](https://github.com/peterseb1969/World-in-a-Pie) using AI-assisted development.

## What is this?

An experiment testing two theses simultaneously:
1. That a shared backend creates compounding value across personal data applications
2. That an AI assistant, given a structured process and platform guardrails, can build real applications

See [Two Theses, One Experiment](docs/WIP_TwoTheses.md) for the full argument.

## Disclaimer

This is a personal experiment, not a product. The app supports a random combination of bank statement formats and payslip layouts that happened to be useful for testing. The parsers are brittle by design: they work for a specific selection of input files and will almost certainly fail on yours. Nothing here is intended to be reusable, general-purpose, or production-ready. If you find the *approach* interesting, look at the process and the WIP platform — not the app code.

> [!CAUTION]
> **Data Privacy — only relevant if you connect a cloud AI via MCP.**
>
> WIP and the constellation apps run entirely on your local machine. Without MCP, your data never leaves your network — the apps talk to WIP on `localhost`, no external calls.
>
> The privacy concern arises **only** when you connect a cloud AI (Claude, ChatGPT, etc.) to WIP's MCP server to query your data conversationally. In that scenario, whatever data the AI needs to answer your question — transaction amounts, counterparty names, IBANs, salary details — is sent to the AI provider's servers for processing.
>
> If you don't use MCP with a cloud AI, this does not apply to you. If you do, the tradeoff is: local data sovereignty at rest, cloud processing in transit. The structural solution exists — local AI models (via Ollama or similar) speak the same MCP protocol and keep everything on-device. WIP's architecture is ready for that today.
>
> **This should be a conscious choice, not an invisible default.**

## Status

🚧 Experiment in progress. Starting with the Personal Finance constellation.

## Documentation

| Document | Purpose |
|---|---|
| [Two Theses](docs/WIP_TwoTheses.md) | Why this experiment exists |
| [Personal Finance Use Case](docs/use-cases/WIP_UseCase_PersonalFinance.md) | First constellation: receipts, statements, investments, subscriptions |
| [Energy Use Case](docs/use-cases/WIP_UseCase_Energy.md) | Second constellation: metering, solar, climate |
| [Vehicle Use Case](docs/use-cases/WIP_UseCase_Vehicle.md) | Satellite: fuel, trips, maintenance, TCO |
| [Home Management Use Case](docs/use-cases/WIP_UseCase_HomeManagement.md) | Third constellation: equipment, maintenance, renovation |
| [Development Guardrails](docs/WIP_DevGuardrails.md) | UI stack, container patterns, testing contract |
| [Client Library Spec](docs/WIP_ClientLibrary_Spec.md) | @wip/client and @wip/react specification |
| [AI-Assisted Development](docs/AI-Assisted-Development.md) | The phased development process |
| [Lessons Learned](LESSONS_LEARNED.md) | Living record of experiment observations |

## Prerequisites

- A running WIP instance ([WIP repository](https://github.com/peterseb1969/World-in-a-Pie))
- The WIP MCP server configured for Claude Code
- Node.js 20+ for app development
- Docker/Podman for containerisation

## For AI developers (Claude Code)

The repository includes a `CLAUDE.md` and custom slash commands in `.claude/commands/`. Start a Claude Code session in this directory and run:


/explore # Phase 1: connect to WIP, inventory existing data /design-model # Phase 2: design the data model /implement # Phase 3: create terminologies and templates in WIP /build-app # Phase 4: build the application
