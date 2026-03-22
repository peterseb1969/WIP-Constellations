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
> **Data Privacy — when cloud AI meets personal data.**
>
> WIP and the constellation apps run entirely on your local machine. Without any cloud AI involvement, your data never leaves your network — the apps talk to WIP on `localhost`, no external calls.
>
> The privacy concern arises when you use a cloud AI (Claude, ChatGPT, etc.) anywhere in the workflow. There are three channels to be aware of:
>
> 1. **Development context.** When a cloud AI builds or debugs parsers, it reads your sample data files — bank statements, payslips, CSVs — to understand the format. Real financial data enters the AI's context window. This is the channel people miss: it happens before MCP is even involved.
>
> 2. **Development-time MCP queries.** When the AI calls WIP's MCP tools to test what it built (`query_documents`, `search`, etc.), actual data from your WIP instance is returned into the AI's context. Transaction amounts, counterparty names, IBANs, salary details — whatever the query matches.
>
> 3. **Conversational queries.** The "talk to your data" use case — asking a cloud AI questions about your finances via MCP. This is the same mechanism as channel 2, but now it's the feature, not a development side-effect.
>
> **The structural solution exists.** Local AI models (via Ollama or similar) speak the same MCP protocol and can handle all three channels without data leaving your machine. WIP's architecture supports this today. The tradeoff is capability — local models are currently less capable than cloud models.
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
| [Field Report: Day 1](WIP_Journey.md) | The experiment begins — process design, first app, MCP discovery |
| [Field Report: Day 2](WIP_Journey_Day2.md) | Clean rebuild, containerisation, ecosystem thinking |
| [Field Report: Day 3](WIP_Journey_Day3.md) | Adversarial review on a train — no code, all sparring |
| [Field Report: Day 4](WIP_Journey_Day4.md) | Raspberry Pi deployment, platform bugs, performance |
| [Field Report: Day 4½](WIP_Journey_Day4_Intermezzo.md) | Cache regression, benchmarking, 7x throughput improvement |
| [Field Report: Day 5](WIP_Journey_Day5.md) | The reporter discovers its own blind spots |
| [Field Report: Day 6](WIP_Journey_Day6.md) | Hardware investigation, module audit, Receipt Scanner in 2h15m |
| [Field Report: Day 7](WIP_Journey_Day7.md) | The checklist — publishing focus, quality audit, CI pipeline |
| [Field Report: Day 8](WIP_Journey_Day8.md) | The process — MCP expansion (69 tools), doc overhaul, Viseca/DKB parsers |

## Prerequisites

- A running WIP instance ([WIP repository](https://github.com/peterseb1969/World-in-a-Pie))
- The WIP MCP server configured for Claude Code
- Node.js 20+ for app development
- Docker/Podman for containerisation

## For AI developers (Claude Code)

The repository includes a `CLAUDE.md` and custom slash commands in `.claude/commands/`. Start a Claude Code session in this directory and run:


/explore # Phase 1: connect to WIP, inventory existing data /design-model # Phase 2: design the data model /implement # Phase 3: create terminologies and templates in WIP /build-app # Phase 4: build the application
