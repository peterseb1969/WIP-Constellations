# WIP Use Case: Energy & Sustainability Constellation

*Part 2 of 3*

*DRAFT — March 2026*

---

# The Network Effect of Personal Data

Part 1 of this series introduced the core argument: when multiple apps share a common backend, the value of the system grows non-linearly. Each new app retroactively increases the value of every existing app by enabling cross-dataset queries that would be impractical to build as point-to-point integrations.

The Energy constellation is where this argument shifts from theory to visceral demonstration. Energy data is inherently contextual — a meter reading in isolation tells you almost nothing. It only becomes meaningful when combined with external reference data (weather, prices, grid carbon intensity) and with personal data from other constellations (financial costs, home renovation history, equipment specs). This makes energy the ideal second constellation: it is simultaneously useful on its own and dramatically more powerful when connected.

> **Why energy, and why now?**
> Energy costs have become a first-order household concern across Europe since 2022. At the same time, distributed generation (solar, battery storage) has turned many households into both consumers and producers of energy. Managing this dual role — and understanding its true financial and environmental impact — requires exactly the kind of cross-domain analysis that WIP enables.

# Constellation Overview

The Energy & Sustainability constellation consists of three apps that capture your home’s energy profile, plus a rich set of external data integrations that provide the context necessary for meaningful analysis. As with the Financial constellation, a BI layer queries across all sources.

|                                |                                                                                                      |                                                                                                                           |
|--------------------------------|------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------|
| **App**                        | **Core Function**                                                                                    | **WIP Data Contribution**                                                                                                 |
| **Utility Meter Tracker**      | Record electricity, gas, and water meter readings over time; import smart meter data where available | Time-series consumption data by utility type, granularity from monthly manual readings to 15-minute smart meter intervals |
| **Solar & Generation Monitor** | Track solar panel output, battery storage levels, and grid feed-in; import inverter data             | Production time-series, self-consumption vs. feed-in split, battery charge cycles, system health metrics                  |
| **Home Climate Logger**        | Record indoor temperature and humidity per room via IoT sensors; map comfort zones                   | Room-level climate time-series, comfort index calculations, anomaly detection (e.g., humidity spike indicating a leak)    |
| **BI Layer**                   | Cross-app and cross-constellation dashboards, trend analysis, optimisation recommendations           | Queries spanning energy data, financial data (Part 1), external reference data, and (in Part 3) home management data      |

# External Data: The Context That Makes Energy Data Meaningful

This section deserves special prominence. More than any other constellation in this series, the Energy constellation depends on external data to turn raw measurements into actionable insight. A meter reading of 450 kWh for January means nothing without knowing: Was it cold? What did you pay per kWh? How much CO₂ did it produce? How does it compare to similar households? External data answers all of these questions.

**The principle is simple:** your apps capture *what happened* (consumption, production, indoor climate). External data explains *why it happened* and *what it cost* — in money, carbon, and comfort.

## Weather & Temperature Data

> **Why this matters**
> Weather is the single strongest driver of residential energy consumption. Without it, you cannot distinguish a behavioural change from a seasonal one. With it, you can normalise consumption across seasons and isolate the variables you actually control.

### Data sources

- **MeteoSwiss (Swiss Federal Office of Meteorology):** Free hourly and daily temperature, precipitation, sunshine duration, and wind data for stations across Switzerland. High-quality, well-documented API.

- **Open-Meteo:** Open-source weather API providing historical and forecast data globally. No API key required for non-commercial use. Includes hourly temperature, humidity, wind, solar radiation, and precipitation.

- **Degree-day data (HDD/CDD):** Heating Degree Days and Cooling Degree Days are a standardised measure used in energy auditing. They quantify how much outdoor temperature deviated from a comfort baseline (typically 18°C). Available from national weather services or computed from raw temperature data.

### Analysis enabled

- **Consumption normalisation:** "We used 15% more gas this January than last January — but there were 20% more heating degree days. Adjusted for weather, our consumption actually improved."

- **Efficiency benchmarking:** kWh per heating degree day gives you a weather-independent efficiency metric that you can track year-over-year to detect degradation in your heating system or building envelope.

