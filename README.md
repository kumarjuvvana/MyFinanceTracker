# Daybook — Daily Shopping Tracker

A responsive shopping and personal-record tracker built with React, TypeScript, Vite, Tailwind CSS and reusable shadcn-style UI primitives. Shared data is stored in separate Supabase Postgres tables for each data collection; `data/daybook.json` is the versioned initial seed. The optional Gmail test connector uses Google OAuth directly from the browser.

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Local setup

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Production build

```bash
npm run build
npm run preview
```

The static production site is written to `dist/`.

## Deploy to Vercel

Import the repository into Vercel and use the Vite defaults:

- **Framework preset:** Vite
- **Build command:** `npm run build`
- **Output directory:** `dist`

Or deploy with the Vercel CLI using `vercel` and `vercel --prod`. Application data is stored in Supabase, independently of source-code deployments.

## Data and privacy

For direct database development from VS Code, use a **separate Supabase development project**. The local database utility requires `SUPABASE_DEV_DB_URL` and `SUPABASE_DEV_PROJECT_REF` in the ignored `.env.local`; it rejects the current production project reference and requires the URI's project reference to match. It supports listing tables, bounded selects, parameterized insert/update/delete, bulk inserts, and creating basic tables. All write commands require interactive confirmation; update/delete require non-empty filters. Example commands: `npm run db:test`, `npm run db:tables`, `npm run db:select -- my_table 50`, `npm run db:create-table -- my_table '[{"name":"id","type":"uuid","primaryKey":true},{"name":"name","type":"text","nullable":false}]'`, `npm run db:insert -- my_table '{"id":"...","name":"Example"}'`, `npm run db:update -- my_table '{"name":"Updated"}' '{"id":"..."}'`, and `npm run db:delete -- my_table '{"id":"..."}'`. For file-based imports, `npm run db:insert-many -- my_table <json-file>` accepts a JSON array of up to 1000 records with matching fields; a future CSV workflow can map its headers to database columns and call the same bulk-insert method. These developer scripts do not run as part of Vite or Vercel and do not alter the production app. Do not configure production credentials in the development variables. The Vercel deployment continues using its existing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server-only), and `DATA_ACCESS_PASSWORD` variables.

Supabase schema migrations are not run by Vercel deployments. For app schema changes, review and explicitly run the relevant SQL migration only after checking its compatibility with the deployed app. The local data utility is not a migration runner. Keep `.env.local` private and never commit or expose database credentials in a `VITE_` variable. The app uses a signed, HTTP-only, same-site session cookie. Use the same Daybook password on each device. This is one shared password, not separate user accounts; anyone who knows it can access the shared records. Sessions last seven days. The browser never connects to Supabase directly; Vercel API handlers authenticate requests and access the server credentials.

After deploying the current app, if it asks how to initialize, choose **Use Git seed data** first. Then open **Data management → Restore a backup** and import the old `data/daybook.shared.json` file to populate the Supabase tables. Download that file privately from the old repository; it includes personal information and an encrypted credential vault, so do not commit or share it. The app validates the backup before saving. The API writes each collection as rows in its own Supabase table; record fields are preserved in each table's `record` JSONB column, and child records and relationships are stored in linked tables. Shopping lists, purchases, trips, products, stores, reminders, stocks, brokers, price snapshots, assets, learning records, education records and their subjects/assessments/payments, vehicles and their journeys/maintenance, personal documents, and the encrypted credential vault are all included. Changes autosave; open devices check for updates on focus and every two minutes. Database revisions detect concurrent edits and report conflicts instead of silently replacing remote changes. JSON backup, Excel-compatible purchase CSV export, refresh, and confirmed clear-data controls are available under **Data management**. Display preferences remain browser-specific.

The top-bar toggle or **Data management** page lets you switch between light and dark mode. Data management also lets you choose a visual theme (Sage studio, Cloud canvas, or Warm sand), display currency (INR by default, with USD, EUR and GBP available), font style (modern sans, editorial serif, or friendly rounded), font/interface size, accent color, and a dark background theme. Theme and appearance preferences are saved in browser LocalStorage separately from tracker data. Changing currency updates formatting only; it does not convert existing amounts.

Pages adapt to phone and tablet widths with a compact navigation bar, single-column layouts where needed, and card-style shopping and history rows on narrower screens.

