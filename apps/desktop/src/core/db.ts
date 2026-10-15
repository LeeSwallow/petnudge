import type { DatabaseSync } from 'node:sqlite';
import { Context, Effect, Exit, Layer } from 'effect';

export class Db extends Context.Service<Db, { readonly sql: DatabaseSync }>()('core/Db') {}

export const layerDb = (sql: DatabaseSync) => Layer.succeed(Db, { sql });

// Runs `self` inside BEGIN/COMMIT; any failure, defect or interruption rolls back.
export const transaction = <A, E, R>(self: Effect.Effect<A, E, R>): Effect.Effect<A, E, R | Db> =>
  Effect.gen(function* () {
    const { sql } = yield* Db;
    sql.exec('BEGIN');
    const exit = yield* Effect.exit(self);
    sql.exec(Exit.isSuccess(exit) ? 'COMMIT' : 'ROLLBACK');
    return yield* exit;
  });
