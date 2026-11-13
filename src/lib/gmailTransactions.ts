export type GmailTransactionDirection = "debit" | "credit";

export interface GmailTransactionCandidate {
  gmailMessageId: string;
  from: string;
  subject: string;
  transactionDate: string;
  amount: number | null;
  direction: GmailTransactionDirection | null;
  accountSuffix: string;
  description: string;
}

interface GmailHeader {
  name?: string;
  value?: string;
}

interface GmailPayload {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPayload[];
  headers?: GmailHeader[];
}

interface GmailMessage {
  id?: string;
  internalDate?: string;
  snippet?: string;
  payload?: GmailPayload;
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

function collectBody(payload: GmailPayload | undefined, mimeType: string): string[] {
  if (!payload) return [];
  const content = payload.mimeType === mimeType && payload.body?.data
    ? [decodeBase64Url(payload.body.data)]
    : [];
  return [...content, ...(payload.parts ?? []).flatMap((part) => collectBody(part, mimeType))];
}

function htmlToText(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:div|p|tr|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)));
}

function headerValue(payload: GmailPayload | undefined, name: string): string {
  return payload?.headers?.find((header) => header.name?.toLocaleLowerCase() === name)?.value?.trim() ?? "";
}

function parseAmount(text: string): number | null {
  const patterns = [
    /(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/gi,
    /([\d,]+(?:\.\d{1,2})?)\s*(?:INR|Rs\.?|₹)/gi,
  ];
  const amounts = patterns.flatMap((pattern) =>
    [...text.matchAll(pattern)].map((match) => Number(match[1].replace(/,/g, ""))))
    .filter((amount) => Number.isFinite(amount) && amount > 0);
  const uniqueAmounts = [...new Set(amounts)];
  return uniqueAmounts.length === 1 ? uniqueAmounts[0] : null;
}

function parseDirection(text: string): GmailTransactionDirection | null {
  const lower = text.toLocaleLowerCase();
  const hasDebit = /\b(debited|withdrawn|deducted|spent|paid|purchase|sent)\b/.test(lower);
  const hasCredit = /\b(credited|deposited|received|refund(?:ed)?)\b/.test(lower);
  return hasDebit === hasCredit ? null : hasDebit ? "debit" : "credit";
}

function parseAccountSuffix(text: string): string {
  return text.match(/\b(?:a\/c|account|acct|card)(?:\s*(?:no\.?|number))?\s*[:#-]?\s*[*xX•\s-]*(\d{4})\b/i)?.[1] ?? "";
}

export function parseGmailTransactionMessage(message: GmailMessage): GmailTransactionCandidate | null {
  if (!message.id) return null;
  const payload = message.payload;
  const plainText = collectBody(payload, "text/plain").join("\n");
  const htmlText = plainText ? "" : collectBody(payload, "text/html").map(htmlToText).join("\n");
  const subject = headerValue(payload, "subject");
  const from = headerValue(payload, "from");
  const text = `${subject}\n${plainText || htmlText || message.snippet || ""}`;
  const amount = parseAmount(text);
  const direction = parseDirection(text);
  const receivedDate = message.internalDate && /^\d+$/.test(message.internalDate)
    ? new Date(Number(message.internalDate)).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  if (!subject && !from && amount === null && direction === null) return null;
  return {
    gmailMessageId: message.id,
    from,
    subject,
    transactionDate: receivedDate,
    amount,
    direction,
    accountSuffix: parseAccountSuffix(text),
    description: subject || from || "Bank transaction",
  };
}

export function decodeGmailMessage(value: unknown): GmailMessage {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Gmail returned a message with an unexpected format.");
  }
  const message = value as GmailMessage;
  if (message.payload !== undefined &&
    (typeof message.payload !== "object" || message.payload === null || Array.isArray(message.payload))) {
    throw new Error("Gmail returned a message payload with an unexpected format.");
  }
  return message;
}
