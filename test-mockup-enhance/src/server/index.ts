/// <reference types="node" />
import path from "node:path";

import express from "express";
import type { Express, NextFunction, Request, Response } from "express";

import { createActivityRouter } from "../api/activity/router.js";
import { createMemoryActivityRepository } from "../api/activity/repository.js";
import type { ActivityRepository } from "../api/activity/repository.js";
import { TaskActivityService } from "../api/activity/service.js";
import { createChecklistRouter } from "../api/checklist/index.js";
import { createCommentRouter } from "../api/comments/router.js";
import { createLabelRouter } from "../api/labels/router.js";
import { createMemoryLabelRepository } from "../api/labels/repository.js";
import type { LabelRepository } from "../api/labels/repository.js";
import { createReportRepository } from "../api/reports/repository.js";
import { createReportRouter } from "../api/reports/router.js";
import { createTaskRouter } from "../api/tasks/router.js";
import { createTeamRouter } from "../api/team/index.js";
import {
  createChecklistRepository,
  createMemoryChecklistDataSource,
  createPrismaChecklistRepository,
} from "../data/checklist/checklistRepository.js";
import type { ChecklistRepository } from "../data/checklist/checklistRepository.js";
import {
  createCommentRepository,
  createTaskRepository,
  createTeamMemberRepository,
  disconnect,
  prisma,
} from "../db/index.js";
import type { TaskRepository } from "../db/taskRepository.js";
import type { Label, NewLabel } from "../models/label.js";
import { API_PREFIX, HEALTH_ENDPOINT } from "../shared/api-paths.js";
import { withActivityRecording } from "./activityRecording.js";
import { createMemoryRepositories, type Repositories } from "./memoryStore.js";

/** Shown in the boot log. */
const APP_LABEL = "Test mockup enhance";

/** Directory holding the built client (`npm run build` writes it to `dist/`). */
const CLIENT_DIR = path.resolve(process.cwd(), process.env.CLIENT_DIR ?? "dist");
const CLIENT_INDEX = path.join(CLIENT_DIR, "index.html");

/**
 * TEST-MODE DATASTORE switch, read at startup.
 *
 * `APP_DB=memory` selects the in-memory implementation of the very same
 * repository interfaces; any other explicit value selects the real PostgreSQL
 * database through Prisma. With `APP_DB` unset the real database is used
 * whenever a `DATABASE_URL` is configured, and the in-memory store otherwise,
 * so the assembled app always boots. No route, contract or behaviour changes.
 */
function useMemoryStore(): boolean {
  const mode = (process.env.APP_DB ?? "").trim().toLowerCase();
  if (mode === "memory") {
    return true;
  }
  if (mode !== "") {
    return false;
  }
  return (process.env.DATABASE_URL ?? "").trim() === "";
}

/** The repository set every router reads and writes through. */
function createRepositories(): Repositories {
  if (useMemoryStore()) {
    return createMemoryRepositories();
  }
  return {
    tasks: createTaskRepository(prisma),
    members: createTeamMemberRepository(prisma),
    comments: createCommentRepository(prisma),
  };
}

/**
 * The label store, created once for the lifetime of the process.
 *
 * The label endpoints are written against the `LabelRepository` INTERFACE, so
 * when the data lane lands its Prisma-backed `Label` / `TaskLabel` tables this
 * one call is the only line that changes.
 */
function createLabelStore(): LabelRepository {
  return createMemoryLabelRepository();
}

/**
 * The activity store, created once for the lifetime of the process.
 *
 * As with the labels above, the feed is written against the
 * `ActivityRepository` INTERFACE, so a Prisma-backed implementation drops in
 * here without touching the service or the route.
 */
function createActivityStore(): ActivityRepository {
  return createMemoryActivityRepository();
}

/**
 * THE CHECKLIST STORE, created once for the lifetime of the process.
 *
 * The checklist repository the data lane owns is wired to the REAL database
 * through Prisma; with the test-mode datastore selected it is the very same
 * repository over the in-memory data source, so every route, contract and
 * behaviour is identical and the app boots with no external database.
 */
function createChecklistStore(): ChecklistRepository {
  if (useMemoryStore()) {
    return createChecklistRepository(createMemoryChecklistDataSource());
  }
  return createPrismaChecklistRepository(prisma);
}

/** A label set as one comparable string, so a reorder is not a change. */
function labelSignature(labels: readonly Label[]): string {
  return labels
    .map((label: Label): string => label.name)
    .sort((left: string, right: string): number => left.localeCompare(right))
    .join("\u0000");
}

/**
 * THE LABEL STORE, WITH THE TASK'S ACTIVITY RECORDED.
 *
 * A task's labels are held beside the task rather than on it, so the activity
 * recording wrapped around the task repository never sees a label change and no
 * `labels_changed` entry was ever written. Wrapping the label store here
 * records ONE entry whenever a replacement really changes the set, reusing the
 * service's own diffing rules (from / to names and the sentence they read as).
 *
 * A replacement that changes nothing — the task screen saves the whole
 * selection on every edit, including an empty one — records nothing, and a
 * failure to record never fails the write itself.
 */
