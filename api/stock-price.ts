interface StockPriceRequest {
  method?: string;
  url?: string;
}

interface StockPriceResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

export interface NormalizedQuote {
  price: number;
  currency: string;
  timestamp: string;
  marketState: string;
  previousClose: number | null;
}

export interface StockPriceQuote extends NormalizedQuote {
  provider: "Yahoo Finance" | "Twelve Data";
}

function respond(response: StockPriceResponse, status: number, body: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

function validQuote(value: unknown): value is NormalizedQuote {
  if (typeof value !== "object" || value === null) return false;
  const quote = value as Record<string, unknown>;
  return typeof quote.price === "number" && Number.isFinite(quote.price) && quote.price > 0 &&
    typeof quote.currency === "string" && /^[A-Z]{3}$/.test(quote.currency) &&
    typeof quote.timestamp === "string" && !Number.isNaN(Date.parse(quote.timestamp)) &&
    typeof quote.marketState === "string" &&
    (quote.previousClose === null || typeof quote.previousClose === "number" && Number.isFinite(quote.previousClose));
}

function providerError(payload: unknown, fallback: string): string {
  if (typeof payload !== "object" || payload === null || !("message" in payload) || typeof payload.message !== "string") {
    return fallback;
  }
  return payload.message.slice(0, 240);
}

async function fetchYahooQuote(symbol: string, exchange: string): Promise<NormalizedQuote> {
  const yahooSymbol = `${symbol}.${exchange === "NSE" ? "NS" : "BO"}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const quoteResponse = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=1d&interval=1m`,
      { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" }, signal: controller.signal },
    );
    if (!quoteResponse.ok) throw new Error(`Yahoo Finance returned HTTP ${quoteResponse.status}.`);

    const payload: unknown = await quoteResponse.json();
    if (typeof payload !== "object" || payload === null || !("chart" in payload) ||
      typeof payload.chart !== "object" || payload.chart === null) {
      throw new Error("Yahoo Finance returned an unexpected response.");
    }
    const chart = payload.chart;
    if (!("result" in chart) || !Array.isArray(chart.result) || chart.result.length === 0) {
      throw new Error(`Yahoo Finance has no quote for ${symbol} on ${exchange}.`);
    }

    const result: unknown = chart.result[0];
    if (typeof result !== "object" || result === null || !("meta" in result) ||
      typeof result.meta !== "object" || result.meta === null) {
      throw new Error("Yahoo Finance returned incomplete quote information.");
    }
    const meta = result.meta;
    if (!("regularMarketPrice" in meta) || typeof meta.regularMarketPrice !== "number" ||
      !Number.isFinite(meta.regularMarketPrice) || meta.regularMarketPrice <= 0) {
      throw new Error(`Yahoo Finance has no current price for ${symbol} on ${exchange}.`);
    }
    return {
      price: meta.regularMarketPrice,
      currency: "currency" in meta && typeof meta.currency === "string" && /^[A-Z]{3}$/.test(meta.currency)
        ? meta.currency
        : "INR",
      timestamp: "regularMarketTime" in meta && typeof meta.regularMarketTime === "number"
        ? new Date(meta.regularMarketTime * 1000).toISOString()
        : new Date().toISOString(),
      marketState: "marketState" in meta && typeof meta.marketState === "string" && meta.marketState.trim()
        ? meta.marketState
        : "STATUS_UNAVAILABLE",
      previousClose: "previousClose" in meta && typeof meta.previousClose === "number" &&
        Number.isFinite(meta.previousClose) ? meta.previousClose : null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchTwelveDataQuote(symbol: string, exchange: string, apiKey: string): Promise<NormalizedQuote> {
  const params = new URLSearchParams({ symbol, exchange, apikey: apiKey });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const quoteResponse = await fetch(`https://api.twelvedata.com/quote?${params.toString()}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const payload: unknown = await quoteResponse.json();
    if (!quoteResponse.ok || typeof payload !== "object" || payload === null ||
      ("status" in payload && payload.status === "error")) {
      throw new Error(providerError(payload, `Twelve Data returned HTTP ${quoteResponse.status}.`));
    }
    const quote = payload as Record<string, unknown>;
    const price = typeof quote.close === "string" || typeof quote.close === "number" ? Number(quote.close) : NaN;
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(providerError(payload, `Twelve Data has no current quote for ${symbol} on ${exchange}.`));
    }
    const quoteDate = typeof quote.datetime === "string" ? quote.datetime : "";
    const parsedDate = Date.parse(quoteDate);
    return {
      price,
      currency: typeof quote.currency === "string" && /^[A-Z]{3}$/.test(quote.currency) ? quote.currency : "INR",
      timestamp: Number.isNaN(parsedDate) ? new Date().toISOString() : new Date(parsedDate).toISOString(),
      marketState: "PROVIDER_QUOTE",
      previousClose: typeof quote.previous_close === "string" || typeof quote.previous_close === "number"
        ? Number.isFinite(Number(quote.previous_close)) ? Number(quote.previous_close) : null
        : null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchStockQuote(symbol: string, exchange: string): Promise<StockPriceQuote> {
  let yahooError = "Yahoo Finance could not provide a quote.";
  try {
    const quote = await fetchYahooQuote(symbol, exchange);
    if (validQuote(quote)) return { ...quote, provider: "Yahoo Finance" };
  } catch (error) {
    yahooError = error instanceof Error && error.name === "AbortError"
      ? "Yahoo Finance timed out."
      : error instanceof Error ? error.message : yahooError;
  }

  const twelveDataApiKey = process.env.TWELVE_DATA_API_KEY?.trim();
  if (!twelveDataApiKey) {
    throw new Error(`${yahooError} Add TWELVE_DATA_API_KEY to enable the Twelve Data fallback, or enter a verified price manually.`);
  }
  try {
    const quote = await fetchTwelveDataQuote(symbol, exchange, twelveDataApiKey);
    if (!validQuote(quote)) throw new Error("Twelve Data returned invalid quote information.");
    return { ...quote, provider: "Twelve Data" };
  } catch (error) {
    const fallbackError = error instanceof Error && error.name === "AbortError"
      ? "Twelve Data timed out."
      : error instanceof Error ? error.message : "Twelve Data could not provide a quote.";
    throw new Error(`${yahooError} Twelve Data fallback: ${fallbackError}`);
  }
}

export default async function stockPriceHandler(request: StockPriceRequest, response: StockPriceResponse) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    respond(response, 405, { error: "Only GET requests are supported." });
    return;
  }

  const url = new URL(request.url ?? "/", "http://localhost");
  const symbol = url.searchParams.get("symbol")?.trim().toUpperCase() ?? "";
  const exchange = url.searchParams.get("exchange") ?? "";
  if (!/^[A-Z0-9][A-Z0-9.&_-]{0,29}$/.test(symbol) || (exchange !== "NSE" && exchange !== "BSE")) {
    respond(response, 400, { error: "Enter a valid NSE or BSE stock symbol." });
    return;
  }

  try {
    const quote = await fetchStockQuote(symbol, exchange);
    respond(response, 200, { symbol, exchange, ...quote });
    return;
  } catch (error) {
    respond(response, 502, { error: error instanceof Error ? error.message : "Could not load a stock quote." });
  }
}
