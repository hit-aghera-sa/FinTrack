// PROTECTED built-in app layer (app-jobs, first-writer-frozen). Do NOT edit or re-emit — import it.
// Durable background jobs + scheduling on the app's OWN Postgres (process.env.DATABASE_URL). The SQL
// client is injected — pass a thin adapter over your Prisma client or pg pool. Start ONE worker from
// your server entry: const worker = startJobWorker(queue, handlers). No external service, no new env.

/** The two-method SQL surface the queue needs. Adapt your client:
 *    Prisma:  { query: (text, params) => prisma.$queryRawUnsafe(text, ...(params ?? [])) }
 *    pg Pool: { query: async (text, params) => (await pool.query(text, params)).rows }
 */
export interface SqlRunner {
  query(text: string, params?: unknown[]): Promise<Array<Record<string, unknown>>>;
}

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface JobRecord {
  id: string;
  name: string;
  payload: unknown;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  /** Earliest time the job may run (ISO-8601). Scheduling = enqueue with a future runAt. */
  runAt: string;
  /** For repeating jobs: seconds between runs. Null for one-shot jobs. */
  repeatSeconds: number | null;
  lastError: string | null;
}

export interface EnqueueOptions {
  /** Run no earlier than this time. Default: now. */
  runAt?: Date;
  /** Attempts before the job parks as failed. Default 5. */
  maxAttempts?: number;
  /** Re-queue this many seconds after each SUCCESSFUL run (cron-lite). Omit for one-shot. */
  repeatEverySeconds?: number;
}

export interface JobQueue {
  enqueue(name: string, payload?: unknown, options?: EnqueueOptions): Promise<string>;
  getJob(id: string): Promise<JobRecord | null>;
  /** Most recent first, bounded. For an admin/status screen — never bytes-heavy. */
  listJobs(limit?: number): Promise<JobRecord[]>;
  /** INTERNAL worker surface — claim one due job, then settle it. */
  claimNext(): Promise<JobRecord | null>;
  settle(job: JobRecord, outcome: { ok: true } | { ok: false; error: string }): Promise<void>;
}

export type JobHandler = (payload: unknown, job: JobRecord) => Promise<void>;

export interface WorkerHandle {
  /** Stop polling and wait for in-flight handlers to finish. Idempotent. */
  stop(): Promise<void>;
}

const TABLE_SQL =
  'CREATE TABLE IF NOT EXISTS app_jobs (' +
  ' id text PRIMARY KEY,' +
  ' name text NOT NULL,' +
  ' payload jsonb,' +
  " status text NOT NULL DEFAULT 'queued'," +
  ' attempts integer NOT NULL DEFAULT 0,' +
  ' max_attempts integer NOT NULL DEFAULT 5,' +
  ' run_at timestamptz NOT NULL DEFAULT now(),' +
  ' repeat_seconds integer,' +
  ' last_error text,' +
  ' created_at timestamptz NOT NULL DEFAULT now(),' +
  ' updated_at timestamptz NOT NULL DEFAULT now())';
const INDEX_SQL =
  'CREATE INDEX IF NOT EXISTS ix_app_jobs_due ON app_jobs (status, run_at)';

function rowToJob(row: Record<string, unknown>): JobRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    payload: row.payload ?? null,
    status: String(row.status) as JobStatus,
    attempts: Number(row.attempts),
    maxAttempts: Number(row.max_attempts),
    runAt: new Date(String(row.run_at)).toISOString(),
    repeatSeconds: row.repeat_seconds == null ? null : Number(row.repeat_seconds),
    lastError: row.last_error == null ? null : String(row.last_error),
  };
}

/** Exponential backoff for retry n (1-based): 2^n seconds, capped at 10 minutes. */
function backoffSeconds(attempt: number): number {
  return Math.min(Math.pow(2, attempt), 600);
}

/** The DURABLE queue on the app's own Postgres. Call once at boot; it creates its table if absent. */
export async function createPostgresJobQueue(sql: SqlRunner): Promise<JobQueue> {
  await sql.query(TABLE_SQL);
  await sql.query(INDEX_SQL);
  return {
    async enqueue(name, payload, options) {
      const id = globalThis.crypto.randomUUID();
      await sql.query(
        'INSERT INTO app_jobs (id, name, payload, max_attempts, run_at, repeat_seconds)' +
          ' VALUES ($1, $2, $3, $4, $5, $6)',
        [
          id,
          name,
          JSON.stringify(payload ?? null),
          options?.maxAttempts ?? 5,
          (options?.runAt ?? new Date()).toISOString(),
          options?.repeatEverySeconds ?? null,
        ],
      );
      return id;
    },
    async getJob(id) {
      const rows = await sql.query('SELECT * FROM app_jobs WHERE id = $1', [id]);
      return rows.length > 0 ? rowToJob(rows[0]!) : null;
    },
    async listJobs(limit) {
      const rows = await sql.query(
        'SELECT * FROM app_jobs ORDER BY created_at DESC LIMIT $1',
        [Math.min(Math.max(limit ?? 50, 1), 200)],
      );
      return rows.map(rowToJob);
    },
    async claimNext() {
      // SKIP LOCKED: many pollers, no double-claims, no lock queue behind a slow job.
      const rows = await sql.query(
        'UPDATE app_jobs SET status = $1, attempts = attempts + 1, updated_at = now()' +
          ' WHERE id = (SELECT id FROM app_jobs WHERE status = $2 AND run_at <= now()' +
          ' ORDER BY run_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *',
        ['running', 'queued'],
      );
      return rows.length > 0 ? rowToJob(rows[0]!) : null;
    },
    async settle(job, outcome) {
      if (outcome.ok) {
        if (job.repeatSeconds != null) {
          // Success on a repeating job: schedule the next run, reset the attempt budget.
          await sql.query(
            'UPDATE app_jobs SET status = $1, attempts = 0, last_error = NULL,' +
              " run_at = now() + ($2 || ' seconds')::interval, updated_at = now() WHERE id = $3",
            ['queued', String(job.repeatSeconds), job.id],
          );
        } else {
          await sql.query(
            'UPDATE app_jobs SET status = $1, last_error = NULL, updated_at = now() WHERE id = $2',
            ['completed', job.id],
          );
        }
        return;
      }
      if (job.attempts < job.maxAttempts) {
        await sql.query(
          'UPDATE app_jobs SET status = $1, last_error = $2,' +
            " run_at = now() + ($3 || ' seconds')::interval, updated_at = now() WHERE id = $4",
          ['queued', outcome.error, String(backoffSeconds(job.attempts)), job.id],
        );
      } else {
        await sql.query(
          'UPDATE app_jobs SET status = $1, last_error = $2, updated_at = now() WHERE id = $3',
          ['failed', outcome.error, job.id],
        );
      }
    },
  };
}

