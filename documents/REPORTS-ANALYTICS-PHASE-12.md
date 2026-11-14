# Reports & Analytics — Phase 12 Export and Sharing

## Delivered

- Filtered CSV export for report records, investment positions/history, asset records/history, forecasts, and saved views.
- Print action for report pages with print-specific layout rules.
- Copy-summary action for sharing plain-text report summaries through the browser clipboard.
- CSV serialization reuses `exportCsvRows`, including its quoting and spreadsheet-formula protections.

## Boundaries

- CSV exports contain the rows matching the active report filters; pagination does not limit export contents.
- Print is local to the current browser. Copy-summary shares text only.
- No public links, email delivery, cloud file export, or cross-account view sharing is added.
