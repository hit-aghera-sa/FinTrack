import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MESSAGES } from '../messages/index.js';
import { apiFetch, apiPath } from './client.js';
import { ApiError, isOfflineError } from './errors.js';

interface RecordedCall {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

const calls: RecordedCall[] = [];

function stubFetch(responder: (url: string, init: RequestInit | undefined) => Promise<Response>): void {
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    calls.push({ url: String(input), init });
    return responder(String(input), init);
  });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  calls.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiPath', () => {
  it('puts every call under the /api prefix exactly once', () => {
    expect(apiPath('/auth/me')).toBe('/api/auth/me');
    expect(apiPath('auth/me')).toBe('/api/auth/me');
    expect(apiPath('/api/auth/me')).toBe('/api/auth/me');
  });
});

describe('apiFetch', () => {
  it('reads JSON from the API and sends the session cookie', async () => {
    stubFetch(() => Promise.resolve(jsonResponse(200, { fullName: 'Aisha Kapoor' })));

    const result = await apiFetch<{ fullName: string }>('/auth/me');

    expect(result).toEqual({ fullName: 'Aisha Kapoor' });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/api/auth/me');
    expect(calls[0].init?.method).toBe('GET');
    expect(calls[0].init?.credentials).toBe('same-origin');
    expect(calls[0].init?.body).toBeUndefined();
  });

  it('sends a POST body as JSON', async () => {
    stubFetch(() => Promise.resolve(jsonResponse(200, { id: 'ok' })));

    await apiFetch<{ id: string }>('/auth/login', { method: 'POST', body: { mobile: '9876543210', password: 'Travel@123' } });

    expect(calls[0].url).toBe('/api/auth/login');
    expect(calls[0].init?.method).toBe('POST');
    const headers = calls[0].init?.headers as Record<string, string> | undefined;
    expect(headers?.['content-type']).toBe('application/json');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ mobile: '9876543210', password: 'Travel@123' });
  });

  it('resolves to undefined for a no-content success', async () => {
    stubFetch(() => Promise.resolve(new Response(null, { status: 204 })));

    await expect(apiFetch<void>('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('maps the shared error body to an ApiError', async () => {
    stubFetch(() =>
      Promise.resolve(jsonResponse(401, { error: { code: 'invalid_credentials', message: MESSAGES.loginIncorrect } })),
    );

    const caught: unknown = await apiFetch('/auth/login', { method: 'POST', body: {} }).catch((error: unknown) => error);

    expect(caught).toBeInstanceOf(ApiError);
    const error = caught as ApiError;
    expect(error.status).toBe(401);
    expect(error.code).toBe('invalid_credentials');
    expect(error.message).toBe(MESSAGES.loginIncorrect);
    expect(isOfflineError(error)).toBe(false);
  });

  it('surfaces a dropped connection as the no-internet message', async () => {
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')));

    const caught: unknown = await apiFetch('/auth/me').catch((error: unknown) => error);

    expect(caught).toBeInstanceOf(ApiError);
    const error = caught as ApiError;
    expect(error.status).toBe(0);
    expect(error.message).toBe('No internet connection. Please check and try again.');
    expect(isOfflineError(error)).toBe(true);
  });

  it('re-throws an abort so a superseded call is not reported as offline', async () => {
    const aborted = new Error('The operation was aborted.');
    aborted.name = 'AbortError';
    stubFetch(() => Promise.reject(aborted));

    const caught: unknown = await apiFetch('/search?from=Pune').catch((error: unknown) => error);

    expect(caught).toBe(aborted);
    expect(isOfflineError(caught)).toBe(false);
  });

  it('reports an unusable success body rather than returning broken data', async () => {
    stubFetch(() => Promise.resolve(new Response('<html>hello</html>', { status: 200 })));

    const caught: unknown = await apiFetch('/auth/me').catch((error: unknown) => error);

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).code).toBe('unexpected_response');
  });
});