Use **Master data** to save reusable products with a category, unit and estimated price per unit, stores with optional plain-text locations, and custom reminder categories. Reminder categories remain available even when no current reminder uses them; a category in use cannot be deleted until its reminders are reassigned or removed. Product presets can be selected when adding an item; quantities such as kg, g, L, ml, pcs, and other common units are supported, and the estimated total is calculated as quantity multiplied by the per-unit price. Saved stores are available when planning a shopping trip. Store locations are text only; map integration is not included.

Use **Notes & reminders** to add dated notes with a category, choose from grouped category buttons, search across reminder titles, categories, dates, details, and status, or filter by category and completion. Reminders display as full-width rows and can be edited directly in place. Add custom categories under **Master data → Reminder categories**. Due and overdue reminders, plus reminders due within the next seven days, appear on the dashboard. These are in-app reminders only; they do not send email, browser, or operating-system notifications.

For an existing database, run only `supabase/migrations/20261105020000_add_reminder_categories.sql` in the Supabase SQL Editor to enable persistent custom reminder categories. This additive script creates the category table and its restricted read/write functions; it does not rerun or replace the main Daybook migration. Fresh database setup can use the full `20261105010000_normalize_daybook_storage.sql` migration.

Use **Stocks** to save NSE/BSE stock codes and display names, group them with manually managed broker labels, enter average buy price per share and number of shares held, refresh quotes, and review dated price snapshots. New seed data starts with no sample holdings. Migrating older browser data preserves its saved watchlist and price snapshots. When the average buy price, quantity, and an INR quote are available, the app calculates invested value, current value, and unrealized profit/loss. Holdings inputs are optional; leave both empty if you only want a watchlist. The app requests quotes through a Vercel serverless endpoint backed by Yahoo Finance's public chart endpoint; no API key or broker login is required. The source is unofficial and may provide delayed prices, limit requests, or be unavailable. Verify prices with your broker before making financial decisions. Stock lists, holdings inputs, and snapshots are stored in Supabase; no broker account or trade data is connected.

Use **Asset manager** for a broader manual overview of mutual funds, stocks, loans, real estate, bonds, digital gold, cash/deposits, and other assets. Only the name and type are required; institution, account/reference, currency, invested amount, current value or outstanding loan balance, units, interest rate, dates, location, link, tags, and notes are optional. Loans are counted as liabilities, with per-currency asset, liability, and net totals. Values are user-entered and are not independently verified or converted. Stock entries are portfolio summaries; avoid counting the same position again if you already use the detailed Stocks page. Asset details are readable to anyone with access to the Daybook password and Supabase service role; do not store full account numbers or other secrets.

Use **Learning** to keep a personal record of skills, courses, and topics you want to learn. Set a level from beginner/basic through intermediate, advanced, or expert, track whether you have not started, are in progress, or completed it, and optionally save the provider, dates, notes, a course/resource link, and an AI tutor or tool link. Links must use HTTPS. Records sync with your other devices in the shared Daybook data.

Use **Schools & Colleges** to maintain an education timeline for each child from Nursery / Pre-KG, LKG, and UKG through primary grades, higher secondary, and college/university. Records appear as compact rows with student, institution, class/course, academic year, and status; use **Show** on an individual year to expand its full details, subjects, assessments, and payments, and **Hide** to collapse it again. Add separate records for academic years, with student name and school/college as the only required fields. Education level, class/course, academic year, status, board/university, dates, school contact, portal/document link, and notes are also supported. Enter tuition, admission, school van / transport (annual total), and other fee charges separately. Log each payment by type and period; admission and transport payments are included in the same paid total, which is checked against the combined charges. If older records have fee payments but no charge total, add the charge amounts before recording further payments. Keep the existing “Previously paid fee (legacy)” separate from itemized payments and do not enter the same payment twice. When updating an older record, if its annual tuition amount included admission or transport fees, adjust it to tuition-only before adding those charges separately. The app blocks new payments beyond the remaining combined charges and prevents reducing declared charges below amounts already paid. Existing education and payment records are preserved; the new fields are stored in the existing JSON records and require no database migration. Select a student to review their years, then record subjects/courses, assessments and marks with a maximum score, or a grade/GPA for systems that do not use numeric marks. Use the copy icon on a year record to open a prefilled form and save a separate record; the copy includes its subjects, assessments, and payment entries with fresh identifiers, so changes to either record do not change the other. Search and filter records by student, institution, year, level, and status; sort by academic year, recent payment, fees paid, fee balance, or institution. These records are readable to anyone with access to the Daybook password and Supabase service role; avoid entering student ID numbers or sensitive health information.

