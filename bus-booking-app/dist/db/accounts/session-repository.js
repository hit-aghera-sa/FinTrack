import { compareSessionsNewestFirst, toActiveSession, toUserRecord } from './rows.js';
export function createSessionRepository(deps) {
    return {
        async create(input) {
            await deps.sessions.insert({
                userId: input.userId,
                token: input.token,
                userAgent: input.userAgent,
            });
        },
        async findUserByToken(token) {
            const session = await deps.sessions.findByToken(token);
            if (session === null)
                return null;
            const user = await deps.users.findById(session.userId);
            return user === null ? null : toUserRecord(user);
        },
        async deleteByToken(token) {
            await deps.sessions.deleteByToken(token);
        },
        async listActiveByUser(userId, currentToken) {
            const rows = await deps.sessions.listByUser(userId);
            const token = currentToken ?? null;
            return [...rows]
                .sort(compareSessionsNewestFirst)
                .map((row) => toActiveSession(row, token));
        },
        async deleteAllForUser(userId) {
            await deps.sessions.deleteAllForUser(userId);
        },
    };
}
