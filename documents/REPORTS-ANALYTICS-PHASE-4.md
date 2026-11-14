# Reports & Analytics — Phase 4 Hub

## Phase objective

Add a dedicated top-level Reports & Analytics landing page, separate from Shopping, and make the existing Shopping report reachable within that hub.

## Delivered

- Added **Reports & Analytics** to the Overview navigation group.
- Added an overview with current-month recorded shopping spend and counts of purchase, investment-source, and subscription records.
- Added report-category controls for Overview, Shopping, Finance & investments, Assets & portfolio, Subscriptions & bills, Forecasts, and Saved reports.
- Kept the existing Shopping report's filters, grouping, and charts available under Shopping.
- Added source-availability views and links to the existing stocks, asset manager, and subscriptions screens. These links open the record-management screens; they are not represented as finished analytics reports.
- Marked forecast and saved-report areas as planned rather than showing unsupported projections or implying persistence exists.
- Added a note that the currency selector changes display formatting only and that record counts do not imply complete financial coverage.
- Kept the legacy `?page=Reports` route working by directing it to the new hub, and mapped saved legacy Reports favorites to Reports & Analytics during data normalization.

## Data boundaries

The overview reads the already-loaded shared Daybook data and computes current-month shopping spend with the Phase 3 report engine. Investment and subscription figures are counts of recorded source entries only. No cross-currency totals, net-worth figure, portfolio return, cash-flow metric, forecast, or saved view is created in this phase.

No Supabase migration or new persistence endpoint is required.

## Validation

- Production TypeScript and Vite build.
- Manual navigation check: new top-level entry opens the overview; Shopping category opens the existing report; other categories clearly distinguish source-management links from analytics not yet available.
- Compatibility check: legacy Reports URLs and saved favorites resolve to the new hub.
- Responsive and light/dark theme check for category controls and cards.
