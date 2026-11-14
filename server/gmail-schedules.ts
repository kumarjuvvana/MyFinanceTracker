import { isAuthenticated, isSameOrigin } from "../src/lib/dataAuth.js";
import {
  cancelGmailSchedule,
  cancelPendingGmailSchedules,
  claimDueGmailSchedules,
  createGmailSchedule,
  disconnectGmailConnection,
  finishGmailSchedule,
  getGmailAccessToken,
  loadGmailConnection,
  loadGmailSchedules,
  revokeGmailRefreshToken,
  sendScheduledGmailMessage,
} from "./gmail-schedule-service.js";

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

function requestBody(request: ApiRequest): unknown {
  if (typeof request.body !== "string") return request.body;
  try {
    return JSON.parse(request.body) as unknown;
  } catch {
    return null;
  }
}

function validEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 320 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateScheduleBody(value: unknown): {
  recipient: string;
  subject: string;
  content: string;
  scheduledFor: string;
  recurrence: "once" | "daily" | "weekly";
} | null {
  if (typeof value !== "object" || value === null ||
    !("recipient" in value) || !validEmail(value.recipient) ||
    !("subject" in value) || typeof value.subject !== "string" ||
    !value.subject.trim() || value.subject.length > 200 || /[\r\n]/.test(value.subject) ||
    !("content" in value) || typeof value.content !== "string" ||
    !value.content.trim() || value.content.length > 10000 ||
    !("scheduledFor" in value) || typeof value.scheduledFor !== "string" ||
    !("recurrence" in value) ||
    (value.recurrence !== "once" && value.recurrence !== "daily" && value.recurrence !== "weekly")) return null;
  const scheduledFor = new Date(value.scheduledFor);
  const now = Date.now();
  if (Number.isNaN(scheduledFor.getTime()) || scheduledFor.getTime() <= now ||
    scheduledFor.getTime() > now + 366 * 24 * 60 * 60 * 1000) return null;
  return {
    recipient: value.recipient,
    subject: value.subject.trim(),
    content: value.content,
    scheduledFor: scheduledFor.toISOString(),
    recurrence: value.recurrence,
  };
}

function cronSecret(request: ApiRequest): "not-cron" | "authorized" | "invalid" | "missing" {
  const authorization = header(request, "authorization");
  if (!authorization.startsWith("Bearer ")) return "not-cron";
  const secret = process.env.CRON_SECRET;
  if (!secret) return "missing";
  return authorization === `Bearer ${secret}` ? "authorized" : "invalid";
}

async function runDueSchedules(response: ApiResponse) {
  const schedules = await claimDueGmailSchedules();
  if (!schedules.length) {
    respond(response, 200, { processed: 0, sent: 0, failed: 0 });
    return;
  }

  let connection;
  let accessToken: string | null = null;
  let connectionError = "";
  try {
    connection = await loadGmailConnection();
    if (!connection) throw new Error("No Gmail sender is connected. Reconnect Gmail to schedule new emails.");
    accessToken = await getGmailAccessToken(connection.refreshToken);
  } catch (caught) {
    connectionError = caught instanceof Error ? caught.message : "Could not authorize Gmail sending.";
  }

  let sent = 0;
  let failed = 0;
  for (const schedule of schedules) {
    try {
      if (connectionError || !accessToken || !connection) {
        throw new Error(connectionError || "Gmail authorization is unavailable.");
      }
      if (schedule.google_email !== connection.email) {
        throw new Error("This schedule belongs to a different Gmail sender. Recreate it using the connected account.");
      }
      await sendScheduledGmailMessage(accessToken, schedule);
      await finishGmailSchedule(schedule.id, "sent");
      sent += 1;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The scheduled email failed.";
      console.error(`Scheduled Gmail email ${schedule.id} failed:`, message);
      try {
        await finishGmailSchedule(schedule.id, "failed", message);
      } catch (finishError) {
        console.error(`Could not record failure for scheduled Gmail email ${schedule.id}:`, finishError);
      }
      failed += 1;
    }
  }
  respond(response, 200, { processed: schedules.length, sent, failed });
}

export default async function gmailSchedulesHandler(request: ApiRequest, response: ApiResponse) {
  const cron = cronSecret(request);
  if (cron === "authorized") {
    if (request.method !== "GET") {
      response.setHeader("Allow", "GET");
      respond(response, 405, { error: "The scheduled email job accepts GET requests only." });
      return;
    }
    try {
      await runDueSchedules(response);
    } catch (caught) {
      console.error("Scheduled Gmail email job failed:", caught);
      respond(response, 500, { error: caught instanceof Error ? caught.message : "The scheduled Gmail email job failed." });
    }
    return;
  }
  if (cron === "invalid") {
    respond(response, 401, { error: "Invalid scheduled-job authorization." });
    return;
  }
  if (cron === "missing") {
    respond(response, 503, { error: "Set CRON_SECRET before enabling scheduled Gmail delivery." });
    return;
  }
  if (!isAuthenticated(request)) {
    respond(response, 401, { error: "Your Daybook session expired. Enter the access password again." });
    return;
  }
  if (request.method !== "GET" && !isSameOrigin(request)) {
    respond(response, 403, { error: "This request must come from the Daybook site." });
    return;
  }

  try {
    if (request.method === "GET") {
      const [connection, schedules] = await Promise.all([loadGmailConnection(), loadGmailSchedules()]);
      respond(response, 200, { connectedEmail: connection?.email ?? null, schedules });
      return;
    }
    if (request.method === "POST") {
      const input = validateScheduleBody(requestBody(request));
      if (!input) {
        respond(response, 400, { error: "Enter a valid recipient, subject, message, recurrence, and future date/time within one year." });
        return;
      }
      const connection = await loadGmailConnection();
      if (!connection) {
        respond(response, 409, { error: "Connect Gmail for scheduled sending before saving an email." });
        return;
      }
      const schedule = await createGmailSchedule({
        ...input,
        googleEmail: connection.email,
      });
      respond(response, 201, { schedule });
      return;
    }
    if (request.method === "DELETE") {
      const url = new URL(request.url ?? "/", `https://${header(request, "host") || "localhost"}`);
      const id = url.searchParams.get("id") ?? "";
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
        respond(response, 400, { error: "Provide a valid scheduled email ID to cancel." });
        return;
      }
      if (!await cancelGmailSchedule(id)) {
        respond(response, 409, { error: "That email is no longer waiting to send and cannot be cancelled." });
        return;
      }
      respond(response, 200, { cancelled: true });
      return;
    }
    if (request.method === "PATCH") {
      const connection = await loadGmailConnection();
      if (connection) {
        await cancelPendingGmailSchedules();
        await revokeGmailRefreshToken(connection.refreshToken);
        await disconnectGmailConnection();
      }
      respond(response, 200, { disconnected: true });
      return;
    }
    response.setHeader("Allow", "GET, POST, PATCH, DELETE");
    respond(response, 405, { error: "Only GET, POST, PATCH, and DELETE requests are supported." });
  } catch (caught) {
    const error = caught instanceof Error ? caught.message : "The Gmail schedule request failed.";
    console.error("Gmail schedule request failed:", caught);
    respond(response, 500, { error });
  }
}
