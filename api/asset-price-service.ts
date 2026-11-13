import { fetchMutualFundNavs } from "./mutual-fund-nav.js";
import { fetchNpsNavs } from "./nps-nav.js";
import { fetchStockQuote } from "./stock-price.js";
import { normalizeTrackerData, validateData } from "../src/lib/data.js";
import type { AutomatedPriceAssetType, TrackerData } from "../src/types.js";

interface SettingsRow {
  asset_type: AutomatedPriceAssetType;
  enabled: boolean;
  day_of_week: number;
  run_hour: number;
  timezone: string;
  last_run_at: string | null;
}

interface PriceUpdate {
  asset_type: AutomatedPriceAssetType;
  asset_id: string;
  asset_name: string;
  instrument_id: string;
  instrument_name: string;
  price: number;
  price_date: string;
  currency: string;
  provider: string;
  fetched_at: string;
  quote_timestamp?: string;
  market_state?: string;
  previous_close?: number | null;
}

interface PriceRun {
  id: string;
}

const ASSET_TYPES: AutomatedPriceAssetType[] = ["Stocks", "Mutual fund", "NPS"];

function credentials(): { baseUrl: string; key: string } {
  const configuredUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!configuredUrl || !key) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel to enable scheduled asset prices.");
  }
  const url = new URL(configuredUrl);
  if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("SUPABASE_URL must be the HTTPS origin of your Supabase project.");
  }
  return { baseUrl: url.origin, key };
}

async function supabaseRequest(path: string, init?: RequestInit): Promise<Response> {
  const { baseUrl, key } = credentials();
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
    const body = await response.text();
    console.error("Asset price Supabase request failed:", response.status, body.slice(0, 500));
    throw new Error(`Supabase asset price storage failed (HTTP ${response.status}).`);
  }
  return response;
}

export async function loadAssetPriceData(): Promise<TrackerData> {
  const response = await supabaseRequest("rpc/load_daybook_data_with_account_credentials", {
    method: "POST",
    body: "{}",
  });
  const rows: unknown = await response.json();
  if (!Array.isArray(rows) || rows.length !== 1 || typeof rows[0] !== "object" || rows[0] === null ||
    !("data" in rows[0]) || typeof rows[0].data !== "object" || rows[0].data === null) {
    throw new Error("Supabase did not return the saved asset records.");
  }
  if (!validateData(rows[0].data)) {
    throw new Error("The shared asset records in Supabase are invalid; no prices were updated.");
  }
  return normalizeTrackerData(rows[0].data);
}

export async function loadPriceSettings(): Promise<SettingsRow[]> {
  const response = await supabaseRequest("asset_price_update_settings?select=*&order=asset_type.asc");
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) {
    throw new Error("Supabase returned incomplete or invalid asset price settings.");
  }
  const settings = rows.filter(isSettingsRow);
  if (settings.length !== ASSET_TYPES.length ||
    new Set(settings.map((setting) => setting.asset_type)).size !== ASSET_TYPES.length) {
    throw new Error("Supabase returned incomplete or invalid asset price settings.");
  }
  return settings;
}

export async function savePriceSettings(settings: SettingsRow[]): Promise<void> {
  await supabaseRequest("asset_price_update_settings?on_conflict=asset_type", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(settings.map((setting) => ({
      asset_type: setting.asset_type,
      enabled: setting.enabled,
      day_of_week: setting.day_of_week,
      run_hour: setting.run_hour,
      timezone: setting.timezone,
      updated_at: new Date().toISOString(),
    }))),
  });
}

export async function loadPriceDashboardData() {
  const [settings, historyResponse, runsResponse] = await Promise.all([
    loadPriceSettings(),
    supabaseRequest("asset_price_history?select=*&order=price_date.desc,fetched_at.desc&limit=100"),
    supabaseRequest("asset_price_update_runs?select=*&order=started_at.desc&limit=30"),
  ]);
  return {
    settings,
    history: await historyResponse.json(),
    runs: await runsResponse.json(),
  };
}

export async function startPriceRun(
  assetType: AutomatedPriceAssetType,
  runKind: "scheduled" | "manual",
  scheduledFor: string | null,
): Promise<PriceRun | null> {
  const response = await supabaseRequest("asset_price_update_runs?on_conflict=asset_type,scheduled_for", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify([{
      asset_type: assetType,
      run_kind: runKind,
      scheduled_for: scheduledFor,
      status: "running",
    }]),
  });
  const rows: unknown = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;
  if (typeof rows[0] !== "object" || rows[0] === null || !("id" in rows[0]) || typeof rows[0].id !== "string") {
    throw new Error("Supabase returned an invalid asset price run.");
  }
  return rows[0] as PriceRun;
}

