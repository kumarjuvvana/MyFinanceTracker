import type { DocumentAttachment, DocumentFileAttachment } from "../types";

export const MAX_DOCUMENT_FILE_BYTES = 13 * 1024 * 1024;
export const MAX_DOCUMENT_ATTACHMENTS = 100;
export const DOCUMENT_FILE_TYPES = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".txt": "text/plain",
  ".text": "text/plain",
  ".csv": "text/csv",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".rtf": "application/rtf",
} as const;

export type DocumentFileExtension = keyof typeof DOCUMENT_FILE_TYPES;

export function getDocumentAttachments(document: Pick<DocumentAttachment,
  "attachments" | "fileName" | "contentType" | "sizeBytes" | "storagePath" | "contentHash">): DocumentFileAttachment[] {
  if (document.attachments?.length) return document.attachments;
  if (!document.storagePath) return [];
  return [{
    id: document.storagePath,
    fileName: document.fileName,
    contentType: document.contentType,
    sizeBytes: document.sizeBytes,
    storagePath: document.storagePath,
    ...(document.contentHash ? { contentHash: document.contentHash } : {}),
  }];
}

export function isDocumentFileAttachment(value: unknown): value is DocumentFileAttachment {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const file = value as Record<string, unknown>;
  const fileType = typeof file.fileName === "string" ? getDocumentFileType(file.fileName) : null;
  return typeof file.id === "string" && file.id.length > 0 && file.id.length <= 200 &&
    typeof file.fileName === "string" && file.fileName.length > 0 && file.fileName.length <= 255 &&
    Boolean(fileType) && typeof file.contentType === "string" && fileType?.contentType === file.contentType &&
    typeof file.sizeBytes === "number" && Number.isSafeInteger(file.sizeBytes) &&
    file.sizeBytes > 0 && file.sizeBytes <= MAX_DOCUMENT_FILE_BYTES &&
    typeof file.storagePath === "string" && isDocumentStoragePath(file.storagePath) &&
    (file.contentHash === undefined || typeof file.contentHash === "string" && /^[0-9a-f]{64}$/i.test(file.contentHash));
}

export function getDocumentFileType(fileName: string): { extension: DocumentFileExtension; contentType: string } | null {
  const extension = `.${fileName.split(".").pop()?.toLocaleLowerCase() ?? ""}` as DocumentFileExtension;
  const contentType = DOCUMENT_FILE_TYPES[extension];
  return contentType ? { extension, contentType } : null;
}

export function canPreviewDocumentContentType(contentType: string): boolean {
  return contentType === DOCUMENT_FILE_TYPES[".pdf"] ||
    contentType.startsWith("image/") ||
    contentType === DOCUMENT_FILE_TYPES[".docx"] ||
    contentType === DOCUMENT_FILE_TYPES[".xlsx"];
}

export function isDocumentStoragePath(value: string): boolean {
  const extensionPattern = Object.keys(DOCUMENT_FILE_TYPES).map((extension) => extension.slice(1)).join("|");
  return new RegExp(`^documents/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.(?:${extensionPattern})$`, "i").test(value);
}
