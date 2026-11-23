import { createHash } from "node:crypto";
import pg from "pg";
import { isAuthenticated, isSameOrigin } from "../src/lib/dataAuth.js";
import { loadUnlockedDatabaseConnectionProfile } from "../server/databaseConnections.js";
import { inspectSqlStatement, sqlConfirmationPhrase } from "./databaseSql.js";

const { Client, Pool } = pg;
const PROTECTED_TABLES = new Set(["daybook_data", "daybook_state", "credential_vault", "database_connection_vault"]);
const IDENTIFIER_PATTERN = /^[a-z_][a-z0-9_]*$/i;
const MAX_PAGE_SIZE = 50;

interface ApiRequest {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface ApiResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

let pool: pg.Pool | undefined;

function respond(response: ApiResponse, status: number, body: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

function requestBody(request: ApiRequest): unknown {
  if (typeof request.body !== "string") return request.body;
  try {
    return JSON.parse(request.body) as unknown;
  } catch {
    return null;
  }
}

function parseSupabaseConnectionString(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2000) return null;
  try {
    const url = new URL(value);
    const isSupabaseHost =
      /^db\.[a-z0-9-]+\.supabase\.co$/i.test(url.hostname) ||
      /^[a-z0-9-]+\.pooler\.supabase\.com$/i.test(url.hostname);
    if ((url.protocol !== "postgres:" && url.protocol !== "postgresql:") ||
      !isSupabaseHost || !["5432", "6543"].includes(url.port) ||
      !url.username || !url.password || !/^\/[^/]+$/.test(url.pathname) || url.hash) return null;

    if (url.search) {
      const options = new URLSearchParams(url.search);
      if ([...options.keys()].some((key) => key !== "sslmode") ||
        (options.has("sslmode") && !["require", "verify-full"].includes(options.get("sslmode") ?? ""))) return null;
      url.search = "";
    }
    return url.toString();
  } catch {
    return null;
  }
}

function parseSupabaseCaCertificate(value: unknown): string | null | undefined {
  if (value === undefined || (typeof value === "string" && !value.trim())) return undefined;
  if (typeof value !== "string" || value.length > 20000) return null;
  const certificate = value.trim();
  return certificate.startsWith("-----BEGIN CERTIFICATE-----") &&
    certificate.endsWith("-----END CERTIFICATE-----")
    ? certificate
    : null;
}

function connectionTestFailureMessage(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : "unknown";
  const safeCode = /^[A-Z0-9_]+$/.test(code) ? code : "unknown";
  const hint = safeCode === "28P01" || safeCode === "28000"
    ? "Supabase rejected the username or password."
    : safeCode === "3D000"
      ? "The database name was not found."
      : safeCode === "ENOTFOUND"
        ? "The Supabase database host could not be resolved."
        : safeCode === "ETIMEDOUT" || safeCode === "ECONNREFUSED"
          ? "Could not reach the Supabase database endpoint."
          : safeCode === "SELF_SIGNED_CERT_IN_CHAIN" || safeCode === "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
            ? "The database certificate is not trusted. Add the CA certificate downloaded from this Supabase project's SSL settings and try again."
          : "The connection could not be completed. Check the Supabase connection details.";
  console.error("Supabase connection test failed:", safeCode);
  return `${hint} (code: ${safeCode})`;
}

async function testSupabaseConnection(connectionString: string, caCertificate: string | undefined, response: ApiResponse) {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: true, ...(caCertificate ? { ca: caCertificate } : {}) },
    connectionTimeoutMillis: 10000,
    query_timeout: 10000,
  });
  try {
    await client.connect();
    const result = await client.query<{ database_name: string }>("select current_database() as database_name");
    await client.end();
    respond(response, 200, { connected: true, database: result.rows[0]?.database_name ?? "" });
  } catch (caught) {
    try {
      await client.end();
    } catch (closeError) {
      const code = typeof closeError === "object" && closeError !== null && "code" in closeError &&
        typeof closeError.code === "string" ? closeError.code : "unknown";
      console.error("Supabase connection test cleanup failed:", /^[A-Z0-9_]+$/.test(code) ? code : "unknown");
    }
    respond(response, 503, { error: connectionTestFailureMessage(caught) });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function quoteIdentifier(value: string): string {
  if (!IDENTIFIER_PATTERN.test(value)) throw new Error("Invalid database identifier.");
  return `"${value}"`;
}

function projectRefFromSupabaseUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const match = url.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return match?.[1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

function projectRefFromDatabaseUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const directMatch = url.hostname.match(/^db\.([a-z0-9-]+)\.supabase\.co$/i);
    if (directMatch) return directMatch[1].toLowerCase();
    if (/^[a-z0-9-]+\.pooler\.supabase\.com$/i.test(url.hostname)) {
      return decodeURIComponent(url.username).match(/^[^.]+\.([a-z0-9-]+)$/i)?.[1]?.toLowerCase() ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

export function getPool(): pg.Pool {
  const databaseUrl = process.env.SUPABASE_DB_URL;
  const projectUrl = process.env.SUPABASE_URL;
  if (!databaseUrl || !projectUrl) {
    throw new Error("Set SUPABASE_DB_URL and SUPABASE_URL in the server environment to enable database inspection.");
  }
  const configuredRef = projectRefFromSupabaseUrl(projectUrl);
  const databaseRef = projectRefFromDatabaseUrl(databaseUrl);
  if (!configuredRef || configuredRef !== databaseRef) {
    throw new Error("SUPABASE_DB_URL must point to the same Supabase project as SUPABASE_URL.");
  }
  if (!pool) {
    const caCertificate = process.env.SUPABASE_DB_CA_CERT_BASE64
      ? Buffer.from(process.env.SUPABASE_DB_CA_CERT_BASE64, "base64").toString("utf8")
      : undefined;
    if (caCertificate && (!caCertificate.includes("-----BEGIN CERTIFICATE-----") ||
      !caCertificate.includes("-----END CERTIFICATE-----"))) {
      throw new Error("SUPABASE_DB_CA_CERT_BASE64 must contain a base64-encoded PEM certificate.");
    }
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: true, ...(caCertificate ? { ca: caCertificate } : {}) },
      max: 2,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 10000,
      statement_timeout: 15000,
    });
  }
  return pool;
}

