/**
 * THE ACTIVE DEVICES LANE'S PUBLIC SURFACE.
 *
 * The composition root mounts the router under `/api`:
 *
 *   app.use('/api', deviceSessionsRouter);
 *
 * which gives the app `GET /api/profile/sessions` and `POST /api/profile/sessions/revoke-all`.
 */
export {
  deviceSessionsRouter,
  DEVICE_SESSIONS_REVOKE_ALL_ROUTE,
  DEVICE_SESSIONS_ROUTE,
  type DeviceSessionBody,
} from './router.js';
export { readSessionTokenFromCookies } from './session-token.js';
