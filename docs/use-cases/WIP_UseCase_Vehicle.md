# WIP Use Case: Vehicle & Mobility

*Part 2.1 — Satellite of the Energy & Sustainability Constellation*

*DRAFT — March 2026*

---

# Why Part 2.1?

A vehicle is simultaneously an energy consumer, a financial asset, an operational tool, and a maintenance commitment. No single constellation fully claims it. The fuel and charging dimension is firmly within Energy (Part 2). The purchase price, depreciation, insurance, and running costs are Financial (Part 1). The service history and parts inventory resemble Home Management (Part 3).

Rather than split the vehicle across three documents — or inflate it into a full constellation of its own — this satellite document treats the vehicle as a single, unified subject. It is self-contained: you can implement the vehicle manager on its own and get immediate value. But its full potential is unlocked when connected to the Energy and Financial constellations via WIP.

> **The satellite pattern**
> Part 2.1 establishes a reusable format for topics that straddle constellations. A satellite is too rich for a subsection, too focused for a full constellation, and too cross-cutting to belong to just one. Future satellites might include Tax Planning (1.1), Garden & Outdoor (3.1), or Pet Management. The “.1” numbering signals the primary gravitational pull while acknowledging independence.

One more thing: this document covers vehicle management at a level appropriate for most households. WIP’s flexible schema means an enthusiast could extend this to track individual component wear, modification history, track day telemetry, or a multi-vehicle fleet — without any changes to the platform. The depth is yours to choose.

# The Vehicle Manager: One App, Multiple Facets

Unlike the Energy constellation — which comprises three distinct apps — the vehicle use case is best served by a single app with multiple modules. Each module captures a different aspect of vehicle ownership, but they share a common vehicle identity and timeline.

|                           |                                                                                                  |                                                                                                                 |
|---------------------------|--------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------|
| **Module**                | **Core Function**                                                                                | **WIP Data Contribution**                                                                                       |
| **Fuel & Charging Log**   | Record every refuelling or charging event: date, quantity, cost, location, odometer reading      | Energy consumption time-series per vehicle, cost per km, consumption trends (l/100km or kWh/100km)              |
| **Trip Logger**           | Log trips with purpose (commute, business, private, leisure), distance, start/end location       | Mileage breakdown by purpose. Basis for tax-deductible business travel claims. Commute cost analysis.           |
| **Service & Maintenance** | Track oil changes, tyre rotations, brake replacements, MFK inspections, warranty claims, recalls | Service history with parts, labour costs, and intervals. Predictive maintenance reminders. Evidence for resale. |
| **Ownership & Valuation** | Purchase details, financing terms, insurance, registration, and current market value tracking    | Depreciation curve, total cost of ownership calculation, insurance cost history, financing amortisation         |

# Module Details

## Fuel & Charging Log

This module is the energy bridge — the reason the vehicle is a satellite of Part 2 rather than Part 1 or Part 3.

### Core workflow

- After each refuelling or charging event, the user logs: date, odometer reading, quantity (litres or kWh), total cost, station/location, and fuel type (petrol, diesel, electricity, hydrogen)

- For home EV charging: consumption can be derived from the Utility Meter Tracker (Part 2) if a dedicated meter or smart plug measures the wallbox, or logged manually

- The app calculates consumption (l/100km or kWh/100km) between fill-ups, and cost per km

- Over time, consumption trends reveal driving pattern changes, seasonal effects (winter tyres, air conditioning), and potential mechanical issues (rising consumption may indicate engine or tyre problems)

### Data model

|               |                                                                                                                           |                                                                                                                               |
|---------------|---------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| **Entity**    | **Key Fields**                                                                                                            | **Notes**                                                                                                                     |
| **Vehicle**   | make, model, year, fuel_type, engine_displacement, battery_capacity_kwh, vin, license_plate, purchase_date                | Master record. Supports multiple vehicles per household. fuel_type determines which consumption metrics apply.                |
| **FuelEvent** | vehicle_ref, date, odometer_km, quantity, unit (litres/kWh), price_per_unit, total_cost, fuel_type, station, is_full_tank | is_full_tank matters: accurate l/100km calculation requires tank-to-tank measurement. Partial fills are recorded but flagged. |

### Energy constellation link

For electric vehicles, home charging creates a direct data link to Part 2. The Utility Meter Tracker records the electricity drawn by the wallbox. The Solar Monitor shows whether that electricity came from your own panels (essentially free, after capital cost) or from the grid. The tariff data determines what the grid electricity cost. Together, these answer a question that no standalone fuel-log app can: “What did this charge actually cost me, given my solar production at the time?”

## Trip Logger