async function publicTableExists(client: pg.PoolClient | pg.Client, table: string): Promise<boolean> {
  if (!IDENTIFIER_PATTERN.test(table)) return false;
  const result = await client.query(
    "select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = $1 and c.relkind in ('r', 'p')",
    [table],
  );
  return result.rowCount === 1;
}

async function getPrimaryKey(client: pg.PoolClient, table: string): Promise<string[]> {
  const result = await client.query(
    `select a.attname as name
     from pg_catalog.pg_constraint con
     cross join lateral unnest(con.conkey) with ordinality as key_column(attnum, position)
     join pg_catalog.pg_attribute a on a.attrelid = con.conrelid and a.attnum = key_column.attnum
     where con.contype = 'p'
       and con.conrelid = (select c.oid from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = $1)
     order by key_column.position`,
    [table],
  );
  return result.rows.map((row: { name: string }) => row.name);
}

async function loadCatalog(client: pg.PoolClient) {
  const [tables, routines, triggers] = await Promise.all([
    client.query(
      `select c.relname as name,
              (select count(*)::integer from pg_catalog.pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped) as column_count,
              coalesce(s.n_live_tup, 0)::bigint as estimated_rows
       from pg_catalog.pg_class c
       join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       left join pg_catalog.pg_stat_user_tables s on s.relid = c.oid
       where n.nspname = 'public' and c.relkind in ('r', 'p')
         and c.relname <> all (array['daybook_data', 'daybook_state', 'credential_vault', 'database_connection_vault'])
       order by c.relname`,
    ),
    client.query(
      `select p.oid::text as id,
              p.proname as name,
              pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments,
              case p.prokind when 'p' then 'procedure' when 'a' then 'aggregate' else 'function' end as kind,
              pg_catalog.pg_get_functiondef(p.oid) as definition
       from pg_catalog.pg_proc p
       join pg_catalog.pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prokind in ('f', 'p')
       order by p.proname`,
    ),
    client.query(
      `select t.tgname as name, c.relname as table_name,
              pg_catalog.pg_get_triggerdef(t.oid, true) as definition
       from pg_catalog.pg_trigger t
       join pg_catalog.pg_class c on c.oid = t.tgrelid
       join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and not t.tgisinternal
       order by c.relname, t.tgname`,
    ),
  ]);
  return {
    tables: tables.rows,
    routines: routines.rows,
    triggers: triggers.rows,
  };
}

