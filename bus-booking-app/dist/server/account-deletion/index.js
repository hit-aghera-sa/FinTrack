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
export { ACCOUNT_DELETION_PREVIEW_ROUTE, ACCOUNT_DELETION_ROUTE, accountDeletionRouter, createAccountDeletionRouter, } from './router.js';
export { createAccountDeletionService, } from './service.js';
export { AccountSchemaError, SCHEMA_COLUMNS_SQL, buildIndex, createSqlAccountDeletionStore, normaliseName, pickColumn, pickTable, resolveAccountSchema, runPurge, } from './sql-store.js';
export { isUpcomingBooking, summariseBookings } from './preview.js';
export { CURRENT_PASSWORD_REQUIRED_MESSAGE, deleteAccountSchema, readCurrentPassword, } from './validation.js';
