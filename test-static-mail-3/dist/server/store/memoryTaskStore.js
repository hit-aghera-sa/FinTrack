/**
 * In-memory implementation of the shared {@link TaskStore} port.
 *
 * The list lives in a plain array owned by the closure below: no file, no database,
 * no persistence. Importing this module performs no I/O and creates no store —
 * callers build one explicitly (or take the shared singleton).
 */
import { DEFAULT_FILTER, filterTasks, validateTitle } from '../../models/index.js';
import { TaskStoreValidationError, defaultTaskId, parseTaskList } from './taskShape.js';
function sortNewestFirst(tasks) {
    return [...tasks].sort((left, right) => {
        const delta = Date.parse(right.createdAt) - Date.parse(left.createdAt);
        if (delta !== 0)
            return delta;
        if (left.id < right.id)
            return -1;
        if (left.id > right.id)
            return 1;
        return 0;
    });
}
/** Build an isolated in-memory store. */
export function createMemoryTaskStore(options = {}) {
    const idFactory = options.idFactory ?? defaultTaskId;
    const clock = options.now ?? (() => new Date());
    const parseOptions = {
        idFactory,
        now: () => clock().toISOString(),
    };
    /** The one and only backing array. Never handed out by reference. */
    let tasks = [];
    if (options.initial !== undefined) {
        const seeded = parseTaskList([...options.initial], parseOptions);
        if (!seeded.ok) {
            throw new TaskStoreValidationError(seeded.code, seeded.message);
        }
        tasks = seeded.value;
    }
    function snapshot() {
        return sortNewestFirst(tasks);
    }
    const store = {
        async list(listOptions) {
            const filter = listOptions?.filter ?? DEFAULT_FILTER;
            return sortNewestFirst(filterTasks(snapshot(), filter));
        },
        async get(id) {
            const found = tasks.find((task) => task.id === id);
            return found ? { ...found } : null;
        },
        async create(input) {
            const title = validateTitle(input?.title);
            if (!title.ok) {
                throw new TaskStoreValidationError(title.code, title.message);
            }
            const task = {
                id: idFactory(),
                title: title.value,
                completed: false,
                createdAt: clock().toISOString(),
            };
            tasks = [...tasks, task];
            return { ...task };
        },
        async update(id, patch) {
            const index = tasks.findIndex((task) => task.id === id);
            if (index === -1)
                return null;
            const current = tasks[index];
            const fields = patch;
            let title = current.title;
            if (fields.title !== undefined) {
                const validated = validateTitle(fields.title);
                if (!validated.ok) {
                    throw new TaskStoreValidationError(validated.code, validated.message);
                }
                title = validated.value;
            }
            let completed = current.completed;
            if (fields.completed !== undefined) {
                if (typeof fields.completed !== 'boolean') {
                    throw new TaskStoreValidationError('bad_request', 'completed must be a boolean.');
                }
                completed = fields.completed;
            }
            const next = { ...current, title, completed };
            const copy = [...tasks];
            copy[index] = next;
            tasks = copy;
            return { ...next };
        },
        async remove(id) {
            const next = tasks.filter((task) => task.id !== id);
            const removed = next.length !== tasks.length;
            tasks = next;
            return removed;
        },
        async replaceAll(input) {
            const parsed = parseTaskList(input, parseOptions);
            if (!parsed.ok) {
                // The array is left untouched: a malformed body can never corrupt the list.
                throw new TaskStoreValidationError(parsed.code, parsed.message);
            }
            tasks = parsed.value;
            return snapshot();
        },
        snapshot,
        clear() {
            tasks = [];
        },
        size() {
            return tasks.length;
        },
    };
    return store;
}
