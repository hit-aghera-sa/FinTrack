/**
 * THE ACCOUNT DELETION LANE'S PUBLIC SURFACE.
 *
 * The composition root mounts the router under `/api`:
 *
 *   app.use('/api', accountDeletionRouter);
 *
 * which gives the app `GET /api/profile/delete-account/preview` and `POST /api/profile/delete-account`.
 * Everything else is exported so the rules can be reused and tested without an HTTP server.
 */
export {
  ACCOUNT_DELETION_PREVIEW_ROUTE,
  ACCOUNT_DELETION_ROUTE,
  accountDeletionRouter,
  createAccountDeletionRouter,
} from './router.js';

export {
  createAccountDeletionService,
  type AccountDeletionService,
  type AccountDeletionServiceDeps,
  type DeleteAccountRequest,
} from './service.js';

export {
  AccountSchemaError,
  SCHEMA_COLUMNS_SQL,
  buildIndex,
  createSqlAccountDeletionStore,
  normaliseName,
  pickColumn,
  pickTable,
  resolveAccountSchema,
  runPurge,
  type AccountDeletionSchema,
  type BookingTableNames,
  type PassengerTableNames,
  type SchemaColumn,
  type SchemaIndex,
  type SeatTableNames,
  type SessionTableNames,
  type SqlExecutor,
  type TableIndex,
  type TransactionalSql,
} from './sql-store.js';

export { isUpcomingBooking, summariseBookings } from './preview.js';

export {
  CURRENT_PASSWORD_REQUIRED_MESSAGE,
  deleteAccountSchema,
  readCurrentPassword,
  type CurrentPasswordRead,
  type DeleteAccountInput,
} from './validation.js';

export type {
  AccountDeletionFailure,
  AccountDeletionFailureCode,
  AccountDeletionPreview,
  AccountDeletionResult,
  AccountDeletionStore,
  AccountDeletionSuccess,
  AccountPurgeSummary,
  BookingCounts,
  BookingTimingRecord,
  DeletionAccount,
  DeletionBookingReader,
  DeletionSessionReader,
  DeletionUserStore,
} from './types.js';