Trip logging serves two distinct purposes: tax documentation and personal mobility analysis. In Switzerland and most European jurisdictions, business-related vehicle use is tax-deductible — but only if properly documented with date, purpose, route, and kilometres.

### Core workflow

- User logs each trip: date, start/end odometer (or GPS distance), start/end location, purpose (commute, business, personal, leisure), and optional notes

- Business trips can link to a client, project, or meeting for audit traceability

- The app produces reports compliant with Swiss tax authority requirements: total business km, total private km, ratio applied to vehicle expenses

- Commute analysis: distance, time, frequency, and cost — compared against public transport alternatives

### Data model

|                   |                                                                                                                        |                                                                                                                        |
|-------------------|------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------|
| **Entity**        | **Key Fields**                                                                                                         | **Notes**                                                                                                              |
| **Trip**          | vehicle_ref, date, start_odometer, end_odometer, distance_km, purpose, start_location, end_location, client_ref, notes | purpose is the key classification field. Business trips require additional detail (client/project) for tax compliance. |
| **AnnualSummary** | vehicle_ref, year, total_km, business_km, commute_km, private_km, business_ratio                                       | Derived entity, computed from Trip data. The business_ratio drives the tax-deductible share of all vehicle costs.      |

> **The tax deduction cross-link**
> This is one of the strongest cross-constellation connections in the entire WIP ecosystem. The trip logger provides the business-use ratio. The Financial constellation provides total vehicle costs (fuel from receipts, insurance from bank statements, leasing from transactions, maintenance from service records). Multiply costs by ratio, and you have the tax-deductible amount — automatically, with full audit trail. No spreadsheet, no manual reconciliation.

## Service & Maintenance

This module is the vehicle’s equivalent of the Home Management constellation’s maintenance log. It tracks everything done to the vehicle, from routine servicing to major repairs, and uses the data to predict upcoming needs.

### Core workflow

- After each service or repair, the user logs: date, odometer reading, work performed, parts replaced, labour cost, parts cost, and the service provider

- Recurring items (oil change, brake pads, tyres) are tracked against manufacturer-recommended intervals (km or months)

- The app generates reminders: “Oil change due in 2,000 km or 3 months, whichever comes first”

- MFK (Swiss vehicle inspection) dates and results are recorded, with reminders for upcoming inspections

- Warranty coverage is tracked per component, with alerts as warranties approach expiration

### Data model

|                         |                                                                                                                                           |                                                                                                                    |
|-------------------------|-------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------|
| **Entity**              | **Key Fields**                                                                                                                            | **Notes**                                                                                                          |
| **ServiceEvent**        | vehicle_ref, date, odometer_km, event_type (routine/repair/inspection/recall), description, provider, labour_cost, parts_cost, total_cost | Comprehensive service history. Links to receipts in Financial constellation for cost verification.                 |
| **MaintenanceSchedule** | vehicle_ref, item (oil/brakes/tyres/belt/etc.), interval_km, interval_months, last_done_date, last_done_km, next_due_date, next_due_km    | Predictive scheduling. Computed from ServiceEvent history and manufacturer specs. next_due values drive reminders. |
| **Warranty**            | vehicle_ref, component, coverage_type, start_date, end_date, max_km, provider                                                             | Multiple warranties per vehicle (factory, extended, component-specific). Links to purchase receipt.                |

### Value of a complete history

A well-documented service history is not just operationally useful — it is financially valuable. When selling the vehicle, a complete, structured maintenance record commands a measurably higher resale price. WIP can generate a clean service report for prospective buyers directly from the data, replacing the familiar shoebox of crumpled receipts.

## Ownership & Valuation

This module captures the financial lifecycle of the vehicle: acquisition, ongoing costs, depreciation, and eventual disposal. It is the bridge between the vehicle-specific data and the Financial constellation’s total-cost-of-ownership perspective.

### Core workflow

- Purchase record: price, financing terms (lease or loan: monthly payment, interest rate, residual value, duration), or cash payment

- Insurance tracking: provider, premium, coverage type, deductible, renewal date, claims history

- Registration and taxes: annual cantonal vehicle tax, vignette, parking permits

- Depreciation tracking: current market value estimates, compared against purchase price and financing balance

### Data model

|                 |                                                                                                                                           |                                                                                                                                               |
|-----------------|-------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------|
| **Entity**      | **Key Fields**                                                                                                                            | **Notes**                                                                                                                                     |
| **Acquisition** | vehicle_ref, purchase_date, purchase_price, payment_type (cash/lease/loan), monthly_payment, interest_rate, residual_value, loan_end_date | For leases: monthly_payment and residual_value determine total cost. Links to bank transactions (Statement Manager) for payment verification. |
| **Insurance**   | vehicle_ref, provider, policy_number, coverage_type, annual_premium, deductible, renewal_date                                             | Premium history enables trend analysis. Claims history may affect future premiums.                                                            |
| **Valuation**   | vehicle_ref, date, estimated_value, source, odometer_km                                                                                   | Periodic snapshots from external sources. Plots the depreciation curve against purchase price and financing balance.                          |

