import gmailOAuthHandler, { gmailOAuthCallbackHandler } from "../server/gmail-oauth.js";
import gmailSchedulesHandler from "../server/gmail-schedules.js";

interface ApiRequest {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface ApiResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

function routeFor(request: ApiRequest): string {
  const host = request.headers.host;
  const hostname = Array.isArray(host) ? host[0] : host;
  const url = new URL(request.url ?? "/", `https://${hostname || "localhost"}`);
  const configuredRoute = url.searchParams.get("handler");
  if (configuredRoute) return configuredRoute;
  return {
    "/api/gmail-oauth": "oauth",
    "/api/gmail-oauth-callback": "callback",
    "/api/gmail-schedules": "schedules",
  }[url.pathname] ?? "";
}

function respondNotFound(response: ApiResponse) {
  response.statusCode = 404;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify({ error: "Unknown Gmail API route." }));
}

export default async function gmailHandler(request: ApiRequest, response: ApiResponse) {
  switch (routeFor(request)) {
    case "oauth":
      await gmailOAuthHandler(request, response);
      return;
    case "callback":
      await gmailOAuthCallbackHandler(request, response);
      return;
    case "schedules":
      await gmailSchedulesHandler(request, response);
      return;
    default:
      respondNotFound(response);
  }
}
