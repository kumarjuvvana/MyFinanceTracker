import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { readdir, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import stockPriceHandler from "./api/stock-price";
import dataHandler from "./api/data";
import documentsHandler from "./api/documents";
import databaseHandler from "./api/database";
import usageHandler from "./api/usage";
import dataAuthHandler from "./src/lib/dataAuth";
import type { ResolvedConfig } from "vite";

type ApiRequest = {
  method?: string;
  url?: string;
  headers: IncomingMessage["headers"];
  body?: unknown;
};
type ApiResponse = Pick<ServerResponse, "statusCode" | "setHeader" | "end">;
type ApiHandler = (request: ApiRequest, response: ApiResponse) => void | Promise<void>;

function hostingUsagePlugin() {
  let config: ResolvedConfig;
  return {
    name: "daybook-hosting-usage",
    apply: "build" as const,
    configResolved(resolved: ResolvedConfig) {
      config = resolved;
    },
    async closeBundle() {
      const outputDirectory = resolve(config.root, config.build.outDir);
      let totalBytes = 0;
      let fileCount = 0;
      async function measure(directory: string) {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          const path = resolve(directory, entry.name);
          if (entry.isDirectory()) {
            await measure(path);
          } else if (entry.isFile() && entry.name !== "hosting-usage.json") {
            totalBytes += (await stat(path)).size;
            fileCount += 1;
          }
        }
      }
      await measure(outputDirectory);
      await writeFile(resolve(outputDirectory, "hosting-usage.json"), JSON.stringify({
        deploymentOutputBytes: totalBytes,
        fileCount,
        measuredAt: new Date().toISOString(),
      }));
    },
  };
}

export default defineConfig(({ command, mode }) => {
  if (command === "serve") {
    const env = loadEnv(mode, process.cwd(), "");
    for (const key of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_DB_URL", "DATA_ACCESS_PASSWORD", "LOCAL_AUTH_BYPASS"]) {
      if (!process.env[key] && env[key]) process.env[key] = env[key];
    }
  }
  return {
    plugins: [react(), hostingUsagePlugin(), {
      name: "daybook-api",
      configureServer(server) {
        const routes: [string, ApiHandler][] = [
          ["/api/stock-price", stockPriceHandler],
          ["/api/data-auth", dataAuthHandler],
          ["/api/data", dataHandler],
          ["/api/documents", documentsHandler],
          ["/api/database", databaseHandler],
          ["/api/usage", usageHandler],
        ];
        for (const [path, handler] of routes) {
          server.middlewares.use(path, (request, response, next) => {
            const chunks: Buffer[] = [];
            let size = 0;
            let tooLarge = false;
            request.on("data", (chunk: Buffer | string) => {
              const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
              size += buffer.byteLength;
              if (size > 2 * 1024 * 1024) {
                tooLarge = true;
                return;
              }
              chunks.push(buffer);
            });
            request.on("end", () => {
              if (tooLarge) {
                response.statusCode = 413;
                response.setHeader("Content-Type", "application/json; charset=utf-8");
                response.end(JSON.stringify({ error: "Request body exceeds the 2 MB limit." }));
                return;
              }
              const bodyText = Buffer.concat(chunks).toString("utf8");
              let body: unknown = bodyText || undefined;
              if (bodyText && request.headers["content-type"]?.includes("application/json")) {
                try {
                  body = JSON.parse(bodyText) as unknown;
                } catch {
                  body = bodyText;
                }
              }
              const apiRequest: ApiRequest = {
                method: request.method,
                url: request.url,
                headers: request.headers,
                body,
              };
              Promise.resolve(handler(apiRequest, response)).catch(next);
            });
            request.on("error", next);
          });
        }
      }
    }],
  };
});
