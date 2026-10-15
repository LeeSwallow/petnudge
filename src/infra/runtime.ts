import type { DatabaseSync } from 'node:sqlite';
import { Effect, Fiber, Layer, ManagedRuntime, PubSub } from 'effect';
import { layerDb, type Db } from '../core/db';
import { Engine, layerEngine } from '../core/engine';
import { toWire, type Wire } from '../core/errors';
import type { AppEvent, Emitter } from '../core/events';
import type { ModuleDef } from '../core/module';
import { Scheduler, layerScheduler, type WakeReason } from '../core/scheduler';

export type CoreServices = Db | Scheduler | Emitter;

// Builds the engine over the app's open database. `onEvent` is attached before
// the scheduler loop boots, so it also sees the catch-up of jobs missed while
// the app was closed. Call `dispose()` before closing the database.
export const startEngine = async (
  db: DatabaseSync,
  modules: ReadonlyArray<ModuleDef<CoreServices>>,
  onEvent?: (event: AppEvent) => void
) => {
  const runtime = ManagedRuntime.make(
    layerEngine(modules).pipe(Layer.provideMerge(layerScheduler), Layer.provideMerge(layerDb(db)))
  );
  let attached = () => {};
  const listening = new Promise<void>((resolve) => (attached = resolve));
  const listener = runtime.runFork(
    Effect.scoped(
      Effect.gen(function* () {
        const engine = yield* Engine;
        const subscription = yield* engine.subscribe;
        attached();
        if (!onEvent) return;
        yield* Effect.forever(Effect.map(PubSub.take(subscription), onEvent));
      })
    )
  );
  await listening;
  await runtime.runPromise(
    Effect.gen(function* () {
      const scheduler = yield* Scheduler;
      yield* scheduler.wake('boot');
    })
  );
  const call = (method: 'dispatch' | 'query', type: string, input: unknown): Promise<Wire<unknown>> =>
    runtime
      .runPromiseExit(
        Effect.gen(function* () {
          const engine = yield* Engine;
          return yield* engine[method](type, input);
        })
      )
      .then(toWire);
  return {
    dispatch: (type: string, input?: unknown) => call('dispatch', type, input),
    query: (type: string, input?: unknown) => call('query', type, input),
    wake: (reason: WakeReason) =>
      runtime.runPromise(
        Effect.gen(function* () {
          const scheduler = yield* Scheduler;
          yield* scheduler.wake(reason);
        })
      ),
    dispose: async () => {
      await runtime.runPromise(Fiber.interrupt(listener));
      await runtime.dispose();
    }
  };
};

export type EngineHandle = Awaited<ReturnType<typeof startEngine>>;