- **Anomaly detection:** If consumption spikes but weather is mild, something has changed — a malfunctioning appliance, a window left open, or a behaviour change. The system can flag this automatically.

- **Cross-link to Home Climate Logger:** Compare outdoor temperature (external data) with indoor temperature (your sensors) to assess insulation performance. A house that maintains 21°C when it’s -5°C outside with low energy input is well-insulated. One that requires maximum heating to hold 19°C is not.

## Energy Prices & Tariff Data

> **Why this matters**
> Energy bills are the product of consumption × price. You control consumption; the market controls price. Without price data, you cannot separate the two — and you cannot evaluate whether a reduction in your bill came from using less energy or from a tariff change.

### Data sources

- **ElCom (Swiss Electricity Commission):** Publishes tariff data for every Swiss electricity provider, including network charges, energy charges, and levies. Allows comparison across providers and municipalities. Updated annually.

- **ENTSO-E Transparency Platform:** European-wide day-ahead and intraday wholesale electricity prices. Free API. Useful for understanding whether your provider’s tariff tracks wholesale costs, and for optimising the timing of electricity use if you are on a dynamic tariff.

- **Natural gas spot prices:** THE (Trading Hub Europe) or TTF (Dutch Title Transfer Facility) provide European gas reference prices. Relevant for understanding the cost trajectory of gas heating.

- **Feed-in tariffs:** Your local utility’s published rate for solar electricity fed back into the grid. Critical for solar ROI calculations. In Switzerland, this varies significantly by canton and provider.

- **Water tariffs:** Municipal water pricing, including tiered rates and sewage charges. Less volatile than energy but still relevant for total utility cost tracking.

### Analysis enabled

- **Cost decomposition:** "My electricity bill rose CHF 40 this quarter. CHF 28 of that is from a tariff increase; CHF 12 is from higher consumption." This requires both your meter data and the tariff history.

- **Tariff optimisation:** If your provider offers time-of-use pricing, your smart meter data combined with hourly price data reveals whether you could save by shifting load (dishwasher, laundry, EV charging) to off-peak hours.

- **Solar feed-in valuation:** "I fed 1,200 kWh into the grid this year. At my current feed-in tariff, that’s worth CHF 108. If I had stored it in a battery and self-consumed it, I would have avoided buying 1,200 kWh at my consumption tariff of CHF 0.27/kWh = CHF 324." This difference drives the battery investment decision.

- **Cross-link to Financial constellation:** Utility bills are already captured as bank transactions (Statement Manager) and potentially as receipts (Receipt Scanner). Energy price data lets the BI layer decompose those financial outflows into price and volume components.

## Solar Irradiance & Yield Data

> **Why this matters**
> Solar panels degrade over time. Without a reference for expected output, you cannot detect underperformance. With irradiance data, you can compare actual vs. theoretical yield and catch problems early — before they cost you money.

### Data sources

- **PVGIS (EU Joint Research Centre):** Free tool that provides solar irradiance data and estimated PV output for any location in Europe, based on satellite observations. Accounts for panel orientation, tilt, and shading. Provides both historical and typical-year datasets.

- **Open-Meteo Solar Radiation API:** Hourly Global Horizontal Irradiance (GHI), Direct Normal Irradiance (DNI), and Diffuse Horizontal Irradiance (DHI). Useful for more granular analysis of production patterns.

- **Manufacturer performance specifications:** Panel wattage ratings, temperature coefficients, and degradation curves. These can be stored in WIP as part of the Home Management constellation (Part 3), creating yet another cross-link.

### Analysis enabled

- **Performance ratio:** Actual output divided by theoretical output (based on irradiance and panel specs). A healthy system should achieve 75–85%. A sudden drop indicates soiling, shading, inverter issues, or panel damage.

- **Degradation tracking:** Year-over-year decline in performance ratio, compared against the manufacturer’s guaranteed degradation curve. If your panels degrade faster than warranted, this is evidence for a warranty claim.

- **Seasonal production forecasting:** Using historical irradiance data to predict next month’s likely output, which feeds into financial planning (expected feed-in revenue, expected grid consumption cost).

