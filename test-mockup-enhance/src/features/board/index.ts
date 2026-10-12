/**
 * Public surface of the board page lane. The shell imports from here:
 *
 *   import { BoardPage } from "./features/board/index.js";
 */
export { BoardPage, BoardPageWithApi } from "./BoardPage.js";
export type { BoardPageProps, BoardPageWithApiProps } from "./BoardPage.js";
export { TaskCard } from "./TaskCard.js";
export type { TaskCardProps } from "./TaskCard.js";
export {
  checklistSummaryClient,
  createChecklistSummaryClient,
} from "./checklistSummaryClient.js";
export type {
  ChecklistSummaryClient,
  ChecklistSummaryFetch,
} from "./checklistSummaryClient.js";
export * from "./boardModel.js";
