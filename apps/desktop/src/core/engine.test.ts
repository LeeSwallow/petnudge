import { describe, expect, it } from 'vitest';
import { Effect, Exit, Schema } from 'effect';
import { TestClock } from 'effect/testing';
import { Db } from './db';
import { Engine } from './engine';
import { domainError, toWire } from './errors';
import { emit } from './events';
import { defineModule, handler } from './module';
import { Scheduler } from './scheduler';
import { memoryDb, recordEvents, runTest, settle, START, testEngine } from './testing';

const notesSql = 'CREATE TABLE notes (id TEXT PRIMARY KEY, body TEXT NOT NULL);';
const count = Effect.gen(function* () {
  const { sql } = yield* Db;
  return Number((sql.prepare('SELECT COUNT(*) AS n FROM notes').get() as { n: number }).n);
});

const notes = defineModule({
  id: 'notes',
  actions: {
    'note/add': handler(Schema.Struct({ id: Schema.String, body: Schema.String }), ({ id, body }) =>
      Effect.gen(function* () {
        const { sql } = yield* Db;
        sql.prepare('INSERT INTO notes (id, body) VALUES (?, ?)').run(id, body);
        yield* emit('note/added', { id });
        if (body === 'boom') return yield* Effect.fail(domainError('boom', 'rejected'));
        return id;
      })
    ),
    'note/remind': handler(Schema.Struct({ id: Schema.String, at: Schema.Number }), ({ id, at }) =>
      Effect.gen(function* () {
        const scheduler = yield* Scheduler;
        return yield* scheduler.at(at, 'note/ping', { id }, `note:${id}`);
      })
    ),
    'note/crash': handler(Schema.Unknown, () =>
      Effect.gen(function* () {
        const { sql } = yield* Db;
        sql.prepare("INSERT INTO notes (id, body) VALUES ('x', 'x')").run();
        yield* emit('note/added', { id: 'x' });
        return yield* Effect.die(new Error('bug'));
      })
    ),
    'note/forget': handler(Schema.Struct({ id: Schema.String }), ({ id }) =>
      Effect.gen(function* () {
        const scheduler = yield* Scheduler;
        yield* scheduler.cancelOwner(`note:${id}`);
      })
    )
  },
  queries: {
    'note/count': handler(Schema.Unknown, () => count)
  },
  on: {
    'note/added': (payload) => emit('note/indexed', payload)
  },
  schedules: {
    'note/ping': (payload, job) => emit('note/pinged', { ...(payload as object), late: job.late }),
    'note/explode': () => Effect.fail(domainError('boom', 'schedule failed'))
  }
});

// A second subscriber that always fails must not stop the first one.
const flaky = defineModule({
  id: 'flaky',
  on: { 'note/added': () => Effect.fail(domainError('flaky', 'subscriber failed')) }
});

const music = defineModule({
  id: 'music',
  optional: true,
  actions: { 'music/play': handler(Schema.Unknown, () => Effect.succeed('playing')) }
});

const engine = () => testEngine(memoryDb(notesSql), [notes, flaky, music], { disabled: new Set(['music']) });
const types = (events: ReadonlyArray<{ type: string }>) => events.map((event) => event.type);

describe('engine dispatch', () => {
  it('commits the handler and publishes its events, then subscriber events', () =>
    runTest(
      Effect.gen(function* () {
        const seen = yield* recordEvents;
        const { dispatch, query } = yield* Engine;
        expect(yield* dispatch('note/add', { id: 'a', body: 'hi' })).toBe('a');
        yield* settle;
        expect(yield* query('note/count')).toBe(1);
        expect(types(seen)).toEqual(['note/added', 'note/indexed']);
      }),
      engine()
    ));

  it('rolls back and drops events when the handler fails', () =>
    runTest(
      Effect.gen(function* () {
        const seen = yield* recordEvents;
        const { dispatch, query } = yield* Engine;
        const exit = yield* Effect.exit(dispatch('note/add', { id: 'a', body: 'boom' }));
        yield* settle;
        expect(toWire(exit)).toEqual({ ok: false, error: { code: 'boom', message: 'rejected' } });
        expect(yield* query('note/count')).toBe(0);
        expect(seen).toEqual([]);
      }),
      engine()
    ));

  it('reports invalid input, unknown types and disabled modules as domain errors', () =>
    runTest(
      Effect.gen(function* () {
        const { dispatch } = yield* Engine;
        const code = (exit: Exit.Exit<unknown, never> | Exit.Exit<unknown, unknown>) => {
          const wire = toWire(exit as Exit.Exit<unknown, never>);
          return wire.ok ? 'ok' : wire.error.code;
        };
        expect(code(yield* Effect.exit(dispatch('note/add', { id: 1 })))).toBe('invalid_input');
        expect(code(yield* Effect.exit(dispatch('nope')))).toBe('unknown_type');
        expect(code(yield* Effect.exit(dispatch('music/play')))).toBe('module_disabled');
      }),
      engine()
    ));
});

