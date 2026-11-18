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
  priceDate: string;
  updatedAt: string;
}

const TROY_OUNCE_GRAMS = 31.1034768;

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

async function fetchGoldPrice(currency: Currency): Promise<GoldPriceQuote> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`https://api.gold-api.com/price/XAU/${currency}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Gold-API returned HTTP ${response.status}.`);

    const payload: unknown = await response.json();
    if (!isRecord(payload) || payload.symbol !== "XAU" || payload.currency !== currency ||
      typeof payload.price !== "number" || !Number.isFinite(payload.price) || payload.price <= 0 ||
      typeof payload.updatedAt !== "string" || Number.isNaN(Date.parse(payload.updatedAt))) {
      throw new Error("Gold-API returned an invalid 24K gold quote.");
    }

    return {
      currency,
      pricePerGram: payload.price / TROY_OUNCE_GRAMS,
      priceDate: priceDateInIndia(payload.updatedAt),
      updatedAt: payload.updatedAt,
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

  const currencies = [...new Set(requestedCurrencies)] as Currency[];
  const results = await Promise.all(currencies.map(async (currency) => {
    try {
      return { quote: await fetchGoldPrice(currency) };
    } catch (caught) {
      const error = caught instanceof Error && caught.name === "AbortError"
        ? "Gold-API timed out."
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
  respond(response, 200, { prices, errors, provider: "Gold-API.com" });
}