function withLabelActivity(
  labels: LabelRepository,
  tasks: TaskRepository,
  activity: TaskActivityService,
): LabelRepository {
  return {
    list: (): Promise<Label[]> => labels.list(),
    create: (input: NewLabel): Promise<Label> => labels.create(input),
    listForTask: (taskId: string): Promise<Label[]> => labels.listForTask(taskId),
    async replaceTaskLabels(taskId: string, labelIds: readonly string[]): Promise<Label[]> {
      const before = await labels.listForTask(taskId);
      const after = await labels.replaceTaskLabels(taskId, labelIds);
      if (labelSignature(before) !== labelSignature(after)) {
        try {
          const task = await tasks.findById(taskId);
          if (task !== null) {
            await activity.logTaskUpdated(
              { ...task, labels: [...before] },
              { ...task, labels: [...after] },
            );
          }
        } catch (error: unknown) {
          const reason = error instanceof Error ? error.message : String(error);
          process.stderr.write(
            `Could not record the label change of task ${taskId}: ${reason}\n`,
          );
        }
      }
      return after;
    },
  };
}

/**
 * Builds the whole application: the repositories, the feature routers under
 * `/api`, and the built single-page client with its history fallback.
 */
export function createServer(): Express {
  const app = express();
  const stored = createRepositories();

  // The recording service, and the repository set that feeds it: every task
  // create / edit and every comment that reaches storage also records the
  // activity entries the feed serves.
  const activity = new TaskActivityService({
    activity: createActivityStore(),
    members: stored.members,
  });
  const repositories = withActivityRecording(stored, activity);

  // …and the labels, which live beside the task rather than on it, record their
  // own entry through the store the task and label routers share.
  const labels = withLabelActivity(createLabelStore(), repositories.tasks, activity);

  // The checklist store the checklist router reads and writes through.
  const checklist = createChecklistStore();

  app.use(express.json({ limit: "1mb" }));

  app.get(HEALTH_ENDPOINT, (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  // The feature routers. Each one declares its own module paths internally
  // (`/tasks…`, `/tasks/:taskId/comments`, `/tasks/:taskId/activity`,
  // `/tasks/:taskId/checklist`, `/checklist/summary`, `/members`, `/labels`,
  // `/tasks/:taskId/labels`, `/reports`) and is mounted on the shared `/api`
  // scope, whose single spelling lives in src/shared/api-paths.ts. None of them
  // installs a guard, so an unmatched request falls through to the next router
  // rather than being swallowed.
  app.use(
    API_PREFIX,
    createTaskRouter({
      tasks: repositories.tasks,
      members: repositories.members,
      labels,
    }),
  );
  app.use(
    API_PREFIX,
    createCommentRouter({ comments: repositories.comments, tasks: repositories.tasks }),
  );
  app.use(API_PREFIX, createActivityRouter({ activity, tasks: repositories.tasks }));
  // THE CHECKLIST: one task's items, and the board's progress counts. The task
  // store is handed in as the router's task lookup, so a checklist request
  // about a task that does not exist is a 404 rather than an empty list.
  app.use(API_PREFIX, createChecklistRouter(checklist, { tasks: repositories.tasks }));
  app.use(API_PREFIX, createTeamRouter({ members: repositories.members }));
  app.use(API_PREFIX, createLabelRouter({ labels, tasks: repositories.tasks }));
  app.use(
    API_PREFIX,
    createReportRouter({
      reports: createReportRepository({
        tasks: repositories.tasks,
        members: repositories.members,
      }),
    }),
  );

  // Anything left under /api is a missing endpoint, never the client shell.
  app.use(API_PREFIX, (_req: Request, res: Response) => {
    res.status(404).json({ message: "Unknown API endpoint" });
  });

  // The built client owns the web root.
  app.use(express.static(CLIENT_DIR));
  app.get("*", (_req: Request, res: Response) => {
    res.sendFile(CLIENT_INDEX, (error?: Error) => {
      if (error && !res.headersSent) {
        res
          .status(503)
          .type("text/plain")
          .send("The client has not been built yet. Run: npm run build");
      }
    });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message });
  });

  return app;
}

/** Boots the assembled app on `process.env.PORT`. */
function start(): void {
  const port = Number(process.env.PORT ?? 3001);
  const store = useMemoryStore() ? "in-memory" : "PostgreSQL";
  const server = createServer().listen(port, () => {
    process.stdout.write(
      `${APP_LABEL} listening on port ${String(port)} (${store} datastore)\n`,
    );
  });

  const shutdown = (): void => {
    server.close(() => {
      void disconnect().then(
        () => {
          process.exit(0);
        },
        () => {
          process.exit(0);
        },
      );
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

// `npm start` runs this file, which boots the server. A unit test that imports
// `createServer` must not open a socket, so the boot is skipped under Vitest.
const isTestRun = process.env.VITEST !== undefined || process.env.NODE_ENV === "test";

if (!isTestRun) {
  start();
}
