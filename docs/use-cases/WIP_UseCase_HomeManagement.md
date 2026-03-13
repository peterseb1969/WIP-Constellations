# WIP Use Case: Home Management Constellation

*Part 3 of 3 — The Convergence Point*

*DRAFT — March 2026*

---

# The Convergence Point

Parts 1 and 2 of this series established a pattern: each constellation creates standalone value, then multiplies it through cross-links to other constellations. The Financial constellation provides the monetary lens. The Energy constellation provides the operational lens. Home Management provides the physical lens — the actual things you own, the space you inhabit, and the work required to keep it all running.

What makes this constellation the natural conclusion of the series is that it sits at the intersection of the other two. Almost everything in your home has a financial cost (purchase, insurance, maintenance) and many things have an energy dimension (appliances, heating systems, insulation). The home itself is the single largest asset and expense for most households. Managing it well requires exactly the kind of cross-domain visibility that a shared backend enables.

> **From episodic to continuous**
> Most people think about home management in episodes: something breaks, you call a tradesperson, you pay the bill, and you move on. The records — if they exist at all — live in a drawer as loose receipts, or as half-remembered conversations. This constellation turns episodic firefighting into a continuous, queryable system. What was done, when, by whom, at what cost, and what was the measurable impact?

# Constellation Overview

The Home Management constellation consists of four apps. Unlike the Financial constellation (where each app captures a distinct financial domain) or the Energy constellation (where each app measures a different physical quantity), these four apps represent different perspectives on the same physical objects and spaces.

|                               |                                                                                                                                                                 |                                                                                                                                                                                            |
|-------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **App**                       | **Core Function**                                                                                                                                               | **WIP Data Contribution**                                                                                                                                                                  |
| **Equipment Registry**        | Inventory of everything you own that matters: appliances, electronics, smart devices, tools, furniture. With manuals, specifications, and warranty information. | Structured equipment records with make, model, purchase date, warranty, location, manual links, and specifications. The master reference for all physical assets.                          |
| **Maintenance & Service Log** | Track everything done to the home and its contents: repairs, servicing, inspections, cleaning schedules, seasonal tasks.                                        | Service history per equipment item and per room/zone. Labour and material costs. Contractor contact details. Schedules and reminders for recurring tasks.                                  |
| **Network & IT Inventory**    | Manage home network infrastructure: routers, switches, access points, cabling, port assignments, WiFi coverage, and connected devices.                          | Physical and logical network topology. Port maps, cable run documentation, IP assignments, device inventory with firmware versions and update status.                                      |
| **Renovation Planner**        | Plan, budget, execute, and evaluate home improvement projects. From a new bathroom to full energy retrofits.                                                    | Project records with scope, budget, timeline, contractor details, permits, before/after state. Links to equipment (what was installed), energy (what changed), and finance (what it cost). |

# App Details

## App 1: Equipment Registry

This is the foundation of the Home Management constellation — a structured inventory of everything in your home that you might need to service, replace, insure, or refer to. Think of it as the home’s asset register.

### Core workflow

- User registers an item: make, model, serial number, purchase date, location (room/zone), and category (major appliance, electronics, HVAC, plumbing, furniture, tool, smart device)

- Manuals and specification sheets are uploaded or linked (PDF, URL to manufacturer page)

- Warranty details are recorded: type (manufacturer, extended, retailer), duration, expiry date, coverage terms, and claim process

- For smart devices: firmware version, connectivity protocol (WiFi, Zigbee, Z-Wave, Bluetooth), and integration status

- The registry supports hierarchical relationships: a kitchen contains an oven, which contains a light bulb; a network rack contains a switch, which has 24 ports

### Data model

|               |                                                                                                                                                                   |                                                                                                                                                                   |
|---------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Entity**    | **Key Fields**                                                                                                                                                    | **Notes**                                                                                                                                                         |
| **Equipment** | name, make, model, serial_number, category, subcategory, purchase_date, purchase_price, location_room, location_zone, status (active/stored/disposed), parent_ref | Master record. parent_ref enables hierarchy (oven → kitchen; access point → network rack). Links to Receipt (Part 1) via purchase_date + purchase_price matching. |
| **Manual**    | equipment_ref, document_type (user manual/installation guide/spec sheet/quick start), file_ref or url, language                                                   | Multiple documents per item. Eliminates the frantic search for the manual when something breaks.                                                                  |
| **Warranty**  | equipment_ref, warranty_type, provider, start_date, end_date, coverage_description, claim_contact, receipt_ref                                                    | Links to purchase receipt in Financial constellation. Alerts before expiry. Multiple warranties per item (manufacturer + extended).                               |