function validateTableName(value: string | null): value is string {
  return typeof value === "string" && IDENTIFIER_PATTERN.test(value) && !PROTECTED_TABLES.has(value);
}

async function validateSqlTables(client: pg.PoolClient | pg.Client, tables: string[]) {
  for (const table of tables) {
    if (!validateTableName(table)) throw new Error("SQL may target eligible public tables only.");
    if (!(await publicTableExists(client, table))) throw new Error(`Public table "${table}" does not exist.`);
  }
}

async function getSavedProfileClient(profileId: string, passphrase: string): Promise<pg.Client> {
  const profile = await loadUnlockedDatabaseConnectionProfile(profileId, passphrase);
  const connectionString = parseSupabaseConnectionString(profile.connectionString);
  const caCertificate = parseSupabaseCaCertificate(profile.caCertificate);
  if (!connectionString || caCertificate === null) {
    throw new Error("The saved database connection profile is invalid.");
  }
  const profileClient = new Client({
    connectionString,
    ssl: { rejectUnauthorized: true, ...(caCertificate ? { ca: caCertificate } : {}) },
    connectionTimeoutMillis: 10000,
    query_timeout: 10000,
    statement_timeout: 15000,
  });
  await profileClient.connect();
  return profileClient;
}

async function readSavedProfileDatabase(
  body: Record<string, unknown>,
  response: ApiResponse,
) {
  if (typeof body.profileId !== "string" || body.profileId.length > 100 ||
    typeof body.passphrase !== "string" || body.passphrase.length > 256) {
    respond(response, 400, { error: "Select a saved profile and unlock the connection vault first." });
    return;
  }

  const profileClient = await getSavedProfileClient(body.profileId, body.passphrase);
  let transactionOpen = false;
  try {
    await profileClient.query("begin read only");
    transactionOpen = true;
    if (body.action === "profile-catalog") {
      const [tables, routines, triggers] = await Promise.all([
        profileClient.query(
        `select c.relname as name,
                (select count(*)::integer from pg_catalog.pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped) as column_count,
                coalesce(s.n_live_tup, 0)::bigint as estimated_rows
         from pg_catalog.pg_class c
         join pg_catalog.pg_namespace n on n.oid = c.relnamespace
         left join pg_catalog.pg_stat_user_tables s on s.relid = c.oid
         where n.nspname = 'public' and c.relkind in ('r', 'p')
           and c.relname <> all (array['daybook_data', 'daybook_state', 'credential_vault', 'database_connection_vault'])
         order by c.relname`,
        ),
        profileClient.query(
          `select p.oid::text as id,
                  p.proname as name,
                  pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments,
                  case p.prokind when 'p' then 'procedure' when 'a' then 'aggregate' else 'function' end as kind,
                  pg_catalog.pg_get_functiondef(p.oid) as definition
           from pg_catalog.pg_proc p
           join pg_catalog.pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prokind in ('f', 'p')
           order by p.proname`,
        ),
        profileClient.query(
          `select t.tgname as name, c.relname as table_name,
                  pg_catalog.pg_get_triggerdef(t.oid, true) as definition
           from pg_catalog.pg_trigger t
           join pg_catalog.pg_class c on c.oid = t.tgrelid
           join pg_catalog.pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and not t.tgisinternal
           order by c.relname, t.tgname`,
        ),
      ]);
      await profileClient.query("commit");
      transactionOpen = false;
      respond(response, 200, {
        tables: tables.rows,
        routines: routines.rows,
        triggers: triggers.rows,
      });
      return;
    }

    if (typeof body.table !== "string" || !validateTableName(body.table)) {
      respond(response, 400, { error: "Choose a valid public table." });
      return;
    }
    const table = body.table;
    const exists = await profileClient.query(
      "select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = $1 and c.relkind in ('r', 'p')",
      [table],
    );
    if (exists.rowCount !== 1) {
      respond(response, 404, { error: "That public table does not exist." });
      return;
    }

    const requestedOffset = typeof body.offset === "number" ? body.offset : 0;
    const offset = Number.isInteger(requestedOffset) ? Math.min(1000000, Math.max(0, requestedOffset)) : 0;
    const primaryKeyResult = await profileClient.query(
      `select a.attname as name
       from pg_catalog.pg_constraint con
       cross join lateral unnest(con.conkey) with ordinality as key_column(attnum, position)
       join pg_catalog.pg_attribute a on a.attrelid = con.conrelid and a.attnum = key_column.attnum
       where con.contype = 'p'
         and con.conrelid = (select c.oid from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = $1)
       order by key_column.position`,
      [table],
    );
    const primaryKey = primaryKeyResult.rows.map((row: { name: string }) => row.name);
    const columns = await profileClient.query(
      "select column_name, data_type, is_nullable from information_schema.columns where table_schema = 'public' and table_name = $1 order by ordinal_position",
      [table],
    );
    const orderBy = primaryKey.length ? ` order by ${primaryKey.map(quoteIdentifier).join(", ")}` : "";
    const result = await profileClient.query(
      `select * from public.${quoteIdentifier(table)}${orderBy} limit $1 offset $2`,
      [MAX_PAGE_SIZE + 1, offset],
    );
    await profileClient.query("commit");
    transactionOpen = false;
    respond(response, 200, {
      table,
      columns: columns.rows,
      primaryKey,
      rows: result.rows.slice(0, MAX_PAGE_SIZE),
      hasMore: result.rows.length > MAX_PAGE_SIZE,
      offset,
    });
  } finally {
    if (transactionOpen) {
      try {
        await profileClient.query("rollback");
      } catch {
        console.error("Saved-profile read-only transaction rollback failed.");
      }
    }
    try {
      await profileClient.end();
    } catch (caught) {
      const code = typeof caught === "object" && caught !== null && "code" in caught && typeof caught.code === "string"
        ? caught.code : "unknown";
      console.error("Saved-profile database connection cleanup failed:", /^[A-Z0-9_]+$/.test(code) ? code : "unknown");
    }
  }
}

