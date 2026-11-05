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

Supabase SQL migrations are **manual**; Vercel does not execute them during deployment. Run `supabase/migrations/20261105010000_normalize_daybook_storage.sql` in the Supabase SQL Editor. It creates separate tables for each data collection and the RPC functions used by the app. It can be rerun to update those functions and preserves existing collection rows. If you already ran the earlier `20261105000000_create_daybook_data.sql`, the migration preserves and converts any saved row in that legacy table. In the Vercel project's Environment Variables, set `SUPABASE_URL` to the project URL, `SUPABASE_SERVICE_ROLE_KEY` to a server-only service role key, and `DATA_ACCESS_PASSWORD` to a private passphrase of at least 16 characters. Never expose the service role key in a `VITE_` variable or commit it. The app uses a signed, HTTP-only, same-site session cookie. Use the same Daybook password on each device. This is one shared password, not separate user accounts; anyone who knows it can access the shared records. Sessions last seven days. The browser never connects to Supabase directly; Vercel API handlers authenticate requests and use the service key.

After deploying the current app, if it asks how to initialize, choose **Use Git seed data** first. Then open **Data management → Restore a backup** and import the old `data/daybook.shared.json` file to populate the Supabase tables. Download that file privately from the old repository; it includes personal information and an encrypted credential vault, so do not commit or share it. The app validates the backup before saving. The API writes each collection as rows in its own Supabase table; record fields are preserved in each table's `record` JSONB column, and child records and relationships are stored in linked tables. Shopping lists, purchases, trips, products, stores, reminders, stocks, brokers, price snapshots, assets, learning records, education records and their subjects/assessments/payments, vehicles and their journeys/maintenance, personal documents, and the encrypted credential vault are all included. Changes autosave; open devices check for updates on focus and every two minutes. Database revisions detect concurrent edits and report conflicts instead of silently replacing remote changes. JSON backup, Excel-compatible purchase CSV export, refresh, and confirmed clear-data controls are available under **Data management**. Display preferences remain browser-specific.

The top-bar toggle or **Data management** page lets you switch between light and dark mode. Data management also lets you choose a display currency (INR by default, with USD, EUR and GBP available), font style (modern sans, editorial serif, or friendly rounded), font/interface size, accent color, and a dark background theme. These preferences are saved in browser LocalStorage separately from tracker data. Changing currency updates formatting only; it does not convert existing amounts.

Pages adapt to phone and tablet widths with a compact navigation bar, single-column layouts where needed, and card-style shopping and history rows on narrower screens.

Use **Master data** to save reusable products with a category, unit and estimated price per unit, and stores with optional plain-text locations. Product presets can be selected when adding an item; quantities such as kg, g, L, ml, pcs, and other common units are supported, and the estimated total is calculated as quantity multiplied by the per-unit price. Saved stores are available when planning a shopping trip. Store locations are text only; map integration is not included.

Use **Notes & reminders** to add dated notes with a category, search across reminder titles, categories, dates, details, and status, or filter by category and completion. Edit a reminder directly in its list card so you do not have to scroll back to the add form. Due and overdue reminders, plus reminders due within the next seven days, appear on the dashboard. These are in-app reminders only: they are stored in the shared JSON file and do not send email, browser, or operating-system notifications.

Use **Stocks** to save NSE/BSE stock codes and display names, group them with manually managed broker labels, enter average buy price per share and number of shares held, refresh quotes, and review dated price snapshots. New seed data starts with no sample holdings. Migrating older browser data preserves its saved watchlist and price snapshots. When the average buy price, quantity, and an INR quote are available, the app calculates invested value, current value, and unrealized profit/loss. Holdings inputs are optional; leave both empty if you only want a watchlist. The app requests quotes through a Vercel serverless endpoint backed by Yahoo Finance's public chart endpoint; no API key or broker login is required. The source is unofficial and may provide delayed prices, limit requests, or be unavailable. Verify prices with your broker before making financial decisions. Stock lists, holdings inputs, and snapshots are stored in Supabase; no broker account or trade data is connected.

Use **Asset manager** for a broader manual overview of mutual funds, stocks, loans, real estate, bonds, digital gold, cash/deposits, and other assets. Only the name and type are required; institution, account/reference, currency, invested amount, current value or outstanding loan balance, units, interest rate, dates, location, link, tags, and notes are optional. Loans are counted as liabilities, with per-currency asset, liability, and net totals. Values are user-entered and are not independently verified or converted. Stock entries are portfolio summaries; avoid counting the same position again if you already use the detailed Stocks page. Asset details are readable to anyone with access to the Daybook password and Supabase service role; do not store full account numbers or other secrets.

Use **Learning** to keep a personal record of skills, courses, and topics you want to learn. Set a level from beginner/basic through intermediate, advanced, or expert, track whether you have not started, are in progress, or completed it, and optionally save the provider, dates, notes, a course/resource link, and an AI tutor or tool link. Links must use HTTPS. Records sync with your other devices in the shared Daybook data.

