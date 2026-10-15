import type { Effect, Schema } from 'effect';
import type { DomainError } from './errors';

export interface JobInfo {
  readonly id: string;
  readonly dueAt: number;
  readonly late: boolean;
}

export interface Handler<R> {
  readonly input: Schema.Decoder<unknown>;
  readonly run: (input: never) => Effect.Effect<unknown, DomainError, R>;
}

// Pairs an input schema with its handler so `run` sees the decoded type.
export const handler = <I, A, R>(input: Schema.Decoder<I>, run: (input: I) => Effect.Effect<A, DomainError, R>): Handler<R> => ({
  input,
  run: run as (input: never) => Effect.Effect<unknown, DomainError, R>
});

export interface ModuleDef<R> {
  readonly id: string;
  readonly optional?: boolean;
  readonly actions?: Readonly<Record<string, Handler<R>>>;
  readonly queries?: Readonly<Record<string, Handler<R>>>;
  readonly on?: Readonly<Record<string, (payload: unknown) => Effect.Effect<void, DomainError, R>>>;
  readonly schedules?: Readonly<Record<string, (payload: unknown, job: JobInfo) => Effect.Effect<void, DomainError, R>>>;
}

type Requirement<T> =
  T extends Handler<infer R> ? R : T extends (...args: never[]) => Effect.Effect<unknown, unknown, infer R> ? R : never;
type RecordRequirement<T> = T extends Readonly<Record<string, infer V>> ? Requirement<V> : never;

// The union of every service the module's handlers need, so the engine layer
// can demand exactly those from the app layer.
export type ModuleRequirements<M> =
  M extends ModuleDef<any>
    ? RecordRequirement<M['actions']> | RecordRequirement<M['queries']> | RecordRequirement<M['on']> | RecordRequirement<M['schedules']>
    : never;

export const defineModule = <M extends ModuleDef<any>>(module: M): ModuleDef<ModuleRequirements<M>> => module;
