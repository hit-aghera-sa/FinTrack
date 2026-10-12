/**
 * Application logic for a task's comment thread.
 *
 * Deliberately free of Express, so every rule here can be unit tested against
 * fake repositories; `router.ts` beside it is a thin HTTP adapter. All data
 * access goes through the repositories the database lane owns — this module
 * never touches Prisma directly.
 *
 * Comments carry no author attribution: the app has no login.
 */
/** Longest comment body the API accepts, measured after trimming. */
export const MAX_COMMENT_BODY_LENGTH = 2000;
/** Builds a problem response. */
export function problem(status, error, message) {
    return { status, body: { error, message } };
}
/** The problem sent when the task in the URL does not exist. */
export function taskNotFound() {
    return problem(404, "task_not_found", "That task could not be found.");
}
/**
 * Validates an untrusted request payload and returns the trimmed comment text.
 *
 * A payload is acceptable only when it is an object carrying a `body` string
 * that is not blank and not longer than {@link MAX_COMMENT_BODY_LENGTH}.
 */
export function readCommentBody(payload) {
    const blank = problem(400, "invalid_body", "Enter a comment before posting.");
    if (typeof payload !== "object" || payload === null || !("body" in payload)) {
        return { ok: false, problem: blank };
    }
    const raw = payload.body;
    if (typeof raw !== "string") {
        return { ok: false, problem: blank };
    }
    const trimmed = raw.trim();
    if (trimmed === "") {
        return { ok: false, problem: blank };
    }
    if (trimmed.length > MAX_COMMENT_BODY_LENGTH) {
        return {
            ok: false,
            problem: problem(400, "invalid_body", `A comment can be at most ${String(MAX_COMMENT_BODY_LENGTH)} characters long.`),
        };
    }
    return { ok: true, value: trimmed };
}
/**
 * The task's comments in creation order, or a 404 problem when the task does
 * not exist.
 */
export async function listCommentsForTask(deps, taskId) {
    const task = await deps.tasks.findById(taskId);
    if (task === null) {
        return { ok: false, problem: taskNotFound() };
    }
    const comments = await deps.comments.listByTask(taskId);
    return { ok: true, value: comments };
}
/**
 * Adds a comment to a task.
 *
 * An unknown task is reported first (404) so a stale client never gets a
 * validation message about a thread that no longer exists; a blank or
 * malformed body is then rejected with 400.
 */
export async function createCommentForTask(deps, taskId, payload) {
    const task = await deps.tasks.findById(taskId);
    if (task === null) {
        return { ok: false, problem: taskNotFound() };
    }
    const body = readCommentBody(payload);
    if (!body.ok) {
        return { ok: false, problem: body.problem };
    }
    const created = await deps.comments.create(taskId, { body: body.value });
    return { ok: true, value: created };
}
