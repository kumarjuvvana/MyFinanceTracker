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

## Automated asset analytics report

- **Reports & Analytics → Asset analytics** defaults to **All asset types** and displays separate Stocks, Mutual funds, and NPS sections, with one chart per instrument.
- Line, area, and column charts share date filters; the instrument selector can show all instruments or focus on an individual instrument across asset types.
- The report loads every page of automated price history and presents values as recorded per share/unit, keeping each instrument and currency separate.
- This report does not interpolate missing dates, convert currencies, or treat a per-unit price/NAV as total portfolio value. Investment & portfolio summaries retain their existing latest-100-record limit.
