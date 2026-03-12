# WIP Use Case: Personal Finance Constellation

*Part 1 of 3 — Foundational Use Case*

*DRAFT — March 2026*

---

# The Network Effect of Personal Data

It is easy to claim that a unified backend is "better" than isolated app databases. It is harder to prove it. After all, most single-purpose apps work fine on their own, and exporting data for one-off analysis is always possible. The real question is: when does a shared backend create value that fragmented storage fundamentally cannot?

The answer lies in a network effect that operates on your own data.

A single app writing to WIP is convenient — you get schema consistency, API access, and durability. Two apps writing to WIP start to become interesting, because queries can now span both datasets without ETL. But the inflection point comes at three or more apps, where the number of possible cross-dataset queries grows combinatorially. At that point, each new app added to WIP does not just create value for itself — it ***retroactively increases the value of every app already in the system***.

> **The key insight**
> Nobody would build a custom integration between their wine collection app and their child’s school fee tracker. But if both already write to WIP, the query is just there, waiting to be asked. The cost of enabling cross-domain analysis drops to zero — the only investment is asking the right question.

To make this tangible, this document series presents constellations — clusters of apps that each work independently but become dramatically more valuable when their data coexists in a shared backend. We use WIP as that backend — not because WIP prescribes this model, but because WIP’s generic, schema-flexible architecture is naturally suited to it. WIP is equally capable of serving a single app with no cross-links. The constellation approach is an architectural choice made by the app designer, enabled but not imposed by WIP. We begin with the constellation that touches virtually every other domain: personal finance.

# Constellation Overview

The Personal Finance constellation consists of four apps and a cross-cutting BI layer. Each app addresses a distinct aspect of personal financial management. Individually, each is a useful tool. Together, they provide a unified financial picture that no single app — and no manual spreadsheet reconciliation — can match.

|                          |                                                                                       |                                                                                      |
|--------------------------|---------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------|
| **App**                  | **Core Function**                                                                     | **WIP Data Contribution**                                                            |
| **Receipt Scanner**      | Upload purchase receipts (photo/PDF), extract line items via OCR, categorize spending | Item-level purchase records with vendor, date, category, amount, and payment method  |
| **Statement Manager**    | Import bank and employer statements; normalize transactions across institutions       | Account balances, income records, transaction history, employer compensation details |
| **Investment Tracker**   | Track stock, bond, ETF, and fund positions; integrate market data for valuation       | Holdings, cost basis, current value, realized/unrealized gains, dividend history     |
| **Subscription Tracker** | Log recurring charges (streaming, SaaS, insurance, memberships); detect changes       | Subscription inventory with cost, frequency, renewal dates, and price change history |
| **BI Layer**             | Cross-app dashboards, trend analysis, alerts, and scenario modelling                  | Queries and aggregations across all financial data in WIP                            |

# App Details

## App 1: Receipt Scanner & Categorizer

The receipt scanner is the most granular data source in the constellation. While bank statements show that you spent CHF 87.50 at Migros, the receipt tells you that CHF 12.90 of that was wine, CHF 34.60 was groceries, and CHF 40.00 was a household item. This item-level detail is what enables meaningful spending analysis.

### Core workflow

- User uploads a photo or PDF of a receipt (mobile or desktop)

- OCR extracts vendor, date, line items, quantities, prices, VAT, total, and payment method

- Each line item is auto-categorized (groceries, electronics, clothing, etc.) with manual override

- Data is written to WIP as structured records: one receipt entity with linked line-item entities

### Data model (simplified)

|              |                                                                                 |                                                                                                  |
|--------------|---------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| **Entity**   | **Key Fields**                                                                  | **Notes**                                                                                        |
| **Receipt**  | vendor, date, total, currency, payment_method, store_location                   | One per physical receipt. Links to Statement transaction via amount + date matching.             |
| **LineItem** | description, quantity, unit_price, total_price, category, subcategory, vat_rate | Belongs to one Receipt. Category enables roll-up analysis (e.g., total grocery spend per month). |

### Standalone value

Even without the other apps, this provides categorized spending history at item level — far more detailed than any bank statement. Users can answer questions like "How much do I spend on dairy per month?" or "What percentage of my supermarket spending is alcohol?"

### Value added by WIP integration

- Receipt totals auto-reconcile with bank statement transactions (from Statement Manager), catching discrepancies

- Grocery spending from receipts feeds into the Health constellation’s food tracker, linking purchases to nutrition

- Product purchases link to the Home Management constellation for warranty tracking

- The BI layer can trend item-level categories over time, adjusted for inflation (via external CPI data)

## App 2: Financial Statement Manager

This app is the backbone of the constellation. It normalizes financial data from multiple sources — bank accounts, credit cards, employer pay slips — into a single, consistent transaction history.