async function runSavedProfileSql(body: Record<string, unknown>, response: ApiResponse) {
  if (typeof body.profileId !== "string" || body.profileId.length > 100 ||
    typeof body.passphrase !== "string" || body.passphrase.length > 256 ||
    typeof body.sql !== "string") {
    respond(response, 400, { error: "Select a saved profile, unlock the connection vault, and enter SQL." });
    return;
  }
  const action = body.action;
  if (action !== "profile-review-sql" && action !== "profile-execute-sql") {
    respond(response, 400, { error: "Choose a supported saved-profile SQL action." });
    return;
  }

  const sql = body.sql;
  const statementHash = createHash("sha256").update(sql).digest("hex");
  const inspection = inspectSqlStatement(sql);
  const profileClient = await getSavedProfileClient(body.profileId, body.passphrase);
  let transactionOpen = false;
  try {
    await validateSqlTables(profileClient, inspection.tables);
    if (action === "profile-review-sql") {
      respond(response, 200, {
        command: inspection.command,
        tables: inspection.tables,
        requiresConfirmation: inspection.requiresConfirmation,
        confirmationPhrase: inspection.requiresConfirmation ? sqlConfirmationPhrase(inspection.command) : "",
        statementHash,
      });
      return;
    }
    if (body.statementHash !== statementHash) {
      respond(response, 409, { error: "This SQL differs from the reviewed statement. Review it again before execution." });
      return;
    }
    if (inspection.requiresConfirmation && body.confirmation !== sqlConfirmationPhrase(inspection.command)) {
      respond(response, 400, { error: `Type "${sqlConfirmationPhrase(inspection.command)}" to confirm this database change.` });
      return;
    }
    await profileClient.query(inspection.requiresConfirmation ? "begin" : "begin read only");
    transactionOpen = true;
    const result = await profileClient.query(sql);
    await profileClient.query("commit");
    transactionOpen = false;
    respond(response, 200, {
      command: inspection.command,
      rowCount: result.rowCount ?? result.rows.length,
      fields: result.fields.map((field) => field.name),
      rows: result.rows.slice(0, 100),
    });
  } finally {
    if (transactionOpen) {
      try {
        await profileClient.query("rollback");
      } catch {
        console.error("Saved-profile SQL transaction rollback failed.");
      }
    }
    try {
      await profileClient.end();
    } catch (caught) {
      const code = typeof caught === "object" && caught !== null && "code" in caught && typeof caught.code === "string"
        ? caught.code : "unknown";
      console.error("Saved-profile SQL connection cleanup failed:", /^[A-Z0-9_]+$/.test(code) ? code : "unknown");
    }
  }
}

