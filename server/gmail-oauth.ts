import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { isAuthenticated, isSameOrigin } from "../src/lib/dataAuth.js";
import { saveGmailConnection, signGmailOAuthState, validateGmailCryptoConfiguration } from "./gmail-schedule-service.js";

interface ApiRequest {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
}

interface ApiResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

const STATE_COOKIE = "daybook_gmail_oauth";
const STATE_LIFETIME_SECONDS = 600;
const SEND_SCOPE = "openid email https://www.googleapis.com/auth/gmail.send";

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

function redirectUri(): string {
  const value = process.env.GMAIL_OAUTH_REDIRECT_URI;
  if (!value) throw new Error("Set GMAIL_OAUTH_REDIRECT_URI in Vercel and Google Cloud.");
  const url = new URL(value);
  if (url.pathname !== "/api/gmail-oauth-callback" || url.search || url.hash ||
    (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("GMAIL_OAUTH_REDIRECT_URI must point to /api/gmail-oauth-callback over HTTPS.");
  }
  return url.toString();
}

function cookie(value: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${STATE_COOKIE}=${value}; Path=/api; HttpOnly; SameSite=Lax${secure}; Max-Age=${maxAge}`;
}

function readCookie(request: ApiRequest): string {
  return header(request, "cookie").split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${STATE_COOKIE}=`))?.slice(STATE_COOKIE.length + 1) ?? "";
}

function safeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function oauthResultPage(response: ApiResponse, success: boolean, message: string, origin: string) {
  const payload = JSON.stringify({ type: "daybook-gmail-oauth", success, message }).replace(/</g, "\\u003c");
  const returnUrl = new URL("/", origin);
  returnUrl.searchParams.set("page", "R&D / Test Connectors");
  returnUrl.searchParams.set("gmailOAuth", success ? "connected" : "failed");
  const fallbackUrl = JSON.stringify(returnUrl.toString()).replace(/</g, "\\u003c");
  response.statusCode = success ? 200 : 400;
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'unsafe-inline'; frame-ancestors 'none'");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Set-Cookie", cookie("", 0));
  response.end(`<!doctype html><meta charset="utf-8"><title>Daybook Gmail authorization</title><p>${success ? "Gmail sending access connected. You can close this window." : "Gmail connection could not be completed. Return to Daybook and try again."}</p><script>if(window.opener){window.opener.postMessage(${payload},${JSON.stringify(origin)});window.close()}else{window.location.replace(${fallbackUrl})}</script>`);
}

function authorizeStart(request: ApiRequest, response: ApiResponse) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    respond(response, 405, { error: "Use POST to start Gmail authorization." });
    return;
  }
  if (!isAuthenticated(request)) {
    respond(response, 401, { error: "Sign in to Daybook before connecting scheduled Gmail sending." });
    return;
  }
  if (!isSameOrigin(request)) {
    respond(response, 403, { error: "This request must come from the Daybook site." });
    return;
  }
  try {
    const clientId = process.env.VITE_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("Set VITE_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel before connecting scheduled Gmail sending.");
    }
    validateGmailCryptoConfiguration();
    const redirect = redirectUri();
    const stateNonce = randomBytes(32).toString("base64url");
    const verifier = randomBytes(48).toString("base64url");
    const state = `${stateNonce}.${signGmailOAuthState(stateNonce)}`;
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorization.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirect,
      response_type: "code",
      scope: SEND_SCOPE,
      access_type: "offline",
      prompt: "consent select_account",
      include_granted_scopes: "false",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    }).toString();
    response.setHeader("Set-Cookie", cookie(`${stateNonce}.${verifier}`, STATE_LIFETIME_SECONDS));
    respond(response, 200, { authorizationUrl: authorization.toString() });
  } catch (caught) {
    respond(response, 503, { error: caught instanceof Error ? caught.message : "Could not start Gmail authorization." });
  }
}

async function authorizeCallback(request: ApiRequest, response: ApiResponse) {
  let origin = "https://myfinance-tracker-lac.vercel.app";
  let redirect: string;
  try {
    redirect = redirectUri();
    origin = new URL(redirect).origin;
  } catch (caught) {
    oauthResultPage(response, false, "OAuth callback is not configured.", origin);
    return;
  }
  if (request.method !== "GET") {
    oauthResultPage(response, false, "The Gmail authorization callback used an unsupported request.", origin);
    return;
  }
  const url = new URL(request.url ?? "/", `https://${header(request, "host") || "localhost"}`);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  const callbackError = url.searchParams.get("error");
  if (callbackError) {
    oauthResultPage(response, false, "Gmail authorization was cancelled or denied.", origin);
    return;
  }
  const cookieParts = readCookie(request).split(".");
  const [cookieNonce, verifier, extra] = cookieParts;
  const [stateNonce, signature, stateExtra] = state.split(".");
  if (!code || !cookieNonce || !verifier || extra !== undefined || !stateNonce || !signature ||
    stateExtra !== undefined || !safeEqual(cookieNonce, stateNonce) ||
    !safeEqual(signature, signGmailOAuthState(stateNonce))) {
    oauthResultPage(response, false, "The Gmail authorization state was invalid or expired.", origin);
    return;
  }
  try {
    const clientId = process.env.VITE_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error("Google OAuth server settings are incomplete.");
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirect,
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
      cache: "no-store",
    });
    const tokenPayload: unknown = await tokenResponse.json();
    if (!tokenResponse.ok || typeof tokenPayload !== "object" || tokenPayload === null ||
      !("access_token" in tokenPayload) || typeof tokenPayload.access_token !== "string" ||
      !("refresh_token" in tokenPayload) || typeof tokenPayload.refresh_token !== "string") {
      throw new Error("Google did not return a reusable Gmail authorization. Reconnect and approve the requested send permission.");
    }
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
      cache: "no-store",
    });
    const profile: unknown = await profileResponse.json();
    if (!profileResponse.ok || typeof profile !== "object" || profile === null ||
      !("email" in profile) || typeof profile.email !== "string" ||
      !("email_verified" in profile) || profile.email_verified !== true) {
      throw new Error("Google did not provide a verified Gmail address.");
    }
    await saveGmailConnection(profile.email, tokenPayload.refresh_token);
    oauthResultPage(response, true, "Gmail sending access connected.", origin);
  } catch (caught) {
    console.error("Scheduled Gmail OAuth callback failed:", caught);
    oauthResultPage(response, false, caught instanceof Error ? caught.message : "Could not save Gmail authorization.", origin);
  }
}

export async function gmailOAuthCallbackHandler(request: ApiRequest, response: ApiResponse) {
  await authorizeCallback(request, response);
}

export default async function gmailOAuthHandler(request: ApiRequest, response: ApiResponse) {
  if (!isSameOrigin(request) && request.method !== "GET") {
    respond(response, 403, { error: "This request must come from the Daybook site." });
    return;
  }
  authorizeStart(request, response);
}
