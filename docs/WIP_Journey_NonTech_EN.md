# What If All Your Personal Data Lived in One Place?

*A day-one report from an experiment in AI-built software and personal data sovereignty.*

---

## The Problem You Didn't Know You Had

You probably use dozens of apps that know things about you. Your banking app knows your transactions. Your fitness tracker knows your steps. Your energy provider knows your electricity consumption. Your supermarket loyalty card knows what you eat. Your employer knows what you earn.

But none of them talk to each other.

Want to know how much of your grocery spending goes to healthy food versus snacks? You'd need to cross-reference your bank transactions with your supermarket receipts and a nutritional database. Want to know the true cost of commuting by car — including fuel, insurance, maintenance, depreciation, and parking — compared to a train pass? You'd need data from five different sources, none of which share a format.

Today, the only tool that can do this is a spreadsheet. And the person operating it is you, manually copying numbers between apps, hoping the formats match, and starting over when something changes.

**What if there were a single place where all this data could live — structured, connected, and queryable?**

That's what this experiment is about.

---

## What Is WIP?

**World In a Pie (WIP)** is a software platform — think of it as a universal filing cabinet for structured data. It doesn't know anything about finance, energy, health, or vehicles. Instead, it provides building blocks:

- **Vocabularies**: standardised lists of allowed values. For example, a list of currencies (CHF, EUR, USD) or a list of transaction types (debit card, bank transfer, standing order). These ensure everyone speaks the same language.
- **Templates**: blueprints that define what a piece of data looks like. A "bank transaction" template says: every transaction must have a date, an amount, a currency (from the currency vocabulary), and an account reference. If you try to store something that doesn't fit the blueprint, the system rejects it.
- **Documents**: the actual data, validated against a template. Every piece of data is checked, versioned (the system remembers every change), and linked to related data in other templates.

WIP doesn't care what you store. A recipe collection, a stamp catalogue, a clinical trial database — it handles them all the same way. The power comes from the fact that everything shares the same infrastructure: the same validation, the same versioning, the same query language.

**WIP runs on a Raspberry Pi** — a credit-card-sized computer costing about CHF 80. Your data stays in your home, on your network, under your control. No cloud subscriptions. No data harvesting. No terms of service that change without notice.

---

## The Two Big Ideas Being Tested

### Idea 1: Your Data Is Worth More Connected

A single app storing your bank transactions is useful. A second app storing your receipts is also useful. But if both apps store their data in WIP, something new becomes possible: you can ask questions that span both datasets.

"I spent CHF 87.50 at Migros last Tuesday." That's what the bank transaction tells you. But the receipt tells you that CHF 12.90 was wine, CHF 34.60 was groceries, and CHF 40 was a household item. With both in WIP, you can ask: *"How much do I spend on alcohol per month?"* — a question neither app could answer alone.

Now imagine adding a third app that tracks your energy consumption, and a fourth that manages your home equipment. Suddenly you can ask: *"I replaced my windows last March. What was the measurable impact on my heating bill?"* That question draws on your energy meter data, your financial records, your equipment registry, and weather data — all from different apps, all answerable because the data lives in one place.

This is what we call the **network effect on personal data**: each new app doesn't just add its own value — it increases the value of every app already in the system. The connections between datasets grow faster than the datasets themselves.

**Nobody would build a custom integration between their wine collection app and their child's school fee tracker.** But if both already store their data in WIP, the query is just there, waiting to be asked.

### Idea 2: AI Can Build the Apps — If You Give It Guardrails

Here's where it gets interesting. Having a universal data platform is only useful if there are apps built on it. Building apps takes time, skill, and money. What if an AI could do it?

Not the kind of AI that generates a pretty demo and falls apart when you use it for real. The kind that builds working software against a real platform, with real data validation, real error handling, and real user interfaces.

The key insight: **an AI building from scratch will make hundreds of decisions, and many of them will be wrong.** Which database to use? How to handle errors? How to validate input? How to version data? Each decision is an opportunity for inconsistency, bugs, and technical debt.

But an AI building on WIP doesn't have to make most of those decisions. WIP makes them:

- *"Should I validate the data?"* — WIP validates automatically. The AI can't store invalid data.
- *"How do I handle versioning?"* — WIP versions automatically. Submit the same record twice, you get version 2, not a duplicate.
- *"How do I link related data?"* — WIP resolves references automatically. The AI says "this receipt belongs to that transaction" and WIP ensures the link is valid.
- *"How do I make the data queryable?"* — WIP syncs to a SQL database automatically. No pipeline to build.

The AI's freedom is reduced to the decisions that actually matter: what data does the user need? What should the screens look like? How should the import process work? These are the questions where human input is essential — and the AI can ask them, get answers, and build accordingly.

**WIP is the guardrail that makes AI-built software viable.** Not by limiting what the AI can do, but by ensuring that the infrastructure decisions are already made correctly.

---

## What Actually Happened (In One Day)

### Morning: Designing the Vision

