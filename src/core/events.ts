import { Context, Effect } from 'effect';

export interface AppEvent {
  readonly type: string;
  readonly payload: unknown;
}

// Provided by the engine for each handler run; events are buffered and only
// published after the handler's transaction commits.
export class Emitter extends Context.Service<Emitter, { readonly emit: (event: AppEvent) => Effect.Effect<void> }>()(
  'core/Emitter'
) {}

export const emit = (type: string, payload: unknown = null): Effect.Effect<void, never, Emitter> =>
  Effect.gen(function* () {
    const emitter = yield* Emitter;
    yield* emitter.emit({ type, payload });
  });
