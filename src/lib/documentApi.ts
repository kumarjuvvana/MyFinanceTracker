import { getDocumentFileType } from "./documentFiles";

interface UploadPreparation {
  uploadUrl: string;
  storagePath: string;
  contentType: string;
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