async function databaseHandler(request: ApiRequest, response: ApiResponse) {
  if (!isAuthenticated(request)) {
    respond(response, 401, { error: "Your Daybook session expired. Enter the access password again." });
    return;
  }
  if (request.method !== "GET" && request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    respond(response, 405, { error: "Only GET and POST requests are supported." });
    return;
  }
  if (request.method === "POST" && !isSameOrigin(request)) {
    respond(response, 403, { error: "This request must come from the Daybook site." });
    return;
  }
  let client: pg.PoolClient | undefined;
  let transactionOpen = false;
  try {
    if (request.method === "POST") {
      const body = requestBody(request);
      if (!isRecord(body) ||
        (body.action !== "review-sql" && body.action !== "execute-sql" && body.action !== "test-connection" &&
          body.action !== "profile-catalog" && body.action !== "profile-rows" &&
          body.action !== "profile-review-sql" && body.action !== "profile-execute-sql")) {
        respond(response, 400, { error: "Choose a supported database action." });
        return;
      }
      if (body.action === "profile-catalog" || body.action === "profile-rows") {
        await readSavedProfileDatabase(body, response);
        return;
      }
      if (body.action === "profile-review-sql" || body.action === "profile-execute-sql") {
        await runSavedProfileSql(body, response);
        return;
      }
      if (body.action === "test-connection") {
        const connectionString = parseSupabaseConnectionString(body.connectionString);
        const caCertificate = parseSupabaseCaCertificate(body.caCertificate);
        if (!connectionString) {
          respond(response, 400, {
            error: "Enter a valid Supabase PostgreSQL connection URI using a Supabase direct or pooler host.",
          });
          return;
        }
        if (caCertificate === null) {
          respond(response, 400, { error: "The optional CA certificate must be a PEM certificate." });
          return;
        }
        await testSupabaseConnection(connectionString, caCertificate, response);
        return;
      }
      if (typeof body.sql !== "string") {
        respond(response, 400, { error: "SQL must be provided as text." });
        return;
      }
      const sql = body.sql;
      const statementHash = createHash("sha256").update(sql).digest("hex");
      const inspection = inspectSqlStatement(sql);
      client = await getPool().connect();
      await validateSqlTables(client, inspection.tables);
      if (body.action === "review-sql") {
        respond(response, 200, {
          command: inspection.command,
          tables: inspection.tables,
          requiresConfirmation: inspection.requiresConfirmation,
          confirmationPhrase: inspection.requiresConfirmation ? sqlConfirmationPhrase(inspection.command) : "",
          statementHash,
        });
        return;
      }
      if (body.statementHash !== statementHash) {
        respond(response, 409, { error: "This SQL differs from the reviewed statement. Review it again before execution." });
        return;
      }
      if (inspection.requiresConfirmation && body.confirmation !== sqlConfirmationPhrase(inspection.command)) {
        respond(response, 400, { error: `Type "${sqlConfirmationPhrase(inspection.command)}" to confirm this database change.` });
        return;
      }
      if (inspection.requiresConfirmation) {
        await client.query("begin");
        transactionOpen = true;
      } else {
        await client.query("begin read only");
        transactionOpen = true;
      }
      const result = await client.query(sql);
      await client.query("commit");
      transactionOpen = false;
      respond(response, 200, {
        command: inspection.command,
        rowCount: result.rowCount ?? result.rows.length,
        fields: result.fields.map((field) => field.name),
        rows: result.rows.slice(0, 100),
      });
      return;
    }

    const requestUrl = new URL(request.url ?? "/", `https://${request.headers.host ?? "localhost"}`);
    const table = requestUrl.searchParams.get("table");
    const requestedOffset = Number(requestUrl.searchParams.get("offset") ?? 0);
    const requestedLimit = Number(requestUrl.searchParams.get("limit") ?? MAX_PAGE_SIZE);
    client = await getPool().connect();
    if (table === null) {
      const result = await loadCatalog(client);
      respond(response, 200, result);
      return;
    }
    if (!validateTableName(table)) {
      respond(response, 400, { error: "Choose an eligible public table." });
      return;
    }
    if (!(await publicTableExists(client, table))) {
      respond(response, 404, { error: "That public table does not exist." });
      return;
    }
    const primaryKey = await getPrimaryKey(client, table);
    const limit = Number.isInteger(requestedLimit) ? Math.max(1, Math.min(MAX_PAGE_SIZE, requestedLimit)) : MAX_PAGE_SIZE;
    const offset = Number.isInteger(requestedOffset) ? Math.min(1000000, Math.max(0, requestedOffset)) : 0;
    const columns = await client.query(
      "select column_name, data_type, is_nullable from information_schema.columns where table_schema = 'public' and table_name = $1 order by ordinal_position",
      [table],
    );
    const orderBy = primaryKey.length ? ` order by ${primaryKey.map(quoteIdentifier).join(", ")}` : "";
    const result = await client.query(
      `select * from public.${quoteIdentifier(table)}${orderBy} limit $1 offset $2`,
      [limit + 1, offset],
    );
    respond(response, 200, {
      table,
      columns: columns.rows,
      primaryKey,
      rows: result.rows.slice(0, limit),
      hasMore: result.rows.length > limit,
      offset,
    });
  } catch (caught) {
    if (client && transactionOpen) {
      try {
        await client.query("rollback");
      } catch (rollbackError) {
        const rollbackCode = typeof rollbackError === "object" && rollbackError !== null && "code" in rollbackError
          ? rollbackError.code : "unknown";
        console.error("Database manager SQL rollback failed:", rollbackCode);
      }
    }
    const configError = caught instanceof Error &&
      (caught.message.startsWith("Set SUPABASE_DB_URL") || caught.message.startsWith("SUPABASE_DB_URL must"));
    if (caught instanceof Error && !("code" in caught) && !configError) {
      respond(response, 400, { error: caught.message });
      return;
    }
    const code = typeof caught === "object" && caught !== null && "code" in caught && typeof caught.code === "string"
      ? caught.code : undefined;
    console.error("Database manager request failed:", code ?? "unknown database error");
    respond(response, configError ? 503 : 500, {
      error: configError ? caught.message : "The database request failed. Check the server logs and database connection settings.",
    });
  } finally {
    client?.release();
  }
}

export default databaseHandler;