# External Data Sources

The vehicle use case draws on several external data sources. Some are shared with the Energy constellation; others are vehicle-specific.

|                                    |                                                      |                        |               |                                                                                       |
|------------------------------------|------------------------------------------------------|------------------------|---------------|---------------------------------------------------------------------------------------|
| **Data Source**                    | **Provider Examples**                                | **Access**             | **Frequency** | **Key Use**                                                                           |
| **Fuel prices**                    | TCS, Comparis, fuel price APIs                       | API / scraping         | Daily         | "Did I refuel cheaply?" Optimise station choice over time.                            |
| **Electricity tariffs**            | ElCom, provider tariff sheets (shared with Part 2)   | API / published        | Annual        | EV charging cost calculation. Home vs. public charging comparison.                    |
| **Public charging prices**         | GoFast, Swisscharge, MOVE, Ionity                    | Provider APIs / manual | Varies        | Compare home vs. public charging cost per kWh. Plan routes by charging cost.          |
| **Vehicle market values**          | AutoScout24, Comparis, Eurotax                       | API / periodic lookup  | Monthly       | Depreciation tracking. Optimal sell timing. Lease vs. buy analysis.                   |
| **Spare part pricing**             | Manufacturer parts catalogues, aftermarket suppliers | Web / API              | As needed     | Forecast maintenance costs. Compare dealer vs. independent service.                   |
| **Public transport pricing**       | SBB, local transit operators                         | Published tariffs      | Annual        | Commute comparison: car vs. GA/Halbtax + regional passes.                             |
| **Manufacturer service intervals** | OEM service manuals, online databases                | Manual / reference     | Static        | Populate MaintenanceSchedule. Validate garage recommendations.                        |
| **CO₂ emission factors**           | BAFU (Swiss EPA), HBEFA                              | Published              | Annual        | Carbon footprint per trip. Compare EV (using grid carbon from Part 2) vs. combustion. |

# Cross-App and Cross-Constellation Analysis

The vehicle manager is a single app, but its data touches every constellation in the series. This section maps the connections.

## The Total Cost of Ownership Question

This is the flagship query for the vehicle satellite — and it is impossible without cross-constellation data living in a shared backend.

**True cost per kilometre** combines: fuel or electricity (Fuel Log + Energy tariffs), insurance (Ownership module + bank transactions from Statement Manager), maintenance and repairs (Service module + receipts from Receipt Scanner), financing cost or depreciation (Ownership module + market valuation data), taxes and fees (Ownership module + bank transactions), and parking (receipts or bank transactions). Divide by total kilometres driven (Trip Logger). The result is a single number — your actual cost per km — that accounts for everything. Most people have never seen this number for their own vehicle.

> **Example: the commute decision**
> You drive 22 km to work, 5 days a week, 46 weeks a year. That’s 10,120 km of commuting annually. Your true cost per km is CHF 0.72 (fuel, depreciation, insurance, maintenance, parking — all from WIP). Total commute cost: CHF 7,286/year. A GA Travelcard costs CHF 3,860. The train takes 12 minutes longer each way. Is 46 hours of your time per year worth CHF 3,426? WIP gives you the data to make this decision with real numbers, not guesses.

## Vehicle + Energy Constellation (Part 2)

- **Home charging economics:** "Last month I charged 280 kWh at home. 180 kWh came from solar (self-consumed, effective cost CHF 0.04/kWh amortised over panel lifetime) and 100 kWh from the grid (CHF 0.27/kWh). Total charging cost: CHF 34.20. Equivalent petrol for the same distance: CHF 168." This requires Solar Monitor + Meter Tracker + tariff data + fuel log + fuel price data.

- **Charging timing optimisation:** If you’re on a time-of-use electricity tariff, the optimal charging window depends on tariff rates (Part 2 external data), solar production forecast (Part 2 Solar Monitor), and your departure time (Trip Logger). WIP has all three.

- **Carbon comparison:** EV charged from Swiss grid (low carbon, mostly hydro/nuclear) vs. EV charged from solar (near zero) vs. petrol car (tailpipe + upstream emissions). Grid carbon intensity from Part 2, fuel emission factors from external data, driving distance from Trip Logger.

## Vehicle + Financial Constellation (Part 1)