## Grid Carbon Intensity

> **Why this matters**
> If your motivation includes sustainability (not just cost), then when you use electricity matters as much as how much you use. Grid carbon intensity varies dramatically by hour and season.

### Data sources

- **Electricity Maps:** Real-time and historical carbon intensity data for electricity grids worldwide. Free tier available. Provides grams of CO₂ per kWh for each grid zone, updated every hour.

- **ENTSO-E generation mix:** The same platform that provides price data also publishes the generation mix (nuclear, hydro, gas, wind, solar) per bidding zone. You can compute carbon intensity from generation shares using standard emission factors.

### Analysis enabled

- **Personal carbon footprint:** Multiply your hourly consumption by the hourly carbon intensity of the grid. This is far more accurate than using an annual average, because running your dryer at midday (when solar is high and carbon intensity is low) has a different impact than running it at 8 PM (when gas peaker plants may be online).

- **Optimisation for sustainability:** If you have flexible loads (EV charging, heat pump, battery storage), carbon-aware scheduling can reduce your footprint without reducing comfort.

- **Combined cost and carbon:** The BI layer can show both dimensions on the same chart. Often, low-carbon hours and low-price hours overlap (midday solar surplus), but not always — the system helps you navigate the tradeoffs.

## Household Benchmark Data

### Data sources

- **Swiss Federal Office of Energy (BFE):** Publishes average household energy consumption by building type, age, heating system, and region. Provides the "typical household" reference against which you compare your own performance.

- **Minergie / GEAK ratings:** Swiss building energy efficiency standards and certificates. If your home has a GEAK rating, you can compare your actual consumption against the rating’s predicted range. Consistent underperformance vs. the rating suggests operational issues.

- **EU Building Stock Observatory:** Broader European benchmarks by country, climate zone, and building vintage.

### Analysis enabled

- **Peer comparison:** "My house consumes 18,000 kWh of gas annually. A typical house of this size and age in my canton uses 15,000 kWh. I’m 20% above the benchmark." This provides both motivation and a realistic improvement target.

- **Renovation impact prediction:** "If I improve from GEAK class D to class B, benchmark data suggests a 40% reduction in heating energy." Combined with gas price projections, this becomes a financial payback model — and a direct bridge to Part 3 (Home Management).

# App Details

## App 1: Utility Meter Tracker

This is the workhorse of the constellation. It captures the raw consumption data that everything else builds upon — much as the Statement Manager is the backbone of the Financial constellation.

### Core workflow

- Manual entry: user photographs or reads their meter and logs the reading (electricity, gas, water, district heating)

- Smart meter import: where available, automated ingestion of 15-minute interval data via provider API or P1 port reader

- Bill import: utility invoices often contain period readings; parsing these provides a fallback where manual and smart meter data is unavailable

- All readings are stored as time-series data in WIP, normalised to a common schema regardless of input method

### Data model (simplified)

|             |                                                                                               |                                                                                                                                           |
|-------------|-----------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------|
| **Entity**  | **Key Fields**                                                                                | **Notes**                                                                                                                                 |
| **Meter**   | utility_type, meter_id, unit, location, provider, tariff_type                                 | Represents a physical meter. A household may have multiple (electricity, gas, water, separate heat meter).                                |
| **Reading** | meter_ref, timestamp, value, source (manual/smart/bill), period_consumption                   | Time-series data point. period_consumption is derived (current minus previous reading). Smart meter data may produce 96 readings per day. |
| **Tariff**  | provider, utility_type, rate_type (flat/TOU/tiered), rate, valid_from, valid_to, feed_in_rate | Historical tariff records. Enables cost calculation per reading period. Links to external ElCom data for benchmark comparison.            |

### Standalone value

A clear history of utility consumption across all sources. Users can track trends, catch anomalies, and compare billing periods. Smart meter users gain near-real-time visibility into consumption patterns throughout the day.

### Value added by WIP integration

- Combined with weather data: normalised consumption metrics (kWh per heating degree day)

- Combined with tariff data: accurate cost calculation per period, cost decomposition (price vs. volume)

