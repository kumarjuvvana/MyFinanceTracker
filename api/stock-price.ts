interface StockPriceRequest {
  method?: string;
  url?: string;
}

interface StockPriceResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

function respond(response: StockPriceResponse, status: number, body: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
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

  const yahooSymbol = `${symbol}.${exchange === "NSE" ? "NS" : "BO"}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const quoteResponse = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=1d&interval=1m`,
      { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" }, signal: controller.signal },
    );
    if (!quoteResponse.ok) {
      respond(response, 502, { error: `Market data provider returned HTTP ${quoteResponse.status}. Try refreshing later.` });
      return;
    }

    const payload: unknown = await quoteResponse.json();
    if (typeof payload !== "object" || payload === null || !("chart" in payload) ||
      typeof payload.chart !== "object" || payload.chart === null) {
      respond(response, 502, { error: "The market data provider returned an unexpected response." });
      return;
    }
    const chart = payload.chart;
    if (!("result" in chart) || !Array.isArray(chart.result) || chart.result.length === 0) {
      respond(response, 404, { error: `No quote was found for ${symbol} on ${exchange}. Check the stock code and exchange.` });
      return;
    }

    const result: unknown = chart.result[0];
    if (typeof result !== "object" || result === null || !("meta" in result) ||
      typeof result.meta !== "object" || result.meta === null) {
      respond(response, 502, { error: "The market data provider returned incomplete quote information." });
      return;
    }
    const meta = result.meta;
    if (!("regularMarketPrice" in meta) || typeof meta.regularMarketPrice !== "number" ||
      !Number.isFinite(meta.regularMarketPrice) || meta.regularMarketPrice < 0) {
      respond(response, 404, { error: `A current price is not available for ${symbol} on ${exchange}.` });
      return;
    }
    const quoteTime = "regularMarketTime" in meta && typeof meta.regularMarketTime === "number"
      ? new Date(meta.regularMarketTime * 1000).toISOString()
      : new Date().toISOString();
    respond(response, 200, {
      symbol,
      exchange,
      price: meta.regularMarketPrice,
      currency: "currency" in meta && typeof meta.currency === "string" ? meta.currency : "INR",
      timestamp: quoteTime,
      marketState: "marketState" in meta && typeof meta.marketState === "string" ? meta.marketState : "UNKNOWN",
      previousClose: "previousClose" in meta && typeof meta.previousClose === "number" &&
        Number.isFinite(meta.previousClose) ? meta.previousClose : null,
    });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "The market data request timed out. Try again."
      : "Could not reach the market data provider. Check your connection and try again.";
    respond(response, 502, { error: message });
  } finally {
    clearTimeout(timeout);
  }
}