- **Automatic expense categorisation:** The Statement Manager captures fuel station payments, insurance premiums, leasing debits, road tax, and parking charges as bank transactions. With the vehicle manager in WIP, these transactions can be automatically tagged to the correct vehicle and expense category, eliminating manual categorisation.

- **Tax-deductible business travel:** The trip logger provides the business-use ratio. The Financial constellation provides the total costs. The BI layer computes the deductible amount. A tax-reporting module could generate the required documentation directly. Every data point has provenance.

- **Lease vs. buy analysis:** Combine lease terms (monthly payment, residual value), depreciation curve (market valuation data), opportunity cost of capital (investment returns from Portfolio Tracker in Part 1), and total maintenance costs. "Would I be better off leasing or buying, given my actual driving pattern and the car’s actual depreciation?"

- **Budget forecasting:** Based on historical fuel consumption, km trends, upcoming service schedule, and insurance renewal, project vehicle costs for the next quarter and feed this into the Financial BI layer as a budget line.

## Vehicle + Home Management (Part 3, preview)

- **Equipment registry:** The vehicle itself, the wallbox/charger, the garage door opener — all appear in the Home Management equipment inventory. Their manuals, warranties, and maintenance schedules are tracked alongside household appliances.

- **EV charger installation:** The wallbox is both a vehicle accessory and a home electrical installation. Its cost (receipt from Part 1), its energy consumption (meter from Part 2), and its maintenance (Home Management, Part 3) converge. WIP connects all three naturally.

## Vehicle + Health Constellation (future)

- **Commute impact:** Correlate commute duration and frequency (Trip Logger) with stress or mood data (Health constellation’s mood tracker). Does working from home measurably improve your wellbeing? What’s the breakeven point — how many commute days per week before the impact becomes significant?

- **Active mobility:** If you cycle or walk for some trips, those appear in both the Trip Logger (as a non-vehicle trip mode) and the Health constellation’s fitness tracker. The financial saving of not driving plus the health benefit of active travel can be quantified together.

# Suggested Implementation Sequence

The vehicle manager is a single app with four modules. These can be implemented incrementally:

|           |                       |                                                                                                                                                                                |                                                                                                               |
|-----------|-----------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------|
| **Phase** | **Module**            | **Rationale**                                                                                                                                                                  | **Depends On**                                                                                                |
| **1**     | Fuel & Charging Log   | Immediate standalone value. Every fill-up produces a data point. Consumption tracking begins from day one. For EV owners, connects to existing Energy constellation.           | None (standalone). Enhanced by: Utility Meter Tracker (Part 2), Receipt Scanner (Part 1)                      |
| **2**     | Service & Maintenance | High practical value (reminders, warranty tracking). Users can backfill historical records from existing receipts. Builds service history that appreciates in value over time. | Financial: Receipt Scanner (for cost records). Home Management (Part 3, for equipment registry).              |
| **3**     | Trip Logger           | Adds the business/private classification needed for tax purposes. Requires discipline to log consistently, so introduce after fuel and service habits are established.         | Fuel & Charging Log (for km-to-cost correlation)                                                              |
| **4**     | Ownership & Valuation | Completes the total-cost-of-ownership picture. Best implemented once fuel, service, and trip data provide a solid historical base to analyse against.                          | All previous modules + Financial: Statement Manager (for payment reconciliation) + external market value data |

# Positioning in the Series

This document is Part 2.1, a satellite of the Energy & Sustainability constellation:

- **Part 1: Personal Finance Constellation** — the foundational layer

- **Part 2: Energy & Sustainability Constellation** — home energy, enriched by external data

- **Part 2.1: Vehicle & Mobility** (this document) — satellite bridging energy, finance, and daily life

- **Part 3: Home Management Constellation** — equipment, maintenance, renovation; the convergence point

The vehicle satellite demonstrates an important architectural benefit of using a generic shared backend like WIP: not everything needs to be a full constellation, and not everything needs to fit neatly into one domain. Real life is messy. A vehicle is part energy consumer, part financial asset, part maintenance commitment, part tax document. A shared backend handles this naturally, because it does not enforce domain boundaries — it simply stores facts, and lets queries cross whatever boundaries they need to.

> **The broader point**
> Every person’s life contains dozens of small data domains that don’t justify a dedicated system but are too important to track on scraps of paper or disconnected spreadsheets. The constellation model described in this series — with full constellations for major domains and lightweight satellites for cross-cutting topics — is one way to organise this. WIP, as a generic and schema-flexible backend, happens to be an ideal foundation for it. But WIP is not limited to this pattern: it is equally suited to a single standalone app, a flat data lake, or any other architecture. The constellation approach is a choice, not a constraint.

