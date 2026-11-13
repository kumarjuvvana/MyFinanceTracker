# Reports & Analytics — Phase 1 Product Scope

## Purpose

Establish the product scope and report taxonomy for a dedicated Reports & Analytics area. This phase defines what the feature is meant to cover; it does not implement navigation, screens, analytics calculations, forecasts, or database changes.

## Product direction

Reports & Analytics will be a top-level area, separate from Shopping. It will give users one place to understand current status and historical trends across supported Daybook modules, then add clearly labeled, data-backed forecasts in later phases.

Reports must be descriptive and traceable to saved records. Forecasts are estimates, not guarantees or investment advice. The feature must not imply that incomplete records represent a user's complete financial picture.

## Navigation taxonomy

The eventual top-level navigation entry is **Reports & Analytics**. Its report categories are:

1. **Overview** — cross-module status summaries and links to detailed reports.
2. **Shopping** — spending, purchases, trips, products, and stores.
3. **Finance & investments** — financial records and investment-related summaries, subject to available source data.
4. **Assets & portfolio** — holdings, valuations, allocations, and available price history.
5. **Subscriptions & bills** — recurring costs, payment history, and upcoming renewals where recorded.
6. **Forecasts** — estimates derived from supported historical records, with assumptions and data coverage shown.
7. **Saved reports** — named report configurations and filters, after persistence and ownership behavior are defined.

The existing Shopping **Reports** screen is the initial report to migrate into the new area in a later implementation phase. It should remain available during that migration, and its behavior should be preserved unless a separately approved product change is made. This phase does not move or rename the existing screen.

## Scope by release

### Initial report experience

- Establish the dedicated Reports & Analytics entry and landing-page concept.
- Bring the existing Shopping reports into the new report taxonomy without losing existing reporting behavior.
- Define shared report controls before adding module-specific report collections.

### Follow-on report categories

- Finance and investment summaries, limited to records Daybook actually captures.
- Asset and portfolio history using saved holdings and supported valuations.
- Subscription and bill summaries using recorded billing and transaction history.
- Additional personal and household reports only where the underlying records support meaningful, non-misleading measures.

### Forecasting

- Add forecasts only after source coverage and metric definitions have been reviewed.
- Show the historical window, method, and relevant assumptions next to each forecast.
- Distinguish observed values from projected values visually and in exports.
- Do not present projections as personalized investment recommendations.

## Shared report capabilities

The intended shared interaction model is:

- **Date scope:** useful presets plus a custom range where the source data has dates.
- **Comparison:** optional previous-period comparison when both periods have adequate data.
- **Filters:** source-relevant dimensions such as category, store, account, asset type, institution, status, or record type.
- **Grouping:** time period and relevant dimensions, such as category, store, trip, asset type, or institution.
- **Presentation:** summary metrics, trends, breakdowns, and a record-level or grouped table where appropriate.
- **Data quality:** empty states, missing-history indicators, and explicit coverage limits.
- **Exports:** preserve the active report's scope and filters when exports are added in a later phase.

Controls should be relevant to the selected report. A global filter must not silently affect unrelated report categories.

## Candidate report catalogue

These are candidates for assessment, not commitments that every metric is currently calculable:

| Category | Candidate reports |
| --- | --- |
| Overview | Current records and recent trends by supported module |
| Shopping | Spend over time; spend by category or store; trip totals; purchase and item patterns |
| Finance & investments | Recorded cash and investment summaries; available contribution, balance, and transaction trends |
| Assets & portfolio | Current recorded valuation; allocation by asset type or institution; valuation and available price-history trends |
| Subscriptions & bills | Recurring costs; recorded transaction history; upcoming renewals where dates are available |
| Forecasts | Spending trend estimates; subscription cost outlook; portfolio or net-worth scenarios only when data and assumptions support them |

Cash flow, savings rate, profit/loss, and net worth should not be promised as complete measures until Phase 2 confirms that Daybook captures the required inflows, outflows, liabilities, cost basis, dates, and valuation coverage.

## Product principles

- Keep reports separate from the operational screens where records are created and edited.
- Reuse common filter, grouping, comparison, and presentation behavior where it fits.
- Link summary results back to the records behind them whenever practical.
- Make calculation definitions and included records understandable.
- Avoid double-counting related records or mixing currencies without a disclosed conversion method.
- Treat missing or stale prices as missing data, not as zero or a current valuation.
- Keep saved views distinct from shared or global report settings.
- Make reports usable on narrow screens and accessible by keyboard and assistive technology.

## Not included in Phase 1

- Any app-code, menu, or screen changes.
- Metric formulas or financial-source reconciliation.
- Forecast algorithms or “what-if” calculations.
- Saved-view persistence or sharing.
- Chart-library selection, data migrations, or backend APIs.
- Changes to the existing Shopping reports behavior.

## Phase 1 completion criteria

- The top-level Reports & Analytics direction and category taxonomy are documented.
- The existing Shopping report is identified as the first migration candidate, with current behavior protected.
- Candidate report ideas are distinguished from metrics verified against current data.
- Forecasting is explicitly gated on data validation and communicates uncertainty.
- Phase 2 can proceed to inventory actual data sources, fields, coverage, and gaps against this scope.
