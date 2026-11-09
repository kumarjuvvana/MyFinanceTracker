import { isAuthenticated, isSameOrigin } from "../src/lib/dataAuth.js";
import type { CookingInventoryItem } from "../src/types";

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

function isOptionalAmount(value: unknown): boolean {
  return value === null || typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function validateInventory(value: unknown): value is CookingInventoryItem[] {
  if (!Array.isArray(value) || value.length > 5000) return false;
  const itemIds = new Set<string>();
  return value.every((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || !item.id.trim() || item.id.length > 120 ||
      itemIds.has(item.id) || typeof item.name !== "string" || !item.name.trim() || item.name.length > 120 ||
      typeof item.category !== "string" || item.category.length > 60 || !Array.isArray(item.measures) ||
      item.measures.length > 100) return false;
    itemIds.add(item.id);
    const measureIds = new Set<string>();
    return item.measures.every((measure) => {
      if (!isRecord(measure) || typeof measure.id !== "string" || !measure.id.trim() ||
        measureIds.has(measure.id) || typeof measure.unit !== "string" || !measure.unit.trim() ||
        measure.unit.length > 40 || !isOptionalAmount(measure.stockQuantity) ||
        !isOptionalAmount(measure.unitPrice) ||
        measure.piecesPerKg !== undefined && measure.piecesPerKg !== null &&
          (typeof measure.piecesPerKg !== "number" || !Number.isFinite(measure.piecesPerKg) || measure.piecesPerKg <= 0)) return false;
      measureIds.add(measure.id);
      return true;
    });
  });
}

function supabaseCredentials(): { baseUrl: string; key: string } {
  const configuredUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!configuredUrl || !key) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the server environment to enable cooking inventory storage.");
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
    let message = `Supabase cooking inventory storage failed (HTTP ${result.status}).`;
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

export default async function cookingInventoryHandler(request: ApiRequest, response: ApiResponse) {
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
      const result = await supabaseRequest("load_cooking_inventory", {});
      if (!Array.isArray(result) || !isRecord(result[0]) ||
        typeof result[0].revision !== "string" || !validateInventory(result[0].items)) {
        throw new Error("Supabase returned an invalid cooking inventory response.");
      }
      respond(response, 200, { revision: result[0].revision, items: result[0].items });
    } catch (caught) {
      if (caught instanceof SupabaseApiError) console.error("Cooking inventory API failed:", caught);
      const error = caught instanceof Error ? caught : new Error("Could not load cooking inventory.");
      const status = error.message.startsWith("Set SUPABASE_") ? 503 :
        caught instanceof SupabaseApiError ? caught.status === 404 ? 503 : 500 : 500;
      respond(response, status, { error: status === 503 && caught instanceof SupabaseApiError
        ? "Apply the cooking inventory SQL migration in supabase/migrations, then reload this tab."
        : error.message });
    }
    return;
  }
  if (request.method !== "PUT") {
    response.setHeader("Allow", "GET, PUT");
    respond(response, 405, { error: "Only GET and PUT requests are supported." });
    return;
  }
  const body = requestBody(request);
  if (!isRecord(body) || typeof body.revision !== "string" || !body.revision ||
    !validateInventory(body.items)) {
    respond(response, 400, { error: "Provide a valid cooking inventory and its current revision." });
    return;
  }
  try {
    const result = await supabaseRequest("replace_cooking_inventory", {
      p_items: body.items,
      p_expected_revision: body.revision,
    });
    if (!Array.isArray(result) || !isRecord(result[0]) || typeof result[0].revision !== "string") {
      respond(response, 409, { error: "Cooking inventory changed elsewhere. Reload it before saving again." });
      return;
    }
    respond(response, 200, { revision: result[0].revision });
  } catch (caught) {
    if (caught instanceof SupabaseApiError) console.error("Cooking inventory API failed:", caught);
    const error = caught instanceof Error ? caught : new Error("Could not save cooking inventory.");
    const status = error.message.startsWith("Set SUPABASE_") ? 503 : 500;
    respond(response, status, { error: error.message });
  }
}
