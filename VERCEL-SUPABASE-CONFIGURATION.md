# Vercel and Supabase Configuration

This note records the MyFinanceTracker deployment settings and how to recreate them. Secret values are intentionally omitted; do not put passwords, API keys, or full database connection strings in this file.

## Project references

- **GitHub repository:** `kumarjuvvana/MyFinanceTracker`
- **Vercel project:** `myfinance-tracker`
- **Supabase project reference:** `ijgxodotgscoldjevpwp`
- **Supabase project URL:** `https://ijgxodotgscoldjevpwp.supabase.co`
- **Vercel production URL:** `https://myfinance-tracker-lac.vercel.app`

The browser does not connect directly to PostgreSQL. Vercel API routes use server-side environment variables to connect to Supabase.

## Vercel build settings

In the Vercel project, use:

- **Framework preset:** Vite
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Production branch:** `main`

Pushing a commit to `main` triggers a Vercel deployment. Environment-variable changes apply to new deployments, so redeploy after changing variables. Select **Production** for the live site; also select **Preview** if preview deployments need the same feature.

## Environment variables

Configure these under **Vercel → Project → Settings → Environment Variables**. Use the exact names shown.

| Variable | Required | Value / purpose | Handling |
|---|---:|---|---|
| `SUPABASE_URL` | Yes | `https://ijgxodotgscoldjevpwp.supabase.co` | Server-side. Leave the existing value unchanged when configuring PostgreSQL access. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | The service-role secret key for this same Supabase project. | Secret; server-only. Never prefix with `VITE_`, expose to the browser, or commit it. |
| `DATA_ACCESS_PASSWORD` | Yes | The shared Daybook sign-in passphrase. Use a strong, private value at least 16 characters long. | Secret. It is the app login password, not the PostgreSQL password. |
| `SUPABASE_DB_URL` | Optional | Supabase **Transaction pooler** PostgreSQL URI for the same project. | Secret; server-only. Used by Database manager and Hosting & storage. |
| `SUPABASE_DB_CA_CERT_BASE64` | Optional | Base64-encoded contents of the Supabase database CA certificate file. | Server-only. Used to verify the PostgreSQL server certificate while TLS verification remains enabled. |
| `VITE_GOOGLE_CLIENT_ID` | Optional | Google OAuth web client ID for the Gmail test connector. | Browser-visible client ID; not a client secret. |
| `TWELVE_DATA_API_KEY` | Optional | Twelve Data API key for stock-price requests. | Secret; server-only. |

Do not configure the following local-development variables in Vercel:

| Variable | Purpose |
|---|---|
| `SUPABASE_DEV_DB_URL` | Direct PostgreSQL URI for a separate Supabase development project. |
| `SUPABASE_DEV_PROJECT_REF` | Reference used by local database scripts to ensure they target that development project. |
| `LOCAL_AUTH_BYPASS` | Local-only troubleshooting switch. Keep it `false` or unset in Vercel; never enable it in production. |

For local development, copy `.env.example` to `.env.local` and use the local values there. `.env.local` is ignored by Git. Never reuse production database credentials as development credentials unless you intentionally choose to target production.

## PostgreSQL connection and CA certificate

1. In Supabase, open project `ijgxodotgscoldjevpwp`, choose **Connect**, then choose **Transaction pooler**. This mode is intended for short-lived serverless connections.
2. Copy the full URI provided by Supabase. Its host, port, and username must be copied exactly; the pooler username includes the project reference. The current project’s pooler details shown during setup were:
   - Host: `aws-0-eu-west-1.pooler.supabase.com`
   - Port: `6543`
   - Username: `postgres.ijgxodotgscoldjevpwp`
3. Replace only the URI’s password placeholder with the existing Supabase **database password**. Do not select **Reset database password** just to configure this URI. URL-encode reserved characters in the password.
4. In Supabase, open **Database → Settings → SSL Configuration** and download the project CA certificate.
5. In PowerShell, convert the downloaded certificate to Base64 (adjust the path and filename if needed):

   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:USERPROFILE\Downloads\prod-ca-2021.crt")) | Set-Clipboard
   ```

6. In Vercel Environment Variables, set:
   - `SUPABASE_DB_URL` to the complete Transaction pooler URI.
   - `SUPABASE_DB_CA_CERT_BASE64` to the Base64 text copied to the clipboard.
7. Leave `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` unchanged. Save the variables for Production (and Preview if needed), then redeploy.
8. When the deployment reports **Ready**, test Database manager and Hosting & storage.

The CA certificate is supplied to the Node PostgreSQL client as a trusted CA. Certificate verification is not disabled. Do not use `rejectUnauthorized: false` as a workaround.

Changing the database password in Supabase is different from putting that password into a URI. If you reset the password, update every direct PostgreSQL connection string that uses it, including `SUPABASE_DB_URL` and any development or external tools. The normal Supabase API key is separate from the PostgreSQL password.

## Database schema and Storage

- Vercel deployments do **not** run Supabase migrations automatically.
- Apply only the repository migration(s) needed for the features being deployed. Back up data and review a migration before running it in the Supabase SQL Editor.
- The core normalized-storage setup is in `supabase/migrations/20261105010000_normalize_daybook_storage.sql`.
- Private document object storage is configured by `supabase/migrations/20261106130000_add_private_document_storage.sql`; the bucket is private and named `daybook-documents`.
- Other feature migrations are listed under `supabase/migrations/`. A migration existing in Git does not prove it has been applied to the live Supabase project.
- The app stores records in the Supabase database and document files in Supabase Storage. Vercel's deployment filesystem is not the persistent data store.

## Database manager write safeguards

The guarded SQL console is part of the current source changes and is available only after a Vercel deployment containing those changes reports **Ready**. It does not provide table-edit controls or execute SQL automatically when opening the screen.

- It accepts one `SELECT`, `INSERT`, `UPDATE`, or `DELETE` statement at a time.
- Table names must be qualified as `public.<table>`.
- `SELECT` requires a literal `LIMIT` from 1 to 100 and runs inside a read-only transaction.
- `INSERT` is limited to 100 `VALUES` rows.
- `UPDATE` and `DELETE` require a `WHERE` clause.
- Before a statement runs, the server parses and validates it; the screen shows the exact statement for review.
- Every write requires checking an acknowledgement and typing its command-specific phrase (`EXECUTE INSERT`, `EXECUTE UPDATE`, or `EXECUTE DELETE`).
- DDL (including `CREATE TABLE`), transaction commands, multiple statements, CTEs/subqueries, function calls, `RETURNING`, `ON CONFLICT`, and the protected Daybook core tables are blocked.
- Writes are permanent and bypass the Daybook archive. Database triggers or foreign-key cascades may change linked data. Download a JSON backup before using write statements.
- The confirmation step helps prevent accidental execution; it is not separate user authorization. Anyone with the shared Daybook password can use the screen.

## Security checklist

- Keep `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, and `DATA_ACCESS_PASSWORD` out of Git, screenshots, chat messages, and browser-prefixed variables.
- Do not add `VITE_` to server secrets. Vite-prefixed variables are exposed to browser code.
- If a secret was exposed, rotate it in its issuing service and update Vercel; redeploy afterward.
- Limit Vercel access and protect the shared Daybook password. The app uses one shared password, not separate user accounts.
- After configuration changes, check the newest deployment and newest function log entry; older log events do not show whether a new setting works.