Use **Vehicles** to maintain vehicle details, log travel dates, routes, odometer readings, purposes and costs, and record services or repairs with providers, costs and next-due dates or odometer readings. These records are part of the shared JSON backup and sync across devices.

Use **Electricity** to manage readings for multiple meters or locations. Record each cumulative kWh reading, billing period, unit rate, bill amount, and payment status/date. Usage is calculated from the previous reading for that meter; readings must be non-decreasing and cannot duplicate a meter/date. Records sync with the shared Daybook data and are included in backups.

Use **Personal documents** to organize identity records, insurance policies, licenses, certificates and other important information. Entries can include holder, document or policy number, issuer, issue and renewal/expiry dates, a shared link, notes, custom fields and a configurable due-date reminder. Expired and due-soon records appear on the dashboard and in this screen while the app is open. These are in-app reminders, not push or email notifications. No scans are uploaded. Only use links that have appropriate sharing permissions. The details are stored as readable text in Supabase; anyone with access to the Daybook password or Supabase service role can access them. Restrict Supabase credentials accordingly.

Use **Account credentials** for account/provider names, HTTPS sign-in links, usernames, passwords, recovery information, tags, notes and searchable custom fields. Before saving, the browser encrypts the vault with AES-256-GCM using a separate passphrase-derived key (PBKDF2-SHA-256); only encrypted data is stored in Supabase. Use a unique vault passphrase on each device. It is not the Daybook access password and is never sent as part of the save request. If forgotten, the vault cannot be recovered. Lock the vault when finished. This protects stored data, not a compromised browser, device or deployed app; while unlocked, the app handles decrypted values in browser memory. This is not a substitute for a dedicated password manager; do not store bank PINs, one-time codes or recovery codes. The fictional example in the add form is not saved unless you submit it.

The development server includes a matching `/api/stock-price` middleware, so **Stocks** refresh also works with `npm run dev`. Deployments use the Vercel function in `api/stock-price.ts`.

## Supabase and Gmail setup

1. In your Supabase project, open **SQL Editor**, run `supabase/migrations/20261105010000_normalize_daybook_storage.sql`, and confirm the collection tables and `public.load_daybook_data` / `public.save_daybook_data` functions are created. If you already ran the earlier single-table migration, this migration keeps and converts its shared row.
2. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel Environment Variables. Use the project URL and a server-only service role key. Never use a `VITE_` prefix for the service role key or commit it. Also set `DATA_ACCESS_PASSWORD` to a strong passphrase of at least 16 characters, then redeploy.
3. Optional: to use **R&D / Test Connectors → Test database connection**, set `SUPABASE_DB_URL` to a PostgreSQL URI from your Supabase project's **Connect** dialog. Choose **Transaction pooler** for the Vercel serverless runtime, keep it server-only, and redeploy after setting it. The test only executes `SELECT 1`; it does not run migrations.
4. For local API development, copy `.env.example` to `.env.local` and set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATA_ACCESS_PASSWORD`, and, if testing the database connection, `SUPABASE_DB_URL`; then run `npm run dev`. `.env.local` is ignored by Git.
5. Open the app and sign in. If the database is not initialized, choose **Use Git seed data**; then use **Data management → Restore a backup** to import `data/daybook.shared.json` downloaded privately from the old repository. The import is what loads those records into their corresponding tables. A local-only SQL script containing the old backup is generated at `supabase/manual-import-daybook.sql`; it is excluded from Git because it contains personal information. The old shared data file and browser secrets are intentionally not copied into this repository.
6. Gmail is separate and optional. In Google Cloud Console, enable the **Gmail API**, configure OAuth consent, and create a Web application OAuth client. Add your local and deployed origins, set `VITE_GOOGLE_CLIENT_ID` in `.env.local` and Vercel Environment Variables, and redeploy.
7. To test email, select **R&D / Test Connectors**, click **Connect Gmail**, and follow the authorization prompt. The email is sent from the Google account you authorize.

For a local-only UI/data preview while diagnosing sign-in, set `LOCAL_AUTH_BYPASS=true` in `.env.local` and run `npm run dev`. This skips the password only for requests addressed to `localhost`, `127.0.0.1`, or `::1`, and only outside production. It still requires the local Supabase server credentials to load cloud data. Never enable this in Vercel or expose the development server to your network. Remove the setting or set it to `false` after testing.

Gmail API sending is a test-email connector, not a scheduled reminder system.