- Combined with Solar Monitor: net consumption (grid draw minus self-consumption from solar)

- Combined with Financial constellation: utility costs reconciled against bank transactions

- Combined with Home Climate Logger: energy input vs. comfort output (efficiency of heating/cooling)

## App 2: Solar & Generation Monitor

For households with solar panels — and increasingly with battery storage — this app tracks what you produce, what you consume directly, what you store, and what you feed back to the grid. It transforms the household from a pure consumer into an energy prosumer.

### Core workflow

- Inverter data import: most modern inverters (Fronius, SMA, Huawei, Enphase) provide local or cloud APIs with production data at 5–15 minute intervals

- Battery monitoring: state of charge, charge/discharge cycles, and capacity degradation tracking

- Feed-in metering: typically captured by the utility meter (bidirectional), cross-referenced with inverter data for validation

- Manual fallback: for older systems, periodic recording of the inverter’s cumulative production counter

### Data model (simplified)

|                  |                                                                                                  |                                                                                                                            |
|------------------|--------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------|
| **Entity**       | **Key Fields**                                                                                   | **Notes**                                                                                                                  |
| **System**       | capacity_kwp, panel_count, orientation, tilt, inverter_model, install_date, battery_capacity_kwh | Physical installation parameters. Links to Home Management constellation (equipment records, installer receipt, warranty). |
| **Production**   | timestamp, production_kwh, self_consumed_kwh, fed_in_kwh, battery_charged_kwh                    | Time-series. Self-consumption is the most valuable kWh (saves buying from grid at full tariff).                            |
| **BatteryState** | timestamp, state_of_charge_pct, cycle_count, estimated_capacity_kwh                              | Battery health monitoring. Capacity decline over time signals degradation.                                                 |

### Standalone value

Production monitoring, self-consumption optimisation, and battery health tracking. Users can answer: "How much of my solar energy do I actually use myself?" and "Is my battery holding its capacity?"

### Value added by WIP integration

- Combined with Utility Meter Tracker: complete energy balance (production + grid import = consumption + feed-in + storage losses)

- Combined with irradiance data: performance ratio calculation, degradation detection, warranty evidence

- Combined with grid carbon intensity: "How many kg CO₂ did my solar panels displace this month?"

- Combined with Financial constellation: ROI model incorporating installation cost (receipt), feed-in revenue (tariff × production), avoided grid cost (tariff × self-consumption), and battery replacement forecast

## App 3: Home Climate Logger

This app captures the output side of the energy equation: comfort. Energy is not an end in itself — it exists to maintain a liveable indoor environment. By measuring that environment directly, you can evaluate whether your energy spend is achieving its purpose efficiently.

### Core workflow

- IoT sensor deployment: temperature and humidity sensors in key rooms (living room, bedroom, bathroom, basement)

- Data ingestion: sensors report at regular intervals (typically every 5–15 minutes) via WiFi, Zigbee, or similar protocol

- Comfort indexing: the app computes a comfort score per room based on temperature and humidity ranges (e.g., 20–22°C and 40–60% RH = "comfortable")

- Anomaly alerts: sudden humidity spikes (possible leak), persistent low temperatures in a heated room (possible insulation failure or radiator issue)

### Data model (simplified)

|                    |                                                                                           |                                                                                                  |
|--------------------|-------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| **Entity**         | **Key Fields**                                                                            | **Notes**                                                                                        |
| **Sensor**         | sensor_id, room, floor, sensor_type, model, install_date                                  | Sensor inventory. Links to Home Management (equipment records, batteries, replacement schedule). |
| **ClimateReading** | sensor_ref, timestamp, temperature_c, humidity_pct, co2_ppm (if available), comfort_score | High-frequency time-series. CO₂ is a strong proxy for ventilation quality.                       |

### Standalone value

Room-by-room visibility into comfort conditions, mould risk assessment (sustained high humidity), and ventilation monitoring. Users can answer: "Is the bedroom too cold at night?" and "Should I be concerned about the humidity in the bathroom?"

### Value added by WIP integration

- Combined with weather data: insulation quality assessment (indoor/outdoor temperature differential vs. energy input)

