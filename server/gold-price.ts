import { CURRENCIES, type Currency } from "../src/types.js";

interface GoldPriceRequest {
  method?: string;
  url?: string;
}

interface GoldPriceResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

interface GoldPriceQuote {
  currency: Currency;
  pricePerGram: number;
  safeGoldSellPricePerGram: number;
  priceDate: string;
  updatedAt: string;
}

const DEFAULT_SAFEGOLD_SELL_RATE_MULTIPLIER = 1.045;

function respond(response: GoldPriceResponse, status: number, body: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function priceDateInIndia(value: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) throw new Error("Could not determine the gold quote date.");
  return `${year}-${month}-${day}`;
}

function readQuoteTimestamp(value: unknown): string {
  const timestamp = typeof value === "number" && Number.isFinite(value)
    ? new Date(value < 1_000_000_000_000 ? value * 1000 : value)
    : typeof value === "string" ? new Date(value) : null;
  if (!timestamp || Number.isNaN(timestamp.getTime())) {
    throw new Error("GoldAPI.io returned an invalid quote timestamp.");
  }
  return timestamp.toISOString();
}

function positiveNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value
    : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getSafeGoldSellRateMultiplier(): number {
  const configured = process.env.SAFEGOLD_SELL_RATE_MULTIPLIER;
  if (configured === undefined || configured.trim() === "") return DEFAULT_SAFEGOLD_SELL_RATE_MULTIPLIER;
  const multiplier = Number(configured);
  if (!Number.isFinite(multiplier) || multiplier < 1 || multiplier > 1.15) {
    throw new Error("SAFEGOLD_SELL_RATE_MULTIPLIER must be between 1 and 1.15.");
  }
  return multiplier;
}

async function fetchGoldPrice(currency: Currency, apiKey: string, safeGoldSellRateMultiplier: number): Promise<GoldPriceQuote> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`https://www.goldapi.io/api/price/XAU/${currency}`, {
      headers: { Accept: "application/json", "x-access-token": apiKey },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`GoldAPI.io returned HTTP ${response.status}.`);

    const payload: unknown = await response.json();
    if (!isRecord(payload)) {
      throw new Error("GoldAPI.io returned a non-object quote response.");
    }

    const providerMessage = [payload.error, payload.message]
      .find((value): value is string => typeof value === "string" && value.trim().length > 0);
    if (providerMessage) throw new Error(`GoldAPI.io: ${providerMessage.slice(0, 240)}`);

    const metal = payload.metal ?? payload.symbol;
    if (typeof metal === "string" && !metal.toUpperCase().includes("XAU")) {
      throw new Error(`GoldAPI.io returned ${metal} instead of XAU.`);
    }
    if (typeof payload.currency === "string" && payload.currency.toUpperCase() !== currency) {
      throw new Error(`GoldAPI.io returned ${payload.currency} instead of ${currency}.`);
    }

    const gramQuote = positiveNumber(payload.price_gram_24k);
    const troyOunceQuote = positiveNumber(payload.price);
    const pricePerGram = gramQuote ?? (troyOunceQuote === null ? null : troyOunceQuote / 31.1034768);
    if (pricePerGram === null) {
      throw new Error("GoldAPI.io returned no usable 24K gram price or troy-ounce price.");
    }

    const updatedAt = readQuoteTimestamp(payload.timestamp ?? payload.updatedAt ?? payload.open_time);
    return {
      currency,
      pricePerGram,
      safeGoldSellPricePerGram: currency === "INR"
        ? pricePerGram * safeGoldSellRateMultiplier
        : pricePerGram,
      priceDate: priceDateInIndia(updatedAt),
      updatedAt,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export default async function goldPriceHandler(request: GoldPriceRequest, response: GoldPriceResponse) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    respond(response, 405, { error: "Only GET requests are supported." });
    return;
  }

  const url = new URL(request.url ?? "/", "http://localhost");
  const requestedCurrencies = (url.searchParams.get("currencies") ?? "INR")
    .split(",")
    .map((currency) => currency.trim().toUpperCase())
    .filter((currency) => currency.length > 0);
  if (!requestedCurrencies.length ||
    requestedCurrencies.some((currency) => !CURRENCIES.includes(currency as Currency))) {
    respond(response, 400, { error: `Use supported currencies: ${CURRENCIES.join(", ")}.` });
    return;
  }

  const apiKey = process.env.GOLDAPI_IO_API_KEY?.trim();
  if (!apiKey) {
    respond(response, 503, { error: "Gold refresh is not configured. Set the server-only GOLDAPI_IO_API_KEY." });
    return;
  }

  let safeGoldSellRateMultiplier: number;
  try {
    safeGoldSellRateMultiplier = getSafeGoldSellRateMultiplier();
  } catch (caught) {
    respond(response, 500, {
      error: caught instanceof Error ? caught.message : "SafeGold sell-rate configuration is invalid.",
    });
    return;
  }

  const currencies = [...new Set(requestedCurrencies)] as Currency[];
  const results = await Promise.all(currencies.map(async (currency) => {
    try {
      return { quote: await fetchGoldPrice(currency, apiKey, safeGoldSellRateMultiplier) };
    } catch (caught) {
      const error = caught instanceof Error && caught.name === "AbortError"
        ? "GoldAPI.io timed out."
        : caught instanceof Error ? caught.message : "Could not load a gold price.";
      return { currency, error };
    }
  }));
  const prices = results.flatMap((result) => "quote" in result ? [result.quote] : []);
  const errors = results.flatMap((result) => "error" in result
    ? [{ currency: result.currency, error: result.error }]
    : []);

  if (!prices.length) {
    respond(response, 502, { error: errors.map((entry) => `${entry.currency}: ${entry.error}`).join(" ") });
    return;
  }
  respond(response, 200, {
    prices,
    errors,
    provider: "GoldAPI.io",
    safeGoldSellRateMultiplier,
  });
}
