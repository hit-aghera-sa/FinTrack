import { describe, it, expect } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import type { Express } from 'express';
import { COPY } from '../../models/index.js';
import type { ApiErrorCode, ListTasksOptions, Task } from '../../models/index.js';
import { TASKS_ROUTE_PATHS, createTasksRouter } from './tasksRouter.js';
import type { TasksApiStore } from './tasksRouter.js';

const PINNED_A = '2024-05-01T10:00:00.000Z';
const PINNED_B = '2024-05-02T10:00:00.000Z';

const seeded: Task[] = [
  { id: 'b2', title: 'Priya Lunch prep', completed: true, createdAt: PINNED_B },
  { id: 'a1', title: 'Alex QA groceries', completed: false, createdAt: PINNED_A },
];

/**
 * A stand-in for the error a store raises for an invalid task list.
 *
 * The router recognises store validation failures STRUCTURALLY (a known error code,
 * or a name ending in `ValidationError`), so this double reproduces exactly the shape
 * the router has to cope with WITHOUT importing the store lane's error class — that
 * lane owns its own error type and may rename or reshape it.
 */
class StoreValidationError extends Error {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'TaskValidationError';
    this.code = code;
  }
}

/** A store double implementing exactly the port the router depends on. */
class FakeStore implements TasksApiStore {
  tasks: Task[];
  listError: unknown = null;
  replaceError: unknown = null;
  replaceCalls: unknown[] = [];

  constructor(tasks: readonly Task[] = []) {
    this.tasks = tasks.map((task: Task) => ({ ...task }));
  }

  list(options?: ListTasksOptions): Promise<Task[]> {
    void options;
    if (this.listError !== null) return Promise.reject(this.listError);
    return Promise.resolve(this.tasks.map((task: Task) => ({ ...task })));
  }

  replaceAll(input: unknown): Promise<Task[]> {
    this.replaceCalls.push(input);
    if (this.replaceError !== null) return Promise.reject(this.replaceError);
    const incoming: unknown[] = Array.isArray(input) ? input : [];
    this.tasks = incoming.map((raw: unknown) => ({ ...(raw as Task) }));
    return Promise.resolve(this.tasks.map((task: Task) => ({ ...task })));
  }
}

/** A booted router, reachable over real HTTP on an ephemeral port. */
interface Harness {
  readonly origin: string;
  close(): Promise<void>;
}

async function start(store: TasksApiStore): Promise<Harness> {
  const app: Express = express();
  app.use('/api', createTasksRouter(store));
  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: (): Promise<void> =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}

interface Reply {
  readonly status: number;
  readonly headers: http.IncomingHttpHeaders;
  readonly text: string;
}

interface SendOptions {
  readonly body?: string;
  readonly headers?: Record<string, string>;
  readonly contentType?: string;
}

function send(origin: string, method: string, path: string, options: SendOptions = {}): Promise<Reply> {
  return new Promise<Reply>((resolve, reject) => {
    const target = new URL(path, origin);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.body !== undefined) {
      headers['Content-Type'] = options.contentType ?? 'application/json';
      headers['Content-Length'] = String(Buffer.byteLength(options.body));
    }
    for (const [name, value] of Object.entries(options.headers ?? {})) {
      headers[name] = value;
    }

    const request = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: target.pathname,
        method,
        headers,
      },
      (response) => {
        let text = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => {
          text += chunk;
        });
        response.on('end', () => {
          resolve({ status: response.statusCode ?? 0, headers: response.headers, text });
        });
      },
    );
    request.on('error', reject);
    if (options.body !== undefined) request.write(options.body);
    request.end();
  });
}

function parse(reply: Reply): unknown {
  return JSON.parse(reply.text) as unknown;
}

function titlesOf(reply: Reply): string[] {
  const payload = parse(reply) as Task[];
  return payload.map((task: Task) => task.title);
}

async function withStore(
  store: FakeStore,
  run: (origin: string) => Promise<void>,
): Promise<void> {
  const harness = await start(store);
  try {
    await run(harness.origin);
  } finally {
    await harness.close();
  }
}

describe('route table', () => {
  it('registers only the collection paths', () => {
    expect([...TASKS_ROUTE_PATHS]).toEqual(['/tasks', '/api/tasks']);
  });
});

describe('GET /api/tasks', () => {
  it('answers an empty store with a 200 and an empty array', async () => {
    await withStore(new FakeStore(), async (origin: string) => {
      const reply = await send(origin, 'GET', '/api/tasks');
      expect(reply.status).toBe(200);
      expect(String(reply.headers['content-type'])).toContain('application/json');
      expect(parse(reply)).toEqual([]);
    });
  });

  it('returns the stored list in store order', async () => {
    await withStore(new FakeStore(seeded), async (origin: string) => {
      const reply = await send(origin, 'GET', '/api/tasks');
      expect(reply.status).toBe(200);
      expect(titlesOf(reply)).toEqual(['Priya Lunch prep', 'Alex QA groceries']);
      expect(parse(reply)).toEqual(seeded);
    });
  });

  it('degrades an unexpected store failure to a 500 with the shared copy', async () => {
    const store = new FakeStore();
    store.listError = new Error('connection reset by peer');
    await withStore(store, async (origin: string) => {
      const reply = await send(origin, 'GET', '/api/tasks');
      expect(reply.status).toBe(500);
      expect(parse(reply)).toEqual({
        error: { code: 'server_error', message: COPY.errors.unexpected },
      });
      expect(reply.text).not.toContain('connection reset');
    });
  });
});