### Standalone value

A searchable home inventory with instant access to manuals and warranty status. Users can answer: “What model is my dishwasher? When does the warranty expire? Where is the installation guide?” No more rummaging through drawers. For insurance purposes, the registry serves as a documented asset list in case of damage or theft.

### Value added by cross-constellation links

- **Financial (Part 1):** Every equipment item links to its purchase receipt, providing cost tracking. The BI layer can answer: “How much have I spent on kitchen appliances in the last five years?” Warranty tracking combined with receipt data enables: “This washing machine is still under warranty, here’s the receipt as proof of purchase.”

- **Energy (Part 2):** Energy-consuming equipment (boiler, heat pump, air conditioning, oven, tumble dryer) links to the Energy constellation’s consumption data. The equipment record holds the rated energy consumption; the meter data shows the actual consumption. Discrepancy flags inefficiency or malfunction.

- **Vehicle (Part 2.1):** The EV wallbox, garage door opener, and similar vehicle-adjacent equipment live in this registry, linking to the vehicle constellation’s charging data.

## App 2: Maintenance & Service Log

If the Equipment Registry answers “What do I own?”, the Maintenance Log answers “What have I done to it?” It is the continuous record of every repair, service visit, inspection, and preventive task performed on the home and its contents.

### Core workflow

- After any service event, the user logs: date, equipment or area affected, work performed, who did it (DIY, contractor name, company), parts used, labour cost, material cost, and outcome

- Recurring tasks are scheduled: boiler servicing (annual), gutter cleaning (biannual), chimney sweep, filter replacements, smoke detector battery checks, legionella testing

- The app generates reminders based on schedules: “Boiler service due next month. Last done: 14 March 2025 by Meier Haustechnik AG.”

- Contractor contacts are stored with ratings and notes, building a personal tradesperson directory over time

- For each event, the before/after state can be noted: “Heating pressure was 0.8 bar (low). Topped up to 1.5 bar. Check again in 3 months.”

### Data model

|                  |                                                                                                                                                                                            |                                                                                                                           |
|------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------|
| **Entity**       | **Key Fields**                                                                                                                                                                             | **Notes**                                                                                                                 |
| **ServiceEvent** | date, equipment_ref (or room/zone), event_type (repair/routine/inspection/emergency), description, performed_by, contractor_ref, labour_cost, material_cost, total_cost, outcome, next_due | Core record. Links to equipment (Registry) and to receipts/transactions (Financial). next_due drives reminder scheduling. |
| **Schedule**     | equipment_ref or zone, task_description, interval_months, last_completed, next_due, priority                                                                                               | Template for recurring tasks. Updated automatically when a matching ServiceEvent is logged.                               |
| **Contractor**   | name, company, trade (plumber/electrician/HVAC/general), phone, email, rating, notes, last_used                                                                                            | Personal tradesperson directory. Accumulated from service events. “Who fixed the boiler last time, and were they good?”   |

### Standalone value

A complete service history for the home, with reminders for upcoming tasks and a built-in contractor directory. For homeowners, this is the operational backbone of property maintenance. For landlords, it provides auditable maintenance records per unit.

### Value added by cross-constellation links

- **Financial (Part 1):** Every service event has a cost. These costs link to bank transactions (Statement Manager) and invoices (Receipt Scanner). The BI layer can compute: “Total home maintenance expenditure per year, broken down by trade category.” Over several years, this reveals whether maintenance costs are stable, rising, or spiking — which informs the renovation decision.

- **Energy (Part 2):** Service events on energy equipment (boiler tuned, heat pump filter cleaned, solar panels washed) can be correlated with energy consumption changes. “Did the boiler service actually improve efficiency? Show me gas consumption per heating degree day before and after the service date.”

- **Equipment Registry:** Service events reference equipment items, building a complete lifecycle per asset: purchase → installation → services → repairs → eventual replacement. This lifecycle drives the replacement planning function.

## App 3: Network & IT Inventory

This is a specialised extension of the Equipment Registry, dedicated to the home’s digital infrastructure. For households with smart home systems, NAS storage, home offices, or simply a complex WiFi setup, this app provides the documentation that is otherwise kept in someone’s head — and lost when they’re not available.

