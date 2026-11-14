# Reports & Analytics — Phase 5 Shopping Reports

## Phase objective

Expand Shopping inside the Reports & Analytics hub into a practical MVP using recorded purchase and trip data, while keeping all report controls scoped to the Shopping report.

## Delivered

- Monthly spending totals and a six-month trend for the active date, store, and category filters.
- Category breakdown and a month-by-month category trend.
- Monthly, category, and store-grouped summaries for comparing recorded spend.
- Trip totals calculated only from purchases linked to each trip and matching the current report filters.
- Item purchase frequency, average paid amount, latest purchase date, and total spend, grouped by saved item ID.
- A configurable overall monthly shopping budget with current-calendar-month actuals, saved in the account's shared preferences.

## Data and calculation boundaries

- Purchase amounts have no per-record currency. The selected display currency formats values but does not convert them.
- Budget comparisons use the overall configured monthly amount and all recorded purchases in the current calendar month; report filters do not change the budget calculation.
- Trips with no linked purchase records are not included. Unlinked purchases are excluded from trip totals and remain included in other Shopping reports.
- Trip totals reflect the matching purchases after the active date, store, and category filters; they are not necessarily the full trip total.
- Item patterns use recorded purchase rows and group on the saved item ID. Averages are per purchase record, not a unit-price or inflation-adjusted measure.
- No budget is assumed when the user has not configured one.

## Phase 5 completion criteria

- Shopping reports expose period spend, category trends, store comparison, trip analysis, item patterns, monthly summaries, and budget-versus-actual.
- Shared Shopping filters consistently affect the historical breakdowns and do not silently alter the independent current-month budget comparison.
- Budget settings are validated and saved through the existing shared-preferences path.
- The production TypeScript/Vite build passes.
