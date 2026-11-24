import { randomUUID } from "node:crypto";
import {
  loadUnlockedDatabaseConnectionProfile,
} from "./databaseConnections.js";
import type { DatabaseConnectionProfile } from "../src/lib/databaseConnectionProfiles.js";
import { getDocumentFileType, isDocumentStoragePath, MAX_DOCUMENT_FILE_BYTES } from "../src/lib/documentFiles.js";

const REQUIRED_DOCUMENT_MODULES = ["Documents", "Personal Documents", "Account credentials"];
const STORAGE_LIST_PAGE_SIZE = 1000;
const MAX_STORAGE_OBJECTS = 50000;

export interface DocumentStorageCredentials {
  baseUrl: string;
  key: string;
  bucket: string;
}

export interface DocumentStorageUsage {
  bucket: string;
  usedBytes: number;
  objectCount: number;
  largestFiles: { name: string; sizeBytes: number }[];
  capacityBytes: null;
  measuredAt: string;
}

export function getProfileStorageCredentials(profile: DatabaseConnectionProfile): DocumentStorageCredentials | null {
  const { storageUrl, storageServiceRoleKey, storageBucket } = profile;
  if (!storageUrl && !storageServiceRoleKey && !storageBucket) return null;
  if (!storageUrl || !storageServiceRoleKey || !storageBucket) {
    throw new Error("The saved profile has incomplete Supabase Storage settings.");
  }
  return validateStorageCredentials(storageUrl, storageServiceRoleKey, storageBucket);
}

function isAssignedDocumentProfile(profile: DatabaseConnectionProfile): boolean {
  const modules = new Set(profile.modules.map((module) => module.trim().toLocaleLowerCase()));
  return profile.name === "mydocumentsmanager" &&
    REQUIRED_DOCUMENT_MODULES.every((module) => modules.has(module.toLocaleLowerCase()));
}

export function getDocumentStorageCredentials(profile: DatabaseConnectionProfile): DocumentStorageCredentials {
  if (!isAssignedDocumentProfile(profile)) {
    throw new Error("The selected saved profile must be mydocumentsmanager and assigned to all document modules.");
  }
  const storage = getProfileStorageCredentials(profile);
  if (!storage) {
    throw new Error("Configure and verify the mydocumentsmanager Storage project and private bucket in Database connections.");
  }
  return storage;
}

export function validateStorageCredentials(storageUrl: unknown, key: unknown, bucket: unknown): DocumentStorageCredentials {
  if (typeof storageUrl !== "string" || storageUrl.length > 300 ||
    typeof key !== "string" || key.length < 20 || key.length > 4096 ||
    typeof bucket !== "string" || !/^[a-z0-9][a-z0-9_-]{1,61}[a-z0-9]$/.test(bucket)) {
    throw new Error("Enter a valid Supabase project URL, secret or service-role key, and bucket name.");
  }
  let url: URL;
  try {
    url = new URL(storageUrl);
  } catch {
    throw new Error("The Supabase Storage project URL is invalid.");
  }
  if (url.protocol !== "https:" || !/^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname) ||
    url.port || url.username || url.password ||
    (url.pathname !== "/" && !/^\/rest\/v1\/?$/i.test(url.pathname)) || url.search || url.hash) {
    throw new Error("Enter an HTTPS Supabase project URL, optionally ending in /rest/v1.");
  }
  return { baseUrl: url.origin, key, bucket };
}

function storageAuthHeaders(key: string): Record<string, string> {
  return key.startsWith("sb_secret_")
    ? { apikey: key }
    : { apikey: key, Authorization: `Bearer ${key}` };
}

export async function resolveDocumentStorageCredentials(profileId: string, passphrase: string): Promise<DocumentStorageCredentials> {
  const profile = await loadUnlockedDatabaseConnectionProfile(profileId, passphrase);
  return getDocumentStorageCredentials(profile);
}

export async function storageRequest(
  credentials: DocumentStorageCredentials,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(`${credentials.baseUrl}/storage/v1/${path}`, {
    ...init,
    headers: {
      ...storageAuthHeaders(credentials.key),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Supabase Storage request failed (HTTP ${response.status}).`);
  return response;
}

export function encodeStoragePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

export async function requirePrivateBucket(credentials: DocumentStorageCredentials): Promise<void> {
  const response = await storageRequest(credentials, `bucket/${encodeURIComponent(credentials.bucket)}`);
  const bucket: unknown = await response.json();
  if (typeof bucket !== "object" || bucket === null || !("public" in bucket) || bucket.public !== false) {
    throw new Error(`The "${credentials.bucket}" bucket must be private. Update it in Supabase Storage settings.`);
  }
}

async function storageResponseError(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (typeof payload === "object" && payload !== null) {
      if ("message" in payload && typeof payload.message === "string" && payload.message.trim()) {
        return payload.message.trim().slice(0, 300);
      }
      if ("error" in payload && typeof payload.error === "string" && payload.error.trim()) {
        return payload.error.trim().slice(0, 300);
      }
      if ("error_description" in payload && typeof payload.error_description === "string" &&
        payload.error_description.trim()) {
        return payload.error_description.trim().slice(0, 300);
      }
    }
  } catch {
    // Keep the HTTP status when Storage does not return a JSON error.
  }
  return `HTTP ${response.status}`;
}

export async function ensurePrivateBucket(credentials: DocumentStorageCredentials): Promise<void> {
  const bucketUrl = `${credentials.baseUrl}/storage/v1/bucket/${encodeURIComponent(credentials.bucket)}`;
  const headers = storageAuthHeaders(credentials.key);
  const getBucket = async (): Promise<unknown | null> => {
    const response = await fetch(bucketUrl, { headers, cache: "no-store" });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Could not inspect the Supabase Storage bucket: ${await storageResponseError(response)}.`);
    }
    return response.json();
  };

  let bucket = await getBucket();
  if (bucket === null) {
    const response = await fetch(`${credentials.baseUrl}/storage/v1/bucket`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        id: credentials.bucket,
        name: credentials.bucket,
        public: false,
        file_size_limit: MAX_DOCUMENT_FILE_BYTES,
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      bucket = await getBucket();
      if (bucket === null) {
        throw new Error(`Could not create the private Supabase Storage bucket: ${await storageResponseError(response)}.`);
      }
    } else {
      bucket = await getBucket();
    }
  }
  if (typeof bucket !== "object" || bucket === null || !("public" in bucket) || bucket.public !== false) {
    throw new Error(`The "${credentials.bucket}" bucket must be private. Update it in Supabase Storage settings.`);
  }
}

