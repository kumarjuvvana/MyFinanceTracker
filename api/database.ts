import pg from "pg";
import { isAuthenticated } from "../src/lib/dataAuth.js";

const { Pool } = pg;
const PROTECTED_TABLES = new Set(["daybook_data", "daybook_state", "credential_vault"]);
const IDENTIFIER_PATTERN = /^[a-z_][a-z0-9_]*$/i;
const MAX_PAGE_SIZE = 50;

interface ApiRequest {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
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

async function publicTableExists(client: pg.PoolClient, table: string): Promise<boolean> {
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
         and c.relname <> all (array['daybook_data', 'daybook_state', 'credential_vault'])
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

async function databaseHandler(request: ApiRequest, response: ApiResponse) {
  if (!isAuthenticated(request)) {
    respond(response, 401, { error: "Your Daybook session expired. Enter the access password again." });
    return;
  }
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    respond(response, 405, { error: "The Database manager is read-only and accepts GET requests only." });
    return;
  }
  let client: pg.PoolClient | undefined;
  try {
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
    const code = typeof caught === "object" && caught !== null && "code" in caught && typeof caught.code === "string"
      ? caught.code : undefined;
    console.error("Database manager request failed:", code ?? "unknown database error");
    const configError = caught instanceof Error &&
      (caught.message.startsWith("Set SUPABASE_DB_URL") || caught.message.startsWith("SUPABASE_DB_URL must"));
    respond(response, configError ? 503 : code === "23503" ? 409 : 500, {
      error: configError ? caught.message : "The database request failed. Check the server logs and database connection settings.",
    });
  } finally {
    client?.release();
  }
}

export default databaseHandler;
