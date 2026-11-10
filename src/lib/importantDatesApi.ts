import type { ImportantDate, ImportantDateCategory, ImportantDateFeeling } from "../types";

export interface ImportantDatesResponse {
  dates: ImportantDate[];
  categories: ImportantDateCategory[];
  feelings: ImportantDateFeeling[];
  revision: string;
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
    let message = `Important dates request failed (${response.status}).`;
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

export async function loadImportantDates(): Promise<ImportantDatesResponse> {
  const result: unknown = await (await request("/api/important-dates")).json();
  if (typeof result !== "object" || result === null ||
    !("dates" in result) || !Array.isArray(result.dates) ||
    !("categories" in result) || !Array.isArray(result.categories) ||
    !("feelings" in result) || !Array.isArray(result.feelings) ||
    !("revision" in result) || typeof result.revision !== "string") {
    throw new Error("The server returned an invalid important dates response.");
  }
  return result as ImportantDatesResponse;
}

export async function saveImportantDates(
  dates: ImportantDate[],
  categories: ImportantDateCategory[],
  feelings: ImportantDateFeeling[],
  revision: string,
): Promise<string> {
  const result: unknown = await (await request("/api/important-dates", {
    method: "PUT",
    body: JSON.stringify({ dates, categories, feelings, revision }),
  })).json();
  if (typeof result !== "object" || result === null || !("revision" in result) || typeof result.revision !== "string") {
    throw new Error("The server did not confirm the saved important dates revision.");
  }
  return result.revision;
}