### Core workflow

- Physical layer documentation: cable runs between rooms (type, length, endpoints), wall port locations and labels, patch panel port assignments, switch port mappings

- Network device inventory: routers, switches, access points, NAS, media servers, IoT hubs — with IP addresses, MAC addresses, firmware versions, and last update date

- WiFi coverage mapping: signal strength observations per room, dead zone documentation, access point placement rationale

- Logical network documentation: VLANs, subnets, DHCP ranges, DNS settings, firewall rules, port forwarding

- Connected device register: every device on the network, its purpose, its owner (family member), and its network requirements (bandwidth, latency, always-on vs. occasional)

### Data model

|                     |                                                                                                                                                  |                                                                                                                                                        |
|---------------------|--------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Entity**          | **Key Fields**                                                                                                                                   | **Notes**                                                                                                                                              |
| **CableRun**        | cable_type (Cat6/Cat6a/fibre/coax), from_location, from_port, to_location, to_port, length_m, label, install_date                                | Physical infrastructure. Rarely changes but impossible to reconstruct without documentation. Links to renovation projects if installed during a build. |
| **NetworkDevice**   | equipment_ref (links to Equipment Registry), role (router/switch/AP/NAS), ip_address, mac_address, firmware_version, last_update, management_url | Extends the Equipment Registry with network-specific fields. firmware_version and last_update drive security update reminders.                         |
| **PortMap**         | device_ref, port_number, connected_to (device or wall port), vlan, speed, poe_enabled, status (active/unused/reserved)                           | Per-port documentation for managed switches and patch panels. Answers: “What is plugged into port 17?”                                                 |
| **ConnectedDevice** | name, device_type, mac_address, ip_address, owner, connection_type (wired/wifi), network_device_ref, notes                                       | Every device on the network. Helps diagnose: “Who is using all the bandwidth?” and “Is this unknown MAC address a security concern?”                   |

### Standalone value

Complete documentation of home network infrastructure. This is invaluable for troubleshooting (“Which cable run connects the study to the patch panel?”), for security (“Are all devices running current firmware?”), and for planning (“I want to add an access point in the garden — where is the nearest cable run?”). It also makes the setup portable: if you move house, the documentation for the new home starts clean; if someone else takes over maintenance, they can understand the setup without archaeology.

### Value added by cross-constellation links

- **Equipment Registry:** Every network device is also an equipment item with warranty, manual, and purchase record. The Network Inventory extends rather than duplicates this data.

- **Financial (Part 1):** Network equipment costs link to receipts. ISP subscription costs appear in the Subscription Tracker. Total cost of home IT infrastructure is computable.

- **Energy (Part 2):** IoT sensors from the Home Climate Logger, smart meter readers, and solar inverters appear as connected devices. Network health affects energy monitoring reliability.

- **Maintenance Log:** Firmware updates, configuration changes, and hardware replacements are service events. “When did I last update the router firmware?” becomes a query, not a guess.

## App 4: Renovation Planner

This is the app where the entire series converges. A renovation is not a single-domain event. It is simultaneously a financial investment, an energy intervention, an equipment replacement, a maintenance milestone, and often a lifestyle improvement. No other activity in home ownership touches as many data domains at once.

> **Why renovation is the ultimate cross-domain event**
> Consider replacing old windows. The decision involves: the current energy performance of the windows (Energy constellation: heat loss visible in indoor climate data, energy consumption per heating degree day). The cost of new windows and installation (Financial: quotes, receipts, bank transactions). The specifications of the new windows (Equipment Registry: make, model, U-value, warranty). Building permit requirements (external data). The expected energy savings (Energy: benchmark data, tariff projections). The impact on property value (external data). And the measurable result after installation (Energy: consumption change, Climate Logger: temperature stability improvement). Every one of these data points lives in a different constellation — but they all need to come together for an informed decision.

### Core workflow

- Project definition: scope (bathroom renovation, window replacement, kitchen remodel, full energy retrofit), goals (comfort, efficiency, aesthetics, compliance), and constraints (budget, timeline, permits)

- Budgeting: cost estimates by category (materials, labour, permits, temporary accommodation), tracked against actuals as the project progresses

- Contractor management: quotes collected, compared, and linked to the contractor directory from the Maintenance Log. Selected contractor’s terms recorded.

- Timeline tracking: planned vs. actual phases, milestones, dependencies, and delays

