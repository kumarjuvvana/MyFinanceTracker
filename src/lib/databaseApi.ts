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

export interface ForeignKeyDependency {
  constraint: string;
  table: string;
  columns: string[];
  referencedColumns: string[];
  onDelete: string;
  count: number;
}

export interface DatabaseRows {
  table: string;
  columns: DatabaseColumn[];
  primaryKey: string[];
  rows: Record<string, unknown>[];
  hasMore: boolean;
  offset: number;
}

export interface DeletePreview {
  table: string;
  row: Record<string, unknown>;
  dependencies: ForeignKeyDependency[];
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
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

async function post<T>(body: Record<string, unknown>): Promise<T> {
  return await (await request("/api/database", { method: "POST", body: JSON.stringify(body) })).json() as T;
}

export function loadDatabaseRows(table: string, offset: number): Promise<DatabaseRows> {
  return post({ action: "rows", table, offset, limit: 50 });
}

export function previewDatabaseDelete(table: string, keys: Record<string, unknown>): Promise<DeletePreview> {
  return post({ action: "preview-delete", table, keys });
}

export function deleteDatabaseRow(
  table: string,
  keys: Record<string, unknown>,
  confirmLinkedChanges: boolean,
): Promise<{ deleted: boolean; dependencies: ForeignKeyDependency[] }> {
  return post({ action: "delete", table, keys, confirmLinkedChanges });
}