/**
 * NON-DURABLE in-memory queue for apps with NO datastore. Jobs are LOST on restart — the name says
 * so, and there is no silent fallback to it: choosing it is an explicit decision in your code.
 */
export function createMemoryJobQueue(): JobQueue {
  const jobs = new Map<string, JobRecord>();
  return {
    async enqueue(name, payload, options) {
      const id = globalThis.crypto.randomUUID();
      jobs.set(id, {
        id,
        name,
        payload: payload ?? null,
        status: 'queued',
        attempts: 0,
        maxAttempts: options?.maxAttempts ?? 5,
        runAt: (options?.runAt ?? new Date()).toISOString(),
        repeatSeconds: options?.repeatEverySeconds ?? null,
        lastError: null,
      });
      return id;
    },
    async getJob(id) {
      return jobs.get(id) ?? null;
    },
    async listJobs(limit) {
      return [...jobs.values()].slice(0, Math.min(Math.max(limit ?? 50, 1), 200));
    },
    async claimNext() {
      const now = Date.now();
      for (const job of jobs.values()) {
        if (job.status === 'queued' && Date.parse(job.runAt) <= now) {
          job.status = 'running';
          job.attempts += 1;
          return job;
        }
      }
      return null;
    },
    async settle(job, outcome) {
      const stored = jobs.get(job.id);
      if (!stored) return;
      if (outcome.ok) {
        if (stored.repeatSeconds != null) {
          stored.status = 'queued';
          stored.attempts = 0;
          stored.lastError = null;
          stored.runAt = new Date(Date.now() + stored.repeatSeconds * 1000).toISOString();
        } else {
          stored.status = 'completed';
          stored.lastError = null;
        }
      } else if (stored.attempts < stored.maxAttempts) {
        stored.status = 'queued';
        stored.lastError = outcome.error;
        stored.runAt = new Date(Date.now() + backoffSeconds(stored.attempts) * 1000).toISOString();
      } else {
        stored.status = 'failed';
        stored.lastError = outcome.error;
      }
    },
  };
}

export interface WorkerOptions {
  /** Concurrent handlers. Default 2. */
  concurrency?: number;
  /** Poll interval when the queue is empty, ms. Default 1000. */
  pollMs?: number;
  /** Sink for handler failures (job name + message, never a payload). Default console.error. */
  onError?: (jobName: string, message: string) => void;
}

/**
 * Start the polling worker. Call ONCE from your server entry after creating the queue; keep the
 * handle and call stop() on shutdown. A job whose name has no handler fails that ATTEMPT (and so
 * retries with backoff) rather than being silently dropped.
 */
export function startJobWorker(
  queue: JobQueue,
  handlers: Record<string, JobHandler>,
  options?: WorkerOptions,
): WorkerHandle {
  const concurrency = Math.max(options?.concurrency ?? 2, 1);
  const pollMs = Math.max(options?.pollMs ?? 1000, 10);
  const onError = options?.onError ?? ((name, message) => console.error('[jobs] ' + name + ': ' + message));
  let stopped = false;
  const inFlight = new Set<Promise<void>>();

  async function runOne(job: JobRecord): Promise<void> {
    const handler = handlers[job.name];
    if (!handler) {
      await queue.settle(job, { ok: false, error: 'no handler registered for "' + job.name + '"' });
      onError(job.name, 'no handler registered');
      return;
    }
    try {
      await handler(job.payload, job);
      await queue.settle(job, { ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await queue.settle(job, { ok: false, error: message });
      onError(job.name, message);
    }
  }

  async function loop(): Promise<void> {
    while (!stopped) {
      let claimed = false;
      if (inFlight.size < concurrency) {
        const job = await queue.claimNext().catch(() => null);
        if (job) {
          claimed = true;
          const p = runOne(job).finally(() => inFlight.delete(p));
          inFlight.add(p);
        }
      }
      if (!claimed) await new Promise((r) => setTimeout(r, pollMs));
    }
  }

  const looping = loop();
  return {
    async stop() {
      stopped = true;
      await looping;
      await Promise.allSettled([...inFlight]);
    },
  };
}