- Documentation: before/after photos, permit records, inspection certificates, compliance documents, architect/engineer reports

- Post-completion evaluation: the critical step. Did the renovation achieve its goals? Energy-related projects are evaluated against meter data. Cost-related projects are evaluated against budget. Comfort projects are evaluated against climate sensor data.

### Data model

|                      |                                                                                                                                                             |                                                                                                                                                                             |
|----------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Entity**           | **Key Fields**                                                                                                                                              | **Notes**                                                                                                                                                                   |
| **Project**          | title, description, project_type, status (planning/in_progress/completed/on_hold), start_date, target_end_date, actual_end_date, budget_total, actual_total | Master project record. budget_total vs. actual_total is the simplest financial health metric. Links to multiple BudgetLines, Phases, and equipment items.                   |
| **BudgetLine**       | project_ref, category (materials/labour/permits/design/contingency), description, estimated_cost, actual_cost, receipt_ref, notes                           | Granular cost tracking. Each line can link to a receipt or bank transaction in the Financial constellation.                                                                 |
| **Phase**            | project_ref, phase_name, planned_start, planned_end, actual_start, actual_end, status, contractor_ref, notes                                                | Timeline tracking. contractor_ref links to the Maintenance Log’s contractor directory.                                                                                      |
| **ProjectEquipment** | project_ref, equipment_ref, action (installed/replaced/removed), old_equipment_ref, notes                                                                   | Tracks what was installed or replaced. old_equipment_ref links to the item being replaced, preserving lifecycle history.                                                    |
| **Evaluation**       | project_ref, metric (energy_saved/cost_vs_budget/comfort_improvement/property_value_impact), baseline_value, post_value, measurement_date, notes            | Post-completion assessment. baseline_value and post_value come from other constellations (energy readings, climate data, financial records). This closes the feedback loop. |

### Standalone value

Structured project management for home renovations: budget tracking, timeline management, contractor coordination, and documentation. Even without cross-constellation data, this replaces the common approach of managing renovations via WhatsApp messages, email threads, and paper notes.

### Value added by cross-constellation links

This is where Part 3 fulfils its promise as the convergence point. The Renovation Planner is not just enhanced by cross-links — its most valuable function, the post-completion evaluation, is entirely dependent on them.

- **Financial (Part 1):** Budget lines link to actual receipts and bank transactions, providing auditable cost tracking. For financed renovations (home equity loan, cantonal energy loan), the financing terms from the Statement Manager complete the picture. Tax-deductible renovation costs (where applicable) feed into the tax planning cross-link.

- **Energy (Part 2):** This is the most powerful link. An energy-related renovation (insulation, windows, heating system replacement, solar installation) has a measurable before-and-after in the Energy constellation’s data. The Evaluation entity captures the baseline (average kWh per HDD in the 12 months before) and the result (same metric in the 12 months after), normalised for weather.

- **Home Climate Logger (Part 2):** Comfort improvements are measurable. After replacing windows, temperature stability improves (fewer cold spots, less variation). After adding insulation, the time constant of the house increases (temperature drops more slowly when heating is off). The Climate Logger captures this.

- **Equipment Registry:** Items installed during renovation are registered as new equipment (with warranty, manual, and specs). Items replaced are marked as disposed, closing their lifecycle. The registry becomes the single source of truth for what is currently installed and what it replaced.

- **Maintenance Log:** The renovation itself is a major service event. Contractors used during renovation enter the tradesperson directory. Post-renovation maintenance schedules are automatically created for newly installed equipment.

# External Data Sources

The Home Management constellation draws on external data primarily for the Renovation Planner’s decision-making and evaluation functions.

