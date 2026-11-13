import { isAuthenticated, isSameOrigin } from "../src/lib/dataAuth.js";
import {
  loadPriceDashboardData,
  savePriceSettings,
  isSupportedAssetType,
} from "./asset-price-service.js";
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
  if (typeof value !== "object" || value === null ||
    !("assetType" in value) || !isSupportedAssetType(value.assetType) ||
    !("enabled" in value) || typeof value.enabled !== "boolean" ||
    !("dayOfWeek" in value) || typeof value.dayOfWeek !== "number" ||
    !Number.isInteger(value.dayOfWeek) || value.dayOfWeek < 0 || value.dayOfWeek > 6 ||
    !("runHour" in value) || typeof value.runHour !== "number" ||
    !Number.isInteger(value.runHour) || value.runHour < 0 || value.runHour > 23 ||
    !("timezone" in value) || typeof value.timezone !== "string" ||
    value.timezone.length > 64 || !("lastRunAt" in value)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value.timezone });
  } catch {
    return false;
  }
  return value.lastRunAt === null || typeof value.lastRunAt === "string";
}

export default async function assetPriceSettingsHandler(request: ApiRequest, response: ApiResponse) {
  if (!isAuthenticated(request)) {
    respond(response, 401, { error: "Your Daybook session expired. Enter the access password again." });
    return;
  }
  if (request.method === "GET") {
    try {
      respond(response, 200, await loadPriceDashboardData());
    } catch (caught) {
      const error = caught instanceof Error ? caught.message : "Could not load asset price settings.";
      console.error("Asset price settings load failed:", caught);
      respond(response, 500, { error });
    }
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
  if (typeof body !== "object" || body === null || !("settings" in body) ||
    !Array.isArray(body.settings) || body.settings.length !== 3 ||
    !body.settings.every(validSchedule) ||
    new Set(body.settings.map((setting) => setting.assetType)).size !== 3) {
    respond(response, 400, { error: "Provide one valid schedule for Stocks, Mutual fund, and NPS." });
    return;
  }
  try {
    const settings = body.settings as AssetPriceSchedule[];
    await savePriceSettings(settings.map((setting) => ({
      asset_type: setting.assetType as AutomatedPriceAssetType,
      enabled: setting.enabled,
      day_of_week: setting.dayOfWeek,
      run_hour: setting.runHour,
      timezone: setting.timezone,
      last_run_at: setting.lastRunAt,
    })));
    respond(response, 200, { saved: true });
  } catch (caught) {
    const error = caught instanceof Error ? caught.message : "Could not save asset price settings.";
    console.error("Asset price settings save failed:", caught);
    respond(response, 500, { error });
  }
}
