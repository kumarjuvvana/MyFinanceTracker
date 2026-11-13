import { isAuthenticated, isSameOrigin } from "../src/lib/dataAuth.js";
import {
  executePriceUpdate,
  finishPriceRun,
  loadPriceSettings,
  runScheduledAssetPrices,
  startPriceRun,
} from "./asset-price-service.js";
import type { AutomatedPriceAssetType } from "../src/types.js";

interface ApiRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
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

export default async function assetPriceJobHandler(request: ApiRequest, response: ApiResponse) {
  if (request.method === "GET") {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      respond(response, 503, { error: "Set CRON_SECRET in Vercel before enabling scheduled asset price updates." });
      return;
    }
    if (header(request, "authorization") !== `Bearer ${secret}`) {
      respond(response, 401, { error: "Invalid scheduled-job authorization." });
      return;
    }
    try {
      respond(response, 200, await runScheduledAssetPrices());
    } catch (caught) {
      console.error("Scheduled asset price job failed:", caught);
      respond(response, 500, { error: caught instanceof Error ? caught.message : "The scheduled price update failed." });
    }
    return;
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    respond(response, 405, { error: "Only GET and POST requests are supported." });
    return;
  }
  if (!isAuthenticated(request)) {
    respond(response, 401, { error: "Your Daybook session expired. Enter the access password again." });
    return;
  }
  if (!isSameOrigin(request)) {
    respond(response, 403, { error: "This request must come from the Daybook site." });
    return;
  }
  try {
    respond(response, 200, await runManualUpdates());
  } catch (caught) {
    console.error("Manual asset price update failed:", caught);
    respond(response, 500, { error: caught instanceof Error ? caught.message : "The manual price update failed." });
  }
}
