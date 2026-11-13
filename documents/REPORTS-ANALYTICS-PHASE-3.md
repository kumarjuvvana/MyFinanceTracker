# Reports & Analytics — Phase 3 Shared Analytics Architecture

## Phase objective

Create a small, domain-neutral analytics foundation that report screens can share, then use it for the existing Shopping report without changing its navigation or its current filter and grouping options.

## Architecture

The reporting layer is split into two pieces:

1. **Shared engine** — [`reportAnalytics.ts`](../src/lib/reportAnalytics.ts) contains serializable query types and pure functions for date ranges, dimension filters, grouping, summaries, and dimension options. It has no React, Supabase, or UI dependencies.
2. **Domain adapter** — [`shoppingReport.ts`](../src/lib/shoppingReport.ts) maps a `Purchase` to its report date, dimensions (store and category), and measure (spend). Other modules can add their own definitions without adding domain conditionals to the engine.

The current Reports screen uses these pieces to produce its filtered purchases, six-month trend data, grouped totals, and filter options. Its screen placement and visible controls are unchanged in this phase.

## Shared query model

- **Date scope:** optional inclusive `from` and `to` dates in `YYYY-MM-DD` form. Invalid dates and reversed ranges fail explicitly. Records without a valid date are excluded when a date range is applied and counted in `missingDateCount` otherwise.
- **Date presets:** all-time, last 30 days, month-to-date, and year-to-date are available as date-range helpers. Custom ranges use the same normalized contract.
- **Filters:** keyed by report dimension. Different dimensions combine with AND; multiple selected values for one dimension combine with OR. Unknown dimension IDs are rejected.
- **Grouping:** by a report dimension or by day, month, or year.
- **Measures:** finite numeric values are summed and averaged; absent/non-finite values are omitted from the measured count rather than treated as zero.
- **Result:** includes the filtered records, grouped record sets, record and measured counts, total, average, and missing-date count.
- **Dimension options:** unique, sorted values come from the same dimension definition used by filtering and grouping.
- **View configuration:** `ReportOptions` is a serializable shape for the date range, filters, group-by, and measure. It is not persisted in this phase.

## Data and correctness boundaries

- The engine only aggregates records supplied by a caller. It does not load data, query the database, or infer missing records.
- Date-only keys are compared inclusively. Timestamp values are grouped by their ISO date prefix; callers must choose the right date field for their business meaning.
- Missing dimension values are grouped under **Not specified**; missing dates are grouped under **Date not recorded** when grouping by time.
- The engine does not convert currencies, reconcile duplicate sources, distinguish actual from estimated amounts, or decide archive inclusion. Domain adapters and later report definitions must enforce the rules established in [Phase 2](./REPORTS-ANALYTICS-PHASE-2.md).
- Comparisons between periods, saved-view persistence, chart rendering, exports, and forecasts remain later work.

## Documentation organization

Non-README Markdown files are kept under [`documents/`](./). `README.md` remains at the repository root and links to the deployment guide there.

## Phase 3 completion criteria

- Shared report contracts and pure calculation helpers exist independently from UI code.
- The existing Shopping report is backed by a domain adapter and shared filtering/grouping functions.
- Existing Shopping filter and grouping choices remain available.
- The production TypeScript/Vite build passes.
- The architecture is ready for additional domain adapters without a database migration.
