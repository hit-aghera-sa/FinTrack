/**
 * THE SHARED CHECKLIST DOMAIN MODEL — declared EXACTLY ONCE for the whole
 * project. The Prisma-backed repository, the HTTP router and the browser
 * clients all import these types and this route table; no other module
 * re-declares them or hard-codes a checklist route string.
 *
 * A checklist item belongs to exactly one task. `position` fixes the display
 * order and is assigned once, when the item is created — there is no
 * reordering — and `done` is INDEPENDENT of the task's status: ticking every
 * item never moves the task to Done. An item's title cannot be edited: an item
 * can only be ticked, unticked or removed.
 */

import { API_PREFIX } from "../../shared/api-paths.js";

/** One stored checklist item of one task. */
export interface ChecklistItem {
  id: string;
  /** The task this item belongs to. */
  taskId: string;
  title: string;
  /** Ticked or not. Never changes the task's own status. */
  done: boolean;
  /** The display order, assigned at creation time and never changed. */
  position: number;
  /** ISO-8601 timestamp of the moment the item was created. */
  createdAt: string;
}

/**
 * A checklist item as it is handed to the store: the id, the `done` flag, the
 * position and the stamp are the store's job.
 */
export interface ChecklistItemInput {
  taskId: string;
  title: string;
}

/** How much of one task's checklist is finished. */
export interface ChecklistProgress {
  taskId: string;
  /** The items that are ticked. */
  done: number;
  /** Every item of the task's checklist. */
  total: number;
}

/** The longest title a checklist item may carry. */
export const MAX_CHECKLIST_TITLE_LENGTH = 200;

/** The query parameter the progress-summary endpoint reads its task ids from. */
export const CHECKLIST_SUMMARY_QUERY_PARAM = "taskIds";

/**
 * THE CHECKLIST ROUTE TEMPLATES, relative to the API scope the routers are
 * mounted on (`API_PREFIX`) — which is how every other router in this app
 * declares its own paths. The Express router registers these; the browser
 * clients use {@link CHECKLIST_API_PATHS} below.
 */
export const CHECKLIST_ROUTE_PATHS = {
  /** `GET` one task's checklist, `POST` a new item onto it. */
  items: "/tasks/:taskId/checklist",
  /** `PATCH` an item's `done` flag, `DELETE` the item. */
  item: "/tasks/:taskId/checklist/:itemId",
  /** `GET` the progress counts of a set of task ids. */
  summary: "/checklist/summary",
} as const;

/** One of the checklist route templates. */
export type ChecklistApiPath =
  (typeof CHECKLIST_ROUTE_PATHS)[keyof typeof CHECKLIST_ROUTE_PATHS];

/**
 * One path part. A ROUTE PARAMETER TOKEN (`:taskId`) is passed through
 * verbatim, so the HTTP router can build its own mount paths from the very
 * same table — `CHECKLIST_API_PATHS.items(":taskId")` is
 * `/api/tasks/:taskId/checklist`. Anything else is a real id and is escaped.
 */
function segment(value: string): string {
  return value.startsWith(":") ? value : encodeURIComponent(value);
}

/** The shape of the shared checklist route table. */
export interface ChecklistApiPaths {
  /** One task's checklist collection. */
  items: (taskId: string) => string;
  /** One item of one task's checklist. */
  item: (taskId: string, itemId: string) => string;
  /** The progress counts endpoint, without its query string. */
  summary: string;
}

/**
 * THE CHECKLIST ROUTE TABLE, written down once: the same-origin addresses the
 * browser clients call and the router mounts. Every address carries the shared
 * `/api` scope, whose single spelling lives in src/shared/api-paths.ts.
 */
export const CHECKLIST_API_PATHS: ChecklistApiPaths = {
  items: (taskId: string): string => `${API_PREFIX}/tasks/${segment(taskId)}/checklist`,
  item: (taskId: string, itemId: string): string =>
    `${API_PREFIX}/tasks/${segment(taskId)}/checklist/${segment(itemId)}`,
  summary: `${API_PREFIX}/checklist/summary`,
};

/** The address of one task's checklist. */
export function taskChecklistUrl(taskId: string): string {
  return CHECKLIST_API_PATHS.items(taskId);
}

/** The address of one checklist item of one task. */
export function checklistItemUrl(taskId: string, itemId: string): string {
  return CHECKLIST_API_PATHS.item(taskId, itemId);
}

/**
 * The address of the progress counts for a set of task ids. Blank and repeated
 * ids are dropped, so the board can pass its whole task list straight in.
 */
export function checklistSummaryUrl(taskIds: readonly string[]): string {
  const base = CHECKLIST_API_PATHS.summary;
  const unique = uniqueTaskIds(taskIds);
  if (unique.length === 0) {
    return base;
  }
  return `${base}?${CHECKLIST_SUMMARY_QUERY_PARAM}=${encodeURIComponent(unique.join(","))}`;
}

/** The task ids of a list, without blanks and without repeats, in order. */
export function uniqueTaskIds(taskIds: readonly string[]): string[] {
  const unique: string[] = [];
  for (const id of taskIds) {
    const trimmed = id.trim();
    if (trimmed !== "" && !unique.includes(trimmed)) {
      unique.push(trimmed);
    }
  }
  return unique;
}

/**
 * The title an item is stored with: runs of whitespace collapsed, trimmed, and
 * capped at {@link MAX_CHECKLIST_TITLE_LENGTH}. An empty result means no title
 * was given at all.
 */
export function normaliseChecklistTitle(title: string): string {
  return title.replace(/\s+/g, " ").trim().slice(0, MAX_CHECKLIST_TITLE_LENGTH);
}

/**
 * The task ids a summary request names, read from an untrusted query value:
 * one comma-separated string, or a repeated parameter, or neither.
 */
export function parseChecklistTaskIds(value: unknown): string[] {
  const parts: string[] = [];

  const collect = (raw: string): void => {
    for (const piece of raw.split(",")) {
      const trimmed = piece.trim();
      if (trimmed !== "" && !parts.includes(trimmed)) {
        parts.push(trimmed);
      }
    }
  };

  if (typeof value === "string") {
    collect(value);
    return parts;
  }
  if (Array.isArray(value)) {
    const entries: readonly unknown[] = value;
    for (const entry of entries) {
      if (typeof entry === "string") {
        collect(entry);
      }
    }
  }
  return parts;
}

/** Orders two items the way a checklist is always listed: by `position`. */
export function compareChecklistItems(left: ChecklistItem, right: ChecklistItem): number {
  if (left.position !== right.position) {
    return left.position - right.position;
  }
  if (left.createdAt !== right.createdAt) {
    return left.createdAt < right.createdAt ? -1 : 1;
  }
  return left.id.localeCompare(right.id, "en");
}

/**
 * The progress of one task, counted from a set of items — items belonging to
 * another task are ignored, so a single read of many tasks can be counted per
 * task without a second query.
 */
export function countChecklistProgress(
  taskId: string,
  items: readonly ChecklistItem[],
): ChecklistProgress {
  let done = 0;
  let total = 0;
  for (const item of items) {
    if (item.taskId !== taskId) {
      continue;
    }
    total += 1;
    if (item.done) {
      done += 1;
    }
  }
  return { taskId, done, total };
}

/** The `done/total` text a board card's checklist badge shows. */
export function checklistProgressLabel(progress: ChecklistProgress): string {
  return `${String(progress.done)}/${String(progress.total)}`;
}
