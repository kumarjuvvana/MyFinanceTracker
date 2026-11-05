import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE = "daybook_session";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 7;

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

function cookieAttributes() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `Path=/api; HttpOnly; SameSite=Strict${secure}; Max-Age=${SESSION_LIFETIME_SECONDS}`;
}

function secret(): string | null {
  const configured = process.env.DATA_ACCESS_PASSWORD;
  return configured && configured.length >= 16 ? configured : null;
}

function isLocalDevelopmentBypass(request: ApiRequest): boolean {
  if (process.env.NODE_ENV === "production" || process.env.LOCAL_AUTH_BYPASS !== "true") return false;
  const host = header(request, "host");
  if (!host) return false;
  try {
    const hostname = new URL(`http://${host}`).hostname.replace(/^\[|\]$/g, "").toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

function sign(expiry: string, key: string): string {
  return createHmac("sha256", key).update(expiry).digest("hex");
}

export function isAuthenticated(request: ApiRequest): boolean {
  if (isLocalDevelopmentBypass(request)) return true;
  const key = secret();
  if (!key) return false;
  const cookies = header(request, "cookie").split(";").map((part) => part.trim());
  const value = cookies.find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  if (!value) return false;
  const [expiry, signature, extra] = value.split(".");
  if (!expiry || !signature || extra !== undefined || !/^\d+$/.test(expiry) ||
    Number(expiry) <= Math.floor(Date.now() / 1000)) return false;
  const expected = Buffer.from(sign(expiry, key), "hex");
  const received = Buffer.from(signature, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function isSameOrigin(request: ApiRequest): boolean {
  const origin = header(request, "origin");
  const host = header(request, "x-forwarded-host").split(",")[0]?.trim() || header(request, "host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function requestBody(request: ApiRequest): unknown {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body) as unknown;
    } catch {
      return null;
    }
  }
  return request.body;
}

export default function dataAuthHandler(request: ApiRequest, response: ApiResponse) {
  const localBypass = isLocalDevelopmentBypass(request);
  const password = secret();
  if (!password && !localBypass) {
    respond(response, 503, { error: "Set DATA_ACCESS_PASSWORD to a strong passphrase of at least 16 characters in Vercel Project Settings." });
    return;
  }
  if (request.method === "GET") {
    if (!localBypass && !isAuthenticated(request)) {
      respond(response, 401, { error: "Enter the Daybook access password to continue." });
      return;
    }
    respond(response, 200, { authenticated: true, ...(localBypass ? { localBypass: true } : {}) });
    return;
  }

  if (request.method === "DELETE") {
    if (!isSameOrigin(request)) {
      respond(response, 403, { error: "This request must come from the Daybook site." });
      return;
    }
    response.statusCode = 204;
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Set-Cookie", `${SESSION_COOKIE}=; ${cookieAttributes().replace(`Max-Age=${SESSION_LIFETIME_SECONDS}`, "Max-Age=0")}`);
    response.end();
    return;
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "GET, POST, DELETE");
    respond(response, 405, { error: "Only GET, POST, and DELETE requests are supported." });
    return;
  }

  if (localBypass) {
    respond(response, 403, { error: "Password sign-in is disabled while the local preview bypass is enabled." });
    return;
  }

  if (!password) {
    respond(response, 503, { error: "Set DATA_ACCESS_PASSWORD to a strong passphrase of at least 16 characters in Vercel Project Settings." });
    return;
  }

  if (!isSameOrigin(request)) {
    respond(response, 403, { error: "This request must come from the Daybook site." });
    return;
  }

  const body = requestBody(request);
  const supplied = typeof body === "object" && body !== null && "password" in body &&
    typeof body.password === "string" ? body.password : "";
  if (supplied.length > 256) {
    respond(response, 400, { error: "The Daybook passphrase must be 256 characters or fewer." });
    return;
  }
  const expectedHash = createHash("sha256").update(password).digest();
  const suppliedHash = createHash("sha256").update(supplied).digest();
  if (!timingSafeEqual(expectedHash, suppliedHash)) {
    respond(response, 401, { error: "That access password is incorrect." });
    return;
  }

  const expiry = String(Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS);
  response.setHeader("Set-Cookie", `${SESSION_COOKIE}=${expiry}.${sign(expiry, password)}; ${cookieAttributes()}`);
  respond(response, 200, { authenticated: true });
}
