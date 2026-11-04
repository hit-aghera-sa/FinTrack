import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import type { Express, NextFunction, Request, Response } from "express";

import { createTasksRouter } from "./api/index.js";
import type { TasksApiStore } from "./api/index.js";
import { getTaskStore } from "./store/index.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Locate the built client bundle. When the server runs from dist/server the
 * bundle sits next to it in dist/client; when it runs from source (tsx in dev)
 * the bundle, if present, is at <repo>/dist/client.
 */
function resolveClientDir(): string | null {
  const candidates = [
    path.resolve(currentDir, "../client"),
    path.resolve(currentDir, "../../dist/client"),
  ];
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, "index.html"))) {
      return candidate;
    }
  }
  return null;
}

/**
 * The process-wide task store, typed for the tasks router.
 *
 * WHY THE WIDENING EXISTS (and why it is the smallest possible change):
 * the store lane annotates `getTaskStore()` with the shared models' `TaskStore`,
 * which does not declare the `list` member the tasks router's `TasksApiStore`
 * requires — while the object it returns IS exactly the store both lanes document
 * handing to `createTasksRouter(getTaskStore())`. The runtime wiring is therefore
 * unchanged; only the too-narrow annotation is bridged here, at one call site.
 * The real repair belongs to the store lane (src/server/store/sharedTaskStore.ts):
 * `getTaskStore()` should return the concrete `MemoryTaskStore`.
 */
function resolveApiStore(): TasksApiStore {
  return getTaskStore() as unknown as TasksApiStore;
}

export function createServer(): Express {
  const app = express();
  app.use(express.json());

  // The process-wide store owned by the store lane: the same list is served to
  // every request, which is what the tasks router's TasksApiStore expects.
  const store = resolveApiStore();

  // 1. API first, so no static/SPA handler can ever answer an /api request.
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  app.use("/api", createTasksRouter(store));

  // 2. Any other /api request is a JSON 404, never the HTML shell.
  app.use("/api", (_req: Request, res: Response) => {
    res.status(404).json({ error: "Unknown API endpoint" });
  });

  // 3. Then the built client, with a single-page fallback for non-API GETs.
  const clientDir = resolveClientDir();
  if (clientDir !== null) {
    const indexFile = path.join(clientDir, "index.html");
    app.use(express.static(clientDir));
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== "GET" || req.path.startsWith("/api")) {
        next();
        return;
      }
      res.sendFile(indexFile);
    });
  }

  return app;
}

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);

createServer().listen(port);
