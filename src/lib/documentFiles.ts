export const MAX_DOCUMENT_FILE_BYTES = 13 * 1024 * 1024;
export const DOCUMENT_FILE_TYPES = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".txt": "text/plain",
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

export function getDocumentFileType(fileName: string): { extension: DocumentFileExtension; contentType: string } | null {
  const extension = `.${fileName.split(".").pop()?.toLocaleLowerCase() ?? ""}` as DocumentFileExtension;
  const contentType = DOCUMENT_FILE_TYPES[extension];
  return contentType ? { extension, contentType } : null;
}

export function isDocumentStoragePath(value: string): boolean {
  const extensionPattern = Object.keys(DOCUMENT_FILE_TYPES).map((extension) => extension.slice(1)).join("|");
  return new RegExp(`^documents/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.(?:${extensionPattern})$`, "i").test(value);
}