### Core workflow

- User imports statements via file upload (PDF, CSV, MT940) or, where available, via API integration with their bank

- Parser extracts transactions, normalizes fields, and deduplicates across sources

- Employer statements (pay slips) are parsed for gross/net salary, deductions, tax, social contributions

- All transactions are stored in WIP with a unified schema, regardless of source institution

### Data model (simplified)

|                 |                                                                          |                                                                                               |
|-----------------|--------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------|
| **Entity**      | **Key Fields**                                                           | **Notes**                                                                                     |
| **Account**     | institution, account_type, currency, iban                                | Represents a bank account, credit card, or employer. Multiple accounts per user.              |
| **Transaction** | date, amount, currency, counterparty, description, category, account_ref | Normalized across all sources. Category assigned by rules or ML. Links to Receipt if matched. |
| **PaySlip**     | period, gross, net, tax, social_contributions, employer_ref              | Structured compensation data. Enables income tracking separate from account balance changes.  |

### Standalone value

A unified view of all accounts and income sources. Users can see net worth over time, track income vs. expenses across institutions, and maintain a single financial record without managing multiple bank apps.

### Value added by WIP integration

- Transaction-to-receipt matching links high-level bank transactions to item-level detail

- Subscription Tracker uses transaction patterns to auto-detect recurring charges

- Investment Tracker cross-references dividends and capital gains with account inflows

- Pay slip data combined with tax rules (external data) enables tax liability estimation

## App 3: Investment Portfolio Tracker

This app tracks investment holdings and integrates external market data to provide portfolio valuation, performance measurement, and risk analysis.

### Core workflow

- User logs trades manually or imports broker statements (CSV/PDF)

- App fetches current and historical prices from market data APIs (stocks, bonds, ETFs, funds, crypto)

- Portfolio is valued in real time; performance is calculated against benchmarks

- Dividend and interest income is tracked and linked to the Statement Manager’s account inflows

### External data sources

- Stock/ETF/fund prices and historical performance (Yahoo Finance, Alpha Vantage, or similar)

- Bond yields and credit ratings

- Currency exchange rates (ECB, SNB) for multi-currency portfolios

- Benchmark indices (SMI, S&P 500, MSCI World) for performance comparison

- Dividend calendars and corporate actions

### Standalone value

Real-time portfolio overview with performance tracking, cost basis calculation, and gain/loss reporting. Users can answer: "Am I beating the market?" and "What is my actual annualized return after fees?"

### Value added by WIP integration

- Combines with Statement Manager to compute total net worth (liquid + invested assets)

- Dividend income reconciles with bank account inflows — no double counting

- The BI layer can answer: "What percentage of my income am I investing?" and "How does my savings rate correlate with market returns?"

- Combined with external inflation data: "Is my portfolio keeping pace with real purchasing power?"

## App 4: Subscription Tracker

People consistently underestimate their recurring costs. This app makes the invisible visible by surfacing every ongoing financial commitment.

### Core workflow

- Auto-detection: analyses Statement Manager transactions for recurring patterns (same payee, similar amount, regular interval)

- Manual entry for subscriptions not yet visible in statements (new signups, annual payments not yet due)

- Tracks: service name, amount, frequency (monthly/quarterly/annual), next renewal date, cancellation terms

- Alerts on price increases by comparing current charges against historical records

- Provides a "subscription burn rate" — total monthly cost of all recurring commitments

### Standalone value

A clear inventory of all recurring costs with alerts for price changes and upcoming renewals. Users are frequently surprised by the total — this visibility alone often drives cost-saving decisions.

### Value added by WIP integration

- Statement Manager provides the transaction feed that powers auto-detection — the subscription tracker does not need its own bank integration

- BI layer can show subscription costs as a percentage of income (from pay slips), trended over time

- Cross-link to the Learning constellation: which educational subscriptions (Coursera, Udemy) are actually being used?

# External Data Enrichment

Each app benefits from integration with external data sources that provide context for the user’s personal records. WIP’s role as a shared backend makes this particularly powerful: an external data source integrated once is available to all apps in the constellation.

|                                |                                                     |                                                                                                                                              |
|--------------------------------|-----------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------|
| **Data Source**                | **Provider Examples**                               | **Analysis Enabled**                                                                                                                         |
| **Consumer Price Index (CPI)** | BFS (Swiss Federal Statistics), Eurostat, BLS       | Compare personal spending inflation against national averages by category. "Are my grocery costs rising faster than the CPI food component?" |
| **Interest & policy rates**    | SNB, ECB, Federal Reserve                           | Evaluate savings account returns against base rates. Assess mortgage timing decisions.                                                       |
| **Exchange rates**             | ECB, SNB, Open Exchange Rates                       | Consolidate multi-currency holdings into a single base currency. Track FX impact on portfolio.                                               |
| **Market prices & indices**    | Yahoo Finance, Alpha Vantage, SIX                   | Real-time portfolio valuation. Benchmark comparison. Dividend tracking.                                                                      |
| **Tax rules & brackets**       | Federal/cantonal tax tables (CH), OECD tax database | Estimate tax liability from income data. Model impact of salary changes or deductions.                                                       |

