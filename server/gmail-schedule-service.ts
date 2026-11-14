import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

export interface GmailEmailSchedule {
  id: string;
  google_email: string;
  recipient: string;
  subject: string;
  content: string;
  scheduled_for: string;
  recurrence: "once" | "daily" | "weekly";
  status: "pending" | "sending" | "sent" | "failed" | "cancelled";
  created_at: string;
  sending_started_at: string | null;
  sent_at: string | null;
  last_error: string | null;
}

function isGmailEmailSchedule(value: unknown): value is GmailEmailSchedule {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" &&
    typeof record.google_email === "string" &&
    typeof record.recipient === "string" &&
    typeof record.subject === "string" &&
    typeof record.content === "string" &&
    typeof record.scheduled_for === "string" && !Number.isNaN(Date.parse(record.scheduled_for)) &&
    (record.recurrence === "once" || record.recurrence === "daily" || record.recurrence === "weekly") &&
    (record.status === "pending" || record.status === "sending" || record.status === "sent" ||
      record.status === "failed" || record.status === "cancelled") &&
    typeof record.created_at === "string" && !Number.isNaN(Date.parse(record.created_at)) &&
    (record.sending_started_at === null || typeof record.sending_started_at === "string") &&
    (record.sent_at === null || typeof record.sent_at === "string") &&
    (record.last_error === null || typeof record.last_error === "string");
}

interface GmailOAuthConnection {
  id: string;
  google_email: string;
  encrypted_refresh_token: string;
}

function credentials(): { baseUrl: string; key: string } {
  const configuredUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!configuredUrl || !key) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to use scheduled Gmail reminders.");
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
    console.error("Scheduled Gmail Supabase request failed:", response.status, body.slice(0, 500));
    throw new Error(`Supabase scheduled email storage failed (HTTP ${response.status}).`);
  }
  return response;
}

function encryptionKey(): Buffer {
  const configured = process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
  if (!configured) {
    throw new Error("Set GMAIL_TOKEN_ENCRYPTION_KEY in Vercel before connecting Gmail for scheduled reminders.");
  }
  const key = Buffer.from(configured, "base64");
  if (key.length !== 32) {
    throw new Error("GMAIL_TOKEN_ENCRYPTION_KEY must be a Base64-encoded 32-byte key.");
  }
  return key;
}

export function validateGmailCryptoConfiguration(): void {
  encryptionKey();
}

export function signGmailOAuthState(value: string): string {
  return createHmac("sha256", encryptionKey()).update(`daybook-gmail-oauth:${value}`).digest("hex");
}

function encryptRefreshToken(refreshToken: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(refreshToken, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

function decryptRefreshToken(value: string): string {
  const [version, iv, tag, encrypted, extra] = value.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted || extra !== undefined) {
    throw new Error("The stored Gmail authorization has an unsupported format.");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Could not decrypt the stored Gmail authorization. Check GMAIL_TOKEN_ENCRYPTION_KEY.");
  }
}

export async function saveGmailConnection(email: string, refreshToken: string): Promise<void> {
  await supabaseRequest("gmail_oauth_connections?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      id: "daybook",
      google_email: email,
      encrypted_refresh_token: encryptRefreshToken(refreshToken),
      updated_at: new Date().toISOString(),
    }),
  });
}

export async function loadGmailConnection(): Promise<{ email: string; refreshToken: string } | null> {
  const response = await supabaseRequest("gmail_oauth_connections?select=id,google_email,encrypted_refresh_token&id=eq.daybook&limit=1");
  const rows: unknown = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = rows[0];
  if (typeof row !== "object" || row === null ||
    !("google_email" in row) || typeof row.google_email !== "string" ||
    !("encrypted_refresh_token" in row) || typeof row.encrypted_refresh_token !== "string") {
    throw new Error("Supabase returned an invalid saved Gmail connection.");
  }
  return { email: row.google_email, refreshToken: decryptRefreshToken(row.encrypted_refresh_token) };
}

export async function disconnectGmailConnection(): Promise<void> {
  await supabaseRequest("gmail_oauth_connections?id=eq.daybook", { method: "DELETE" });
}

export async function cancelPendingGmailSchedules(): Promise<void> {
  await supabaseRequest("gmail_email_schedules?status=eq.pending", {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: "cancelled", last_error: "Sender disconnected." }),
  });
}

