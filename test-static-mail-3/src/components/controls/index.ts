/**
 * Public surface of the controls lane. Screens import from this barrel:
 *
 *   import { AddTaskForm, FilterBar, TaskFooter, ErrorLine, EmptyState } from './components/controls/index.js';
 *
 * Importing this module has NO side effects: nothing is rendered, no request is
 * issued and no global state is created.
 */
export { AddTaskForm } from './AddTaskForm.js';
export type { AddTaskFormProps } from './AddTaskForm.js';
export { EmptyState } from './EmptyState.js';
export type { EmptyStateProps } from './EmptyState.js';
export { ErrorLine } from './ErrorLine.js';
export type { ErrorLineProps } from './ErrorLine.js';
export { FilterBar } from './FilterBar.js';
export type { FilterBarProps } from './FilterBar.js';
export { TaskFooter } from './TaskFooter.js';
export type { TaskFooterProps } from './TaskFooter.js';
export {
  canSubmitTitle,
  emptyStateMessage,
  errorText,
  filterOptions,
  formatDoneSummary,
  summarizeTasks,
  titleErrorMessage,
} from './logic.js';
export type { FilterOption, TaskSummary } from './logic.js';
export { CONTROLS_CSS, ControlStyles } from './styles.js';
