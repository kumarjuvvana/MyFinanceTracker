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

async function request(path: string): Promise<Response> {
  const response = await fetch(path, {
    headers: { Accept: "application/json" },
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