describe('PUT /api/tasks', () => {
  it('replaces the whole list and echoes back what is stored', async () => {
    const store = new FakeStore(seeded);
    await withStore(store, async (origin: string) => {
      const next: Task[] = [
        { id: 'c3', title: 'Book dentist run-b7', completed: false, createdAt: PINNED_B },
      ];
      const reply = await send(origin, 'PUT', '/api/tasks', { body: JSON.stringify(next) });
      expect(reply.status).toBe(200);
      expect(parse(reply)).toEqual(next);
      expect(store.tasks.map((task: Task) => task.id)).toEqual(['c3']);
      expect(store.replaceCalls).toHaveLength(1);
    });
  });

  it('accepts the wrapped { tasks } envelope', async () => {
    const store = new FakeStore();
    await withStore(store, async (origin: string) => {
      const reply = await send(origin, 'PUT', '/api/tasks', {
        body: JSON.stringify({ tasks: seeded }),
      });
      expect(reply.status).toBe(200);
      expect(titlesOf(reply)).toEqual(['Priya Lunch prep', 'Alex QA groceries']);
    });
  });

  it('clears the list when given an empty array', async () => {
    const store = new FakeStore(seeded);
    await withStore(store, async (origin: string) => {
      const reply = await send(origin, 'PUT', '/api/tasks', { body: '[]' });
      expect(reply.status).toBe(200);
      expect(parse(reply)).toEqual([]);
      expect(store.tasks).toHaveLength(0);
    });
  });

  it('rejects a body that is not a list without touching the store', async () => {
    const store = new FakeStore(seeded);
    await withStore(store, async (origin: string) => {
      const reply = await send(origin, 'PUT', '/api/tasks', {
        body: JSON.stringify({ title: 'Alex QA run-b7' }),
      });
      expect(reply.status).toBe(400);
      expect(parse(reply)).toEqual({
        error: { code: 'bad_request', message: COPY.errors.unexpected },
      });
      expect(store.replaceCalls).toHaveLength(0);
      expect(store.tasks).toHaveLength(2);
    });
  });

  it('rejects a malformed JSON body as a bad request', async () => {
    await withStore(new FakeStore(), async (origin: string) => {
      const reply = await send(origin, 'PUT', '/api/tasks', { body: '{"tasks":' });
      expect(reply.status).toBe(400);
      const payload = parse(reply) as { error: { code: string } };
      expect(payload.error.code).toBe('bad_request');
    });
  });

  it('surfaces a store validation error as a 400 with its own message', async () => {
    const store = new FakeStore();
    store.replaceError = new StoreValidationError('title_too_long', COPY.errors.titleTooLong);
    await withStore(store, async (origin: string) => {
      const reply = await send(origin, 'PUT', '/api/tasks', { body: '[{"title":"too long"}]' });
      expect(reply.status).toBe(400);
      expect(parse(reply)).toEqual({
        error: { code: 'title_too_long', message: COPY.errors.titleTooLong },
      });
    });
  });

  it('degrades an unexpected store write failure to a 500', async () => {
    const store = new FakeStore();
    store.replaceError = new Error('connection reset by peer');
    await withStore(store, async (origin: string) => {
      const reply = await send(origin, 'PUT', '/api/tasks', { body: '[]' });
      expect(reply.status).toBe(500);
      expect(parse(reply)).toEqual({
        error: { code: 'server_error', message: COPY.errors.unexpected },
      });
      expect(reply.text).not.toContain('connection reset');
    });
  });
});

describe('CORS', () => {
  it('answers the preflight for the Vite dev origin with 204', async () => {
    await withStore(new FakeStore(), async (origin: string) => {
      const reply = await send(origin, 'OPTIONS', '/api/tasks', {
        headers: { Origin: 'http://localhost:5173' },
      });
      expect(reply.status).toBe(204);
      expect(reply.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(String(reply.headers['access-control-allow-methods'])).toContain('PUT');
    });
  });

  it('does not echo an unknown origin', async () => {
    await withStore(new FakeStore(), async (origin: string) => {
      const reply = await send(origin, 'GET', '/api/tasks', {
        headers: { Origin: 'http://evil.example' },
      });
      expect(reply.status).toBe(200);
      expect(reply.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});

describe('unclaimed paths', () => {
  it('installs no catch-all, so other routes fall through to the composition root', async () => {
    await withStore(new FakeStore(), async (origin: string) => {
      const reply = await send(origin, 'GET', '/api/health');
      expect(reply.status).toBe(404);
    });
  });
});
