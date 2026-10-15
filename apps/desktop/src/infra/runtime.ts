import type { DatabaseSync } from 'node:sqlite';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { layerDb, type Db } from '../core/db';
import { Engine, layerEngine } from '../core/engine';
import { toWire, type Wire } from '../core/errors';
import type { Emitter } from '../core/events';
import type { ModuleDef } from '../core/module';
import { Scheduler, layerScheduler, type WakeReason } from '../core/scheduler';

export type CoreServices = Db | Scheduler | Emitter;

// Builds the engine over the app's open database. The scheduler loop starts
// right away; call `dispose()` before closing the database.
export const startEngine = async (db: DatabaseSync, modules: ReadonlyArray<ModuleDef<CoreServices>>) => {
  const runtime = ManagedRuntime.make(
    layerEngine(modules).pipe(Layer.provideMerge(layerScheduler), Layer.provideMerge(layerDb(db)))
  );
  await runtime.runPromise(Effect.void);
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
    dispose: () => runtime.dispose()
  };
};

export type EngineHandle = Awaited<ReturnType<typeof startEngine>>;
