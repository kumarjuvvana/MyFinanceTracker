import type { CredentialRecord, EncryptedCredentialVault } from "../types";

const ITERATIONS = 310_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface UnlockedCredentialVault {
  key: CryptoKey;
  records: CredentialRecord[];
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export function isCredentialRecord(value: unknown): value is CredentialRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && record.id.length > 0 &&
    typeof record.provider === "string" && record.provider.trim().length > 0 &&
    typeof record.category === "string" && typeof record.website === "string" && isHttpsLink(record.website) &&
    typeof record.username === "string" && typeof record.password === "string" &&
    typeof record.recoveryInfo === "string" && typeof record.notes === "string" &&
    Array.isArray(record.tags) && record.tags.every((tag) => typeof tag === "string") &&
    Array.isArray(record.additionalFields) && record.additionalFields.every((field) =>
      typeof field === "object" && field !== null && !Array.isArray(field) &&
      typeof field.label === "string" && typeof field.value === "string");
}

function isHttpsLink(value: string): boolean {
  if (!value) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function validateCredentialRecords(value: unknown): value is CredentialRecord[] {
  if (!Array.isArray(value) || !value.every(isCredentialRecord)) return false;
  return new Set(value.map((record) => record.id)).size === value.length;
}

async function encryptRecords(records: CredentialRecord[], key: CryptoKey, salt: Uint8Array): Promise<EncryptedCredentialVault> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify({ version: 1, records }));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return {
    version: 1,
    kdf: "PBKDF2-SHA-256",
    iterations: ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encrypted)),
  };
}

export async function createCredentialVault(password: string): Promise<{ vault: EncryptedCredentialVault; key: CryptoKey }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt);
  return { vault: await encryptRecords([], key, salt), key };
}

export async function unlockCredentialVault(
  vault: EncryptedCredentialVault,
  password: string,
): Promise<UnlockedCredentialVault> {
  if (vault.version !== 1 || vault.kdf !== "PBKDF2-SHA-256" || vault.iterations !== ITERATIONS) {
    throw new Error("This credential vault uses an unsupported encryption format.");
  }
  const salt = fromBase64(vault.salt);
  if (salt.length !== 16) throw new Error("The encrypted credential vault is damaged.");
  const key = await deriveKey(password, salt);
  return { key, records: await decryptRecords(vault, key) };
}

async function decryptRecords(vault: EncryptedCredentialVault, key: CryptoKey): Promise<CredentialRecord[]> {
  const iv = fromBase64(vault.iv);
  if (iv.length !== 12) throw new Error("The encrypted credential vault is damaged.");
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, fromBase64(vault.ciphertext));
  } catch {
    throw new Error("The vault password is incorrect, or its encrypted data has been changed.");
  }
  let payload: unknown;
  try {
    payload = JSON.parse(decoder.decode(plaintext));
  } catch {
    throw new Error("The decrypted credential vault has an invalid format.");
  }
  if (typeof payload !== "object" || payload === null || !("version" in payload) ||
    payload.version !== 1 || !("records" in payload) || !validateCredentialRecords(payload.records)) {
    throw new Error("The decrypted credential vault has invalid records.");
  }
  return payload.records;
}

export function decryptCredentialVaultWithKey(vault: EncryptedCredentialVault, key: CryptoKey): Promise<CredentialRecord[]> {
  if (vault.version !== 1 || vault.kdf !== "PBKDF2-SHA-256" || vault.iterations !== ITERATIONS) {
    throw new Error("This credential vault uses an unsupported encryption format.");
  }
  return decryptRecords(vault, key);
}

export function updateCredentialVault(
  records: CredentialRecord[],
  key: CryptoKey,
  vault: EncryptedCredentialVault,
): Promise<EncryptedCredentialVault> {
  return encryptRecords(records, key, fromBase64(vault.salt));
}
