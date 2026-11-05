import seedFile from "../data/daybook.json" with { type: "json" };
import { isAuthenticated, isSameOrigin } from "../src/lib/dataAuth.js";
import { normalizeTrackerData, validateData } from "../src/lib/data.js";
import type { TrackerData } from "../src/types";

const MAX_DATA_BYTES = 2 * 1024 * 1024;
const seedData = seedFile as TrackerData;

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

interface StoredData {
  data: TrackerData;
  revision: string;
}

class SupabaseApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function respond(response: ApiResponse, status: number, body: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

function requestBody(request: ApiRequest): unknown {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body) as unknown;
    } catch {
      return null;
    }
  }
  return request.body;
}

function supabaseCredentials(): { baseUrl: string; key: string } {
  const configuredUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!configuredUrl || !key) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the server environment to enable cloud data storage.");
  }

  let url: URL;
  try {
    url = new URL(configuredUrl);
  } catch {
    throw new Error("SUPABASE_URL must be a valid Supabase project URL.");
  }
  if ((url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") ||
    url.pathname !== "/" || url.search || url.hash) {
    throw new Error("SUPABASE_URL must be the HTTPS origin of your Supabase project.");
  }
  return { baseUrl: url.origin, key };
}

async function supabaseRequest(path: string, init?: RequestInit): Promise<Response> {
  const { baseUrl, key } = supabaseCredentials();
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    let message = `Supabase data storage failed (HTTP ${response.status}).`;
    try {
      const body: unknown = await response.json();
      if (typeof body === "object" && body !== null && "message" in body &&
        typeof body.message === "string" && body.message.length > 0) {
        message = body.message;
      }
    } catch {
      // Keep the HTTP status when Supabase does not return a JSON error.
    }
    throw new SupabaseApiError(response.status, message);
  }
  return response;
}

async function loadStoredData(): Promise<StoredData | null> {
  const response = await supabaseRequest("rpc/load_daybook_data", {
    method: "POST",
    body: JSON.stringify({}),
  });
  const result: unknown = await response.json();
  if (!Array.isArray(result)) {
    throw new Error("Supabase returned an invalid response for the shared Daybook data.");
  }
  if (result.length === 0) return null;

  const row: unknown = result[0];
  if (typeof row !== "object" || row === null || !("data" in row) ||
    !("revision" in row) || typeof row.revision !== "string" || !validateData(row.data)) {
    throw new Error("The shared Daybook data in Supabase is invalid. Restore a valid JSON backup before saving.");
  }
  const reminderCategories = await loadReminderCategories();
  return {
    data: normalizeTrackerData({ ...row.data, reminderCategories }),
    revision: row.revision,
  };
}

async function loadReminderCategories(): Promise<string[]> {
  const response = await supabaseRequest("rpc/load_reminder_categories", {
    method: "POST",
    body: JSON.stringify({}),
  });
  const result: unknown = await response.json();
  if (!Array.isArray(result) || result.length !== 1) {
    throw new Error("Supabase returned an invalid response for reminder categories.");
  }
  const row: unknown = result[0];
  if (typeof row !== "object" || row === null || !("categories" in row) ||
    !Array.isArray(row.categories) || !row.categories.every((category) =>
      typeof category === "string" && category.trim().length > 0 && category.trim().length <= 80)) {
    throw new Error("Reminder categories in Supabase are invalid.");
  }
  return row.categories;
}

async function saveData(data: TrackerData, expectedRevision: string | null): Promise<string | null> {
  const response = await supabaseRequest("rpc/save_daybook_data", {
    method: "POST",
    body: JSON.stringify({ p_data: data, p_expected_revision: expectedRevision }),
  });
  const result: unknown = await response.json();
  if (!Array.isArray(result)) {
    throw new Error("Supabase did not confirm the saved Daybook data revision.");
  }
  if (result.length === 0) return null;
  const saved: unknown = result[0];
  if (typeof saved !== "object" || saved === null ||
    !("revision" in saved) || typeof saved.revision !== "string") {
    throw new Error("Supabase returned an invalid saved Daybook data revision.");
  }
  return saved.revision;
}

async function saveReminderCategories(categories: string[], expectedRevision: string): Promise<boolean> {
  const response = await supabaseRequest("rpc/save_reminder_categories", {
    method: "POST",
    body: JSON.stringify({ p_categories: categories, p_expected_revision: expectedRevision }),
  });
  const result: unknown = await response.json();
  if (typeof result !== "boolean") {
    throw new Error("Supabase did not confirm the saved reminder categories.");
  }
  return result;
}

export default async function dataHandler(request: ApiRequest, response: ApiResponse) {
  if (!isAuthenticated(request)) {
    respond(response, 401, { error: "Your Daybook session expired. Enter the access password again." });
    return;
  }

  try {
    if (request.method === "GET") {
      const current = await loadStoredData();
      respond(response, 200, current
        ? { data: current.data, revision: current.revision, initialized: true }
        : { data: seedData, revision: null, initialized: false });
      return;
    }

    if (request.method !== "PUT") {
      response.setHeader("Allow", "GET, PUT");
      respond(response, 405, { error: "Only GET and PUT requests are supported." });
      return;
    }
    if (!isSameOrigin(request)) {
      respond(response, 403, { error: "This request must come from the Daybook site." });
      return;
    }

    const body = requestBody(request);
    if (typeof body !== "object" || body === null || !("data" in body) ||
      !("revision" in body) || !(typeof body.revision === "string" || body.revision === null) ||
      !validateData(body.data)) {
      respond(response, 400, { error: "The submitted Daybook data is invalid. No changes were saved." });
      return;
    }

    const data = normalizeTrackerData(body.data);
    if (new TextEncoder().encode(JSON.stringify(data)).byteLength > MAX_DATA_BYTES) {
      respond(response, 413, { error: "Daybook data is larger than the 2 MB limit. Export a backup and remove old stock price snapshots." });
      return;
    }

    const revision = await saveData(data, body.revision);
    if (revision === null) {
      respond(response, 409, { error: "The shared data changed on another device. Refresh before saving to avoid overwriting it." });
      return;
    }
    const categoriesSaved = await saveReminderCategories(data.reminderCategories ?? [], revision);
    if (!categoriesSaved) {
      respond(response, 409, { error: "The shared data changed on another device. Refresh before saving to avoid overwriting it." });
      return;
    }
    respond(response, 200, { revision });
  } catch (caught) {
    if (caught instanceof SupabaseApiError) {
      const status = caught.status === 401 || caught.status === 403 ? 503 : caught.status;
      console.error("Daybook Supabase API failed:", caught);
      respond(response, status, { error: caught.message });
      return;
    }
    const error = caught instanceof Error ? caught : new Error("Could not save shared Daybook data.");
    console.error("Daybook data API failed:", error);
    const status = error.message.startsWith("Set SUPABASE_") ? 503 : 500;
    respond(response, status, { error: error.message || "Could not read or save shared Daybook data." });
  }
}
