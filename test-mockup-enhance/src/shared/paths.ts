/**
 * Client addresses of the application, declared exactly once.
 *
 * The page list (src/routes.tsx) and every navigation callback the shell wires
 * read these constants, so an address is never hand-typed twice.
 */

export const BOARD_PATH = "/";
export const NEW_TASK_PATH = "/tasks/new";
export const TASK_DETAIL_PATTERN = "/tasks/:id";
export const TEAM_PATH = "/team";
export const REPORTS_PATH = "/reports";

/** Address of the detail screen for one task. */
export function taskDetailPath(taskId: string): string {
  return `/tasks/${encodeURIComponent(taskId)}`;
}

/**
 * Reads the task id out of a pathname such as `/tasks/abc123`.
 *
 * Returns an empty string when the pathname is not a task detail address, so a
 * screen receives a value it can render a "not found" state for rather than
 * `undefined`.
 */
export function taskIdFromPath(pathname: string): string {
  const [withoutQuery = ""] = pathname.split("?");
  const [cleaned = ""] = withoutQuery.split("#");
  const segments = cleaned.split("/").filter((part: string) => part.length > 0);
  const first = segments[0] ?? "";
  const second = segments[1] ?? "";
  if (first !== "tasks" || second.length === 0 || second === "new") {
    return "";
  }
  return decodeURIComponent(second);
}
