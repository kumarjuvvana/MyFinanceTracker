import { getDocumentFileType, MAX_DOCUMENT_FILE_BYTES } from "./documentFiles";

export interface UploadPreparation {
  uploadUrl: string;
  storagePath: string;
  contentType: string;
}

export interface DocumentStorageUsage {
  bucket: string;
  usedBytes: number;
  objectCount: number;
  largestFiles: { name: string; sizeBytes: number }[];
  capacityBytes: number | null;
  measuredAt: string;
}

export interface ProfileStorageUsage extends DocumentStorageUsage {
  profileId: string;
  profileName: string;
  databaseBytes: number | null;
  databaseError: string;
  storageError: string;
}

interface ProfileStorageCredentials {
  profileId: string;
  passphrase: string;
}

async function profileStorageRequest(body: Record<string, unknown>): Promise<unknown> {
  const response = await fetch("/api/documents", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : `Document storage request failed (${response.status}).`;
    throw new Error(message);
  }
  return payload;
}

async function uploadToSignedUrl(file: File, upload: UploadPreparation): Promise<UploadPreparation> {
  const typedFile = new File([file], file.name, { type: upload.contentType, lastModified: file.lastModified });
  const form = new FormData();
  form.append("cacheControl", "3600");
  form.append("", typedFile);
  const response = await fetch(upload.uploadUrl, {
    method: "PUT",
    headers: { "x-upsert": "false" },
    body: form,
    cache: "no-store",
  });
  if (!response.ok) {
    let detail = "";
    try {
      const payload: unknown = await response.json();
      if (typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string") detail = payload.message;
    } catch {
      detail = response.statusText;
    }
    throw new Error(`The document could not be uploaded (${response.status}).${detail ? ` ${detail}` : ""}`);
  }
  return upload;
}

export async function loadDocumentStorageUsage(): Promise<DocumentStorageUsage> {
  const response = await fetch("/api/documents?resource=storage-usage", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : `Could not load actual storage usage (${response.status}).`;
    throw new Error(message);
  }
  if (typeof payload !== "object" || payload === null || !("bucket" in payload) ||
    typeof payload.bucket !== "string" || !("usedBytes" in payload) || typeof payload.usedBytes !== "number" ||
    !Number.isSafeInteger(payload.usedBytes) || !("objectCount" in payload) || typeof payload.objectCount !== "number" ||
    !Number.isSafeInteger(payload.objectCount) || !("largestFiles" in payload) || !Array.isArray(payload.largestFiles) ||
    !payload.largestFiles.every((file) => typeof file === "object" && file !== null &&
      "name" in file && typeof file.name === "string" && "sizeBytes" in file &&
      typeof file.sizeBytes === "number" && Number.isSafeInteger(file.sizeBytes)) ||
    !("capacityBytes" in payload) || (payload.capacityBytes !== null &&
      (typeof payload.capacityBytes !== "number" || !Number.isSafeInteger(payload.capacityBytes))) ||
    !("measuredAt" in payload) || typeof payload.measuredAt !== "string") {
    throw new Error("The server returned an invalid storage usage report.");
  }
  return {
    bucket: payload.bucket,
    usedBytes: payload.usedBytes,
    objectCount: payload.objectCount,
    largestFiles: payload.largestFiles.map((file) => ({
      name: file.name,
      sizeBytes: file.sizeBytes,
    })),
    capacityBytes: payload.capacityBytes,
    measuredAt: payload.measuredAt,
  };
}

async function requestUpload(file: File): Promise<UploadPreparation> {
  const response = await fetch("/api/documents", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ action: "upload", fileName: file.name, sizeBytes: file.size }),
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : `Could not prepare document upload (${response.status}).`;
    throw new Error(message);
  }
  if (typeof payload !== "object" || payload === null || !("uploadUrl" in payload) ||
    typeof payload.uploadUrl !== "string" || !("storagePath" in payload) ||
    typeof payload.storagePath !== "string" || !("contentType" in payload) || typeof payload.contentType !== "string") {
    throw new Error("The server returned an invalid document upload link.");
  }
  return { uploadUrl: payload.uploadUrl, storagePath: payload.storagePath, contentType: payload.contentType };
}

export async function uploadDocumentFile(file: File): Promise<UploadPreparation> {
  if (!getDocumentFileType(file.name)) {
    throw new Error("Choose a PDF, image, text, spreadsheet, presentation, or Word document.");
  }
  const upload = await requestUpload(file);
  return uploadToSignedUrl(file, upload);
}

