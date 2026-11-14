import stockPriceHandler from "../server/stock-price.js";
import mutualFundNavHandler from "../server/mutual-fund-nav.js";
import npsNavHandler from "../server/nps-nav.js";

interface ApiRequest {
  method?: string;
  url?: string;
  body?: unknown;
}

interface ApiResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

function routeFor(request: ApiRequest): string {
  const url = new URL(request.url ?? "/", "http://localhost");
  const configuredRoute = url.searchParams.get("handler");
  if (configuredRoute) return configuredRoute;
  return {
    "/api/stock-price": "stock",
    "/api/mutual-fund-nav": "mutual-fund-nav",
    "/api/nps-nav": "nps-nav",
  }[url.pathname] ?? "";
}

function respondNotFound(response: ApiResponse) {
  response.statusCode = 404;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify({ error: "Unknown market-data API route." }));
}

export default async function marketDataHandler(request: ApiRequest, response: ApiResponse) {
  switch (routeFor(request)) {
    case "stock":
      await stockPriceHandler(request, response);
      return;
    case "mutual-fund-nav":
      await mutualFundNavHandler(request, response);
      return;
    case "nps-nav":
      await npsNavHandler(request, response);
      return;
    default:
      respondNotFound(response);
  }
}
