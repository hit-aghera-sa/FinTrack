import { describe, it, expect } from 'vitest';
import {
  API_BASE_PATH,
  ApiError,
  TASKS_ENDPOINT,
  extractTasks,
  getTasks,
  isApiError,
  saveTasks,
  serializeTaskList,
  type FetchLike,
  type HttpRequestInit,
  type HttpResponse,
} from './api.js';
import { COPY, type Task } from '../models/index.js';

const tasks: Task[] = [
  { id: 'a1', title: 'Alex QA groceries', completed: false, createdAt: '2024-05-01T10:00:00.000Z' },
  { id: 'b2', title: 'Priya Lunch prep', completed: true, createdAt: '2024-05-02T10:00:00.000Z' },
];

interface Call {
  readonly url: string;
  readonly init: HttpRequestInit | undefined;
}

interface Stub {
  readonly fetch: FetchLike;
  readonly calls: Call[];
}

function jsonResponse(status: number, payload: unknown): HttpResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: (): Promise<unknown> => Promise.resolve(payload),
  };
}

function stubFetch(response: HttpResponse): Stub {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = (url: string, init?: HttpRequestInit): Promise<HttpResponse> => {
    calls.push({ url, init });
    return Promise.resolve(response);
  };
  return { fetch: fetchImpl, calls };
}

function failingFetch(error: unknown): FetchLike {
  return (): Promise<HttpResponse> => Promise.reject(error);
}

describe('endpoint constants', () => {
  it('uses the /api base path from the shared route table', () => {
    expect(API_BASE_PATH).toBe('/api');
    expect(TASKS_ENDPOINT).toBe('/api/tasks');
  });
});

describe('getTasks', () => {
  it('issues GET /api/tasks as JSON without cookies or auth', async () => {
    const stub = stubFetch(jsonResponse(200, tasks));
    const result = await getTasks(stub.fetch);

    expect(result.map((task: Task) => task.id)).toEqual(['a1', 'b2']);
    expect(stub.calls).toHaveLength(1);

    const call = stub.calls[0];
    expect(call?.url).toBe('/api/tasks');
    expect(call?.init?.method).toBe('GET');
    expect(call?.init?.body).toBeUndefined();
    expect(call?.init?.credentials).toBe('omit');
    expect(call?.init?.headers?.['Content-Type']).toBe('application/json');
    expect(call?.init?.headers?.Accept).toBe('application/json');
    expect(Object.keys(call?.init?.headers ?? {})).toEqual(['Content-Type', 'Accept']);
  });

  it('accepts an empty list as a success', async () => {
    const stub = stubFetch(jsonResponse(200, []));
    await expect(getTasks(stub.fetch)).resolves.toEqual([]);
  });

  it('accepts the wrapped { tasks } envelope', async () => {
    const stub = stubFetch(jsonResponse(200, { tasks }));
    const result = await getTasks(stub.fetch);
    expect(result.map((task: Task) => task.title)).toEqual(['Alex QA groceries', 'Priya Lunch prep']);
  });

  it('never aliases the parsed payload', async () => {
    const payload = [{ ...tasks[0] }];
    const stub = stubFetch(jsonResponse(200, payload));
    const result = await getTasks(stub.fetch);
    result.pop();
    expect(payload).toHaveLength(1);
  });

  it('throws the server message on a non-OK response', async () => {
    const stub = stubFetch(
      jsonResponse(500, { error: { code: 'server_error', message: COPY.errors.unexpected } }),
    );
    await expect(getTasks(stub.fetch)).rejects.toBeInstanceOf(ApiError);

    try {
      await getTasks(stub.fetch);
      expect.unreachable?.();
    } catch (error: unknown) {
      expect(isApiError(error)).toBe(true);
      if (isApiError(error)) {
        expect(error.message).toBe(COPY.errors.unexpected);
        expect(error.status).toBe(500);
        expect(error.code).toBe('server_error');
      }
    }
  });

  it('falls back to the load copy when the failure body is unusable', async () => {
    const stub = stubFetch(jsonResponse(503, 'nope'));
    try {
      await getTasks(stub.fetch);
      expect.unreachable?.();
    } catch (error: unknown) {
      expect(isApiError(error)).toBe(true);
      if (isApiError(error)) {
        expect(error.message).toBe(COPY.errors.loadFailed);
        expect(error.status).toBe(503);
        expect(error.code).toBeNull();
      }
    }
  });

  it('throws on a network failure and keeps the cause', async () => {
    const boom = new Error('connection reset by peer');
    try {
      await getTasks(failingFetch(boom));
      expect.unreachable?.();
    } catch (error: unknown) {
      expect(isApiError(error)).toBe(true);
      if (isApiError(error)) {
        expect(error.message).toBe(COPY.errors.loadFailed);
        expect(error.status).toBeNull();
        expect(error.cause).toBe(boom);
      }
    }
  });

  it('throws when a 200 body is not a task list', async () => {
    const stub = stubFetch(jsonResponse(200, { totally: 'wrong' }));
    await expect(getTasks(stub.fetch)).rejects.toThrow(COPY.errors.loadFailed);
  });
});

describe('saveTasks', () => {
  it('PUTs the complete list to /api/tasks', async () => {
    const stub = stubFetch(jsonResponse(200, tasks));
    const result = await saveTasks(tasks, stub.fetch);

    expect(result.map((task: Task) => task.id)).toEqual(['a1', 'b2']);

    const call = stub.calls[0];
    expect(call?.url).toBe('/api/tasks');
    expect(call?.init?.method).toBe('PUT');
    expect(call?.init?.credentials).toBe('omit');
    expect(call?.init?.headers?.['Content-Type']).toBe('application/json');
    expect(JSON.parse(call?.init?.body ?? 'null')).toEqual(tasks);
  });

  it('sends an empty array when the list is cleared', async () => {
    const stub = stubFetch(jsonResponse(200, []));
    await expect(saveTasks([], stub.fetch)).resolves.toEqual([]);
    expect(stub.calls[0]?.init?.body).toBe('[]');
  });

  it('surfaces the save copy for a rejected body', async () => {
    const stub = stubFetch(jsonResponse(400, { error: { code: 'bad_request', message: '   ' } }));
    try {
      await saveTasks(tasks, stub.fetch);
      expect.unreachable?.();
    } catch (error: unknown) {
      expect(isApiError(error)).toBe(true);
      if (isApiError(error)) {
        expect(error.message).toBe(COPY.errors.saveFailed);
        expect(error.status).toBe(400);
        expect(error.code).toBe('bad_request');
      }
    }
  });

  it('throws the save copy on a network failure', async () => {
    await expect(saveTasks(tasks, failingFetch(new Error('offline')))).rejects.toThrow(
      COPY.errors.saveFailed,
    );
  });
});

describe('payload helpers', () => {
  it('serialises only the wire fields', () => {
    const parsed: unknown = JSON.parse(serializeTaskList(tasks));
    expect(parsed).toEqual(tasks);
  });

  it('rejects payloads that are not task lists', () => {
    expect(extractTasks(null)).toBeNull();
    expect(extractTasks('nope')).toBeNull();
    expect(extractTasks({ tasks: 'nope' })).toBeNull();
    expect(extractTasks([{ id: 'a1' }])).toBeNull();
    expect(extractTasks([])).toEqual([]);
  });
});
