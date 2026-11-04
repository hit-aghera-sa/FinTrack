/** The copy contract. Treat every string as specification text: do not paraphrase. */
export const COPY = {
    appTitle: 'Tasks',
    appSubtitle: 'Keep track of what needs doing.',
    listLabel: 'Task list',
    filtersLabel: 'Filter tasks',
    composer: {
        heading: 'Add a task',
        label: 'Task title',
        placeholder: 'What needs to be done?',
        submit: 'Add task',
    },
    filters: {
        all: 'All',
        active: 'Active',
        completed: 'Completed',
    },
    empty: {
        all: 'No tasks yet. Add your first task above.',
        active: 'No active tasks. Nice work!',
        completed: 'No completed tasks yet.',
    },
    item: {
        toggle: (title) => `Toggle ${title}`,
        delete: (title) => `Delete ${title}`,
        completedBadge: 'Completed',
    },
    status: {
        loading: 'Loading tasks...',
        remaining: (count) => `${count} ${count === 1 ? 'task' : 'tasks'} left`,
        clearCompleted: 'Clear completed',
        retry: 'Try again',
    },
    errors: {
        titleRequired: 'Enter a task title.',
        titleTooLong: 'Task title must be 100 characters or fewer.',
        loadFailed: 'Could not load tasks. Please try again.',
        saveFailed: 'Could not save your change. Please try again.',
        deleteFailed: 'Could not delete that task. Please try again.',
        notFound: 'That task no longer exists.',
        unexpected: 'Something went wrong. Please try again.',
    },
};
/** Label for a filter tab. */
export function filterLabel(filter) {
    return COPY.filters[filter];
}
/** Empty-state message for a filter. */
export function emptyMessage(filter) {
    return COPY.empty[filter];
}
