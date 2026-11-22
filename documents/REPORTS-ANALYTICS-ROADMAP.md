# Reports & Analytics — Module and Visualization Roadmap

This document catalogs report candidates and chart guidance for phased work. Asset Analytics remains a separate report; its implementation and behavior are unchanged by the Investment & portfolio additions described below.

## Initial priority: investments and assets

- **Portfolio snapshot (remaining):** show total recorded current value, invested/cost basis, and profit/loss as clearly labeled summary cards; data-readiness coverage checks are now available in Investment & portfolio.
- **Allocation (delivered in Investment & portfolio):** a horizontal bar chart groups recorded current values by holding type or institution and shows one currency at a time; the exact-value allocation table is retained. Never add amounts in different currencies into one total unless an explicit, documented conversion source is introduced.
- **Data readiness (delivered in Investment & portfolio):** surface missing units, cost basis, current values, and undated or older-than-one-year valuations. The summary follows type, currency, and search filters but is independent of date filters; these checks describe data coverage, not verified returns.
- **Cost versus current value:** use paired bars or a diverging profit/loss bar to compare recorded cost basis and current valuation. State which positions lack either value.
- **Portfolio history:** use a line chart only when dated portfolio/holdings snapshots support the metric. Applying current units to old prices is not a historical holdings ledger or a true historical portfolio return.
- **Assets and liabilities:** show values and coverage separately; only present a net-worth trend when reliable dated values exist for both assets and liabilities.

## Existing report areas

| Area | Candidate visualizations | Display boundaries |
| --- | --- | --- |
| Finance & cashflow | Monthly income and expense columns, with a separate net-cash-flow line | Keep accounts and currencies separate; do not infer missing transactions |
| Shopping | Monthly spend columns, category/store breakdowns, and budget-versus-actual progress | Purchase records may not store currency; state the selected display-currency limitation |
| Subscriptions & bills | Paid-cost trend and an upcoming-due timeline or calendar | Keep paid transactions separate from unpaid dues and hypothetical future recurring charges |
| Forecasts | Historical series followed by a visually distinct projection and scenario range | Show data coverage and assumptions; do not describe estimates as guarantees |

## Future module inventory

Report work for these application groups should begin with a source-data and coverage review; add a report only when the stored data supports it.

- **Home & family:** education/career and school attendance/fees (term or month trends); vehicle maintenance and costs (service timeline); electricity usage and billed amounts (monthly usage and cost); family records and important dates (dated milestones only where appropriate); issues/maintenance (status and age distribution); reminders (upcoming/overdue timeline).
- **Personal growth:** learning/training progress (completion and time trends); mind and habits/exercise (calendar consistency and weekly frequency); devotional activity (dated reading or activity trends).
- **Cooking:** inventory levels and expiry (stock/expiry timeline); cooking activity and recipe use (frequency trends), without presenting estimated ingredient costs as actual spending.
- **Data & tools:** data-quality and freshness summaries for incomplete or stale records; personal-document counts/expiry views only where dates are recorded. Do not expose credential values or analyze private document contents as report data.

## Shared chart and interaction guidance

- Pair charts with summary cards or a table so exact values and empty states remain usable.
- Keep date ranges, grouping, and filters visible; label units, currencies, and valuation dates.
- Use responsive charts with accessible contrast, legends, keyboard-operable controls, and text alternatives.
- Make missing-data coverage explicit; do not imply that missing records are zero.
- Keep forecasts visually distinct from observations and disclose assumptions.
