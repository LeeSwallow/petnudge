import { Clock, Context, Effect, Exit, Layer, PubSub, Schema, Scope, Semaphore } from 'effect';
import { Db, transaction } from './db';
import { DomainError, domainError } from './errors';
import { Emitter, type AppEvent } from './events';
import type { Handler, JobInfo, ModuleDef } from './module';
import { Scheduler, type Job } from './scheduler';

export const LATE_AFTER_MS = 2 * 60_000;
export const MAX_SLEEP_MS = 60 * 60_000;
const MAX_DELIVERIES = 1000;

export class Engine extends Context.Service<
  Engine,
  {
    readonly dispatch: (type: string, input?: unknown) => Effect.Effect<unknown, DomainError>;
    readonly query: (type: string, input?: unknown) => Effect.Effect<unknown, DomainError>;
    readonly subscribe: Effect.Effect<PubSub.Subscription<AppEvent>, never, Scope.Scope>;
  }
>()('core/Engine') {}

export interface EngineOptions {
  readonly disabled?: ReadonlySet<string>;
}

export const layerEngine = <R>(modules: ReadonlyArray<ModuleDef<R>>, options: EngineOptions = {}) =>
  Layer.effect(
    Engine,
    Effect.gen(function* () {
      const context = yield* Effect.context<Exclude<R, Emitter> | Db | Scheduler>();
      const scheduler = yield* Scheduler;
      const disabled = options.disabled ?? new Set<string>();
      const lock = yield* Semaphore.make(1);
      const pubsub = yield* PubSub.unbounded<AppEvent>();

      const actions = new Map<string, { moduleId: string; handler: Handler<R> }>();
      const queries = new Map<string, { moduleId: string; handler: Handler<R> }>();
      const subscribers = new Map<string, Array<(payload: unknown) => Effect.Effect<void, DomainError, R>>>();
      const schedules = new Map<string, (payload: unknown, job: JobInfo) => Effect.Effect<void, DomainError, R>>();
      for (const module of modules) {
        for (const [type, h] of Object.entries(module.actions ?? {})) actions.set(type, { moduleId: module.id, handler: h });
        for (const [type, h] of Object.entries(module.queries ?? {})) queries.set(type, { moduleId: module.id, handler: h });
        if (disabled.has(module.id)) continue;
        for (const [type, h] of Object.entries(module.on ?? {})) subscribers.set(type, [...(subscribers.get(type) ?? []), h]);
        for (const [kind, h] of Object.entries(module.schedules ?? {})) schedules.set(kind, h);
      }

      // Runs one handler in its own transaction; its events come back only if it committed.
      const runInTx = <A>(effect: Effect.Effect<A, DomainError, R>) => {
        const buffer: AppEvent[] = [];
        const emitter = { emit: (event: AppEvent) => Effect.sync(() => void buffer.push(event)) };
        return transaction(Effect.provideService(effect, Emitter, emitter)).pipe(
          Effect.map((value) => ({ value, events: buffer }))
        );
      };

      // Publishes events, then feeds them to module subscribers; their events queue behind.
      const deliver = (initial: ReadonlyArray<AppEvent>) =>
        Effect.gen(function* () {
          const pending = [...initial];
          for (let delivered = 0; pending.length > 0; delivered += 1) {
            if (delivered >= MAX_DELIVERIES) {
              yield* Effect.logError(`event cascade stopped after ${MAX_DELIVERIES} events`);
              return;
            }
            const event = pending.shift()!;
            yield* PubSub.publish(pubsub, event);
            for (const subscriber of subscribers.get(event.type) ?? []) {
              const exit = yield* Effect.exit(runInTx(subscriber(event.payload)));
              if (Exit.isSuccess(exit)) pending.push(...exit.value.events);
              else yield* Effect.logError(`subscriber of ${event.type} failed`, exit.cause);
            }
          }
        });

      const resolve = (
        table: Map<string, { moduleId: string; handler: Handler<R> }>,
        type: string,
        input: unknown
      ) =>
        Effect.gen(function* () {
          const entry = table.get(type);
          if (!entry) return yield* Effect.fail(domainError('unknown_type', `Unknown ${type}`));
          if (disabled.has(entry.moduleId)) return yield* Effect.fail(domainError('module_disabled', `${entry.moduleId} is turned off`));
          const decoded = yield* Schema.decodeUnknownEffect(entry.handler.input)(input).pipe(
            Effect.mapError((error) => domainError('invalid_input', String(error)))
          );
          return entry.handler.run(decoded as never);
        });

      const dispatch = (type: string, input?: unknown) =>
        Semaphore.withPermits(lock, 1)(
          Effect.gen(function* () {
            const run = yield* resolve(actions, type, input);
            const { value, events } = yield* runInTx(run);
            yield* deliver(events);
            return value;
          })
        ).pipe(Effect.ensuring(scheduler.wake('dispatch')), Effect.provideContext(context));

      const queryNoEmit = { emit: () => Effect.die('queries cannot emit events') };
      const query = (type: string, input?: unknown) =>
        Semaphore.withPermits(lock, 1)(
          Effect.gen(function* () {
            const run = yield* resolve(queries, type, input);
            return yield* Effect.provideService(run, Emitter, queryNoEmit);
          })
        ).pipe(Effect.provideContext(context));

      const runJob = (job: Job, now: number) =>
        Effect.gen(function* () {
          const handle = schedules.get(job.kind);
          const info: JobInfo = { id: job.id, dueAt: job.dueAt, late: now - job.dueAt > LATE_AFTER_MS };
          if (!handle) {
            yield* Effect.logWarning(`no schedule handler for ${job.kind}`);
            yield* scheduler.finish(job.id);
            return [];
          }
          const exit = yield* Effect.exit(runInTx(Effect.andThen(handle(job.payload, info), scheduler.finish(job.id))));
          if (Exit.isSuccess(exit)) return exit.value.events;
          yield* Effect.logError(`schedule ${job.kind} failed`, exit.cause);
          yield* scheduler.finish(job.id);
          return [];
        });

      const reconcile = Semaphore.withPermits(lock, 1)(
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis;
          const jobs = yield* scheduler.due(now);
          const events: AppEvent[] = [];
          for (const job of jobs) events.push(...(yield* runJob(job, now)));
          const late = jobs.filter((job) => now - job.dueAt > LATE_AFTER_MS);
          if (late.length > 0) events.push({ type: 'scheduler/caught-up', payload: { jobs: late } });
          yield* deliver(events);
        })
      ).pipe(Effect.provideContext(context));

      // Event-driven loop: settle due jobs, then sleep until the next job or any wake.
      const cycle = Effect.gen(function* () {
        yield* reconcile;
        const next = yield* scheduler.nextDueAt;
        if (next === null) {
          yield* scheduler.awaitWake;
          return;
        }
        const now = yield* Clock.currentTimeMillis;
        yield* Effect.raceFirst(Effect.sleep(Math.min(Math.max(next - now, 0), MAX_SLEEP_MS)), scheduler.awaitWake);
      });
      yield* Effect.forkScoped(Effect.forever(cycle));

      return { dispatch, query, subscribe: PubSub.subscribe(pubsub) };
    })
  );
