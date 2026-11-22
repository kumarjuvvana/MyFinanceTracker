import pg from "pg";
import { isAuthenticated, isSameOrigin } from "../src/lib/dataAuth.js";

const { Pool } = pg;
const PAGE_SIZE = 500;
const MAX_OFFSET = 50000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

interface Query {
  dataset: FinanceDataset;
  from: string | null;
  to: string | null;
  offset: number;
}

interface DatasetQuery {
  from: string;
  userId: string;
  date: string;
  select: string;
  order: string;
}

const DATASETS = {
  payments: {
    from: "public.payments p",
    userId: "p.user_id",
    date: "p.date",
    select: `p.id::text as id, p.user_id::text as "userId", p.date::text as date,
             p.amount::text as amount, p.currency, p.category, p.payee, p.trader_name as "traderName",
             p.method, p.type, p.status, p.account, p.quantity::text as quantity, p.unit`,
    order: "p.date desc, p.id",
  },
  incomes: {
    from: "public.incomes i",
    userId: "i.user_id",
    date: "i.date",
    select: `i.id::text as id, i.user_id::text as "userId", i.date::text as date,
             i.amount::text as amount, i.currency, i.category, i.payer, i.source_name as "sourceName",
             i.method, i.type, i.status, i.account`,
    order: "i.date desc, i.id",
  },
  recurring_transactions: {
    from: "public.recurring_transactions r",
    userId: "r.user_id",
    date: "r.next_due_date",
    select: `r.id::text as id, r.user_id::text as "userId", r.next_due_date::text as date,
             r.title, r.amount::text as amount, r.category, r.method, r.frequency, r.active`,
    order: "r.next_due_date desc, r.id",
  },
  budget_targets: {
    from: "public.budget_targets b",
    userId: "b.user_id",
    date: "b.month",
    select: `b.id::text as id, b.user_id::text as "userId", b.month::text as date,
             b.name, b.category, b.amount::text as amount, b.warning_pct as "warningPct",
             b.critical_pct as "criticalPct", b.active`,
    order: "b.month desc, b.id",
  },
  debt_loans: {
    from: "public.debt_loans d",
    userId: "d.user_id",
    date: "d.opening_date",
    select: `d.id::text as id, d.user_id::text as "userId", d.opening_date::text as date,
             d.name, d.lender, d.currency, d.opening_principal::text as "openingPrincipal",
             d.annual_rate::text as "annualRate", d.monthly_emi::text as "monthlyEmi", d.due_day as "dueDay"`,
    order: "d.opening_date desc, d.id",
  },
  balancer_months: {
    from: "public.balancer_months m",
    userId: "m.user_id",
    date: "m.month",
    select: `m.id::text as id, m.user_id::text as "userId", m.month::text as date, m.data::text as data`,
    order: "m.month desc, m.id",
  },
  shopping_lists: {
    from: "public.shopping_lists l",
    userId: "l.user_id",
    date: "l.planned_date",
    select: `l.id::text as id, l.user_id::text as "userId", l.planned_date::text as date,
             l.title, l.tentative_amount::text as "tentativeAmount"`,
    order: "l.planned_date desc nulls last, l.id",
  },
  shopping_items: {
    from: `public.shopping_items i
           join public.shopping_lists l on l.id = i.list_id and l.user_id = i.user_id`,
    userId: "i.user_id",
    date: "l.planned_date",
    select: `i.id::text as id, i.user_id::text as "userId", i.list_id::text as "listId",
             l.planned_date::text as date, i.name, i.quantity::text as quantity, i.unit,
             i.price::text as price, i.is_purchased as "isPurchased", i.sort_order as "sortOrder"`,
    order: "l.planned_date desc nulls last, i.sort_order, i.id",
  },
} satisfies Record<string, DatasetQuery>;

type FinanceDataset = keyof typeof DATASETS;

let pool: pg.Pool | undefined;

function header(request: ApiRequest, name: string): string {
  const value = request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function respond(response: ApiResponse, status: number, body: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

function databaseFailureHint(code: string): string {
  if (code === "28P01" || code === "28000" || code === "28001") {
    return "The source database rejected the reader login. Check the rotated password and Transaction Pooler username.";
  }
  if (code === "42501") {
    return "The reader role lacks access to a requested table or row. Check its SELECT grants and user-scoped policies.";
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return "The source database host could not be resolved. Check the pooler host in FINANCE_SOURCE_DB_URL.";
  }
  if (code === "ECONNREFUSED" || code === "ECONNRESET" || code === "ETIMEDOUT") {
    return "The source database could not be reached. Check the pooler host, port, and network availability.";
  }
  if (code.includes("TLS") || code.includes("CERT") || code.includes("SSL") || code.includes("VERIFY")) {
    return "The source database TLS certificate could not be verified. Check the pooler host and CA certificate setting.";
  }
  if (code === "42P01") {
    return "A requested table is missing from the connected source database. Check that FINANCE_SOURCE_DB_URL points to the source project.";
  }
  if (code === "42703") {
    return "A requested column is missing from the source schema. Check the source table columns against the configured reports.";
  }
  return "Could not load the external finance data. Check the source database connection and reader role.";
}

function sourceUserId(): string {
  const userId = process.env.FINANCE_SOURCE_USER_ID;
  if (!userId || !UUID_PATTERN.test(userId)) {
    throw new Error("Set FINANCE_SOURCE_USER_ID to the source project's user UUID.");
  }
  return userId;
}

function sourcePool(): pg.Pool {
  const connectionString = process.env.FINANCE_SOURCE_DB_URL;
  if (!connectionString) {
    throw new Error("Set FINANCE_SOURCE_DB_URL to the source project's read-only PostgreSQL connection.");
  }
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("FINANCE_SOURCE_DB_URL must be a valid PostgreSQL connection URI.");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("FINANCE_SOURCE_DB_URL must use the PostgreSQL protocol.");
  }
  if (!pool) {
    const caCertificate = process.env.FINANCE_SOURCE_DB_CA_CERT_BASE64
      ? Buffer.from(process.env.FINANCE_SOURCE_DB_CA_CERT_BASE64, "base64").toString("utf8")
      : undefined;
    if (caCertificate && (!caCertificate.includes("-----BEGIN CERTIFICATE-----") ||
      !caCertificate.includes("-----END CERTIFICATE-----"))) {
      throw new Error("FINANCE_SOURCE_DB_CA_CERT_BASE64 must contain a base64-encoded PEM certificate.");
    }
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: true, ...(caCertificate ? { ca: caCertificate } : {}) },
      max: 1,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 10000,
      statement_timeout: 15000,
    });
  }
  return pool;
}

