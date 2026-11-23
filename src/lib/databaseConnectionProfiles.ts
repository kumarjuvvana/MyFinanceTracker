import { decryptVaultPayload, encryptVaultPayload, isEncryptedVault } from "./credentialVault";
import type { EncryptedVault } from "../types";

export interface DatabaseConnectionProfile {
  id: string;
  name: string;
  modules: string[];
  connectionString: string;
  caCertificate: string;
}

interface DatabaseConnectionVaultPayload {
  version: 1;
  profiles: DatabaseConnectionProfile[];
}

interface LocalDatabaseConnectionConfig {
  format: "my-finance-tracker-database-connections";
  version: 1;
  vault: EncryptedVault;
}

export function serializeLocalDatabaseConnectionConfig(vault: EncryptedVault): string {
  if (!isEncryptedVault(vault)) throw new Error("The encrypted database connection vault is invalid.");
  const config: LocalDatabaseConnectionConfig = {
    format: "my-finance-tracker-database-connections",
    version: 1,
    vault,
  };
  return JSON.stringify(config, null, 2);
}

export function parseLocalDatabaseConnectionConfig(value: unknown): EncryptedVault {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
    !("format" in value) || value.format !== "my-finance-tracker-database-connections" ||
    !("version" in value) || value.version !== 1 || !("vault" in value) ||
    !isEncryptedVault(value.vault)) {
    throw new Error("The local database connection config has an invalid format.");
  }
  return value.vault;
}

export function validateDatabaseConnectionProfiles(value: unknown): value is DatabaseConnectionProfile[] {
  if (!Array.isArray(value) || value.length > 20) return false;
  const ids = new Set<string>();
  return value.every((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return false;
    const record = entry as Record<string, unknown>;
    if (typeof record.id !== "string" || !record.id.trim() || ids.has(record.id) ||
      typeof record.name !== "string" || !record.name.trim() || record.name.length > 80 ||
      !Array.isArray(record.modules) || record.modules.length > 50 ||
      !record.modules.every((module) => typeof module === "string" && module.trim().length > 0 && module.length <= 80) ||
      typeof record.connectionString !== "string" || record.connectionString.length < 1 ||
      record.connectionString.length > 2000 ||
      typeof record.caCertificate !== "string" || record.caCertificate.length > 20000) return false;
    ids.add(record.id);
    return true;
  });
}

export async function encryptDatabaseConnectionProfiles(
  profiles: DatabaseConnectionProfile[],
  passphrase: string,
): Promise<EncryptedVault> {
  if (!validateDatabaseConnectionProfiles(profiles)) throw new Error("The database connection profiles are invalid.");
  const payload: DatabaseConnectionVaultPayload = { version: 1, profiles };
  return encryptVaultPayload(payload, passphrase);
}

export async function decryptDatabaseConnectionProfiles(
  vault: EncryptedVault,
  passphrase: string,
): Promise<DatabaseConnectionProfile[]> {
  const payload = await decryptVaultPayload<unknown>(vault, passphrase);
  if (typeof payload !== "object" || payload === null || Array.isArray(payload) ||
    !("version" in payload) || payload.version !== 1 || !("profiles" in payload) ||
    !validateDatabaseConnectionProfiles(payload.profiles)) {
    throw new Error("The decrypted database connection profiles are invalid.");
  }
  return payload.profiles;
}