|                                      |                                                                      |                            |                |                                                                                                                          |
|--------------------------------------|----------------------------------------------------------------------|----------------------------|----------------|--------------------------------------------------------------------------------------------------------------------------|
| **Data Source**                      | **Provider Examples**                                                | **Access**                 | **Frequency**  | **Key Use**                                                                                                              |
| **Construction cost indices**        | Swiss BFS Baupreisindex, regional construction associations          | Published data             | Quarterly      | Is this a good time to renovate? Are quotes in line with market rates?                                                   |
| **Property valuations**              | Wüest Partner, IAZI, Comparis Immobilien                             | API / published            | Quarterly      | Does the renovation pay for itself in property value? What is my home worth before and after?                            |
| **Building energy ratings**          | GEAK (Gebäudeenergieausweis), Minergie certification                 | Certificate / manual entry | Per renovation | What rating class is my home? What class would it move to after renovation? What does the target class require?          |
| **Subsidy programmes**               | Das Gebäudeprogramm, cantonal energy subsidies, municipal grants     | Published / manual         | Annual         | What subsidies apply to my planned renovation? How much can I recover? What are the application deadlines?               |
| **Building regulations & permits**   | Cantonal building law, municipal building codes                      | Published / manual         | As needed      | Does this renovation require a permit? What are the setback, height, or heritage constraints?                            |
| **Product specifications & pricing** | Manufacturer catalogues, distributor pricing, comparison platforms   | Web / manual               | As needed      | Compare window U-values across manufacturers. Estimate material costs for budgeting.                                     |
| **Mortgage & loan rates**            | Comparis Hypothek, bank rate sheets, cantonal energy loan programmes | Published                  | Monthly        | Finance the renovation: what are current rates? Does a cantonal energy loan offer better terms than a mortgage increase? |

# Worked Example: The Window Replacement Decision

To make the convergence tangible, this section walks through a single renovation decision — replacing old double-glazed windows with modern triple-glazed units — and shows exactly which data from which constellation feeds into each stage.

## Stage 1: Identifying the need

The homeowner does not start with “I want new windows.” They start with observations:

- **Energy data (Part 2, Utility Meter):** Gas consumption per heating degree day has been flat for three years despite a boiler service (Maintenance Log) that should have improved efficiency. Something else is limiting performance.

- **Climate data (Part 2, Home Climate Logger):** Rooms facing north show a 3°C temperature drop within two hours of the heating turning off on cold nights. South-facing rooms hold temperature much better. The windows are the obvious variable.

- **Equipment data (Equipment Registry):** The windows are documented as double-glazed units installed in 1995, with a U-value of 2.7 W/m²K. Modern triple-glazed units achieve 0.6–0.8 W/m²K.

> **What happened here**
> Three constellations — Energy, Home Management, and the Climate Logger — converged to identify a specific problem. No single data source would have been sufficient. The meter data showed stagnation; the climate data localised it to north-facing rooms; the equipment registry confirmed that the windows are old and underperforming by modern standards.

## Stage 2: Evaluating the investment

- **External data (construction costs):** Current market rate for window replacement in the canton: approximately CHF 800–1,200 per m² installed, depending on frame material. The house has 28 m² of window area on north-facing façades. Estimated cost: CHF 25,000–30,000.

- **External data (subsidies):** Das Gebäudeprogramm offers CHF 70 per m² for window replacement meeting the required U-value threshold. Cantonal programme adds CHF 40/m². Total subsidy: approximately CHF 3,080.

- **Energy data + tariffs (Part 2):** Based on the temperature differential data (Climate Logger) and the U-value improvement (2.7 → 0.7), the estimated heating energy saving is 2,800 kWh/year. At the current gas tariff of CHF 0.12/kWh, that’s CHF 336/year.

- **Financial data (Part 1):** Savings rate (from Part 1 BI layer) suggests the household can fund this from savings without financing. Alternative: a cantonal energy loan at 1.5% over 10 years would cost CHF 107/year in interest.

- **External data (property value):** Improving the GEAK rating from D to C (which this renovation, combined with prior insulation work, would achieve) is estimated to add 3–5% to property value. On a CHF 900,000 property, that’s CHF 27,000–45,000.

## Stage 3: Execution and tracking

- **Renovation Planner:** Project created with scope, budget lines (materials, labour, permits, scaffolding), timeline, and selected contractor (chosen from Maintenance Log’s contractor directory, with ratings from prior work).

- **Financial (Part 1):** Deposit and progress payments appear as bank transactions (Statement Manager) and are auto-linked to the project’s budget lines. Invoices captured via Receipt Scanner.

- **Equipment Registry:** Old windows marked as “replaced.” New windows registered with make, model, U-value, warranty (15 years), and installation date. Installer’s certificate and product data sheet uploaded as documents.

## Stage 4: Post-completion evaluation

Six months after installation, the Renovation Planner’s Evaluation function runs:

- **Energy (Meter Tracker + weather):** Gas consumption per heating degree day has dropped 18% compared to the 12-month baseline before installation. This is weather-normalised, so it reflects genuine efficiency improvement.