export async function deleteDocumentFile(storagePath: string): Promise<void> {
  const response = await fetch("/api/documents", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", storagePath }),
  });
  if (!response.ok) {
    let message = `Could not delete the document file (${response.status}).`;
    try {
      const payload: unknown = await response.json();
      if (typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string") message = payload.error;
    } catch {
      // Keep the HTTP status when the server does not return JSON.
    }
    throw new Error(message);
  }
}

export async function testProfileDocumentStorage(storageUrl: string, serviceRoleKey: string, bucket: string): Promise<void> {
  await profileStorageRequest({ action: "test-profile-storage", storageUrl, serviceRoleKey, bucket });
}

export async function uploadProfileDocumentFile(
  file: File,
  credentials: ProfileStorageCredentials,
): Promise<UploadPreparation> {
  if (!getDocumentFileType(file.name)) {
    throw new Error("Choose a PDF, image, text, spreadsheet, presentation, or Word document.");
  }
  if (file.size <= 0 || file.size > MAX_DOCUMENT_FILE_BYTES) {
    throw new Error("Choose a file larger than 0 bytes and no larger than 13 MB.");
  }
  const payload = await profileStorageRequest({
    action: "profile-upload",
    ...credentials,
    fileName: file.name,
    sizeBytes: file.size,
  });
  if (typeof payload !== "object" || payload === null || !("uploadUrl" in payload) ||
    typeof payload.uploadUrl !== "string" || !("storagePath" in payload) ||
    typeof payload.storagePath !== "string" || !("contentType" in payload) || typeof payload.contentType !== "string") {
    throw new Error("The new database returned an invalid document upload link.");
  }
  return uploadToSignedUrl(file, {
    uploadUrl: payload.uploadUrl,
    storagePath: payload.storagePath,
    contentType: payload.contentType,
  });
}

export async function createProfileDocumentSignedUrl(
  credentials: ProfileStorageCredentials,
  storagePath: string,
  downloadName?: string,
): Promise<string> {
  const payload = await profileStorageRequest({
    action: "profile-signed-url",
    ...credentials,
    storagePath,
    ...(downloadName ? { downloadName } : {}),
  });
  if (typeof payload !== "object" || payload === null || !("signedUrl" in payload) || typeof payload.signedUrl !== "string") {
    throw new Error("The new database returned an invalid private document link.");
  }
  return payload.signedUrl;
}

export async function deleteProfileDocumentFile(
  credentials: ProfileStorageCredentials,
  storagePath: string,
): Promise<void> {
  await profileStorageRequest({ action: "profile-delete", ...credentials, storagePath });
}

export async function loadProfileDocumentStorageUsage(
  credentials: ProfileStorageCredentials,
): Promise<DocumentStorageUsage> {
  const payload = await profileStorageRequest({ action: "profile-storage-usage", ...credentials });
  if (typeof payload !== "object" || payload === null || !("bucket" in payload) ||
    typeof payload.bucket !== "string" || !("usedBytes" in payload) || typeof payload.usedBytes !== "number" ||
    !Number.isSafeInteger(payload.usedBytes) || !("objectCount" in payload) || typeof payload.objectCount !== "number" ||
    !Number.isSafeInteger(payload.objectCount) || !("largestFiles" in payload) || !Array.isArray(payload.largestFiles) ||
    !payload.largestFiles.every((file) => typeof file === "object" && file !== null &&
      "name" in file && typeof file.name === "string" && "sizeBytes" in file &&
      typeof file.sizeBytes === "number" && Number.isSafeInteger(file.sizeBytes)) ||
    !("capacityBytes" in payload) || (payload.capacityBytes !== null &&
      (typeof payload.capacityBytes !== "number" || !Number.isSafeInteger(payload.capacityBytes))) ||
    !("measuredAt" in payload) || typeof payload.measuredAt !== "string") {
    throw new Error("The new database returned an invalid storage usage report.");
  }
  return {
    bucket: payload.bucket,
    usedBytes: payload.usedBytes,
    objectCount: payload.objectCount,
    largestFiles: payload.largestFiles.map((file) => ({ name: file.name, sizeBytes: file.sizeBytes })),
    capacityBytes: payload.capacityBytes,
    measuredAt: payload.measuredAt,
  };
}