describe('engine failures', () => {
  it('turns a defect into an internal error and rolls back', () =>
    runTest(
      Effect.gen(function* () {
        const seen = yield* recordEvents;
        const { dispatch, query } = yield* Engine;
        const wire = toWire(yield* Effect.exit(dispatch('note/crash')));
        yield* settle;
        expect(wire.ok ? 'ok' : wire.error.code).toBe('internal');
        expect(yield* query('note/count')).toBe(0);
        expect(seen).toEqual([]);
      }),
      engine()
    ));

  it('keeps delivering when one subscriber fails', () =>
    runTest(
      Effect.gen(function* () {
        const seen = yield* recordEvents;
        const { dispatch } = yield* Engine;
        expect(toWire(yield* Effect.exit(dispatch('note/add', { id: 'a', body: 'hi' })))).toEqual({ ok: true, value: 'a' });
        yield* settle;
        expect(types(seen)).toEqual(['note/added', 'note/indexed']);
      }),
      engine()
    ));

  it('finishes failing and orphaned jobs instead of retrying them forever', async () => {
    const db = memoryDb(notesSql);
    const insert = db.prepare("INSERT INTO jobs (id, kind, payload, due_at, owner, created_at) VALUES (?, ?, 'null', ?, NULL, 0)");
    insert.run('fails', 'note/explode', START);
    insert.run('orphan', 'gone/kind', START);
    insert.run('ok', 'note/ping', START);
    await runTest(
      Effect.gen(function* () {
        const seen = yield* recordEvents;
        yield* TestClock.adjust('1 second');
        yield* settle;
        expect(types(seen)).toEqual(['note/pinged']);
      }),
      testEngine(db, [notes])
    );
    expect(db.prepare("SELECT id, status FROM jobs ORDER BY id").all()).toEqual([
      { id: 'fails', status: 'done' },
      { id: 'ok', status: 'done' },
      { id: 'orphan', status: 'done' }
    ]);
  });
});

describe('scheduler loop', () => {
  it('fires a job at its due time, not before', () =>
    runTest(
      Effect.gen(function* () {
        const seen = yield* recordEvents;
        const { dispatch } = yield* Engine;
        yield* dispatch('note/remind', { id: 'a', at: START + 30 * 60_000 });
        yield* TestClock.adjust('29 minutes');
        yield* settle;
        expect(types(seen)).toEqual([]);
        yield* TestClock.adjust('1 minute');
        yield* settle;
        expect(seen).toEqual([{ type: 'note/pinged', payload: { id: 'a', late: false } }]);
      }),
      engine()
    ));

  it('does not fire cancelled jobs', () =>
    runTest(
      Effect.gen(function* () {
        const seen = yield* recordEvents;
        const { dispatch } = yield* Engine;
        yield* dispatch('note/remind', { id: 'a', at: START + 60_000 });
        yield* dispatch('note/forget', { id: 'a' });
        yield* TestClock.adjust('5 minutes');
        yield* settle;
        expect(seen).toEqual([]);
      }),
      engine()
    ));

  it('fires jobs more than an hour away by chaining sleeps', () =>
    runTest(
      Effect.gen(function* () {
        const seen = yield* recordEvents;
        const { dispatch } = yield* Engine;
        yield* dispatch('note/remind', { id: 'a', at: START + 3 * 60 * 60_000 });
        yield* TestClock.adjust('3 hours');
        yield* settle;
        expect(types(seen)).toEqual(['note/pinged']);
      }),
      engine()
    ));

  it('catches up overdue jobs on boot, marks them late and summarises them', async () => {
    const db = memoryDb(notesSql);
    const insert = db.prepare(
      "INSERT INTO jobs (id, kind, payload, due_at, owner, created_at) VALUES (?, 'note/ping', ?, ?, NULL, 0)"
    );
    insert.run('j1', JSON.stringify({ id: 'a' }), START - 3 * 60 * 60_000);
    insert.run('j2', JSON.stringify({ id: 'b' }), START - 60 * 60_000);
    insert.run('j3', JSON.stringify({ id: 'c' }), START - 30_000);
    await runTest(
      Effect.gen(function* () {
        const seen = yield* recordEvents;
        const { dispatch } = yield* Engine;
        yield* dispatch('note/count-noop').pipe(Effect.ignore); // any dispatch wakes the loop
        yield* settle;
        expect(seen.filter((e) => e.type === 'note/pinged').map((e) => e.payload)).toEqual([
          { id: 'a', late: true },
          { id: 'b', late: true },
          { id: 'c', late: false }
        ]);
        const summary = seen.find((e) => e.type === 'scheduler/caught-up');
        expect((summary?.payload as { jobs: Array<{ id: string }> }).jobs.map((j) => j.id)).toEqual(['j1', 'j2']);
      }),
      testEngine(db, [notes])
    );
    expect(db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE status = 'pending'").get()).toEqual({ n: 0 });
  });
});
