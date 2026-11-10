import { isAuthenticated, isSameOrigin } from "../src/lib/dataAuth.js";

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

function validId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 120;
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validLink(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function validateData(value: unknown): value is {
  dates: Array<{ id: string; title: string; date: string; categoryId: string; feelingId: string; person: string; note: string; link: string; reminder: boolean }>;
  categories: Array<{ id: string; name: string }>;
  feelings: Array<{ id: string; name: string; sentiment: "Good" | "Bad" | "Mixed" }>;
} {
  if (!isRecord(value) || !Array.isArray(value.dates) || value.dates.length > 10000 ||
    !Array.isArray(value.categories) || value.categories.length > 500 ||
    !Array.isArray(value.feelings) || value.feelings.length > 500) return false;
  const categoryIds = new Set<string>();
  const feelingIds = new Set<string>();
  const categoryNames = new Set<string>();
  const feelingNames = new Set<string>();
  for (const category of value.categories) {
    if (!isRecord(category) || !validId(category.id) || typeof category.name !== "string" ||
      !category.name.trim() || category.name.length > 80 || categoryIds.has(category.id) ||
      categoryNames.has(category.name.trim().toLocaleLowerCase())) return false;
    categoryIds.add(category.id);
    categoryNames.add(category.name.trim().toLocaleLowerCase());
  }
  for (const feeling of value.feelings) {
    if (!isRecord(feeling) || !validId(feeling.id) || typeof feeling.name !== "string" ||
      !feeling.name.trim() || feeling.name.length > 60 ||
      !["Good", "Bad", "Mixed"].includes(String(feeling.sentiment)) || feelingIds.has(feeling.id) ||
      feelingNames.has(feeling.name.trim().toLocaleLowerCase())) return false;
    feelingIds.add(feeling.id);
    feelingNames.add(feeling.name.trim().toLocaleLowerCase());
  }
  const dateIds = new Set<string>();
  for (const date of value.dates) {
    if (!isRecord(date) || !validId(date.id) || dateIds.has(date.id) ||
      typeof date.title !== "string" || !date.title.trim() || date.title.length > 160 ||
      !validDate(date.date) || !validId(date.categoryId) || !categoryIds.has(date.categoryId) ||
      !(date.feelingId === "" || validId(date.feelingId) && feelingIds.has(date.feelingId)) ||
      typeof date.person !== "string" || date.person.length > 120 ||
      typeof date.note !== "string" || date.note.length > 500 ||
      !validLink(date.link) || typeof date.reminder !== "boolean") return false;
    dateIds.add(date.id);
  }
  return true;
}

function supabaseCredentials(): { baseUrl: string; key: string } {
  const configuredUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!configuredUrl || !key) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the server environment to enable important dates.");
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

async function supabaseRequest(path: string, body: unknown): Promise<unknown> {
  const { baseUrl, key } = supabaseCredentials();
  const result = await fetch(`${baseUrl}/rest/v1/rpc/${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!result.ok) {
    let message = `Supabase important dates storage failed (HTTP ${result.status}).`;
    try {
      const error: unknown = await result.json();
      if (isRecord(error) && typeof error.message === "string") message = error.message;
    } catch {
      // Keep the HTTP status when Supabase does not return a JSON error.
    }
    throw new SupabaseApiError(result.status, message);
  }
  return await result.json() as unknown;
}

function handleFailure(response: ApiResponse, caught: unknown, action: string) {
  if (caught instanceof SupabaseApiError) console.error(`Important dates ${action} failed:`, caught);
  const error = caught instanceof Error ? caught : new Error(`Could not ${action} important dates.`);
  const missingMigration = caught instanceof SupabaseApiError && caught.status === 404;
  const status = error.message.startsWith("Set SUPABASE_") ? 503 :
    missingMigration ? 503 : caught instanceof SupabaseApiError ? 500 : 500;
  respond(response, status, { error: missingMigration
    ? "Apply the important dates SQL migration in supabase/migrations, then reload this tab."
    : error.message });
}

export default async function importantDatesHandler(request: ApiRequest, response: ApiResponse) {
  if (!isAuthenticated(request)) {
    respond(response, 401, { error: "Enter the Daybook access password to continue." });
    return;
  }
  if (request.method !== "GET" && !isSameOrigin(request)) {
    respond(response, 403, { error: "This request must come from the Daybook site." });
    return;
  }
  if (request.method === "GET") {
    try {
      const result = await supabaseRequest("load_important_dates", {});
      if (!Array.isArray(result) || !isRecord(result[0]) ||
        typeof result[0].revision !== "string" ||
        !validateData({ dates: result[0].dates, categories: result[0].categories, feelings: result[0].feelings })) {
        throw new Error("Supabase returned an invalid important dates response.");
      }
      respond(response, 200, {
        revision: result[0].revision,
        dates: result[0].dates,
        categories: result[0].categories,
        feelings: result[0].feelings,
      });
    } catch (caught) {
      handleFailure(response, caught, "load");
    }
    return;
  }
  if (request.method !== "PUT") {
    response.setHeader("Allow", "GET, PUT");
    respond(response, 405, { error: "Only GET and PUT requests are supported." });
    return;
  }
  const body = requestBody(request);
  if (!isRecord(body)) {
    respond(response, 400, { error: "Provide valid important dates, categories, feelings, and the current revision." });
    return;
  }
  const revision = body.revision;
  if (typeof revision !== "string" || !revision || !validateData(body)) {
    respond(response, 400, { error: "Provide valid important dates, categories, feelings, and the current revision." });
    return;
  }
  try {
    const result = await supabaseRequest("replace_important_dates", {
      p_dates: body.dates,
      p_categories: body.categories,
      p_feelings: body.feelings,
      p_expected_revision: revision,
    });
    if (!Array.isArray(result) || !isRecord(result[0]) || typeof result[0].revision !== "string") {
      respond(response, 409, { error: "Important dates changed elsewhere. Reload them before saving again." });
      return;
    }
    respond(response, 200, { revision: result[0].revision });
  } catch (caught) {
    handleFailure(response, caught, "save");
  }
}
