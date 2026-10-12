/**
 * ACTIVITY RECORDING, wired at the composition root.
 *
 * The feed is only worth reading if something writes to it. Rather than editing
 * a feature router, the shared task and comment repositories are DECORATED here
 * with the same interfaces they already satisfy, so every create, every edit and
 * every comment that reaches storage also produces the activity entries the
 * recording service describes — and no route, contract or behaviour changes.
 *
 * A task edit is diffed from the record as it was BEFORE the write, which is why
 * the decorator reads the task first and hands both snapshots to the service.
 *
 * A COMMENT IS ATTRIBUTED TO A REAL NAME: the comment store has no idea who the
 * task belongs to, so the decorator reads the task and hands its assignee to the
 * service, which resolves the name the timeline shows. Without that the entry
 * would reach the screen nameless and read as "Someone".
 *
 * Recording can never fail the write it describes: a failing entry is swallowed.
 */
async function safely(action) {
    try {
        await action();
    }
    catch {
        // An activity entry must never fail the write it describes.
    }
}
/** The task store, with every write also recorded in the feed. */
function recordTaskWrites(tasks, activity) {
    return {
        list: () => tasks.list(),
        findById: (id) => tasks.findById(id),
        async create(input) {
            const created = await tasks.create(input);
            await safely(() => activity.logTaskCreated(created));
            return created;
        },
        async update(id, patch) {
            const before = await tasks.findById(id);
            const after = await tasks.update(id, patch);
            if (before !== null) {
                await safely(() => activity.logTaskUpdated(before, after));
            }
            return after;
        },
    };
}
/** The comment store, with every new comment also recorded in the feed. */
function recordCommentWrites(comments, tasks, activity) {
    return {
        listByTask: (taskId) => comments.listByTask(taskId),
        async create(taskId, input) {
            const created = await comments.create(taskId, input);
            await safely(async () => {
                // The task says who the comment is attributed to.
                const task = await tasks.findById(created.taskId);
                return activity.logCommentAdded(created.taskId, created.body, task === null ? null : task.assigneeId);
            });
            return created;
        },
    };
}
/**
 * The same repository set, with the task and comment stores recording activity.
 * The roster is passed through untouched.
 */
export function withActivityRecording(repositories, activity) {
    return {
        tasks: recordTaskWrites(repositories.tasks, activity),
        members: repositories.members,
        comments: recordCommentWrites(repositories.comments, repositories.tasks, activity),
    };
}
