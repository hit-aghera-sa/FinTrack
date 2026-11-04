import { parseTaskList } from "./validation.js";
/** Copies a task so callers can never mutate the stored array in place. */
export function cloneTask(task) {
    return { id: task.id, title: task.title, done: task.done };
}
/**
 * Creates an isolated in-memory store. Used by the shared singleton below and
 * by tests that want a clean list without touching module state.
 */
export function createTaskStore(initial = []) {
    let tasks = initial.map(cloneTask);
    const snapshot = () => tasks.map(cloneTask);
    const store = {
        getAll: snapshot,
        replaceAll(next) {
            tasks = next.map(cloneTask);
            return snapshot();
        },
        replaceAllFromUnknown(input) {
            // parseTaskList throws before assignment, so a bad body leaves the list intact.
            tasks = parseTaskList(input);
            return snapshot();
        },
        clear() {
            tasks = [];
        },
        size() {
            return tasks.length;
        },
    };
    return store;
}
/** The single shared list for the whole process. Starts empty. */
export const taskStore = createTaskStore();