export async function createSignedUpload(credentials: DocumentStorageCredentials, fileName: string, sizeBytes: number) {
  const fileType = getDocumentFileType(fileName);
  if (!fileType || fileName.length > 255 ||
    !Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_DOCUMENT_FILE_BYTES) {
    throw new Error("Choose a supported document or image no larger than 10 MB.");
  }
  await requirePrivateBucket(credentials);
  const path = `documents/${randomUUID()}.${fileType.extension.slice(1)}`;
  const response = await storageRequest(credentials, `object/upload/sign/${encodeStoragePath(credentials.bucket)}/${encodeStoragePath(path)}`, {
    method: "POST",
    body: JSON.stringify({ upsert: false }),
  });
  const result: unknown = await response.json();
  if (typeof result !== "object" || result === null || !("token" in result) || typeof result.token !== "string") {
    throw new Error("Supabase did not return a temporary upload link.");
  }
  const uploadUrl = `${credentials.baseUrl}/storage/v1/object/upload/sign/${encodeStoragePath(credentials.bucket)}/${encodeStoragePath(path)}?token=${encodeURIComponent(result.token)}`;
  return { uploadUrl, storagePath: path, contentType: fileType.contentType };
}

export async function createSignedDocumentUrl(
  credentials: DocumentStorageCredentials,
  storagePath: string,
  downloadName?: string,
): Promise<string> {
  if (!isDocumentStoragePath(storagePath)) throw new Error("The document storage path is invalid.");
  await requirePrivateBucket(credentials);
  const response = await storageRequest(credentials, `object/sign/${encodeStoragePath(credentials.bucket)}/${encodeStoragePath(storagePath)}`, {
    method: "POST",
    body: JSON.stringify({
      expiresIn: 300,
      ...(downloadName ? { download: downloadName } : {}),
    }),
  });
  const result: unknown = await response.json();
  if (typeof result !== "object" || result === null || !("signedURL" in result) || typeof result.signedURL !== "string") {
    throw new Error("Supabase did not return a temporary document link.");
  }
  const signedUrl = new URL(result.signedURL, `${credentials.baseUrl}/storage/v1`);
  if (signedUrl.origin !== credentials.baseUrl) throw new Error("Supabase returned an invalid private document link.");
  return signedUrl.toString();
}

export async function deleteStoredDocument(credentials: DocumentStorageCredentials, storagePath: string): Promise<void> {
  if (!isDocumentStoragePath(storagePath)) throw new Error("The document storage path is invalid.");
  await requirePrivateBucket(credentials);
  await storageRequest(credentials, `object/${encodeURIComponent(credentials.bucket)}`, {
    method: "DELETE",
    body: JSON.stringify([{ name: storagePath }]),
  });
}

export async function measureBucketUsage(credentials: DocumentStorageCredentials): Promise<DocumentStorageUsage> {
  await requirePrivateBucket(credentials);
  const prefixes = [""];
  const seenPrefixes = new Set<string>();
  const largestFiles: DocumentStorageUsage["largestFiles"] = [];
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
      if (requestCount > MAX_STORAGE_OBJECTS) throw new Error(`Storage measurement exceeded the safety limit of ${MAX_STORAGE_OBJECTS} objects.`);
      const response = await storageRequest(credentials, `object/list/${encodeURIComponent(credentials.bucket)}`, {
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
        if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) throw new Error("Supabase returned an invalid document file size.");
        usedBytes += sizeBytes;
        objectCount += 1;
        largestFiles.push({ name: `${prefix}${row.name}`, sizeBytes });
        largestFiles.sort((a, b) => b.sizeBytes - a.sizeBytes);
        if (largestFiles.length > 10) largestFiles.pop();
        if (objectCount > MAX_STORAGE_OBJECTS) throw new Error(`Storage measurement exceeded the safety limit of ${MAX_STORAGE_OBJECTS} objects.`);
      }
      if (entries.length < STORAGE_LIST_PAGE_SIZE) break;
      offset += STORAGE_LIST_PAGE_SIZE;
    }
  }
  return {
    bucket: credentials.bucket,
    usedBytes,
    objectCount,
    largestFiles,
    capacityBytes: null,
    measuredAt: new Date().toISOString(),
  };
}
