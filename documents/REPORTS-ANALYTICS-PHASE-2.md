# Reports & Analytics — Phase 2 Data Source Audit

## Purpose and audit boundary

This inventory maps report ideas from [Phase 1](./REPORTS-ANALYTICS-PHASE-1.md) to the data shapes and persistence paths present in the repository. It is a source-code audit only: it does not query the production database, measure live record counts, confirm which migrations have run, or establish that a user's records are complete.

The shared record contract is [`TrackerData`](../src/types.ts), normalized and validated in [`data.ts`](../src/lib/data.ts), and read or saved by [`api/data.ts`](../api/data.ts) through Supabase RPCs. The base storage migration uses dedicated collection tables, JSONB records, and linked child tables; later migrations add domain-specific tables. Important dates and cooking inventory also have separate API and revision paths. Report implementations must load each required source and handle partial or unavailable data explicitly.

## Source inventory

| Domain and source | Reportable fields currently modeled | Candidate use | Audit notes |
| --- | --- | --- | --- |
| Shopping purchases | Date, price, quantity, unit, item name, category, store, optional trip ID | Spend trends and breakdowns by period, category, store, trip, and item | Best-supported starting point for historical spend. Purchase records do not carry a currency field; the selected display currency formats amounts but does not convert them. Confirm entry conventions before presenting monetary totals. |
| Shopping trips, items, products, and stores | Trip date, store, purchase links; item/product category, unit, estimated unit price | Trip totals, product patterns, planned-versus-paid comparisons | Purchase-to-trip links must be counted once. Estimated product prices are not actual transaction prices. |
| Stocks and quote snapshots | Symbol, exchange, broker, optional average buy price and quantity; quote price, currency, timestamp, market state, previous close | Holdings with available quotes; quote history; allocation by broker or exchange | Quantities, buy prices, and quote coverage are optional. No complete trade/lot history is modeled, so realized returns, tax lots, and complete investment cash flows cannot be derived. |
| Mutual fund and NPS assets | Asset type, institution, currency, invested/current value, units, NAV dates/history; NPS tier and scheme-level units, values, and NAV history | Current recorded holding values, allocation, and supported NAV trends | Values and units may be missing or manually entered. Automated price history is persisted separately for Stocks, Mutual fund, and NPS in `asset_price_history`; its schema is in [`20261113130000_add_scheduled_asset_price_updates.sql`](../supabase/migrations/20261113130000_add_scheduled_asset_price_updates.sql). Validate history availability and valuation dates before trend or forecast use. |
| Other assets and loans | Type, institution, currency, invested/current value, quantity, interest rate, start/maturity dates, loan balance and EMI fields, and type-specific details | Recorded asset/liability snapshot by type or institution; maturity and obligation summaries | Most values are snapshots, not dated transaction histories. Asset types do not share identical valuation semantics. Cross-currency aggregation requires an explicit conversion source and date; otherwise report separate currency totals. |
| Bank accounts and imported transactions | Optional current balance and as-of date; embedded transactions with date, debit/credit direction, amount, description, import timestamp | Balance snapshots and imported debit/credit activity | Transaction records do not include currency or a category, and account balances do not carry a currency field. Imported email coverage is not a complete bank ledger. Do not label totals as complete cash flow or savings rate without further validation. |
| Subscriptions and bills | Account category, provider, billing type, account currency; transaction amount, type, transaction/period/due/payment dates, paid state | Recorded recurring costs, history by provider/category, upcoming due dates | Amount is nullable and recurrence intervals are not a normalized schedule. Totals can be grouped by account currency; mixed-currency totals must not be added without conversion. |
| Electricity readings | Meter reading and date, period bounds, optional rate and bill amount, paid status/date | Recorded consumption and bill trends by meter and period | Check meter continuity, reading units, overlapping periods, and missing rates. Bill amount and consumption should remain distinct measures. |
| Education records and student plans | Fees, payments and allocations, expenses, dates, currency, academic year, student/institution; planned cost categories and dates | Education cost summaries, paid-versus-due views, student/academic-year breakdowns | Annual/charged fees, payment allocations, and expenses can describe overlapping costs. Reconcile definitions and allocations before summing to prevent double counting. Plans are estimates, not actual payments. |
| Vehicles, journeys, maintenance, valuations | Journey and maintenance dates and costs; odometer; optional purchase/current values and dated valuation history | Recorded operating-cost and valuation trends by vehicle | Journey and maintenance costs and vehicle values do not include a currency field. Costs may be incomplete; valuations are estimates and need not be regularly updated. |
| Cooking inventory and usage | Inventory quantities, units, optional unit prices; dated usage quantities; recipe/planning ingredients and estimated prices | Inventory movement and estimated ingredient use/cost | Inventory is served by a separate API. Current unit prices are not historical prices; multiplying historical usage by today's price would be an estimate, not historical actual spend. |
| Issues and maintenance | Reported/due dates, estimated/actual cost, status, area, priority, asset/provider | Open work, due items, and recorded cost summaries | Costs are optional and have no currency field. Status counts are more reliable than money totals. |
| Reminders, important dates, learning, training, exercise, mindfulness, devotional, cooking logs, and activities | Dates, statuses, categories, durations/counts, ratings, or qualitative records, depending on module | Activity counts, completion trends, attendance, and date-based summaries | These are domain activity measures, not financial transactions. Important dates have their own API; avoid inferring spending or investment metrics from these records. |
| Family, career, personal documents, and documents | Descriptive/profile fields, dates, document metadata and links | Selected counts or expiry/renewal reminders where appropriate | Mostly profile or sensitive records, not financial activity. Exclude document contents and personal identifiers from broad analytics. |
| Credentials and credential vault | Account access details, recovery information, encrypted vault payload | None | Explicitly excluded from reports, search-derived aggregates, and exports. |
| Archived records | Archived snapshots of records and linked child data | Optional future archived-record analysis | Inclusion policy is not defined. Exclude from active totals by default and avoid counting both active and archived copies. |