export async function revokeGmailRefreshToken(refreshToken: string): Promise<void> {
  const response = await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: refreshToken }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Google could not revoke the Gmail authorization (${response.status}).`);
  }
}

export async function loadGmailSchedules(): Promise<GmailEmailSchedule[]> {
  const response = await supabaseRequest(
    "gmail_email_schedules?select=id,google_email,recipient,subject,content,scheduled_for,recurrence,status,created_at,sending_started_at,sent_at,last_error&order=scheduled_for.desc&limit=100",
  );
  const rows: unknown = await response.json();
  if (!Array.isArray(rows) || !rows.every(isGmailEmailSchedule)) {
    throw new Error("Supabase returned invalid scheduled email records.");
  }
  return rows;
}

export async function createGmailSchedule(input: {
  googleEmail: string;
  recipient: string;
  subject: string;
  content: string;
  scheduledFor: string;
  recurrence: "once" | "daily" | "weekly";
}): Promise<GmailEmailSchedule> {
  const response = await supabaseRequest("gmail_email_schedules?select=id,google_email,recipient,subject,content,scheduled_for,recurrence,status,created_at,sending_started_at,sent_at,last_error", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      google_email: input.googleEmail,
      recipient: input.recipient,
      subject: input.subject,
      content: input.content,
      scheduled_for: input.scheduledFor,
      recurrence: input.recurrence,
    }),
  });
  const rows: unknown = await response.json();
  if (!Array.isArray(rows) || rows.length !== 1 || !isGmailEmailSchedule(rows[0])) {
    throw new Error("Supabase did not confirm the scheduled email.");
  }
  return rows[0];
}

export async function cancelGmailSchedule(id: string): Promise<boolean> {
  const response = await supabaseRequest(`gmail_email_schedules?id=eq.${encodeURIComponent(id)}&status=eq.pending`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status: "cancelled" }),
  });
  const rows: unknown = await response.json();
  return Array.isArray(rows) && rows.length === 1;
}

export async function claimDueGmailSchedules(): Promise<GmailEmailSchedule[]> {
  const response = await supabaseRequest("rpc/claim_due_gmail_email_schedules", {
    method: "POST",
    body: JSON.stringify({ p_now: new Date().toISOString(), p_limit: 5 }),
  });
  const rows: unknown = await response.json();
  if (!Array.isArray(rows) || !rows.every(isGmailEmailSchedule)) {
    throw new Error("Supabase returned invalid due scheduled emails.");
  }
  return rows;
}

export async function finishGmailSchedule(
  id: string,
  status: "sent" | "failed",
  error?: string,
): Promise<void> {
  const response = await supabaseRequest("rpc/complete_gmail_email_schedule", {
    method: "POST",
    body: JSON.stringify({
      p_id: id,
      p_status: status,
      p_error: error ? error.slice(0, 500) : null,
      p_now: new Date().toISOString(),
    }),
  });
  const result: unknown = await response.json();
  if (typeof result !== "number" || result !== 1) {
    throw new Error("Supabase did not confirm the scheduled email status.");
  }
}

export async function getGmailAccessToken(refreshToken: string): Promise<string> {
  const clientId = process.env.VITE_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Set GOOGLE_CLIENT_SECRET and VITE_GOOGLE_CLIENT_ID in Vercel for scheduled Gmail sending.");
  }
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const result: unknown = await response.json();
  if (!response.ok || typeof result !== "object" || result === null ||
    !("access_token" in result) || typeof result.access_token !== "string") {
    const providerError = typeof result === "object" && result !== null && "error_description" in result &&
      typeof result.error_description === "string" ? result.error_description : "Gmail authorization failed.";
    throw new Error(providerError);
  }
  return result.access_token;
}

function encodeSubject(value: string): string {
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

export async function sendScheduledGmailMessage(accessToken: string, schedule: GmailEmailSchedule): Promise<void> {
  const message = [
    `To: ${schedule.recipient}`,
    `Subject: ${encodeSubject(schedule.subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    schedule.content,
  ].join("\r\n");
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: Buffer.from(message, "utf8").toString("base64url") }),
    cache: "no-store",
  });
  if (!response.ok) {
    const result: unknown = await response.json().catch(() => null);
    const detail = typeof result === "object" && result !== null && "error" in result &&
      typeof result.error === "object" && result.error !== null && "message" in result.error &&
      typeof result.error.message === "string" ? result.error.message : response.statusText;
    throw new Error(`Gmail rejected the scheduled email (${response.status}): ${detail}`);
  }
}
