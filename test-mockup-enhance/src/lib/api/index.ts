/**
 * Public surface of the browser API client lane. Screens import from here:
 *
 *   import { api, ApiError } from "../../lib/api/index.js";
 */
export { api, createBoardApi, ApiError } from "./client.js";
export type { BoardApi, BoardApiOptions, FetchLike } from "./client.js";
