import { getPool } from "./database.js";
import { isAuthenticated } from "../src/lib/dataAuth.js";
import type { PoolClient } from "pg";

interface ApiRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
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
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

async function usageHandler(request: ApiRequest, response: ApiResponse) {
  if (!isAuthenticated(request)) {
    respond(response, 401, { error: "Your Daybook session expired. Enter the access password again." });
    return;
  }
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    respond(response, 405, { error: "Only GET requests are supported." });
    return;
  }

  let client: PoolClient | undefined;
  try {
    client = await getPool().connect();
    const result = await client.query(
      `select
         pg_catalog.pg_database_size(pg_catalog.current_database())::text as database_bytes,
         coalesce(sum(
           case when metadata ->> 'size' ~ '^[0-9]+$'
             then (metadata ->> 'size')::numeric
             else 0
           end
         ), 0)::text as storage_bytes,
         count(*)::text as storage_objects
       from storage.objects`,
    );
    const row = result.rows[0] as {
      database_bytes: string;
      storage_bytes: string;
      storage_objects: string;
    };
    respond(response, 200, {
      measuredAt: new Date().toISOString(),
      databaseBytes: row.database_bytes,
      storageBytes: row.storage_bytes,
      storageObjects: row.storage_objects,
    });
  } catch (caught) {
    const code = typeof caught === "object" && caught !== null && "code" in caught && typeof caught.code === "string"
      ? caught.code : undefined;
    const configurationError = caught instanceof Error &&
      (caught.message.startsWith("Set SUPABASE_DB_URL") || caught.message.startsWith("SUPABASE_DB_URL must"));
    console.error("Usage metrics request failed:", code ?? "unknown database error");
    respond(response, configurationError ? 503 : 500, {
      error: configurationError
        ? caught.message
        : "Supabase usage could not be measured. Check the server database connection and storage schema.",
    });
  } finally {
    client?.release();
  }
}

export default usageHandler;