The canonical interface and optional collection list are declared in [`TrackerData`](../src/types.ts). Some data is nested in parent records, such as education payments, subscription transactions, asset histories, and bank transactions. Other sources use dedicated storage paths; report data loading must not assume every domain is present in the shared `/api/data` response.

## Report-to-source map

| Report family | Primary sources | Readiness from schema inspection | Main validation before implementation |
| --- | --- | --- | --- |
| Shopping | Purchases, trips, products, stores | **Good starting point** for descriptive summaries | Confirm purchase currency convention, date validity, trip-link integrity, and treatment of archived records. |
| Portfolio snapshot | Stocks, stock quotes, assets, bank balances, vehicle valuations | **Partial**; present values can be absent, stale, or in different currencies | Define which assets/liabilities are included, valuation freshness, value semantics, currency grouping, and coverage display. |
| Portfolio history | Stock quote snapshots, fund/NPS NAV history, automated asset price history, vehicle valuation history | **Partial**; history is source-specific and opt-in or provider-dependent | Establish per-source history coverage, snapshot ordering, stale-value rules, and whether values represent holdings or instrument prices. |
| Bank activity / cash flow | Bank-account imported transactions and balance snapshots | **Limited** | Verify currencies, account coverage, duplicate/import behavior, transaction categorization, and whether credits/debits are complete. |
| Subscription costs | Subscription account transaction histories | **Partial** | Define recurrence and period semantics, handle null amounts, and compare only compatible currencies. |
| Education costs | Education fees, charges, payments, allocations, expenses, and plans | **Partial** | Reconcile actual versus planned amounts and prevent overlapping fee/payment/expense totals. |
| Household operating costs | Vehicle costs, electricity bills, issue costs, cooking inventory | **Partial** | Establish currency/unit fields, completeness, period boundaries, and estimated versus actual price semantics. |
| Personal activity | Reminders, attendance, learning, training, exercise, mindfulness, devotional, cooking logs | **Good for selected counts/status trends** | Select meaningful module-specific measures and avoid treating missing logs as zero activity. |
| Forecasts | Any source above with consistent dated history | **Not yet validated** | Phase 2 cannot certify history length or quality without live-data review. Define a minimum coverage policy and method per forecast before building it. |

“Readiness” describes the shape of the model, not the completeness or quality of live user data. No formula in this audit should be interpreted as an approved metric definition.

## Cross-cutting data gaps and guardrails

1. **Currency:** Several monetary sources have no per-record currency, and other sources allow multiple currencies. Display preferences do not convert stored values. Keep incompatible values separate and disclose assumptions.
2. **Actuals versus estimates:** Planned, estimated, manually valued, provider-priced, and transaction-paid values need distinct labels and must not be silently combined.
3. **Snapshot versus flow:** Current balances and valuations are snapshots; purchases and some transactions are flows. A snapshot delta is not automatically income, spending, or investment return.
4. **Coverage and freshness:** Optional quantities, missing dates, opt-in histories, delayed NAV publication, and stale manual valuations require visible coverage/freshness indicators.
5. **Overlapping records:** Parent-child details and parallel summaries (for example education charges/payments/expenses or a purchase linked to a trip) need deduplication rules.
6. **Archive policy:** Reports should exclude archived records by default unless an explicit inclusion control is added; active and archived copies must not be counted together.
7. **Privacy:** Account credentials, vault data, document contents, and sensitive identifiers must not enter general-purpose analytics or report exports.
8. **Live schema state:** The repository lists migrations, but that does not prove which are applied to the deployed Supabase project. Confirm migration state and permissions before relying on a source.
9. **Live completeness:** Record counts, date ranges, null rates, and price staleness require a safe, read-only audit of the intended database; they are not inferred from code or seed data here.

## Suggested Phase 3 inputs

Before building the shared analytics layer:

- Confirm which database migrations are applied in the target environment.
- Measure source record counts, date ranges, optional-field coverage, and staleness without exposing personal record values.
- Agree on currency and inclusion rules for each monetary report.
- Define metric formulas and source-of-truth precedence for snapshot and transaction sources.
- Prioritize the initial report set using validated data coverage, beginning with Shopping and only then selecting portfolio or bill summaries that meet the required data quality.
- Establish explicit criteria for forecast eligibility and how uncertainty and missing coverage will be shown.

## Phase 2 completion criteria

- Report candidates are mapped to concrete source collections and fields.
- Dedicated and separate persistence paths are identified.
- Data-supported descriptive reports are distinguished from incomplete or ambiguous metrics.
- Currency, coverage, freshness, privacy, deduplication, and archive risks are recorded.
- Phase 3 can design shared analytics contracts without assuming live data completeness.
