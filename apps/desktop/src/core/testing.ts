import type { DatabaseSync } from 'node:sqlite';
import { Effect, Layer, PubSub, Scope } from 'effect';
import { TestClock } from 'effect/testing';
import { layerDb } from './db';
import { Engine, layerEngine, type EngineOptions } from './engine';
import type { AppEvent } from './events';
import type { ModuleDef } from './module';
import { jobsTableSql, layerScheduler } from './scheduler';

// Vite strips the `node:` prefix from imports it does not know, so load the
// built-in through Node directly.
export const memoryDb = (...migrations: string[]): DatabaseSync => {
  const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  for (const sql of [jobsTableSql, ...migrations]) db.exec(sql);
  return db;
};

export const START = Date.parse('2026-10-15T09:00:00+09:00');

// Engine + scheduler over an in-memory DB with a TestClock set to START.
export const testEngine = <R>(db: DatabaseSync, modules: ReadonlyArray<ModuleDef<R>>, options?: EngineOptions) =>
  layerEngine(modules, options).pipe(
    Layer.provideMerge(layerScheduler),
    Layer.provideMerge(layerDb(db))
  );

export const runTest = <A, E>(effect: Effect.Effect<A, E, Engine | Scope.Scope>, layer: Layer.Layer<Engine, never, never>) =>
  Effect.runPromise(
    Effect.gen(function* () {
      // Set the clock before the engine layer starts its scheduler loop.
      yield* TestClock.setTime(START);
      return yield* effect.pipe(Effect.provide(layer), Effect.scoped);
    }).pipe(Effect.provide(TestClock.layer()))
  );

// Collects every published event so a test can assert on them after letting fibers run.
export const recordEvents = Effect.gen(function* () {
  const engine = yield* Engine;
  const subscription = yield* engine.subscribe;
  const seen: AppEvent[] = [];
  yield* Effect.forkScoped(Effect.forever(PubSub.take(subscription).pipe(Effect.map((event) => void seen.push(event)))));
  return seen;
});

// Lets forked fibers (scheduler loop, recorders) catch up without moving the clock.
export const settle = Effect.gen(function* () {
  for (let i = 0; i < 50; i += 1) yield* Effect.yieldNow;
});

