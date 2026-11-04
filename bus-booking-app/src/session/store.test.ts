import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/index.js';
import { MESSAGES } from '../messages/index.js';
import { DEFAULT_SECURITY_QUESTION_ID } from '../models/accounts/index.js';
import type { AuthUser } from '../models/accounts/index.js';
import {
  SESSION_PATHS,
  clearSessionUser,
  getSessionState,
  loginSession,
  logoutSession,
  refreshSession,
  setSessionUser,
  subscribeToSession,
  type SessionState,
} from './store.js';

const TRAVELLER: AuthUser = {
  id: 'account-aisha',
  fullName: 'Aisha Kapoor',
  mobile: '9876543210',
  securityQuestionId: DEFAULT_SECURITY_QUESTION_ID,
};

interface RecordedCall {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

const calls: RecordedCall[] = [];

function stubFetch(responder: (url: string) => Promise<Response>): void {
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    calls.push({ url: String(input), init });
    return responder(String(input));
  });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

beforeEach(() => {
  calls.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearSessionUser();
});

describe('loginSession', () => {
  it('posts the credentials and holds the signed-in traveller', async () => {
    stubFetch(() => Promise.resolve(jsonResponse(200, TRAVELLER)));

    await loginSession('9876543210', 'Travel@123');

    expect(calls[0].url).toBe(`/api${SESSION_PATHS.login}`);
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ mobile: '9876543210', password: 'Travel@123' });
    expect(getSessionState()).toEqual({ user: TRAVELLER, status: 'authenticated' });
  });

  it('rejects with the server sentence and leaves nobody signed in', async () => {
    stubFetch(() =>
      Promise.resolve(jsonResponse(401, { error: { code: 'invalid_credentials', message: MESSAGES.loginIncorrect } })),
    );

    const caught: unknown = await loginSession('9876543210', 'wrong').catch((error: unknown) => error);

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).message).toBe(MESSAGES.loginIncorrect);
    expect(getSessionState().user).toBeNull();
  });
});

describe('logoutSession', () => {
  it('ends the session on the server and forgets it here', async () => {
    stubFetch(() => Promise.resolve(new Response(null, { status: 204 })));
    setSessionUser(TRAVELLER);

    await logoutSession();

    expect(calls[0].url).toBe(`/api${SESSION_PATHS.logout}`);
    expect(calls[0].init?.method).toBe('POST');
    expect(getSessionState()).toEqual({ user: null, status: 'anonymous' });
  });
});

describe('refreshSession', () => {
  it('adopts the account the server reports', async () => {
    stubFetch(() => Promise.resolve(jsonResponse(200, TRAVELLER)));

    await refreshSession();

    expect(calls[0].url).toBe(`/api${SESSION_PATHS.me}`);
    expect(getSessionState()).toEqual({ user: TRAVELLER, status: 'authenticated' });
  });

  it('becomes anonymous when the server says nobody is signed in', async () => {
    stubFetch(() => Promise.resolve(jsonResponse(401, { error: { code: 'not_signed_in', message: 'Please log in.' } })));

    await refreshSession();

    expect(getSessionState()).toEqual({ user: null, status: 'anonymous' });
  });

  it('does not throw when the backend cannot be reached', async () => {
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')));

    await expect(refreshSession()).resolves.toBeUndefined();
    expect(getSessionState().status).toBe('anonymous');
  });
});

describe('subscribeToSession', () => {
  it('tells listeners about every change until they unsubscribe', () => {
    const seen: SessionState[] = [];
    const unsubscribe = subscribeToSession((state: SessionState) => {
      seen.push(state);
    });

    setSessionUser(TRAVELLER);
    clearSessionUser();
    unsubscribe();
    setSessionUser(TRAVELLER);

    expect(seen).toHaveLength(2);
    expect(seen[0]).toEqual({ user: TRAVELLER, status: 'authenticated' });
    expect(seen[1]).toEqual({ user: null, status: 'anonymous' });
  });
});