- Combined with Utility Meter: energy-to-comfort efficiency ratio — "How many kWh does it take to maintain 21°C in the living room when it’s 0°C outside?"

- Combined with Health constellation: indoor air quality (CO₂, humidity) correlated with sleep quality, respiratory symptoms, or mood

- Combined with Home Management (Part 3): renovation planning — "Which rooms have the worst temperature stability? Those are the insulation priorities."

# Cross-App and Cross-Constellation Analysis

This is the section that demonstrates why these three apps — and their external data integrations — belong in WIP rather than operating as standalone tools.

## Within the Energy Constellation

- **Complete energy balance:** Grid import (Meter Tracker) + solar production (Solar Monitor) = total consumption + feed-in + storage losses. This closed-loop balance is impossible without both data sources in WIP. Any discrepancy flags a measurement error or untracked consumption.

- **Weather-normalised efficiency:** Consumption per heating degree day (Meter Tracker + external weather), correlated with indoor comfort achieved (Climate Logger). The question shifts from "How much energy did I use?" to "How efficiently did I convert energy into comfort?"

- **Solar self-consumption optimisation:** Overlay production curve (Solar Monitor) with consumption curve (Meter Tracker). Identify the gap where you’re feeding to the grid at a low tariff but buying back in the evening at a high tariff. This directly informs the battery storage investment decision.

- **Room-level energy allocation:** If you know the total heating energy (Meter Tracker) and you know the temperature maintained in each room (Climate Logger) relative to outdoor temperature (weather data), you can estimate the energy consumption per room. Rooms that take disproportionate energy to heat are insulation or window candidates.

## Cross-Constellation: Energy + Financial

This is the constellation pair where cross-linking delivers the most immediate, tangible value. Every energy analysis has a financial mirror:

- **True cost of energy:** Utility bills from bank transactions (Statement Manager) decomposed into price and volume using meter readings and tariff data. "I paid CHF 1,800 for electricity last year. CHF 1,200 was consumption cost, CHF 400 was network charges, and CHF 200 was levies and taxes."

- **Solar ROI model:** Installation cost (Receipt Scanner: the invoice from the solar company) + annual maintenance (receipts) versus: avoided grid cost (meter data × consumption tariff for self-consumed kWh) + feed-in revenue (meter data × feed-in tariff) + government subsidies (bank transactions). Updated in real time as new data flows in.

- **Battery payback analysis:** Same structure as solar ROI, but now accounting for the price differential between peak and off-peak tariffs, the self-consumption increase enabled by the battery, and the battery’s degradation curve affecting usable capacity over time.

- **Renovation cost-benefit:** "If I invest CHF 45,000 in new windows (receipt), benchmark data suggests a 25% reduction in heating energy. At current gas prices, that’s CHF 600/year savings. Payback: 75 years. But if gas prices rise at 5% annually (external forecast), payback drops to 28 years. And if I factor in the comfort improvement (Climate Logger showing fewer cold spots), it may be worth it regardless." This query spans receipts, meter data, tariff data, benchmark data, and climate data.

- **Budget forecasting:** Combine historical consumption patterns, weather forecasts, and announced tariff changes to project next quarter’s energy costs. Feed this into the Financial constellation’s BI layer as a budget line item.

## Cross-Constellation: Energy + Future Constellations

- **Energy + Home Management (Part 3):** Every piece of energy equipment (boiler, heat pump, solar panels, sensors) appears in the home equipment registry. Maintenance schedules, warranty terms, and replacement costs are all queryable. "My boiler is 12 years old, its efficiency has dropped 15% based on meter data normalised for weather, and the warranty expires in 6 months. What are my replacement options and what would a heat pump conversion cost?"

- **Energy + Vehicle:** If you charge an EV at home, the electricity meter captures charging load. Combined with driving data (mileage log), you get cost-per-km for electric driving. Combined with fuel price data, you get a direct comparison against a combustion vehicle.

- **Energy + Health:** Indoor air quality data (CO₂, humidity from Climate Logger) correlated with sleep and health data. "Does sleeping with the window open (lower CO₂, higher heating cost in winter) improve my sleep quality enough to justify the energy cost?"

