import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import type { IncomingMessage, ServerResponse } from "node:http";
import stockPriceHandler from "./api/stock-price";
import dataHandler from "./api/data";
import documentsHandler from "./api/documents";
import databaseHandler from "./api/database";
import dataAuthHandler from "./src/lib/dataAuth";

type ApiRequest = {
  method?: string;
  url?: string;
  headers: IncomingMessage["headers"];
  body?: unknown;
};
type ApiResponse = Pick<ServerResponse, "statusCode" | "setHeader" | "end">;
type ApiHandler = (request: ApiRequest, response: ApiResponse) => void | Promise<void>;

export default defineConfig(({ command, mode }) => {
  if (command === "serve") {
    const env = loadEnv(mode, process.cwd(), "");
    for (const key of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_DB_URL", "DATA_ACCESS_PASSWORD", "LOCAL_AUTH_BYPASS"]) {
      if (!process.env[key] && env[key]) process.env[key] = env[key];
    }
  }
  return {
    plugins: [react(), {
      name: "daybook-api",
      configureServer(server) {
        const routes: [string, ApiHandler][] = [
          ["/api/stock-price", stockPriceHandler],
          ["/api/data-auth", dataAuthHandler],
          ["/api/data", dataHandler],
          ["/api/documents", documentsHandler],
          ["/api/database", databaseHandler],
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
