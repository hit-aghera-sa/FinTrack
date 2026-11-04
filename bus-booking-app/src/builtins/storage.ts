// PROTECTED built-in app layer (app-storage, first-writer-frozen). Do NOT edit or re-emit — import it.
// Durable per-app FILE STORAGE client. The store base URL and the service token are supplied at
// RUNTIME by the platform (env APP_STORAGE_BASE_URL / APP_STORAGE_TOKEN) — NEVER hardcoded here, and
// the token must never be exposed to the browser: call this from your app's OWN server routes and put
// your app's auth in front.

export interface StoredObjectMeta {
  /** The key you stored the object under, verbatim. */
  key: string;
  contentType: string;
  bytes: number;
  updatedAt: string;
}

export interface StoredObject extends StoredObjectMeta {
  content: ArrayBuffer;
}

/** Thrown when the platform did not supply the storage env — see the module header. */
export class AppStorageNotConfiguredError extends Error {
  constructor() {
    super(
      'App storage is not configured: APP_STORAGE_BASE_URL / APP_STORAGE_TOKEN are absent from the ' +
        'environment. Uploads would be lost, so storage calls fail loudly instead.',
    );
    this.name = 'AppStorageNotConfiguredError';
  }
}

/** Thrown for a non-2xx store response. Carries status + the server's error code, never the token. */
export class AppStorageRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super('App storage request failed: HTTP ' + status + ' (' + code + ')');
    this.name = 'AppStorageRequestError';
  }
}

interface StorageConfig {
  baseUrl: string;
  token: string;
}

function resolveConfig(): StorageConfig {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  const baseUrl = (env.APP_STORAGE_BASE_URL ?? '').replace(/\/+$/, '');
  const token = env.APP_STORAGE_TOKEN ?? '';
  if (baseUrl === '' || token === '') throw new AppStorageNotConfiguredError();
  return { baseUrl, token };
}

async function failFrom(res: Response): Promise<never> {
  let code = 'unknown';
  try {
    const body = (await res.json()) as { error?: { code?: string } };
    if (body?.error?.code) code = body.error.code;
  } catch {
    // non-JSON error body — the status alone will have to do
  }
  throw new AppStorageRequestError(res.status, code);
}

/** Store (or replace) bytes under `key`. Returns the stored object's metadata. */
export async function putObject(
  key: string,
  content: ArrayBuffer | Uint8Array | string,
  contentType = 'application/octet-stream',
): Promise<StoredObjectMeta> {
  const { baseUrl, token } = resolveConfig();
  const body = typeof content === 'string' ? new TextEncoder().encode(content) : content;
  const res = await fetch(baseUrl + '/objects?key=' + encodeURIComponent(key), {
    method: 'PUT',
    headers: { authorization: 'Bearer ' + token, 'content-type': contentType },
    body: body as BodyInit,
  });
  if (!res.ok) await failFrom(res);
  return (await res.json()) as StoredObjectMeta;
}

/** Read one object, or null when no such key exists. */
export async function getObject(key: string): Promise<StoredObject | null> {
  const { baseUrl, token } = resolveConfig();
  const res = await fetch(baseUrl + '/objects?key=' + encodeURIComponent(key), {
    method: 'GET',
    headers: { authorization: 'Bearer ' + token },
  });
  if (res.status === 404) return null;
  if (!res.ok) await failFrom(res);
  return {
    key,
    contentType: res.headers.get('content-type') ?? 'application/octet-stream',
    bytes: Number(res.headers.get('content-length') ?? 0),
    updatedAt: res.headers.get('x-app-storage-updated-at') ?? '',
    content: await res.arrayBuffer(),
  };
}

/** Delete one object. Resolves true when it existed, false when it did not (idempotent). */
export async function deleteObject(key: string): Promise<boolean> {
  const { baseUrl, token } = resolveConfig();
  const res = await fetch(baseUrl + '/objects?key=' + encodeURIComponent(key), {
    method: 'DELETE',
    headers: { authorization: 'Bearer ' + token },
  });
  if (res.status === 404) return false;
  if (!res.ok) await failFrom(res);
  return true;
}

/** Metadata for every stored object, sorted by key. Never the bytes. */
export async function listObjects(): Promise<StoredObjectMeta[]> {
  const { baseUrl, token } = resolveConfig();
  const res = await fetch(baseUrl + '/objects', {
    method: 'GET',
    headers: { authorization: 'Bearer ' + token },
  });
  if (!res.ok) await failFrom(res);
  const body = (await res.json()) as { objects: StoredObjectMeta[] };
  return body.objects;
}
