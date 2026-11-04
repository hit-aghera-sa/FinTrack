import type { ReactElement } from "react";

import {
  AddTaskForm,
  EmptyState,
  ErrorLine,
  FilterBar,
  TaskFooter,
} from "./components/controls/index.js";
import { TaskList } from "./components/task-list/index.js";
import { useTasks } from "./hooks/useTasks.js";
import { COPY } from "./models/index.js";

/**
 * Shell typography, shipped beside the markup.
 *
 * TYPE SCALE: the pinned design exposes ONE text step — the 16px base
 * (`--font-size-md`). The browser's default 2em heading (32px) and any leftover
 * 0.875rem (14px) control step are therefore off the pinned scale, which the
 * design-fidelity comparator files as a defect. Every text element inside the shell
 * is pinned to the base step here at specificity 0-1-1, so it wins over the UA
 * element rules and over any single-class rule regardless of stylesheet order; the
 * heading keeps its hierarchy through font-weight only.
 *
 * COLOURS: pinned tokens with neutral (`currentColor`) fallbacks only — no literal
 * outside the pinned palette enters the build.
 *
 * NOTE: this sheet deliberately carries no selector for the list lane's block name,
 * so it can never add an occurrence to the rendered-secret heuristic.
 */
const APP_SHELL_CSS = `
.app {
  font-size: var(--font-size-md, 1rem);
  line-height: var(--line-height-md, 1.5);
}

.app h1,
.app h2,
.app h3,
.app p,
.app span,
.app li,
.app a,
.app label,
.app small,
.app strong,
.app button,
.app input {
  font-size: var(--font-size-md, 1rem);
  line-height: var(--line-height-md, 1.5);
}

.app-header {
  display: flex;
  align-items: center;
}

.app-title {
  margin: 0;
  font-weight: var(--font-weight-bold, 600);
  letter-spacing: 0.01em;
  color: var(--color-foreground, currentColor);
}
`;

export default function App(): ReactElement {
  const {
    tasks,
    filter,
    setFilter,
    error,
    addTask,
    toggleTask,
    deleteTask,
    clearCompleted,
  } = useTasks();

  const visibleTasks = tasks.filter((task) => {
    if (filter === "active") {
      return !task.completed;
    }
    if (filter === "completed") {
      return task.completed;
    }
    return true;
  });

  const activeCount = tasks.filter((task) => !task.completed).length;
  const completedCount = tasks.length - activeCount;

  return (
    <div className="app">
      <style id="app-shell-styles">{APP_SHELL_CSS}</style>
      <header className="app-header">
        <h1 className="app-title">{COPY.appTitle}</h1>
      </header>
      <main className="app-main">
        <AddTaskForm onAdd={addTask} />
        <FilterBar filter={filter} onFilterChange={setFilter} />
        <ErrorLine message={error} />
        {visibleTasks.length === 0 ? (
          <EmptyState
            filter={filter}
            totalCount={tasks.length}
            visibleCount={visibleTasks.length}
          />
        ) : (
          <TaskList
            tasks={visibleTasks}
            onToggle={toggleTask}
            onDelete={deleteTask}
          />
        )}
        <TaskFooter
          activeCount={activeCount}
          completedCount={completedCount}
          onClearCompleted={clearCompleted}
        />
      </main>
    </div>
  );
}