Use **School & college records** to maintain an education timeline for each child from primary grades through higher secondary and college/university. Records appear as compact rows with student, institution, class/course, academic year, and status; use **Show** on an individual year to expand its full details, subjects, assessments, and payments, and **Hide** to collapse it again. Add separate records for academic years, with student name and school/college as the only required fields. Education level, class/course, academic year, status, board/university, dates, optional fee amounts and currency, school contact, portal/document link, and notes are also supported. Select a student to review their years, then record subjects/courses, assessments and marks with a maximum score, or a grade/GPA for systems that do not use numeric marks. Log payments independently using terms, quarters, semesters, or installments to suit the institution. Use the copy icon on a year record to open a prefilled form and save a separate record; the copy includes its subjects, assessments, and payment entries with fresh identifiers, so changes to either record do not change the other. Legacy “Fee paid” values remain separate from the itemized payment ledger, but both are included when calculating the remaining annual fee. Do not enter a ledger payment again if it is already included in the legacy “Fee paid” amount. Search and filter records by student, institution, year, level, and status. These records are readable to anyone with access to the Daybook password and Supabase service role; avoid entering student ID numbers or sensitive health information.

Use **Vehicles** to maintain vehicle details, log travel dates, routes, odometer readings, purposes and costs, and record services or repairs with providers, costs and next-due dates or odometer readings. These records are part of the shared JSON backup and sync across devices.

Use **Personal documents** to organize identity records, insurance policies, licenses, certificates and other important information. Entries can include holder, document or policy number, issuer, issue and renewal/expiry dates, a shared link, notes, custom fields and a configurable due-date reminder. Expired and due-soon records appear on the dashboard and in this screen while the app is open. These are in-app reminders, not push or email notifications. No scans are uploaded. Only use links that have appropriate sharing permissions. The details are stored as readable text in Supabase; anyone with access to the Daybook password or Supabase service role can access them. Restrict Supabase credentials accordingly.

Use **Account credentials** for account/provider names, HTTPS sign-in links, usernames, passwords, recovery information, tags, notes and searchable custom fields. Before saving, the browser encrypts the vault with AES-256-GCM using a separate passphrase-derived key (PBKDF2-SHA-256); only encrypted data is stored in Supabase. Use a unique vault passphrase on each device. It is not the Daybook access password and is never sent as part of the save request. If forgotten, the vault cannot be recovered. Lock the vault when finished. This protects stored data, not a compromised browser, device or deployed app; while unlocked, the app handles decrypted values in browser memory. This is not a substitute for a dedicated password manager; do not store bank PINs, one-time codes or recovery codes. The fictional example in the add form is not saved unless you submit it.

The development server includes a matching `/api/stock-price` middleware, so **Stocks** refresh also works with `npm run dev`. Deployments use the Vercel function in `api/stock-price.ts`.

## Supabase and Gmail setup

1. In your Supabase project, open **SQL Editor**, run `supabase/migrations/20261105010000_normalize_daybook_storage.sql`, and confirm the collection tables and `public.load_daybook_data` / `public.save_daybook_data` functions are created. If you already ran the earlier single-table migration, this migration keeps and converts its shared row.
2. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel Environment Variables. Use the project URL and a server-only service role key. Never use a `VITE_` prefix for the service role key or commit it. Also set `DATA_ACCESS_PASSWORD` to a strong passphrase of at least 16 characters, then redeploy.
3. For local API development, copy `.env.example` to `.env.local` and set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `DATA_ACCESS_PASSWORD`, then run `npm run dev`. `.env.local` is ignored by Git.
4. Open the app and sign in. If the database is not initialized, choose **Use Git seed data**; then use **Data management → Restore a backup** to import `data/daybook.shared.json` downloaded privately from the old repository. The import is what loads those records into their corresponding tables. A local-only SQL script containing the old backup is generated at `supabase/manual-import-daybook.sql`; it is excluded from Git because it contains personal information. The old shared data file and browser secrets are intentionally not copied into this repository.
5. Gmail is separate and optional. In Google Cloud Console, enable the **Gmail API**, configure OAuth consent, and create a Web application OAuth client. Add your local and deployed origins, set `VITE_GOOGLE_CLIENT_ID` in `.env.local` and Vercel Environment Variables, and redeploy.
6. To test email, select **R&D / Test Connectors**, click **Connect Gmail**, and follow the authorization prompt. The email is sent from the Google account you authorize.

For a local-only UI/data preview while diagnosing sign-in, set `LOCAL_AUTH_BYPASS=true` in `.env.local` and run `npm run dev`. This skips the password only for requests addressed to `localhost`, `127.0.0.1`, or `::1`, and only outside production. It still requires the local Supabase server credentials to load cloud data. Never enable this in Vercel or expose the development server to your network. Remove the setting or set it to `false` after testing.

Gmail API sending is a test-email connector, not a scheduled reminder system.
