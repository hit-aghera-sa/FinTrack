// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  createTaskActivityClient,
  taskActivityPath,
  type ActivityFetch,
} from './TaskActivityClient.js';
import { ApiError } from '../../lib/api/index.js';

/** A transport that records the address it was called with and answers once. */
function answering(
  body: unknown,
  status = 200,
): { fetch: ActivityFetch; calls: string[] } {
  const calls: string[] = [];
  const fetchImpl: ActivityFetch = (input: string): Promise<Response> => {
    calls.push(input);
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  };
  return { fetch: fetchImpl, calls };
}

describe('taskActivityPath', () => {
  it('addresses one task\u2019s activity, with an optional limit', () => {
    expect(taskActivityPath('task-one')).toBe('/api/tasks/task-one/activity');
    expect(taskActivityPath('task-one', 20)).toBe('/api/tasks/task-one/activity?limit=20');
    expect(taskActivityPath('task one/two')).toBe('/api/tasks/task%20one%2Ftwo/activity');
  });
});

describe('TaskActivityClient', () => {
  it('reads the activity of one task newest first', async () => {
    const transport = answering([
      {
        id: 'activity-older',
        taskId: 'task-one',
        kind: 'created',
        actor: 'Priya Natarajan',
        createdAt: '2026-02-20T08:00:00.000Z',
      },
      {
        id: 'activity-newer',
        taskId: 'task-one',
        kind: 'status_changed',
        from: 'To do',
        to: 'Doing',
        actor: 'Dan Okafor',
        createdAt: '2026-03-01T10:00:00.000Z',
      },
    ]);

    const entries = await createTaskActivityClient(transport.fetch).listActivity('task-one');

    expect(transport.calls).toEqual(['/api/tasks/task-one/activity']);
    expect(entries.map((entry) => entry.id)).toEqual(['activity-newer', 'activity-older']);
    expect(entries[0]?.to).toBe('Doing');
  });

  it('passes the limit on to the endpoint', async () => {
    const transport = answering([]);

    await createTaskActivityClient(transport.fetch).listActivity('task-one', { limit: 5 });

    expect(transport.calls).toEqual(['/api/tasks/task-one/activity?limit=5']);
  });

  it('reports an unknown task as a 404', async () => {
    const transport = answering({ message: 'That task does not exist.' }, 404);
    const client = createTaskActivityClient(transport.fetch);

    await expect(client.listActivity('task-missing')).rejects.toBeInstanceOf(ApiError);

    try {
      await client.listActivity('task-missing');
      expect.unreachable();
    } catch (error: unknown) {
      expect(error instanceof ApiError ? error.status : -1).toBe(404);
      expect(error instanceof Error ? error.message : '').toBe('That task could not be found.');
    }
  });

  it('carries the server message of any other failure', async () => {
    const transport = answering({ message: 'The activity store is unavailable.' }, 500);

    try {
      await createTaskActivityClient(transport.fetch).listActivity('task-one');
      expect.unreachable();
    } catch (error: unknown) {
      expect(error instanceof ApiError ? error.status : -1).toBe(500);
      expect(error instanceof Error ? error.message : '').toBe('The activity store is unavailable.');
    }
  });

  it('reports an unreachable server as status 0', async () => {
    const failing: ActivityFetch = (): Promise<Response> => Promise.reject(new Error('offline'));

    try {
      await createTaskActivityClient(failing).listActivity('task-one');
      expect.unreachable();
    } catch (error: unknown) {
      expect(error instanceof ApiError ? error.status : -1).toBe(0);
    }
  });

  it('refuses a read with no task named', async () => {
    const transport = answering([]);

    await expect(
      createTaskActivityClient(transport.fetch).listActivity('   '),
    ).rejects.toBeInstanceOf(ApiError);
    expect(transport.calls).toEqual([]);
  });
});
