import { describe, expect, it } from 'vitest';
import { Effect, Layer } from 'effect';
import type { DatabaseSync } from 'node:sqlite';
import { TestClock } from 'effect/testing';
import { layerDb } from './db';
import { Scheduler, layerScheduler } from './scheduler';
import { memoryDb, START } from './testing';

const run = <A>(effect: Effect.Effect<A, never, Scheduler>, db: DatabaseSync = memoryDb()) =>
  Effect.runPromise(
    Effect.gen(function* () {
      yield* TestClock.setTime(START);
      return yield* effect.pipe(Effect.provide(layerScheduler.pipe(Layer.provide(layerDb(db)))));
    }).pipe(Effect.provide(TestClock.layer()))
  );

describe('scheduler store', () => {
  it('lists due jobs oldest first and reports the next due time', () =>
    run(
      Effect.gen(function* () {
        const scheduler = yield* Scheduler;
        const later = yield* scheduler.at(START + 2000, 'b', { n: 2 });
        const sooner = yield* scheduler.at(START + 1000, 'a', { n: 1 }, 'todo:1');
        expect(yield* scheduler.nextDueAt).toBe(START + 1000);
        expect(yield* scheduler.due(START + 1500)).toEqual([{ id: sooner, kind: 'a', payload: { n: 1 }, dueAt: START + 1000, owner: 'todo:1' }]);
        expect((yield* scheduler.due(START + 5000)).map((job) => job.id)).toEqual([sooner, later]);
      })
    ));

  it('reschedules, cancels and cancels by owner only pending jobs', () =>
    run(
      Effect.gen(function* () {
        const scheduler = yield* Scheduler;
        const a = yield* scheduler.at(START + 1000, 'k', null, 'todo:1');
        const b = yield* scheduler.at(START + 1000, 'k', null, 'todo:1');
        const c = yield* scheduler.at(START + 1000, 'k', null, 'todo:2');
        yield* scheduler.reschedule(c, START + 9000);
        yield* scheduler.cancelOwner('todo:1');
        expect((yield* scheduler.due(START + 5000)).map((job) => job.id)).toEqual([]);
        yield* scheduler.finish(c);
        yield* scheduler.reschedule(c, START);
        expect(yield* scheduler.nextDueAt).toBe(null);
        expect([a, b]).toHaveLength(2);
      })
    ));

  it('finishes rows it cannot read instead of failing the whole batch', async () => {
    const db = memoryDb();
    db.prepare("INSERT INTO jobs (id, kind, payload, due_at, owner, created_at) VALUES ('bad', 'k', 'not json', ?, NULL, 0)").run(START);
    await run(
      Effect.gen(function* () {
        const scheduler = yield* Scheduler;
        const good = yield* scheduler.at(START, 'k', { ok: true });
        expect((yield* scheduler.due(START)).map((job) => job.id)).toEqual([good]);
      }),
      db
    );
    expect(db.prepare("SELECT status FROM jobs WHERE id = 'bad'").get()).toEqual({ status: 'done' });
  });

  it('collapses wakes that arrive before the loop listens', () =>
    run(
      Effect.gen(function* () {
        const scheduler = yield* Scheduler;
        yield* scheduler.wake('dispatch');
        yield* scheduler.wake('resume');
        expect(yield* scheduler.awaitWake).toBe('resume');
        const next = yield* Effect.raceFirst(scheduler.awaitWake, Effect.as(Effect.yieldNow, 'empty' as const));
        expect(next).toBe('empty');
      })
    ));
});
