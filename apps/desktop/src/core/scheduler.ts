import { Clock, Context, Effect, Layer, Queue } from 'effect';
import { Db } from './db';

export type WakeReason = 'boot' | 'job-changed' | 'timer' | 'resume' | 'unlock' | 'active' | 'dispatch';

export interface Job {
  readonly id: string;
  readonly kind: string;
  readonly payload: unknown;
  readonly dueAt: number;
  readonly owner: string | null;
}

// Appended to the app's migrations as-is; never edit after it ships.
export const jobsTableSql = `
  CREATE TABLE jobs (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    payload TEXT NOT NULL,
    due_at INTEGER NOT NULL,
    owner TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX jobs_pending ON jobs(status, due_at);
`;

export class Scheduler extends Context.Service<
  Scheduler,
  {
    readonly at: (dueAt: number, kind: string, payload: unknown, owner?: string) => Effect.Effect<string>;
    readonly reschedule: (id: string, dueAt: number) => Effect.Effect<void>;
    readonly cancel: (id: string) => Effect.Effect<void>;
    readonly cancelOwner: (owner: string) => Effect.Effect<void>;
    readonly wake: (reason: WakeReason) => Effect.Effect<void>;
    // Engine-facing.
    readonly awaitWake: Effect.Effect<WakeReason>;
    readonly due: (now: number) => Effect.Effect<ReadonlyArray<Job>>;
    readonly nextDueAt: Effect.Effect<number | null>;
    readonly finish: (id: string) => Effect.Effect<void>;
  }
>()('core/Scheduler') {}

type Row = Record<string, unknown>;
const toJob = (row: Row): Job => ({
  id: String(row.id),
  kind: String(row.kind),
  payload: JSON.parse(String(row.payload)),
  dueAt: Number(row.due_at),
  owner: row.owner === null ? null : String(row.owner)
});

export const layerScheduler = Layer.effect(
  Scheduler,
  Effect.gen(function* () {
    const { sql } = yield* Db;
    // Capacity 1 + sliding: wakes that arrive before the loop looks collapse into one.
    const wakes = yield* Queue.sliding<WakeReason>(1);
    const wake = (reason: WakeReason) => Queue.offer(wakes, reason).pipe(Effect.asVoid);
    const run = (statement: string, ...params: Array<string | number | null>) =>
      Effect.sync(() => sql.prepare(statement).run(...params)).pipe(Effect.andThen(wake('job-changed')));

    return {
      at: (dueAt, kind, payload, owner) =>
        Effect.gen(function* () {
          const id = crypto.randomUUID();
          const now = yield* Clock.currentTimeMillis;
          yield* run(
            'INSERT INTO jobs (id, kind, payload, due_at, owner, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            id, kind, JSON.stringify(payload ?? null), dueAt, owner ?? null, now
          );
          return id;
        }),
      reschedule: (id, dueAt) => run("UPDATE jobs SET due_at = ? WHERE id = ? AND status = 'pending'", dueAt, id),
      cancel: (id) => run("UPDATE jobs SET status = 'cancelled' WHERE id = ? AND status = 'pending'", id),
      cancelOwner: (owner) => run("UPDATE jobs SET status = 'cancelled' WHERE owner = ? AND status = 'pending'", owner),
      wake,
      awaitWake: Queue.take(wakes),
      due: (now) =>
        Effect.sync(() =>
          (sql.prepare("SELECT * FROM jobs WHERE status = 'pending' AND due_at <= ? ORDER BY due_at, created_at").all(now) as Row[]).map(toJob)
        ),
      nextDueAt: Effect.sync(() => {
        const row = sql.prepare("SELECT MIN(due_at) AS next FROM jobs WHERE status = 'pending'").get() as Row | undefined;
        return row?.next == null ? null : Number(row.next);
      }),
      finish: (id) => Effect.sync(() => void sql.prepare("UPDATE jobs SET status = 'done' WHERE id = ?").run(id))
    };
  })
);
