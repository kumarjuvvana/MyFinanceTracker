import type { CookingInventoryItem, CookingInventoryUsage } from "../types";

export interface CookingInventoryResponse {
  items: CookingInventoryItem[];
  usage: CookingInventoryUsage[];
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
    let message = `Cooking inventory request failed (${response.status}).`;
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

export async function loadCookingInventory(): Promise<CookingInventoryResponse> {
  return await (await request("/api/cooking-inventory")).json() as CookingInventoryResponse;
}

export async function saveCookingInventory(
  items: CookingInventoryItem[],
  revision: string,
): Promise<string> {
  const result: unknown = await (await request("/api/cooking-inventory", {
    method: "PUT",
    body: JSON.stringify({ items, revision }),
  })).json();
  if (typeof result !== "object" || result === null || !("revision" in result) || typeof result.revision !== "string") {
    throw new Error("The server did not confirm the saved cooking inventory revision.");
  }
  return result.revision;
}