function dateParameter(value: string | null): string | null {
  if (value === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Date filters must use YYYY-MM-DD.");
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error("Date filters must be valid calendar dates.");
  }
  return value;
}

function requestQuery(request: ApiRequest, host: string): Query {
  const url = new URL(request.url ?? "/api/finance-source", `https://${host || "localhost"}`);
  const dataset = url.searchParams.get("dataset") ?? "payments";
  if (!Object.prototype.hasOwnProperty.call(DATASETS, dataset)) {
    throw new Error("Choose a supported source dataset.");
  }
  const rawOffset = url.searchParams.get("offset") ?? "0";
  const rawLimit = url.searchParams.get("limit") ?? String(PAGE_SIZE);
  const offset = Number(rawOffset);
  const limit = Number(rawLimit);
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_OFFSET) {
    throw new Error(`Offset must be between 0 and ${MAX_OFFSET}.`);
  }
  if (limit !== PAGE_SIZE) throw new Error(`Page size must be ${PAGE_SIZE}.`);
  const from = dateParameter(url.searchParams.get("from"));
  const to = dateParameter(url.searchParams.get("to"));
  if (from && to && from > to) throw new Error("The start date must not be after the end date.");
  return { dataset: dataset as FinanceDataset, from, to, offset };
}

export default async function financeSourceHandler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    respond(response, 405, { error: "Only GET requests are supported." });
    return;
  }
  if (!isAuthenticated(request)) {
    respond(response, 401, { error: "Your Daybook session expired. Enter the access password again." });
    return;
  }
  if (header(request, "origin") && !isSameOrigin(request)) {
    respond(response, 403, { error: "This request must come from the Daybook site." });
    return;
  }

  let client: pg.PoolClient | undefined;
  let transactionOpen = false;
  try {
    const userId = sourceUserId();
    const query = requestQuery(request, header(request, "x-forwarded-host").split(",")[0]?.trim() || header(request, "host"));
    const dataset = DATASETS[query.dataset];
    client = await sourcePool().connect();
    await client.query("begin read only");
    transactionOpen = true;
    const filterValues = [userId, query.from, query.to];
    const where = `where ${dataset.userId} = $1::uuid
                   and ($2::date is null or ${dataset.date} >= $2::date)
                   and ($3::date is null or ${dataset.date} <= $3::date)`;
    const countResult = await client.query<{ count: string }>(
      `select count(*)::text as count from ${dataset.from} ${where}`,
      filterValues,
    );
    const total = Number(countResult.rows[0]?.count);
    if (!Number.isSafeInteger(total) || total < 0) throw new Error("The source record count was invalid.");
    const recordsResult = await client.query(
      `select ${dataset.select}
       from ${dataset.from}
       ${where}
       order by ${dataset.order}
       limit $4 offset $5`,
      [...filterValues, PAGE_SIZE, query.offset],
    );
    await client.query("commit");
    transactionOpen = false;
    respond(response, 200, {
      dataset: query.dataset,
      records: recordsResult.rows,
      total,
      hasMore: query.offset + recordsResult.rows.length < total,
    });
  } catch (caught) {
    if (client && transactionOpen) {
      try {
        await client.query("rollback");
      } catch (rollbackError) {
        const code = typeof rollbackError === "object" && rollbackError !== null && "code" in rollbackError
          ? rollbackError.code : "unknown";
        console.error("External finance source rollback failed:", code);
      }
    }
    if (caught instanceof Error &&
      (caught.message.startsWith("Set FINANCE_SOURCE_") ||
        caught.message.startsWith("FINANCE_SOURCE_DB_URL") ||
        caught.message.startsWith("FINANCE_SOURCE_DB_CA_CERT_BASE64"))) {
      respond(response, 503, { error: caught.message });
      return;
    }
    if (caught instanceof Error &&
      (caught.message.startsWith("Date filters") || caught.message.startsWith("The start date") ||
        caught.message.startsWith("Offset") || caught.message.startsWith("Page size") ||
        caught.message.startsWith("Choose a supported"))) {
      respond(response, 400, { error: caught.message });
      return;
    }
    const code = typeof caught === "object" && caught !== null && "code" in caught && typeof caught.code === "string"
      ? caught.code : "unknown";
    console.error("External finance source query failed:", code);
    const safeCode = /^[A-Z0-9_]+$/.test(code) ? code : "unknown";
    respond(response, 503, { error: `${databaseFailureHint(safeCode)} (code: ${safeCode})` });
  } finally {
    client?.release();
  }
}
