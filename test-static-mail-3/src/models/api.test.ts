import { describe, it, expect } from 'vitest';
import {
  API_ROUTES,
  HTTP_STATUS_BY_ERROR_CODE,
  TASKS_PATH,
  apiError,
  isApiErrorResponse,
  statusForErrorCode,
  taskPath,
  tasksQuery,
} from './api.js';
import { COPY } from './copy.js';

describe('api contract', () => {
  it('exposes the route table', () => {
    expect(API_ROUTES.tasks).toBe('/api/tasks');
    expect(API_ROUTES.health).toBe('/api/health');
    expect(API_ROUTES.task('a1')).toBe('/api/tasks/a1');
  });

  it('encodes ids in resource paths', () => {
    expect(taskPath('a/1 b')).toBe('/api/tasks/a%2F1%20b');
  });

  it('omits the default filter from the query string', () => {
    expect(tasksQuery()).toBe(TASKS_PATH);
    expect(tasksQuery('all')).toBe(TASKS_PATH);
    expect(tasksQuery('active')).toBe('/api/tasks?filter=active');
    expect(tasksQuery('completed')).toBe('/api/tasks?filter=completed');
  });

  it('maps error codes to http statuses', () => {
    expect(statusForErrorCode('title_required')).toBe(400);
    expect(statusForErrorCode('title_too_long')).toBe(400);
    expect(statusForErrorCode('not_found')).toBe(404);
    expect(statusForErrorCode('server_error')).toBe(500);
    expect(Object.keys(HTTP_STATUS_BY_ERROR_CODE)).toHaveLength(5);
  });

  it('builds and recognises error payloads', () => {
    const payload = apiError('not_found', COPY.errors.notFound);
    expect(payload).toEqual({ error: { code: 'not_found', message: 'That task no longer exists.' } });
    expect(isApiErrorResponse(payload)).toBe(true);
    expect(isApiErrorResponse({ task: { id: 'a1' } })).toBe(false);
    expect(isApiErrorResponse(null)).toBe(false);
  });
});
