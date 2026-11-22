# Reports & Analytics — Phase 7 Investment and Portfolio Analytics

## Delivered

- Investment positions from tracked stocks and eligible asset records.
- Latest stock values from saved quotes or the latest automated price-history record; mutual-fund and NPS values use saved position values or available units and NAVs.
- Allocation summaries grouped by holding type or institution and currency.
- Record-level invested/current values, date, source, and recorded difference.
- Automated price history loaded from the existing `/api/asset-prices` endpoint; the report reads at most its latest 100 history rows and reports the cap/error state.
- Saved quote and NAV history with search, type, currency, and date filters, pagination, and filtered CSV export.

## Data boundaries

- A recorded difference is current recorded value minus recorded cost; it is not a verified return, realized gain, annualized return, or complete portfolio performance measure.
- Stock lots/trades are incomplete. Missing quantities, cost basis, currency, and price dates remain missing.
- No value is converted across currencies. A missing currency is labeled instead of inferred.
- Automated history is separate from `TrackerData`, so an unavailable endpoint is surfaced while stored in-app snapshots remain visible.
- The automated-history report reads the latest 100 records; the Price automation screen remains the paginated source for longer history.
