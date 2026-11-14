# Reports & Analytics — Phase 8 Asset Analytics

## Delivered

- Asset and liability records grouped by type or institution and currency.
- Coverage counts for records without a current value and records without a valuation date or older than 365 days.
- Dated history from stock quotes, mutual-fund/NPS NAVs, automated asset-price records, and vehicle valuations.
- Independent search, type, currency, and valuation-date filters, with pagination for detailed lists.
- CSV exports for filtered asset records and filtered valuation history.

## Data boundaries

- This is a coverage report, not a complete net-worth statement. Loans are shown separately as liabilities; vehicle and bank balances remain in an unrecorded currency where the source provides none.
- Asset value fields can have different semantics; only same-currency records are totaled, and values without dates are flagged.
- A single current valuation is not treated as historical performance. Only dated snapshots appear in history.
- Duplicate representations of vehicles are de-duplicated by matching normalized names when both asset and vehicle records exist; unmatched asset-level vehicle records remain visible.
