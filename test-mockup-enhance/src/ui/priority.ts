/**
 * THE PRIORITY PRESENTATION LAYER AND ITS DESIGN TOKENS.
 *
 * The priority VOCABULARY itself is NOT declared here: `TaskPriority`,
 * `TASK_PRIORITIES`, `TASK_PRIORITY_LABELS` and `DEFAULT_TASK_PRIORITY` are the
 * project's shared domain model (`src/models/task.ts`) and this module is built
 * on them, so there is exactly one list of levels in the whole application.
 *
 * What this module adds is the DESIGN side of the field: the names of the three
 * token pairs declared in `./priority.css` (each of which aliases an existing
 * `var(--color-*)` theme token, so both the light and the dark palette stay
 * complete) and the class list the shared badge renders. No colour is ever
 * written here or in a component: a screen can reference a priority colour from
 * TypeScript without typing a raw colour.
 */

import {
  DEFAULT_TASK_PRIORITY,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  isTaskPriority,
  type TaskPriority,
} from "../models/task.js";

/**
 * The level a task carries. An alias of the shared {@link TaskPriority} — kept
 * under this name because the design lane's controls are typed with it.
 */
export type PriorityLevel = TaskPriority;

/** Display order: Low, Medium, High — the shared list, not a copy of it. */
export const PRIORITY_LEVELS: readonly PriorityLevel[] = TASK_PRIORITIES;

/** The human-readable label of each level. */
export const PRIORITY_LABELS: Record<PriorityLevel, string> = TASK_PRIORITY_LABELS;

/** The level the priority select starts on when the caller has none yet. */
export const DEFAULT_PRIORITY: PriorityLevel = DEFAULT_TASK_PRIORITY;

/** The CSS slug of each level, used in class and custom-property names. */
const PRIORITY_SLUGS: Record<PriorityLevel, string> = {
  Low: "low",
  Medium: "medium",
  High: "high",
};

/** `prioritySlug("High")` -> `"high"`. */
export function prioritySlug(level: PriorityLevel): string {
  return PRIORITY_SLUGS[level];
}

/** Narrowing guard for untrusted input (a select's value, a request body). */
export function isPriorityLevel(value: unknown): value is PriorityLevel {
  return isTaskPriority(value);
}

/** Label lookup that is safe to call with an unvalidated value. */
export function priorityLabel(value: unknown): string {
  return isTaskPriority(value) ? PRIORITY_LABELS[value] : "";
}

/** `prioritySurfaceToken("High")` -> `"var(--ui-priority-high-surface)"`. */
export function prioritySurfaceToken(level: PriorityLevel): string {
  return `var(--ui-priority-${prioritySlug(level)}-surface)`;
}

/** `priorityInkToken("High")` -> `"var(--ui-priority-high-ink)"`. */
export function priorityInkToken(level: PriorityLevel): string {
  return `var(--ui-priority-${prioritySlug(level)}-ink)`;
}

/** The badge's class list for one level. */
export function priorityBadgeClass(level: PriorityLevel): string {
  return `ui-priority-badge ui-priority-badge--${prioritySlug(level)}`;
}
