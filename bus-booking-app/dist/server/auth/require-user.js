import { toAuthUser } from '../../models/accounts/index.js';
import { errorBody, NOT_SIGNED_IN_MESSAGE, SERVICE_UNAVAILABLE_MESSAGE } from './responses.js';
import { currentUser } from './session.js';
async function authenticate(req, res, next) {
    try {
        const user = await currentUser(req);
        if (user === null) {
            res.status(401).json(errorBody('unauthenticated', NOT_SIGNED_IN_MESSAGE));
            return;
        }
        req.user = toAuthUser(user);
        next();
    }
    catch (error) {
        console.error('[auth] session lookup failed:', error instanceof Error ? error.message : String(error));
        res.status(503).json(errorBody('service_unavailable', SERVICE_UNAVAILABLE_MESSAGE));
    }
}
/** Express middleware: 401 for a signed-out caller, 503 when the datastore is unreachable. */
export function requireUser(req, res, next) {
    void authenticate(req, res, next);
}
