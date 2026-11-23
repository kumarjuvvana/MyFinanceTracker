import { isEncryptedVault } from "./credentialVault";
import type { EncryptedVault } from "../types";

async function readError(response: Response, fallback: string): Promise<Error> {
  try {
    const payload: unknown = await response.json();
    if (typeof payload === "object" && payload !== null && "error" in payload &&
      typeof payload.error === "string") return new Error(payload.error);
  } catch {
    // Keep the HTTP status when the server does not return JSON.
  }
  return new Error(fallback);
}

export async function loadDatabaseConnectionVault(): Promise<EncryptedVault | null> {
  const response = await fetch("/api/data?resource=database-connection-vault", {
    cache: "no-store",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw await readError(response, `Could not load database connection settings (${response.status}).`);
  const payload: unknown = await response.json();
  if (typeof payload !== "object" || payload === null || !("vault" in payload) ||
    (payload.vault !== null && !isEncryptedVault(payload.vault))) {
    throw new Error("The server returned invalid database connection settings.");
  }
  return payload.vault;
}

export async function saveDatabaseConnectionVault(vault: EncryptedVault): Promise<void> {
  const response = await fetch("/api/data", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ resource: "database-connection-vault", action: "save", vault }),
  });
  if (!response.ok) throw await readError(response, `Could not save database connection settings (${response.status}).`);
  const payload: unknown = await response.json();
  if (typeof payload !== "object" || payload === null || !("saved" in payload) || payload.saved !== true) {
    throw new Error("The server did not confirm the database connection settings were saved.");
  }
}
