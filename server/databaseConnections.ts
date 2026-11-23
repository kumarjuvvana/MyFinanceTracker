import { decryptDatabaseConnectionProfiles, type DatabaseConnectionProfile } from "../src/lib/databaseConnectionProfiles.js";
import { isEncryptedVault } from "../src/lib/credentialVault.js";

function supabaseCredentials(): { baseUrl: string; key: string } {
  const configuredUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!configuredUrl || !key) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to load saved database connections.");
  }

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

async function loadEncryptedVault() {
  const { baseUrl, key } = supabaseCredentials();
  const response = await fetch(`${baseUrl}/rest/v1/database_connection_vault?select=vault&id=eq.shared`, {
    headers: {
      Accept: "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Could not load saved database connections (HTTP ${response.status}).`);
  }
  const result: unknown = await response.json();
  if (!Array.isArray(result) || result.length !== 1 ||
    typeof result[0] !== "object" || result[0] === null ||
    !("vault" in result[0]) || !isEncryptedVault(result[0].vault)) {
    throw new Error("The shared database connection vault is missing or invalid.");
  }
  return result[0].vault;
}

// Call only after authenticating the API request; the passphrase is never persisted here.
export async function loadUnlockedDatabaseConnectionProfiles(passphrase: string): Promise<DatabaseConnectionProfile[]> {
  if (passphrase.length < 16 || passphrase.length > 256) {
    throw new Error("The database connection vault passphrase is invalid.");
  }
  return decryptDatabaseConnectionProfiles(await loadEncryptedVault(), passphrase);
}

export async function loadUnlockedDatabaseConnectionProfile(
  profileId: string,
  passphrase: string,
): Promise<DatabaseConnectionProfile> {
  if (!profileId.trim()) throw new Error("A database connection profile ID is required.");
  const profiles = await loadUnlockedDatabaseConnectionProfiles(passphrase);
  const profile = profiles.find((entry) => entry.id === profileId);
  if (!profile) throw new Error("The requested database connection profile was not found.");
  return profile;
}
