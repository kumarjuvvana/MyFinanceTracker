export interface DatabaseTable {
  name: string;
  column_count: number;
  estimated_rows: string;
}

export interface DatabaseRoutine {
  id: string;
  name: string;
  arguments: string;
  kind: string;
  definition: string;
}

export interface DatabaseTrigger {
  name: string;
  table_name: string;
  definition: string;
}

export interface DatabaseCatalog {
  tables: DatabaseTable[];
  routines: DatabaseRoutine[];
  triggers: DatabaseTrigger[];
}

export interface DatabaseColumn {
  column_name: string;
  data_type: string;
  is_nullable: "YES" | "NO";
}

export interface DatabaseRows {
  table: string;
  columns: DatabaseColumn[];
  primaryKey: string[];
  rows: Record<string, unknown>[];
  hasMore: boolean;
  offset: number;
}

export interface SqlReview {
  command: "select" | "insert" | "update" | "delete";
  tables: string[];
  requiresConfirmation: boolean;
  confirmationPhrase: string;
  statementHash: string;
}

export interface SqlExecutionResult {
  command: SqlReview["command"];
  rowCount: number;
  fields: string[];
  rows: Record<string, unknown>[];
}

export interface DatabaseConnectionTestResult {
  connected: true;
  database: string;
}

async function request(path: string, body?: Record<string, unknown>): Promise<Response> {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) {
    let message = `Database request failed (${response.status}).`;
    try {
      const body: unknown = await response.json();
      if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
        message = body.error;
      }
    } catch {
      // Keep the HTTP status when the server does not return JSON.
    }
    throw new Error(message);
  }
  return response;
}

export async function loadDatabaseCatalog(): Promise<DatabaseCatalog> {
  return await (await request("/api/database")).json() as DatabaseCatalog;
}

export function loadDatabaseRows(table: string, offset: number): Promise<DatabaseRows> {
  const query = new URLSearchParams({ table, offset: String(offset), limit: "50" });
  return request(`/api/database?${query.toString()}`).then((response) => response.json() as Promise<DatabaseRows>);
}

export async function reviewDatabaseSql(sql: string): Promise<SqlReview> {
  return await (await request("/api/database", { action: "review-sql", sql })).json() as SqlReview;
}

export async function executeDatabaseSql(sql: string, confirmation: string, statementHash: string): Promise<SqlExecutionResult> {
  return await (await request("/api/database", { action: "execute-sql", sql, confirmation, statementHash })).json() as SqlExecutionResult;
}

export async function testSupabaseConnection(connectionString: string, caCertificate?: string): Promise<DatabaseConnectionTestResult> {
  const payload: unknown = await (await request("/api/database", {
    action: "test-connection",
    connectionString,
    ...(caCertificate ? { caCertificate } : {}),
  })).json();
  if (typeof payload !== "object" || payload === null || !("connected" in payload) ||
    payload.connected !== true || !("database" in payload) || typeof payload.database !== "string") {
    throw new Error("The server returned an invalid Supabase connection test result.");
  }
  return { connected: true, database: payload.database };
}