We started by mapping out what a personal data ecosystem could look like. Not one app — a constellation of apps:

**Personal Finance** (the foundation): An app to manage bank statements, one for purchase receipts, one for recurring subscriptions, one for investments. Each useful alone, but together they provide a complete financial picture — net worth, true savings rate, spending breakdown to the individual product level.

**Energy & Sustainability**: Apps to track your electricity and gas consumption, your solar panel production, your home's indoor climate. Combined with weather data and energy prices, these answer: *"Is my heating bill high because it was cold, or because something is wrong?"*

**Home Management**: An equipment registry (what you own, where the manual is, when the warranty expires), a maintenance log, a renovation planner. Combined with financial data: *"What was the total cost of owning my home this year?"* Combined with energy data: *"Did the new insulation actually reduce my heating bill?"*

**Vehicle & Mobility**: Fuel logs, trip classification, service history. Combined with everything else: *"What does it truly cost me to commute by car, including everything — and is a train pass cheaper?"*

Each constellation was documented with concrete data models, specific examples, and — crucially — the cross-links that make the whole greater than the sum of its parts.

### Afternoon: Building for Real

Then an AI (Claude, by Anthropic) started building. Following a structured four-step process:

**Step 1 — Explore:** The AI connected to a running WIP instance and inventoried what was already there. Like a new employee's first day — look around before touching anything.

