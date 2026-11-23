import pg from "pg";
import { isAuthenticated, isSameOrigin } from "../src/lib/dataAuth.js";

const { Client } = pg;

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

function respond(response: ApiResponse, status: number, body: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Referrer-Policy", "no-referrer");
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

function failureMessage(error: unknown): string {
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
          : "The connection could not be completed. Check the Supabase connection details.";
  console.error("Supabase connection test failed:", safeCode);
  return `${hint} (code: ${safeCode})`;
}

export default async function databaseConnectionTestHandler(request: ApiRequest, response: ApiResponse) {
  if (!isAuthenticated(request)) {
    respond(response, 401, { error: "Your Daybook session expired. Enter the access password again." });
    return;
  }
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    respond(response, 405, { error: "Only POST requests are supported." });
    return;
  }
  if (!isSameOrigin(request)) {
    respond(response, 403, { error: "This request must come from the Daybook site." });
    return;
  }

  const body = requestBody(request);
  const connectionString = typeof body === "object" && body !== null && "connectionString" in body
    ? parseSupabaseConnectionString(body.connectionString)
    : null;
  if (!connectionString) {
    respond(response, 400, {
      error: "Enter a valid Supabase PostgreSQL connection URI using a Supabase direct or pooler host.",
    });
    return;
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: true },
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
    respond(response, 503, { error: failureMessage(caught) });
  }
}
