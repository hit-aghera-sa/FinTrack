import { bootstrapAdminLoginAlias, createApp, ensureBootstrapAccount, mountClient, } from './app.js';
import { API_BASE_PATH, API_PATHS, apiUrl } from '../shared/api-paths.js';
import { authRouter } from './auth/index.js';
import { signupRouter } from './registration/index.js';
import { passwordResetRouter } from './password-reset/index.js';
import { searchRouter } from './search/index.js';
import { tripBookingRouter } from './trip-booking/index.js';
import { myBookingsRouter } from './my-bookings/index.js';
import { cancellationRouter } from './cancellation/index.js';
import { profileRouter } from './profile/index.js';
import { deviceSessionsRouter } from './device-sessions/index.js';
import { accountDeletionRouter } from './account-deletion/index.js';
import { disconnectPrisma } from '../db/client/index.js';
/**
 * THE SERVER THAT IS THE APP: one process serving the built client AND the whole `/api` surface,
 * reading and writing the real PostgreSQL database through the shared Prisma client (every router
 * below is already bound to the repositories in `src/db`, so there is no in-memory copy anywhere in
 * the running app).
 *
 * Each feature router declares its OWN full address after the prefix — `/auth/login`, `/cities`,
 * `/trips/:tripId`, `/bookings/:bookingId/cancel`, `/profile/sessions` — so each is mounted at
 * `/api` exactly as its lane documents. The three unauthenticated doors (log in, sign up, password
 * reset) are mounted first, and no guard is registered ahead of the routers, so an `/api` path no
 * route defines always answers 404 and never "you must be signed in".
 */
const PORT = Number(process.env.PORT ?? 3000);
const app = createApp();
// The account created from the environment signs in with its own address at the app's own endpoint.
app.use(apiUrl(API_PATHS.login), bootstrapAdminLoginAlias);
// 1. Every feature router, under /api — the open doors first.
app.use(API_BASE_PATH, authRouter);
app.use(API_BASE_PATH, signupRouter);
app.use(API_BASE_PATH, passwordResetRouter);
app.use(API_BASE_PATH, searchRouter);
app.use(API_BASE_PATH, tripBookingRouter);
app.use(API_BASE_PATH, myBookingsRouter);
app.use(API_BASE_PATH, cancellationRouter);
app.use(API_BASE_PATH, profileRouter);
app.use(API_BASE_PATH, deviceSessionsRouter);
app.use(API_BASE_PATH, accountDeletionRouter);
// 2 & 3. Unknown /api -> 404 JSON; then the built client from dist/client with its SPA fallback.
mountClient(app);
// 4. Listen. The database is reached lazily on the first query, so boot never waits on it.
const server = app.listen(PORT, () => {
    console.log(`Bus Booking App listening on http://localhost:${String(PORT)}`);
});
void ensureBootstrapAccount().catch((error) => {
    console.error('[server] the first-run account could not be prepared at boot', error);
});
function shutdown(signal) {
    console.log(`[server] ${signal} received, closing`);
    server.close(() => {
        void disconnectPrisma()
            .catch((error) => {
            console.error('[server] could not close the database connection', error);
        })
            .finally(() => {
            process.exit(0);
        });
    });
}
process.on('SIGINT', () => {
    shutdown('SIGINT');
});
process.on('SIGTERM', () => {
    shutdown('SIGTERM');
});
