import pg from "pg";
import { isAuthenticated, isSameOrigin } from "../src/lib/dataAuth.js";

const { Pool } = pg;
const PROTECTED_TABLES = new Set(["daybook_data", "daybook_state", "credential_vault"]);
const IDENTIFIER_PATTERN = /^[a-z_][a-z0-9_]*$/i;
const MAX_PAGE_SIZE = 50;

interface ApiRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface ApiResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

interface ForeignKeyDependency {
  constraint: string;
  table: string;
  columns: string[];
  referencedColumns: string[];
  onDelete: string;
  count: number;
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
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: true },
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

async function getRowByKey(client: pg.PoolClient, table: string, keys: Record<string, unknown>) {
  const columns = Object.keys(keys);
  if (!columns.length || columns.some((column) => !IDENTIFIER_PATTERN.test(column))) return null;
  const where = columns.map((column, index) => `${quoteIdentifier(column)} = $${index + 1}`).join(" and ");
  const result = await client.query(`select * from public.${quoteIdentifier(table)} where ${where} limit 1`, columns.map((column) => keys[column]));
  return result.rows[0] ?? null;
}

async function getDependencies(
  client: pg.PoolClient,
  table: string,
  row: Record<string, unknown>,
): Promise<ForeignKeyDependency[]> {
  const constraints = await client.query(
    `select con.conname as constraint,
            child.relname as table,
            array_agg(child_column.attname order by key_column.position) as columns,
            array_agg(parent_column.attname order by key_column.position) as referenced_columns,
            con.confdeltype as delete_action
     from pg_catalog.pg_constraint con
     join pg_catalog.pg_class child on child.oid = con.conrelid
     join pg_catalog.pg_namespace child_schema on child_schema.oid = child.relnamespace
     cross join lateral unnest(con.conkey, con.confkey) with ordinality as key_column(child_attnum, parent_attnum, position)
     join pg_catalog.pg_attribute child_column on child_column.attrelid = con.conrelid and child_column.attnum = key_column.child_attnum
     join pg_catalog.pg_attribute parent_column on parent_column.attrelid = con.confrelid and parent_column.attnum = key_column.parent_attnum
     where con.contype = 'f'
       and con.confrelid = (select c.oid from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = $1)
       and child_schema.nspname = 'public'
     group by con.conname, child.relname, con.confdeltype
     order by child.relname, con.conname`,
    [table],
  );
  const dependencies: ForeignKeyDependency[] = [];
  for (const constraint of constraints.rows as Array<{
    constraint: string;
    table: string;
    columns: string[];
    referenced_columns: string[];
    delete_action: string;
  }>) {
    const values = constraint.referenced_columns.map((column) => row[column]);
    const where = constraint.columns.map((column, index) => `${quoteIdentifier(column)} = $${index + 1}`).join(" and ");
    const countResult = await client.query(
      `select count(*)::integer as count from public.${quoteIdentifier(constraint.table)} where ${where}`,
      values,
    );
    const actions: Record<string, string> = { a: "no action", r: "restrict", c: "cascade", n: "set null", d: "set default" };
    dependencies.push({
      constraint: constraint.constraint,
      table: constraint.table,
      columns: constraint.columns,
      referencedColumns: constraint.referenced_columns,
      onDelete: actions[constraint.delete_action] ?? "unknown",
      count: countResult.rows[0].count as number,
    });
  }
  return dependencies;
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

function validateTableName(value: unknown): value is string {
  return typeof value === "string" && IDENTIFIER_PATTERN.test(value) && !PROTECTED_TABLES.has(value);
}

function validateKeys(value: unknown, primaryKey: string[]): value is Record<string, unknown> {
  if (!isRecord(value) || !primaryKey.length) return false;
  const keys = Object.keys(value);
  return keys.length === primaryKey.length && primaryKey.every((column) =>
    Object.hasOwn(value, column) && value[column] !== null &&
    ["string", "number", "boolean"].includes(typeof value[column]));
}

async function databaseHandler(request: ApiRequest, response: ApiResponse) {
  if (!isAuthenticated(request)) {
    respond(response, 401, { error: "Your Daybook session expired. Enter the access password again." });
    return;
  }
  let client: pg.PoolClient | undefined;
  let transactionOpen = false;
  try {
    client = await getPool().connect();
    if (request.method === "GET") {
      const result = await loadCatalog(client);
      respond(response, 200, result);
      return;
    }
    if (request.method !== "POST") {
      response.setHeader("Allow", "GET, POST");
      respond(response, 405, { error: "Only GET and POST requests are supported." });
      return;
    }
    if (!isSameOrigin(request)) {
      respond(response, 403, { error: "This request must come from the Daybook site." });
      return;
    }
    const body = requestBody(request);
    if (!isRecord(body) || !validateTableName(body.table)) {
      respond(response, 400, { error: "Choose an eligible public table." });
      return;
    }
    if (!(await publicTableExists(client, body.table))) {
      respond(response, 404, { error: "That public table does not exist." });
      return;
    }
    const primaryKey = await getPrimaryKey(client, body.table);
    if (body.action === "rows") {
      const limit = typeof body.limit === "number" && Number.isInteger(body.limit)
        ? Math.max(1, Math.min(MAX_PAGE_SIZE, body.limit)) : MAX_PAGE_SIZE;
      const offset = typeof body.offset === "number" && Number.isInteger(body.offset)
        ? Math.min(1000000, Math.max(0, body.offset)) : 0;
      const columns = await client.query(
        "select column_name, data_type, is_nullable from information_schema.columns where table_schema = 'public' and table_name = $1 order by ordinal_position",
        [body.table],
      );
      const orderBy = primaryKey.length ? ` order by ${primaryKey.map(quoteIdentifier).join(", ")}` : "";
      const result = await client.query(
        `select * from public.${quoteIdentifier(body.table)}${orderBy} limit $1 offset $2`,
        [limit + 1, offset],
      );
      respond(response, 200, {
        table: body.table,
        columns: columns.rows,
        primaryKey,
        rows: result.rows.slice(0, limit),
        hasMore: result.rows.length > limit,
        offset,
      });
      return;
    }
    if (body.action !== "preview-delete" && body.action !== "delete") {
      respond(response, 400, { error: "Choose a supported database operation." });
      return;
    }
    const keys = body.keys;
    if (!validateKeys(keys, primaryKey)) {
      respond(response, 400, { error: "This row does not have a supported primary key." });
      return;
    }
    if (body.action === "preview-delete") {
      const row = await getRowByKey(client, body.table, keys);
      if (!row) {
        respond(response, 404, { error: "That row no longer exists. Refresh the table and try again." });
        return;
      }
      respond(response, 200, { table: body.table, row, dependencies: await getDependencies(client, body.table, row) });
      return;
    }

    await client.query("begin");
    transactionOpen = true;
    const row = await getRowByKey(client, body.table, keys);
    if (!row) {
      await client.query("rollback");
      transactionOpen = false;
      respond(response, 404, { error: "That row no longer exists. Refresh the table and try again." });
      return;
    }
    const dependencies = await getDependencies(client, body.table, row);
    const linked = dependencies.filter((dependency) => dependency.count > 0);
    const blockers = linked.filter((dependency) => !["cascade", "set null", "set default"].includes(dependency.onDelete));
    if (blockers.length) {
      await client.query("rollback");
      transactionOpen = false;
      respond(response, 409, {
        error: "This row has linked records that must be removed from their own tables first.",
        dependencies,
      });
      return;
    }
    if (linked.length && body.confirmLinkedChanges !== true) {
      await client.query("rollback");
      transactionOpen = false;
      respond(response, 409, {
        error: "Confirm the linked record changes before deleting this row.",
        dependencies,
      });
      return;
    }
    const keyColumns = Object.keys(keys);
    const where = keyColumns.map((column, index) => `${quoteIdentifier(column)} = $${index + 1}`).join(" and ");
    const deleted = await client.query(
      `delete from public.${quoteIdentifier(body.table)} where ${where} returning 1`,
      keyColumns.map((column) => keys[column]),
    );
    if (deleted.rowCount !== 1) {
      await client.query("rollback");
      transactionOpen = false;
      respond(response, 409, { error: "The row changed while you were confirming. Refresh the table and try again." });
      return;
    }
    await client.query(
      "update public.daybook_state set revision = pg_catalog.gen_random_uuid()::text, updated_at = pg_catalog.now() where id = 'shared'",
    );
    await client.query("commit");
    transactionOpen = false;
    respond(response, 200, { deleted: true, dependencies: linked });
  } catch (caught) {
    if (client && transactionOpen) {
      try {
        await client.query("rollback");
      } catch (rollbackError) {
        const rollbackCode = typeof rollbackError === "object" && rollbackError !== null && "code" in rollbackError
          ? rollbackError.code : "unknown";
        console.error("Database manager rollback failed:", rollbackCode);
      }
    }
    const code = typeof caught === "object" && caught !== null && "code" in caught && typeof caught.code === "string"
      ? caught.code : undefined;
    console.error("Database manager request failed:", code ?? "unknown database error");
    const configError = caught instanceof Error &&
      (caught.message.startsWith("Set SUPABASE_DB_URL") || caught.message.startsWith("SUPABASE_DB_URL must"));
    respond(response, configError ? 503 : code === "23503" ? 409 : 500, {
      error: code === "23503"
        ? "The database rejected the deletion because linked records still exist. Refresh the dependency preview."
        : configError ? caught.message : "The database request failed. Check the server logs and database connection settings.",
    });
  } finally {
    client?.release();
  }
}

export default databaseHandler;
