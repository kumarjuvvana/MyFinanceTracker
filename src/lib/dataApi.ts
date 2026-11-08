import type { TrackerData, TrackerPreferences } from "../types";

export interface SharedDataResponse {
  data: unknown;
  revision: string | null;
  initialized: boolean;
  preferencesInitialized: boolean;
  preferencesRevision: string | null;
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const body: unknown = await response.json();
      if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
        message = body.error;
      }
    } catch {
      // Keep the status message when the server does not return JSON.
    }
    throw new Error(message);
  }
  return response;
}

export async function checkSession(): Promise<boolean> {
  const response = await fetch("/api/data-auth", {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (response.status === 401) return false;
  if (!response.ok) {
    let message = `Could not check the Daybook session (${response.status}).`;
    try {
      const body: unknown = await response.json();
      if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
        message = body.error;
      }
    } catch {
      // Keep the status message when the server does not return JSON.
    }
    throw new Error(message);
  }
  return true;
}

export async function signIn(password: string): Promise<void> {
  await request("/api/data-auth", { method: "POST", body: JSON.stringify({ password }) });
}

export async function validateAccessPassword(password: string): Promise<void> {
  await request("/api/data-auth", {
    method: "POST",
    body: JSON.stringify({ password, validateOnly: true }),
  });
}

export async function signOut(): Promise<void> {
  await request("/api/data-auth", { method: "DELETE" });
}

export async function loadSharedData(): Promise<SharedDataResponse> {
  const response = await request("/api/data");
  return await response.json() as SharedDataResponse;
}

export async function saveSharedData(data: TrackerData, revision: string | null): Promise<string> {
  const recordData = { ...data };
  delete recordData.favoritePages;
  delete recordData.preferences;
  const response = await request("/api/data", {
    method: "PUT",
    body: JSON.stringify({ data: recordData, revision }),
  });
  const result: unknown = await response.json();
  if (typeof result !== "object" || result === null || !("revision" in result) || typeof result.revision !== "string") {
    throw new Error("The server did not confirm the saved data revision.");
  }
  return result.revision;
}

export async function saveSharedPreferences(
  favoritePages: NonNullable<TrackerData["favoritePages"]>,
  preferences: TrackerPreferences,
): Promise<string> {
  const response = await request("/api/data", {
    method: "PATCH",
    body: JSON.stringify({ favoritePages, preferences }),
  });
  const result: unknown = await response.json();
  if (typeof result !== "object" || result === null ||
    !("preferencesRevision" in result) || typeof result.preferencesRevision !== "string") {
    throw new Error("The server did not confirm the saved preferences.");
  }
  return result.preferencesRevision;
}
