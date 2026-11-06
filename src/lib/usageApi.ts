export interface CloudUsage {
  measuredAt: string;
  databaseBytes: number;
  storageBytes: number;
  storageObjects: number;
}

export interface DeploymentUsage {
  deploymentOutputBytes: number;
  fileCount: number;
  measuredAt: string;
}

async function responseError(response: Response, fallback: string): Promise<Error> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "error" in body &&
      typeof body.error === "string" && body.error.length > 0) {
      return new Error(body.error);
    }
  } catch {
    // Keep the HTTP status when the server does not return JSON.
  }
  return new Error(`${fallback} (${response.status}).`);
}

export async function loadCloudUsage(): Promise<CloudUsage> {
  const response = await fetch("/api/usage", {
    headers: { Accept: "application/json" },
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) throw await responseError(response, "Could not load Supabase usage");
  const body: unknown = await response.json();
  if (typeof body !== "object" || body === null || !("measuredAt" in body) ||
    typeof body.measuredAt !== "string" || !("databaseBytes" in body) ||
    !("storageBytes" in body) || !("storageObjects" in body)) {
    throw new Error("Supabase returned an invalid usage response.");
  }
  const databaseBytes = Number(body.databaseBytes);
  const storageBytes = Number(body.storageBytes);
  const storageObjects = Number(body.storageObjects);
  if (![databaseBytes, storageBytes, storageObjects].every((value) => Number.isSafeInteger(value) && value >= 0)) {
    throw new Error("Supabase returned invalid usage values.");
  }
  return { measuredAt: body.measuredAt, databaseBytes, storageBytes, storageObjects };
}

export async function loadDeploymentUsage(): Promise<DeploymentUsage> {
  const response = await fetch("/hosting-usage.json", {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Deployment output size is available after a production build.");
  const body: unknown = await response.json();
  if (typeof body !== "object" || body === null || !("deploymentOutputBytes" in body) ||
    !("fileCount" in body) || !("measuredAt" in body) || typeof body.measuredAt !== "string") {
    throw new Error("The deployment usage report is invalid.");
  }
  const deploymentOutputBytes = Number(body.deploymentOutputBytes);
  const fileCount = Number(body.fileCount);
  if (![deploymentOutputBytes, fileCount].every((value) => Number.isSafeInteger(value) && value >= 0)) {
    throw new Error("The deployment usage report contains invalid values.");
  }
  return { deploymentOutputBytes, fileCount, measuredAt: body.measuredAt };
}
