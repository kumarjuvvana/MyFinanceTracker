import { isAuthenticated, isSameOrigin } from "../src/lib/dataAuth.js";
import {
  executePriceUpdate,
  finishPriceRun,
  loadPriceDashboardData,
  loadPriceSettings,
  runScheduledAssetPrices,
  savePriceSettings,
  startPriceRun,
} from "../server/asset-price-service.js";
import type { AssetPriceSchedule, AutomatedPriceAssetType } from "../src/types.js";

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

function requestBody(request: ApiRequest): unknown {
  if (typeof request.body !== "string") return request.body;
  try {
    return JSON.parse(request.body) as unknown;
  } catch {
    return null;
  }
}

function validSchedule(value: unknown): value is AssetPriceSchedule {
  return typeof value === "object" && value !== null &&
    "assetType" in value && isSupportedAssetType(value.assetType) &&
    "enabled" in value && typeof value.enabled === "boolean" &&
    "lastRunAt" in value && (value.lastRunAt === null || typeof value.lastRunAt === "string");
}

function isSupportedAssetType(value: unknown): value is AutomatedPriceAssetType {
  return value === "Stocks" || value === "Mutual fund" || value === "NPS";
}

async function runManualUpdates() {
  const enabled = (await loadPriceSettings()).filter((setting) => setting.enabled);
  const results: Array<{ assetType: AutomatedPriceAssetType; status: string; updatedCount: number; details: string[] }> = [];
  for (const setting of enabled) {
    const run = await startPriceRun(setting.asset_type, "manual", null);
    if (!run) continue;
    const result = await executePriceUpdate(setting.asset_type);
    await finishPriceRun(run.id, setting.asset_type, result);
    results.push({ assetType: setting.asset_type, ...result });
  }
  return { started: results.length, results };
}

async function handleCron(request: ApiRequest, response: ApiResponse): Promise<boolean> {
  const authorization = header(request, "authorization");
  if (!authorization.startsWith("Bearer ")) return false;
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    respond(response, 503, { error: "Set CRON_SECRET in Vercel before enabling scheduled asset price updates." });
    return true;
  }
  if (authorization !== `Bearer ${secret}`) {
    respond(response, 401, { error: "Invalid scheduled-job authorization." });
    return true;
  }
  try {
    respond(response, 200, await runScheduledAssetPrices());
  } catch (caught) {
    console.error("Scheduled asset price job failed:", caught);
    respond(response, 500, { error: caught instanceof Error ? caught.message : "The scheduled price update failed." });
  }
  return true;
}

export default async function assetPricesHandler(request: ApiRequest, response: ApiResponse) {
  if (request.method === "GET" && await handleCron(request, response)) return;
  if (request.method !== "GET" && request.method !== "PUT" && request.method !== "POST") {
    response.setHeader("Allow", "GET, PUT, POST");
    respond(response, 405, { error: "Only GET, PUT, and POST requests are supported." });
    return;
  }
  if (!isAuthenticated(request)) {
    respond(response, 401, { error: "Your Daybook session expired. Enter the access password again." });
    return;
  }
  if (request.method !== "GET" && !isSameOrigin(request)) {
    respond(response, 403, { error: "This request must come from the Daybook site." });
    return;
  }

  if (request.method === "GET") {
    try {
      respond(response, 200, await loadPriceDashboardData());
    } catch (caught) {
      const error = caught instanceof Error ? caught.message : "Could not load asset price settings.";
      console.error("Asset price dashboard load failed:", caught);
      respond(response, 500, { error });
    }
    return;
  }

  if (request.method === "POST") {
    try {
      respond(response, 200, await runManualUpdates());
    } catch (caught) {
      console.error("Manual asset price update failed:", caught);
      respond(response, 500, { error: caught instanceof Error ? caught.message : "The manual price update failed." });
    }
    return;
  }

  const body = requestBody(request);
  if (typeof body !== "object" || body === null || !("settings" in body) ||
    !Array.isArray(body.settings) || body.settings.length !== 3 ||
    !body.settings.every(validSchedule) ||
    new Set(body.settings.map((setting) => setting.assetType)).size !== 3) {
    respond(response, 400, { error: "Provide one enabled/disabled setting for Stocks, Mutual fund, and NPS." });
    return;
  }
  try {
    const settings = body.settings as AssetPriceSchedule[];
    await savePriceSettings(settings.map((setting) => ({
      asset_type: setting.assetType,
      enabled: setting.enabled,
    })));
    respond(response, 200, { saved: true });
  } catch (caught) {
    const error = caught instanceof Error ? caught.message : "Could not save asset price settings.";
    console.error("Asset price settings save failed:", caught);
    respond(response, 500, { error });
  }
}