**Step 2 — Design:** The AI proposed a data model for the Statement Manager: what vocabularies are needed (currencies, account types, transaction categories), what templates (accounts, transactions, payslips), and critically, what makes each record unique (the IBAN for accounts, the bank's transaction ID for transactions). The human reviewed and approved. No code was written until the design was confirmed.

**Step 3 — Implement the data layer:** The AI created the vocabularies and templates in WIP, then tested with real Swiss bank data (UBS and Yuh exports, a real payslip). It verified that importing the same statement twice doesn't create duplicates, that invalid data is rejected, and that links between records work correctly.

**Step 4 — Build the user interface:** The AI built a web application — a real, interactive tool with pages for accounts, transactions, payslips, and data import. Using a prescribed set of modern web technologies, consistent styling, and proper error handling.

By evening, a working Statement Manager was running on `localhost:3001`. Not a mockup. A real app, storing real financial data in WIP, with validated schemas, versioned records, and cross-referenced entities.

---

## What Went Wrong (And Why That's the Point)

An experiment that reports only success isn't an experiment — it's a sales pitch. Here's what actually went wrong, and what we learned:

### The AI's Documentation Was Wrong

An intermediary component (the "MCP server" — a bridge that lets the AI interact with WIP) had three incorrect field names in its documentation. The AI that wrote it used field names from memory instead of checking the actual system. Two of the three errors were the dangerous kind: WIP would have appeared to accept the data while silently skipping validation. You'd only discover the problem weeks later when querying your data.

**The fix:** We now automatically generate the documentation from the same source code that enforces the validation. The field names can't diverge because they come from the same place.

**The lesson:** When an AI writes documentation, verify it against the system it documents. Confidence is not correctness.

### The AI Ran Out of "Memory"

AI assistants have a limited working memory (called a "context window"). Building an entire application in one session exceeded that limit. All uncommitted code was lost. The data model (stored in WIP) survived, but the user interface had to be rebuilt.

**The fix:** Build incrementally — one feature at a time, save after each. If the AI's memory resets, it picks up from the last save, not from zero.

**The lesson:** AI coding works best in focused sessions, not marathons. Just like human developers, actually.

### The AI Never Asked About the User Experience

The AI built a technically correct app without once asking: "What should the main screen show? How should the navigation work? What's the most important feature?" It made every design decision silently, based on reasonable defaults.

**The fix:** A mandatory checkpoint before building the interface. The AI must describe its plan — pages, navigation, workflows — and wait for human approval. Ten lines of description that prevent hundreds of lines of wasted code.

**The lesson:** AI needs to be told to ask, not just to build. The data model had an approval step; the user interface didn't. We added one.

### The Data Model Wasn't Saved to Files

The AI created the data structures interactively in WIP — fast and efficient. But those structures existed only in the running system. If the Raspberry Pi's SD card failed, or someone wanted to replicate the experiment, there was no way to recreate the data model.

**The fix:** After every design phase, the AI now exports the data structures as files that are version-controlled alongside the code. A single command recreates everything on a fresh system.

**The lesson:** This is the same principle every software team knows: don't make changes to a live system and hope someone remembers what you did. Write it down in a file that can be replayed.

---

## Why This Matters (Beyond the Technical Achievement)

### Personal Data Sovereignty

Today, your data is held hostage by the apps you use. Your banking data is in your bank's app. Your health data is in Apple Health or Google Fit. Your energy data is in your provider's portal. You can sometimes export it (as a CSV file you'll never look at), but you can't *use* it in combination with other data without significant technical skill.

WIP changes this. Your data lives on your hardware, in your home, in a structured format that any app can read. You don't need to trust a cloud provider to keep your data safe or to not change their terms. You don't need to beg for an API. You own the data, you own the infrastructure, and you can build (or have AI build) any app you want on top of it.

### The End of "Walled Gardens"

Every app today is a walled garden. Your fitness tracker doesn't know what you eat. Your recipe app doesn't know what you bought. Your energy monitor doesn't know what you paid. The data exists, but the walls between apps prevent it from being useful.

The constellation model tears down the walls — not by forcing apps to talk to each other (which requires endless integration work), but by having them share a common data layer from the start. The "integration" is free, because there's nothing to integrate. The data is already in the same place.

### AI as a Practical Tool Builder

Most AI demonstrations show impressive but useless things: chatbots that are clever, image generators that are beautiful, code that works in a demo and falls apart in production. This experiment tests something different: can AI build *practical tools* that a real person uses every day to manage their real life?

The answer so far is "yes, with guardrails." An unconstrained AI produces inconsistent, fragile software. An AI building on a structured platform (WIP), following a structured process (phased development with approval gates), and using structured tools (the MCP server and typed libraries) produces working software in a day.

If this pattern holds — if the second and third apps are as successful as the first — it means anyone with a Raspberry Pi and access to an AI assistant could build their own personal data ecosystem. Not "in the future." Now.

### The Real Prize: Talk to Your Own Data

Everything described above — the apps, the shared backend, the cross-links — was designed as a technical architecture. Build apps, store data, run queries. Useful, but still a tool for technically minded people.

Then something unexpected happened. A component we built for development purposes — a bridge that lets AI assistants interact directly with WIP — turned out to be far more than a developer tool. It's a universal interface that lets **any AI assistant query all your data, across all your apps, in plain language.**

This changes the entire picture.

You don't need to build dashboards. You don't need to learn a query language. You don't even need to open an app. You just ask:

*"How much did I spend on dining out this year?"*

The AI connects to WIP, queries your transaction data, filters by category, and answers. Two seconds. No spreadsheet.

*"My energy bill seems high. Is it the price or my consumption?"*

The AI queries your meter readings, your tariff history, and weather data. It tells you: "Your consumption is actually down 5% year-over-year, but your tariff increased 18% in January. The higher bill is entirely a price effect."

*"Should I replace my windows?"*

The AI checks your energy data (how much heat you're losing), your equipment registry (how old the windows are), construction cost databases (what new windows cost in your area), government subsidy programmes (what grants are available), your financial records (whether you can afford it), and property valuations (whether it increases your home's value). It gives you a reasoned answer, grounded in *your* data.

No consultant. No spreadsheet weekend. A question and an answer.

**This is only possible because the data is structured.** An AI querying a random folder of bank PDFs and scanned receipts would guess, hallucinate, and get things wrong. An AI querying WIP gets standardised categories, validated data, verified cross-references, and version history. The discipline that WIP imposes on data entry is what makes conversational data access trustworthy rather than a gimmick.

The apps are how data gets *in* — structured and validated. WIP is how data stays *connected* — across every domain in your life. And the AI is how insight comes *out* — in your language, about your questions, from your data, on your hardware.

That's not a technical achievement for developers. That's a **personal data assistant for everyone.**

### The Compounding Effect

This makes the compounding effect even more powerful than we originally described. We have one app. The constellation thesis says the magic happens at three or more, when the cross-connections between datasets become rich enough to answer questions no single app could answer.

Imagine a renovation decision — should I replace my old windows? — that draws on:
- Your energy meter data (how much heating energy are you wasting?)
- Your indoor temperature sensors (which rooms lose heat fastest?)
- Your equipment registry (how old are the windows? What's their thermal rating?)
- Construction cost databases (how much will new windows cost in your area?)
- Government subsidy programmes (what grants are available?)
- Your financial records (can you afford it? What's the payback period?)
- Property valuations (will it increase your home's value?)

Seven data sources, three constellations, one question. Today, answering this requires hiring a consultant or spending a weekend with spreadsheets. With a mature constellation ecosystem on WIP, it's a query.

**That's the prize.** Not just apps. Not just data. But the ability to make informed decisions about your life by connecting data that was always yours but was never accessible in combination.

---

## Where Things Stand

After one day:

- A working Statement Manager app, running on a Raspberry Pi, managing real Swiss bank transactions and payslips
- A structured process for AI-assisted app development, tested and refined through eight documented lessons
- Detailed designs for four constellations (finance, energy, home management, vehicle) ready for implementation
- Everything open, documented, and available for anyone who wants to build on it or follow along

After one day, the first app works. The second app will test whether connected data is truly more valuable than isolated data. The third app will test whether the pattern scales.

**The experiment is public. The process is documented. The invitation stands: watch, critique, build your own, or wait for results.**

*Current status: one app running, ten lessons learned, zero cross-app queries — but the most important discovery was the last one. We set out to build apps on a shared backend. We ended up building the foundation for a personal data assistant. A system where you don’t analyse your data — you just ask it questions.*