- **Comfort (Climate Logger):** North-facing rooms now show only a 1.2°C drop (down from 3°C) in the two hours after heating off. Temperature stability has improved measurably.

- **Financial (BI Layer):** Actual project cost: CHF 27,400 (within budget). Subsidy received: CHF 3,080. Net cost: CHF 24,320. Annual energy saving: CHF 336 (may increase with gas price rises). Simple payback: 72 years on energy alone. Including property value impact: the investment is recovered or exceeded immediately.

> **The point of this example**
> No single app — no matter how sophisticated — could have produced this analysis. It required energy meter data, weather normalisation, indoor climate measurements, equipment specifications, construction cost benchmarks, subsidy programme rules, financial records, property valuations, and project management. All from different sources, different apps, different domains. But because they all write to the same backend, the queries that connect them are straightforward. This is the promise of the shared backend, delivered.

# Suggested Implementation Sequence

The Home Management constellation is best started after the Financial constellation is established, as nearly every home management action has a cost dimension.

|           |                           |                                                                                                                                                                                                                             |                                                                                                      |
|-----------|---------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------|
| **Phase** | **App**                   | **Rationale**                                                                                                                                                                                                               | **Depends On**                                                                                       |
| **1**     | Equipment Registry        | Foundational: other apps reference equipment items. Start with high-value items (appliances, HVAC, electronics) and expand over time. No need to register everything on day one.                                            | Financial: Receipt Scanner (for purchase records and warranty proof)                                 |
| **2**     | Maintenance & Service Log | Immediate practical value through reminders and contractor tracking. Log forward from today; backfill selectively from existing receipts and records.                                                                       | Equipment Registry (for equipment references)                                                        |
| **3**     | Network & IT Inventory    | Specialised: implement when the home network reaches a complexity that exceeds mental tracking. Many households can defer this indefinitely; IT-oriented households will want it early.                                     | Equipment Registry (for base device records)                                                         |
| **4**     | Renovation Planner        | Implement when a renovation project is on the horizon. Maximum value when Equipment Registry, Maintenance Log, Energy constellation, and Financial constellation are all in place — but useful even with only partial data. | All prior Home Management apps + Energy (Part 2) + Financial (Part 1) for full evaluation capability |

# Concluding the Series

This document completes the three-part core series:

- **Part 1: Personal Finance** — the foundational layer. Your money, unified.

- **Part 2: Energy & Sustainability** — operational data enriched by external context.

- **Part 2.1: Vehicle & Mobility** — a satellite demonstrating the cross-cutting pattern.

- **Part 3: Home Management** — the convergence point, where physical assets meet financial costs and energy performance.

Together, the series presents a progression: from a single constellation with internal cross-links, to two constellations with inter-constellation queries, to a satellite that bridges domains, to a final constellation where everything converges around real-world decisions like renovation planning.

## What comes next?

The three core constellations and one satellite cover a significant portion of household data management. But the framework is extensible. Candidates for future constellations or satellites include:

- **Health & Wellbeing:** Fitness tracking, nutrition, sleep, mood. Cross-links to Energy (indoor air quality), Financial (health spending, grocery analysis), and Vehicle (commute stress).

- **Children & Family:** Growth tracking, school, activities, childcare. Cross-links to Financial (total cost of raising a child), Health (pediatric records), and Home Management (child-proofing, room allocation).

- **Collections (wine, books, records, art):** Inventory, valuation, enjoyment logging. Cross-links to Financial (acquisition cost, appreciation) and Home Management (storage, insurance, climate control for sensitive items).

- **Learning & Development:** Courses, certifications, skills, reading. Cross-links to Financial (education spend, ROI on skills) and subscriptions (learning platform costs).

- **Tax Planning (satellite 1.1):** Drawing on Financial (income, deductions), Vehicle (business travel), Home Management (renovation deductions), and external tax rule data.

Each of these follows the same pattern demonstrated in this series: standalone value within the constellation, compounding value through cross-links, and external data enrichment providing context that turns personal records into actionable insight.

> **The network effect, revisited**
> Part 1 introduced this idea. Part 3 has delivered the proof. With three constellations, one satellite, and a handful of external data integrations, we have demonstrated cross-domain queries that span equipment specifications, energy physics, financial costs, weather normalisation, market benchmarks, and personal comfort measurements. Each new domain added to the system does not merely add its own value — it multiplies the value of everything already present. That is the case for a shared backend. That is the case for WIP.