# Cross-App Analysis: The BI Layer

This is where the constellation’s compound value becomes tangible. The BI layer does not own data — it queries WIP across all four apps and their external data enrichments. Below are example analyses that are only possible because the data lives in a shared backend.

## Within the Financial Constellation

- **True savings rate:** Income (pay slips) minus all outflows (transactions) minus subscription burn rate minus investment contributions. A single number that no individual app can compute.

- **Spending composition drill-down:** Start from bank transaction categories (Statement Manager), drill into item-level categories (Receipt Scanner) for any category. "I spent CHF 1,200 on groceries last month — how much of that was convenience food vs. staples?"

- **Net worth trajectory:** Bank balances (Statement Manager) plus portfolio value (Investment Tracker) minus liabilities, plotted over time. One chart, all sources.

- **Subscription-to-income ratio:** Total recurring commitments as a percentage of net income, trended monthly. Alerts if it crosses a threshold.

- **Real return analysis:** Portfolio return (Investment Tracker) minus personal inflation rate (CPI by your actual spending categories from Receipt Scanner). "My portfolio returned 7%, but my cost of living rose 4% — real return is 3%."

## Cross-Constellation Queries

These queries become available as additional constellations are added to WIP, illustrating the network effect:

- **Financial + Energy:** "My energy costs rose 30% year-over-year. How much of that is price increases (external tariff data) vs. increased consumption (meter readings)?" Then: "Is it worth investing in solar panels, and when would they break even?" — combining installation cost (receipt), energy production (Energy constellation), and feed-in revenue (financial).

- **Financial + Home Management:** "Total cost of ownership for my home this year, including mortgage payments, maintenance, renovations, insurance, and energy." Also: "I replaced the windows in March — what was the measurable impact on my heating bill?"

- **Financial + Health:** "I spend CHF 400/month at the supermarket. What percentage of that spend is on nutritionally valuable food vs. alcohol, snacks, and soft drinks?" Requires receipt line items linked to nutritional database categorization.

- **Financial + Vehicle:** "True cost of commuting by car: fuel (receipts/fuel log), insurance, maintenance, depreciation, parking — vs. a public transport annual pass."

- **Financial + Children:** "Total annual cost of raising our child, broken down by category: medical, clothing, education, activities, childcare, food." Requires receipts tagged by family member, school fees, childcare invoices.

> **The network effect in practice**
> Notice that the Financial constellation participates in every cross-constellation query above. This is why we call it foundational. But the pattern is recursive: the Energy constellation will similarly create cross-links to Home Management, and Home Management to Vehicle maintenance, and so on. Each new constellation added multiplies the analytical surface area.

# Suggested Implementation Sequence

The financial constellation benefits from a phased approach where each app builds on the previous one:

|           |                      |                                                                                                       |                                                    |
|-----------|----------------------|-------------------------------------------------------------------------------------------------------|----------------------------------------------------|
| **Phase** | **App**              | **Rationale**                                                                                         | **Prerequisite**                                   |
| **1**     | Statement Manager    | Establishes the foundational transaction feed that other apps depend on                               | None — this is the starting point                  |
| **2**     | Receipt Scanner      | Adds item-level granularity; receipt-to-transaction matching demonstrates cross-app value immediately | Statement Manager (for reconciliation)             |
| **3**     | Subscription Tracker | Builds on transaction patterns from Statement Manager; quick to implement, high user impact           | Statement Manager (for auto-detection)             |
| **4**     | Investment Tracker   | Requires external data integration (market prices); more complex but completes the net-worth picture  | Statement Manager (for dividend reconciliation)    |
| **5**     | BI Layer             | Maximum value when all data sources are in place; can start simple and grow                           | At least Phase 1 + 2 for meaningful cross-analysis |

# Next in the Series

This document is the first in a three-part series illustrating how a shared backend like WIP enables interconnected app constellations:

- **Part 1: Personal Finance Constellation** (this document) — the foundational layer

- **Part 2: Energy & Sustainability Constellation** — meter readings, solar production, tariff analysis, with direct financial cross-links

- **Part 3: Home Management Constellation** — equipment, maintenance, renovation planning, converging energy and financial data

Each subsequent document will include the same introductory section on the network effect, reinforcing the core argument, followed by constellation-specific detail and an expanding map of cross-constellation queries.
