/** Public surface of the task detail, checklist & comment thread lane. */
export { TaskDetailPage, TaskDetailView } from './TaskDetailPage.js';
export type {
  TaskDetailApi,
  TaskDetailPageProps,
  TaskDetailViewProps,
} from './TaskDetailPage.js';
export { ChecklistPanel, ChecklistPanelView } from './ChecklistPanel.js';
export type { ChecklistPanelProps, ChecklistPanelViewProps } from './ChecklistPanel.js';
export { checklistClient, createChecklistClient } from './checklistClient.js';
export type { ChecklistClient, ChecklistFetch } from './checklistClient.js';