export async function finishPriceRun(
  runId: string,
  assetType: AutomatedPriceAssetType,
  result: { status: "succeeded" | "partial" | "failed"; updatedCount: number; details: string[] },
): Promise<void> {
  await supabaseRequest(`asset_price_update_runs?id=eq.${encodeURIComponent(runId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      completed_at: new Date().toISOString(),
      status: result.status,
      updated_count: result.updatedCount,
      failure_count: result.details.length,
      details: result.details,
    }),
  });
  await supabaseRequest(`asset_price_update_settings?asset_type=eq.${encodeURIComponent(assetType)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ last_run_at: new Date().toISOString() }),
  });
}

function providerFailure(value: unknown): string {
  return value instanceof Error ? value.message : "The price provider did not return a usable value.";
}

function dateInTimezone(value: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) throw new Error("Could not determine the stock market price date.");
  return `${year}-${month}-${day}`;
}

async function runStockUpdates(data: TrackerData, fetchedAt: string): Promise<{ updates: PriceUpdate[]; errors: string[] }> {
  const stocks = (data.stocks ?? []).filter((stock) =>
    /^[A-Z0-9][A-Z0-9.&_-]{0,29}$/.test(stock.symbol) &&
    (stock.exchange === "NSE" || stock.exchange === "BSE"));
  const updates: PriceUpdate[] = [];
  const errors: string[] = [];
  let nextStock = 0;
  const workers = Array.from({ length: Math.min(5, stocks.length) }, async () => {
    while (nextStock < stocks.length) {
      const stock = stocks[nextStock++];
      try {
        const quote = await fetchStockQuote(stock.symbol, stock.exchange);
        updates.push({
          asset_type: "Stocks",
          asset_id: stock.id,
          asset_name: stock.name,
          instrument_id: stock.id,
          instrument_name: `${stock.symbol} (${stock.exchange})`,
          price: quote.price,
          price_date: dateInTimezone(quote.timestamp, "Asia/Kolkata"),
          currency: quote.currency,
          provider: quote.provider,
          fetched_at: fetchedAt,
          quote_timestamp: quote.timestamp,
          market_state: quote.marketState,
          previous_close: quote.previousClose,
        });
      } catch (caught) {
        errors.push(`${stock.symbol} (${stock.exchange}): ${providerFailure(caught)}`);
      }
    }
  });
  await Promise.all(workers);
  if (!stocks.length) errors.push("No tracked stocks were found.");
  return { updates, errors };
}

async function runMutualFundUpdates(data: TrackerData, fetchedAt: string): Promise<{ updates: PriceUpdate[]; errors: string[] }> {
  const assets = (data.assets ?? []).filter((asset) => asset.type === "Mutual fund");
  const validAssets = assets.filter((asset) => /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(asset.reference.trim()));
  const errors = assets.filter((asset) => !/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(asset.reference.trim()))
    .map((asset) => `${asset.name}: add a valid ISIN in Account / reference.`);
  if (!validAssets.length) {
    if (!assets.length) errors.push("No mutual-fund records were found.");
    return { updates: [], errors };
  }

  const navs = await fetchMutualFundNavs([...new Set(validAssets.map((asset) => asset.reference.trim().toUpperCase()))]);
  const updates: PriceUpdate[] = [];
  for (const asset of validAssets) {
    const isin = asset.reference.trim().toUpperCase();
    const nav = navs.get(isin);
    if (!nav) {
      errors.push(`${asset.name}: AMFI returned no NAV for ${isin}.`);
      continue;
    }
    updates.push({
      asset_type: "Mutual fund",
      asset_id: asset.id,
      asset_name: asset.name,
      instrument_id: isin,
      instrument_name: nav.schemeName,
      price: nav.nav,
      price_date: nav.date,
      currency: "INR",
      provider: "AMFI",
      fetched_at: fetchedAt,
    });
  }
  return { updates, errors };
}

