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

- **Reports & Analytics → Asset analytics** defaults to **All asset types → All instruments**, showing a single portfolio-total chart. Portfolio currency is selectable and currencies are never combined.
- **Show individual charts** expands the separate Stocks, Mutual funds, and NPS sections, with one price/NAV chart per instrument. Selecting a single instrument shows its chart across asset types.
- Line, area, and column charts share date filters; the instrument selector can show the aggregate or focus on an individual instrument across asset types.
- The report loads every page of automated price history and presents values as recorded per share/unit, keeping each instrument and currency separate.
- The selected-range aggregate change compares a consistent set of holdings: by default the range starts at the latest first-observation date among eligible holdings, while an explicit From date excludes holdings without a price on or before that date. This prevents newly appearing histories from being counted as gains.
- Aggregate value uses current recorded stock quantity, mutual-fund units, and NPS scheme units against the last available automated price/NAV as of each date. It is not a historical holdings ledger; instruments without units or comparable starting prices are excluded.
- **Profit / loss since invested** is independent of the selected dates and uses stock average buy price × quantity or the recorded invested/contribution amount for mutual funds and NPS. Current values use available quotes/NAVs; recorded NPS withdrawals are included. Positions without a cost basis or current value are excluded, so this remains an estimate.
- The report does not convert currencies or imply an investment recommendation. Investment & portfolio summaries retain their existing latest-100-record limit.
