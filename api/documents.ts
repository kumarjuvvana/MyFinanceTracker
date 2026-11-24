import { randomUUID } from "node:crypto";
import { isAuthenticated, isSameOrigin } from "../src/lib/dataAuth.js";
import { getDocumentFileType, isDocumentStoragePath, MAX_DOCUMENT_FILE_BYTES } from "../src/lib/documentFiles.js";
import {
  createSignedDocumentUrl,
  createSignedUpload,
  deleteStoredDocument,
  ensurePrivateBucket,
  measureBucketUsage,
  resolveDocumentStorageCredentials,
  validateStorageCredentials,
} from "../server/documentStorage.js";

const BUCKET = "daybook-documents";
const STORAGE_LIST_PAGE_SIZE = 1000;
const MAX_STORAGE_OBJECTS = 50000;

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

interface SupabaseCredentials {
  baseUrl: string;
  key: string;
}

function respond(response: ApiResponse, status: number, body: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.end(JSON.stringify(body));
}

function bodyOf(request: ApiRequest): unknown {
  if (typeof request.body !== "string") return request.body;
  try {
    return JSON.parse(request.body) as unknown;
  } catch {
    return null;
  }
}

function credentials(): SupabaseCredentials {
  const configuredUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!configuredUrl || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the server environment to enable document storage.");
  let url: URL;
  try {
    url = new URL(configuredUrl);
  } catch {
    throw new Error("SUPABASE_URL must be a valid Supabase project URL.");
  }
  if ((url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") ||
    url.pathname !== "/" || url.search || url.hash) {
    throw new Error("SUPABASE_URL must be the HTTPS origin of your Supabase project.");
  }
  return { baseUrl: url.origin, key };
}

async function storageRequest(path: string, init?: RequestInit): Promise<Response> {
  const { baseUrl, key } = credentials();
  const response = await fetch(`${baseUrl}/storage/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    let message = `Supabase document storage failed (HTTP ${response.status}).`;
    try {
      const payload: unknown = await response.json();
      if (typeof payload === "object" && payload !== null && "message" in payload &&
        typeof payload.message === "string" && payload.message.trim()) message = payload.message;
      else if (typeof payload === "object" && payload !== null && "error" in payload &&
        typeof payload.error === "string" && payload.error.trim()) message = payload.error;
    } catch {
      // Keep the HTTP status when Storage does not return a JSON error.
    }
    throw new Error(message);
  }
  return response;
}

function encodedPath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function respondWithSignedRedirect(response: ApiResponse, signedPath: string, baseUrl: string) {
  const location = /^https?:\/\//i.test(signedPath)
    ? signedPath
    : `${baseUrl}/storage/v1${signedPath.startsWith("/") ? signedPath : `/${signedPath}`}`;
  response.statusCode = 302;
  response.setHeader("Location", location);
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end();
}

async function getBucketUsage() {
  const prefixes = [""];
  const seenPrefixes = new Set<string>();
  const largestFiles: { name: string; sizeBytes: number }[] = [];
  let usedBytes = 0;
  let objectCount = 0;
  let requestCount = 0;

  while (prefixes.length) {
    const prefix = prefixes.shift();
    if (prefix === undefined || seenPrefixes.has(prefix)) continue;
    seenPrefixes.add(prefix);
    let offset = 0;
    while (true) {
      requestCount += 1;
      if (requestCount > MAX_STORAGE_OBJECTS) {
        throw new Error(`Storage usage measurement exceeded the safety limit of ${MAX_STORAGE_OBJECTS} objects.`);
      }
      const response = await storageRequest(`object/list/${BUCKET}`, {
        method: "POST",
        body: JSON.stringify({ prefix, limit: STORAGE_LIST_PAGE_SIZE, offset }),
      });
      const entries: unknown = await response.json();
      if (!Array.isArray(entries)) throw new Error("Supabase returned an invalid storage object listing.");
      for (const entry of entries) {
        if (typeof entry !== "object" || entry === null || !("name" in entry) ||
          typeof entry.name !== "string" || !entry.name || entry.name === "." || entry.name === "..") {
          throw new Error("Supabase returned an invalid storage object entry.");
        }
        const row = entry as { name: string; id?: unknown; metadata?: unknown };
        if (row.id === null || !row.metadata || typeof row.metadata !== "object") {
          prefixes.push(`${prefix}${row.name}/`);
          continue;
        }
        const metadata = row.metadata as { size?: unknown };
        const sizeBytes = typeof metadata.size === "number" ? metadata.size : Number(metadata.size);
        if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) {
          throw new Error("Supabase returned an invalid document storage file size.");
        }
        usedBytes += sizeBytes;
        objectCount += 1;
        largestFiles.push({ name: `${prefix}${row.name}`, sizeBytes });
        largestFiles.sort((a, b) => b.sizeBytes - a.sizeBytes);
        if (largestFiles.length > 10) largestFiles.pop();
        if (objectCount > MAX_STORAGE_OBJECTS) {
          throw new Error(`Storage usage measurement exceeded the safety limit of ${MAX_STORAGE_OBJECTS} objects.`);
        }
      }
      if (entries.length < STORAGE_LIST_PAGE_SIZE) break;
      offset += STORAGE_LIST_PAGE_SIZE;
    }
  }
  return {
    bucket: BUCKET,
    usedBytes,
    objectCount,
    largestFiles,
    capacityBytes: null,
    measuredAt: new Date().toISOString(),
  };
}

function safeDownloadName(value: unknown): string | null {
  if (typeof value !== "string" || value.length < 1 || value.length > 255 ||
    /[\u0000-\u001f\u007f/\\]/.test(value) || value === "." || value === "..") return null;
  return value;
}

function validProfileStorageRequest(body: Record<string, unknown>): body is Record<string, unknown> & {
  profileId: string;
  passphrase: string;
} {
  return typeof body.profileId === "string" && body.profileId.length > 0 && body.profileId.length <= 100 &&
    typeof body.passphrase === "string" && body.passphrase.length >= 16 && body.passphrase.length <= 256;
}

async function handleProfileStorageRequest(body: Record<string, unknown>, response: ApiResponse): Promise<boolean> {
  if (body.action === "test-profile-storage") {
    const storage = validateStorageCredentials(body.storageUrl, body.serviceRoleKey, body.bucket);
    await ensurePrivateBucket(storage);
    respond(response, 200, { verified: true, bucket: storage.bucket });
    return true;
  }
  if (body.action !== "profile-upload" && body.action !== "profile-signed-url" &&
    body.action !== "profile-delete" && body.action !== "profile-storage-usage") return false;
  if (!validProfileStorageRequest(body)) {
    respond(response, 400, { error: "Unlock the assigned mydocumentsmanager profile to use its private Storage." });
    return true;
  }
  const storage = await resolveDocumentStorageCredentials(body.profileId, body.passphrase);
  if (body.action === "profile-upload") {
    const fileName = typeof body.fileName === "string" ? body.fileName : "";
    const sizeBytes = typeof body.sizeBytes === "number" ? body.sizeBytes : NaN;
    respond(response, 200, await createSignedUpload(storage, fileName, sizeBytes));
    return true;
  }
  if (body.action === "profile-signed-url") {
    const storagePath = typeof body.storagePath === "string" ? body.storagePath : "";
    const downloadName = body.downloadName === undefined ? undefined : safeDownloadName(body.downloadName);
    if (body.downloadName !== undefined && !downloadName) {
      respond(response, 400, { error: "The document download name is invalid." });
      return true;
    }
    respond(response, 200, {
      signedUrl: await createSignedDocumentUrl(storage, storagePath, downloadName ?? undefined),
    });
    return true;
  }
  if (body.action === "profile-delete") {
    const storagePath = typeof body.storagePath === "string" ? body.storagePath : "";
    await deleteStoredDocument(storage, storagePath);
    respond(response, 200, { deleted: true });
    return true;
  }
  respond(response, 200, { ...await measureBucketUsage(storage) });
  return true;
}

export default async function documentsHandler(request: ApiRequest, response: ApiResponse) {
  if (!isAuthenticated(request)) {
    respond(response, 401, { error: "Your Daybook session expired. Enter the access password again." });
    return;
  }

  try {
    if (request.method === "GET") {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (url.searchParams.get("resource") === "storage-usage") {
        respond(response, 200, await getBucketUsage());
        return;
      }
      const path = url.searchParams.get("path") ?? "";
      const isDownload = url.searchParams.get("download") === "1";
      const downloadName = isDownload ? safeDownloadName(url.searchParams.get("name")) : null;
      if (!isDocumentStoragePath(path) || (isDownload && !downloadName)) {
        respond(response, 400, { error: "The document link is invalid." });
        return;
      }

      const { baseUrl } = credentials();
      const signedResponse = await storageRequest(`object/sign/${BUCKET}/${encodedPath(path)}`, {
        method: "POST",
        body: JSON.stringify({ expiresIn: 60 }),
      });
      const result: unknown = await signedResponse.json();
      if (typeof result !== "object" || result === null || !("signedURL" in result) || typeof result.signedURL !== "string") {
        throw new Error("Supabase did not return a temporary document link.");
      }
      const signedPath = downloadName
        ? `${result.signedURL}${result.signedURL.includes("?") ? "&" : "?"}download=${encodeURIComponent(downloadName)}`
        : result.signedURL;
      respondWithSignedRedirect(response, signedPath, baseUrl);
      return;
    }

    if (request.method !== "POST") {
      response.setHeader("Allow", "GET, POST");
      respond(response, 405, { error: "Only GET and POST requests are supported." });
      return;
    }
    if (!isSameOrigin(request)) {
      respond(response, 403, { error: "This request must come from the Daybook site." });
      return;
    }

    const body = bodyOf(request);
    if (typeof body !== "object" || body === null || !("action" in body) || typeof body.action !== "string") {
      respond(response, 400, { error: "Choose a valid document operation." });
      return;
    }
    if (await handleProfileStorageRequest(body, response)) return;

    if (body.action === "upload") {
      const fileName = "fileName" in body && typeof body.fileName === "string" ? body.fileName : "";
      const fileType = getDocumentFileType(fileName);
      const sizeBytes = "sizeBytes" in body && typeof body.sizeBytes === "number" ? body.sizeBytes : NaN;
      if (!fileType || fileName.length > 255 ||
        !Number.isInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_DOCUMENT_FILE_BYTES) {
        respond(response, 400, { error: "Choose a supported document or image no larger than 10 MB." });
        return;
      }

      const path = `documents/${randomUUID()}.${fileType.extension.slice(1)}`;
      const uploadResponse = await storageRequest(`object/upload/sign/${BUCKET}/${encodedPath(path)}`, {
        method: "POST",
        body: JSON.stringify({ upsert: false }),
      });
      const result: unknown = await uploadResponse.json();
      if (typeof result !== "object" || result === null || !("token" in result) || typeof result.token !== "string") {
        throw new Error("Supabase did not return a temporary upload token.");
      }
      const { baseUrl } = credentials();
      const uploadUrl = `${baseUrl}/storage/v1/object/upload/sign/${BUCKET}/${encodedPath(path)}?token=${encodeURIComponent(result.token)}`;
      respond(response, 200, { uploadUrl, storagePath: path, contentType: fileType.contentType });
      return;
    }

    if (body.action === "delete") {
      const path = "storagePath" in body && typeof body.storagePath === "string" ? body.storagePath : "";
      if (!isDocumentStoragePath(path)) {
        respond(response, 400, { error: "The document storage path is invalid." });
        return;
      }
      await storageRequest(`object/${BUCKET}`, {
        method: "DELETE",
        body: JSON.stringify([{ name: path }]),
      });
      respond(response, 200, { deleted: true });
      return;
    }

    respond(response, 400, { error: "Choose a valid document operation." });
  } catch (caught) {
    const error = caught instanceof Error ? caught : new Error("Could not complete the document storage request.");
    console.error("Daybook document API failed:", error);
    const status = error.message.startsWith("Set SUPABASE_") ? 503 : 500;
    respond(response, status, { error: error.message || "Could not complete the document storage request." });
  }
}
