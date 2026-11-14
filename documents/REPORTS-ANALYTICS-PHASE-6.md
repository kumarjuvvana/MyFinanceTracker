# Reports & Analytics — Phase 6 Finance and Cashflow

## Phase objective

Add dated bank-activity and subscription-payment reporting using the records already captured by Daybook, without implying complete account coverage, verified income, or currency conversion.

## Delivered

- Bank credits, debits, and net movement by individual account.
- Monthly movement rows by account, using each account's imported transaction history.
- Date and bank-account filters scoped to Finance & Cashflow.
- Paid subscription transaction totals and monthly trends by account.
- Paid subscription breakdowns by category and currency.
- Unpaid subscription entries and recorded due amounts shown separately from paid outflows.
- Date and subscription-account filters scoped to Subscriptions & Bills.
- An explicit unavailable state for savings rate instead of estimating it from incomplete sources.

## Data and calculation boundaries

- Imported bank transactions do not store currency, category, or guaranteed full-ledger coverage. Their amounts are shown as source numbers and never combined across accounts.
- Bank credits and debits are transaction directions, not verified income and expenses. Net movement is only computed within each bank account's source values.
- Subscription outflows count transactions marked paid with a recorded amount, using payment date when available and transaction date as fallback.
- Unpaid subscription entries use their due dates and are never added to paid totals. Unknown due dates do not enter a filtered due-period total.
- Subscription amounts are grouped by their account's recorded currency; different currencies are never added together.
- No savings rate, complete cash-flow total, or bank spending-by-category total is calculated from the current sources.

## Phase 6 completion criteria

- Finance reports show date-filtered credit/debit movement and monthly history per bank account.
- Subscription reports show date-filtered paid actuals, categories, recurring account types, and unpaid due entries.
- Account selection and date filters remain local to the selected report.
- Missing currency, partial bank imports, and unavailable savings-rate coverage are disclosed in the UI.
- The production TypeScript/Vite build passes.