> **The compounding effect**
> Notice how the Financial constellation’s data (from Part 1) appears in nearly every cross-constellation analysis above. The Energy constellation does not replace the Financial one — it amplifies it. And when we add Home Management in Part 3, both existing constellations will be amplified again. This is the network effect in action, applied to your own personal data.

# Suggested Implementation Sequence

The Energy constellation is best implemented after the Financial constellation’s Statement Manager and Receipt Scanner are in place, as these provide the financial context that makes energy analysis actionable.

|           |                                              |                                                                                                                                                            |                                                                                              |
|-----------|----------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------|
| **Phase** | **App / Integration**                        | **Rationale**                                                                                                                                              | **Depends On**                                                                               |
| **1**     | Utility Meter Tracker                        | Foundational data source for the constellation. Even manual monthly readings provide value. Smart meter integration adds granularity later.                | Financial: Statement Manager (for bill reconciliation)                                       |
| **2**     | External data: weather + tariffs             | Transforms raw meter data into actionable metrics. High impact, relatively low implementation effort (public APIs, no user data entry).                    | Utility Meter Tracker (Phase 1)                                                              |
| **3**     | Solar & Generation Monitor                   | Only relevant for households with solar. Builds on meter data to compute energy balance. Add irradiance data simultaneously for performance monitoring.    | Utility Meter Tracker (for net metering); Financial: Receipt Scanner (for ROI)               |
| **4**     | Home Climate Logger                          | Requires IoT hardware investment. Best added once meter data and weather data are established, so that climate readings can immediately be contextualised. | External weather data (Phase 2); Home Management constellation (Part 3) for sensor inventory |
| **5**     | External data: carbon intensity + benchmarks | Adds sustainability dimension and peer comparison. Lower priority than price and weather but completes the picture.                                        | Utility Meter Tracker + Solar Monitor for meaningful context                                 |

## External Data Source Reference

For convenience, the following table consolidates all external data sources referenced in this document, with access method and update frequency.

|                                  |                         |                     |               |                                        |
|----------------------------------|-------------------------|---------------------|---------------|----------------------------------------|
| **Data Source**                  | **Provider**            | **Access**          | **Frequency** | **Key Use**                            |
| Temperature, precipitation, wind | MeteoSwiss / Open-Meteo | REST API, free      | Hourly        | Consumption normalisation              |
| Heating/Cooling Degree Days      | Derived from temp. data | Computed in WIP     | Daily         | Efficiency benchmarking                |
| Electricity tariffs              | ElCom                   | Published data, API | Annual        | Cost calculation, provider comparison  |
| Wholesale electricity prices     | ENTSO-E                 | REST API, free      | Hourly        | TOU optimisation, market context       |
| Gas spot prices                  | THE / TTF               | Market data feed    | Daily         | Heating cost forecasting               |
| Solar irradiance                 | PVGIS / Open-Meteo      | REST API, free      | Hourly        | Performance ratio, yield forecast      |
| Grid carbon intensity            | Electricity Maps        | REST API, free tier | Hourly        | CO₂ footprint, carbon-aware scheduling |
| Household benchmarks             | BFE / GEAK / EU BSO     | Published data      | Annual        | Peer comparison, renovation targeting  |
| Feed-in tariffs                  | Local utility           | Published / manual  | Annual        | Solar ROI, feed-in revenue             |

# Next in the Series

This document is Part 2 of a three-part series:

- **Part 1: Personal Finance Constellation** — the foundational layer (prerequisite for this document)

- **Part 2: Energy & Sustainability Constellation** (this document) — operational data enriched by external context, with strong financial cross-links

- **Part 3: Home Management Constellation** — equipment lifecycle, maintenance, renovation planning; the convergence point where financial investment, energy impact, and physical assets meet

Part 3 will close the loop. It will show how a renovation decision — the quintessential cross-domain event — draws on financial data (can I afford it?), energy data (will it save energy?), equipment data (what needs replacing?), and external data (construction costs, property value impact, building regulations). This convergence is only possible because all three constellations share a common backend.