function normalizeName(value: string): string {
  return value.toLocaleUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeSchemeName(value: string): string {
  return normalizeName(value).replace(/^NPSTRUSTAC/, "");
}

function normalizePfmName(value: string): string {
  return normalizeName(value).replace(/(?:LIMITED|LTD|PRIVATE|PVT)$/, "");
}

async function runNpsUpdates(data: TrackerData, fetchedAt: string): Promise<{ updates: PriceUpdate[]; errors: string[] }> {
  const assets = (data.assets ?? []).filter((asset) => asset.type === "NPS" && (asset.npsSchemes?.length ?? 0) > 0);
  if (!assets.length) return { updates: [], errors: ["No NPS scheme holdings were found."] };
  const navs = await fetchNpsNavs();
  const updates: PriceUpdate[] = [];
  const errors: string[] = [];
  for (const asset of assets) {
    const pfm = normalizePfmName(asset.institution);
    const providerNavs = navs.filter((entry) => normalizePfmName(entry.pfmName) === pfm);
    for (const scheme of asset.npsSchemes ?? []) {
      const exactName = normalizeSchemeName(scheme.schemeName);
      let matches = providerNavs.filter((entry) => normalizeSchemeName(entry.schemeName) === exactName);
      if (!matches.length && exactName.endsWith("POP")) {
        const withoutPop = exactName.slice(0, -3);
        matches = providerNavs.filter((entry) => normalizeSchemeName(entry.schemeName) === withoutPop);
      }
      if (scheme.schemeId) matches = matches.filter((entry) => entry.schemeId === scheme.schemeId);
      if (matches.length !== 1) {
        errors.push(`${asset.name} · ${scheme.schemeName}: ${matches.length ? "matches multiple official schemes" : "has no exact official scheme match"}.`);
        continue;
      }
      const nav = matches[0];
      updates.push({
        asset_type: "NPS",
        asset_id: asset.id,
        asset_name: asset.name,
        instrument_id: nav.schemeId,
        instrument_name: scheme.schemeName,
        price: nav.nav,
        price_date: nav.date,
        currency: "INR",
        provider: "NPS Trust",
        fetched_at: fetchedAt,
      });
    }
  }
  return { updates, errors };
}

async function saveUpdates(updates: PriceUpdate[]): Promise<number> {
  const response = await supabaseRequest("rpc/save_asset_price_updates", {
    method: "POST",
    body: JSON.stringify({ p_updates: updates }),
  });
  const result: unknown = await response.json();
  if (typeof result !== "number" || result < 0) throw new Error("Supabase did not confirm the saved price history.");
  return result;
}

export async function executePriceUpdate(
  assetType: AutomatedPriceAssetType,
): Promise<{ status: "succeeded" | "partial" | "failed"; updatedCount: number; details: string[] }> {
  try {
    const data = await loadAssetPriceData();
    const fetchedAt = new Date().toISOString();
    const result = assetType === "Stocks"
      ? await runStockUpdates(data, fetchedAt)
      : assetType === "Mutual fund"
        ? await runMutualFundUpdates(data, fetchedAt)
        : await runNpsUpdates(data, fetchedAt);
    const updatedCount = result.updates.length ? await saveUpdates(result.updates) : 0;
    return {
      status: result.errors.length ? updatedCount ? "partial" : "failed" : "succeeded",
      updatedCount,
      details: result.errors,
    };
  } catch (caught) {
    return { status: "failed", updatedCount: 0, details: [providerFailure(caught)] };
  }
}

export async function runScheduledAssetPrices(now = new Date()): Promise<{
  started: number;
  skipped: number;
  results: Array<{ assetType: AutomatedPriceAssetType; status: string; updatedCount: number; details: string[] }>;
}> {
  const settings = await loadPriceSettings();
  const dueSettings = settings.filter((setting) => setting.enabled && isDue(setting, now));
  if (!dueSettings.length) {
    return {
      started: 0,
      skipped: settings.filter((setting) => setting.enabled).length,
      results: [],
    };
  }
  const results: Array<{ assetType: AutomatedPriceAssetType; status: string; updatedCount: number; details: string[] }> = [];
  const scheduledFor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours())).toISOString();

  for (const setting of dueSettings) {
    const run = await startPriceRun(setting.asset_type, "scheduled", scheduledFor);
    if (!run) continue;
    try {
      const result = await executePriceUpdate(setting.asset_type);
      await finishPriceRun(run.id, setting.asset_type, result);
      results.push({ assetType: setting.asset_type, ...result });
    } catch (caught) {
      const details = [providerFailure(caught)];
      await finishPriceRun(run.id, setting.asset_type, { status: "failed", updatedCount: 0, details });
      results.push({ assetType: setting.asset_type, status: "failed", updatedCount: 0, details });
    }
  }
  return {
    started: results.length,
    skipped: settings.filter((setting) => setting.enabled).length - results.length,
    results,
  };
}

function isDue(setting: SettingsRow, now: Date): boolean {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: setting.timezone,
      weekday: "short",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const weekday = parts.find((part) => part.type === "weekday")?.value;
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return weekdays[weekday ?? ""] === setting.day_of_week && hour === setting.run_hour;
  } catch (caught) {
    throw new Error(`Invalid timezone for ${setting.asset_type} schedule: ${providerFailure(caught)}`);
  }
}

export function isSupportedAssetType(value: unknown): value is AutomatedPriceAssetType {
  return typeof value === "string" && ASSET_TYPES.includes(value as AutomatedPriceAssetType);
}

function isSettingsRow(value: unknown): value is SettingsRow {
  if (typeof value !== "object" || value === null ||
    !("asset_type" in value) || !isSupportedAssetType(value.asset_type) ||
    !("enabled" in value) || typeof value.enabled !== "boolean" ||
    !("day_of_week" in value) || typeof value.day_of_week !== "number" ||
    !Number.isInteger(value.day_of_week) || value.day_of_week < 0 || value.day_of_week > 6 ||
    !("run_hour" in value) || typeof value.run_hour !== "number" ||
    !Number.isInteger(value.run_hour) || value.run_hour < 0 || value.run_hour > 23 ||
    !("timezone" in value) || typeof value.timezone !== "string" ||
    !("last_run_at" in value) || !(value.last_run_at === null || typeof value.last_run_at === "string")) {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value.timezone });
    return true;
  } catch {
    return false;
  }
}
