import type { CredentialRecord, DocumentAttachment, DocumentCategory, EncryptedCredentialVault, PersonalRecord } from "../types";

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

export type ProfileDatabaseCatalog = DatabaseCatalog;

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

export const VEHICLE_PROFILE_TABLES = [
  "vehicles",
  "alerts",
  "certificates",
  "expenses",
  "fuel_consumptions",
  "insurance_policies",
  "monthly_targets",
  "odometer_logs",
  "services",
  "travel_logs",
] as const;

export type VehicleProfileTableName = (typeof VEHICLE_PROFILE_TABLES)[number];
export type VehicleProfileRow = Record<string, unknown>;

export interface VehicleProfileColumn {
  name: string;
  dataType: string;
  udtName: string;
  nullable: boolean;
  defaultValue: string | null;
}

export interface VehicleProfileTable {
  name: VehicleProfileTableName;
  columns: VehicleProfileColumn[];
  primaryKey: string[];
  totalRows: string;
  truncated: boolean;
  rows: VehicleProfileRow[];
}

export interface VehicleProfileData {
  profileId: string;
  tables: VehicleProfileTable[];
}

export interface DocumentModulesData {
  documents: DocumentAttachment[];
  personalDocuments: PersonalRecord[];
  accountCredentials: CredentialRecord[];
  archivedAccountCredentials: CredentialRecord[];
  categories: DocumentCategory[];
  credentialVault?: EncryptedCredentialVault;
}

export type DocumentModuleCollection = "documents" | "personalDocuments" | "accountCredentials" | "categories";
export type DocumentModuleMutation =
  | { collection: DocumentModuleCollection; action: "upsert"; record: DocumentAttachment | PersonalRecord | CredentialRecord | DocumentCategory }
  | { collection: Exclude<DocumentModuleCollection, "categories">; action: "archive" | "restore" | "delete"; id: string }
  | { collection: "credentialVault"; action: "clear" };

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

export async function loadSavedProfileDatabaseCatalog(
  profileId: string,
  passphrase: string,
): Promise<ProfileDatabaseCatalog> {
  return await (await request("/api/database", {
    action: "profile-catalog",
    profileId,
    passphrase,
  })).json() as ProfileDatabaseCatalog;
}

export async function loadSavedProfileDatabaseRows(
  profileId: string,
  passphrase: string,
  table: string,
  offset: number,
): Promise<DatabaseRows> {
  return await (await request("/api/database", {
    action: "profile-rows",
    profileId,
    passphrase,
    table,
    offset,
  })).json() as DatabaseRows;
}

export async function reviewSavedProfileDatabaseSql(
  profileId: string,
  passphrase: string,
  sql: string,
): Promise<SqlReview> {
  return await (await request("/api/database", {
    action: "profile-review-sql",
    profileId,
    passphrase,
    sql,
  })).json() as SqlReview;
}

export async function executeSavedProfileDatabaseSql(
  profileId: string,
  passphrase: string,
  sql: string,
  confirmation: string,
  statementHash: string,
): Promise<SqlExecutionResult> {
  return await (await request("/api/database", {
    action: "profile-execute-sql",
    profileId,
    passphrase,
    sql,
    confirmation,
    statementHash,
  })).json() as SqlExecutionResult;
}

export async function loadSavedProfileVehicleData(
  profileId: string,
  passphrase: string,
): Promise<VehicleProfileData> {
  return await (await request("/api/database", {
    action: "profile-vehicles-data",
    profileId,
    passphrase,
  })).json() as VehicleProfileData;
}

export async function mutateSavedProfileVehicleRecord(
  profileId: string,
  passphrase: string,
  table: VehicleProfileTableName,
  operation: "insert" | "update" | "delete",
  values?: Record<string, string | number | boolean | null>,
  id?: number,
): Promise<{ operation: "insert" | "update" | "delete"; table: VehicleProfileTableName; row: VehicleProfileRow }> {
  return await (await request("/api/database", {
    action: "profile-vehicles-mutate",
    profileId,
    passphrase,
    table,
    operation,
    ...(values ? { values } : {}),
    ...(id !== undefined ? { id } : {}),
  })).json() as { operation: "insert" | "update" | "delete"; table: VehicleProfileTableName; row: VehicleProfileRow };
}

export async function loadSavedProfileDocumentModules(
  profileId: string,
  passphrase: string,
): Promise<DocumentModulesData> {
  return await (await request("/api/database", {
    action: "profile-document-modules-data",
    profileId,
    passphrase,
  })).json() as DocumentModulesData;
}

export async function mutateSavedProfileDocumentModules(
  profileId: string,
  passphrase: string,
  mutation: DocumentModuleMutation,
): Promise<DocumentModulesData> {
  const { action: operation, ...details } = mutation;
  return await (await request("/api/database", {
    action: "profile-document-modules-mutate",
    profileId,
    passphrase,
    ...details,
    operation,
  })).json() as DocumentModulesData;
}
