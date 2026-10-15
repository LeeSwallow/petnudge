import { describe, expect, it } from 'vitest';
import { Effect, Exit, Fiber } from 'effect';
import { Db, layerDb, transaction } from './db';
import { domainError, toWire } from './errors';

const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite');

const setup = () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE t (v TEXT)');
  return db;
};
const insert = (v: string) =>
  Effect.gen(function* () {
    const { sql } = yield* Db;
    sql.prepare('INSERT INTO t (v) VALUES (?)').run(v);
  });
const rows = (db: InstanceType<typeof DatabaseSync>) => db.prepare('SELECT v FROM t').all().map((row) => row.v);

describe('transaction', () => {
  it('commits when the effect succeeds', async () => {
    const db = setup();
    await Effect.runPromise(transaction(insert('a')).pipe(Effect.provide(layerDb(db))));
    expect(rows(db)).toEqual(['a']);
  });

  it('rolls back on failure and on defects', async () => {
    const db = setup();
    const failed = transaction(Effect.andThen(insert('a'), Effect.fail(domainError('nope', 'no'))));
    const died = transaction(Effect.andThen(insert('b'), Effect.die(new Error('bug'))));
    await Effect.runPromiseExit(failed.pipe(Effect.provide(layerDb(db))));
    await Effect.runPromiseExit(died.pipe(Effect.provide(layerDb(db))));
    expect(rows(db)).toEqual([]);
  });

  it('rolls back when the fiber is interrupted mid-transaction', async () => {
    const db = setup();
    await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(transaction(Effect.andThen(insert('a'), Effect.never)));
        yield* Effect.yieldNow;
        yield* Fiber.interrupt(fiber);
      }).pipe(Effect.provide(layerDb(db)))
    );
    expect(db.isTransaction).toBe(false);
    expect(rows(db)).toEqual([]);
  });
});

describe('toWire', () => {
  it('maps success, domain errors and defects to plain data', () => {
    expect(toWire(Exit.succeed(1))).toEqual({ ok: true, value: 1 });
    expect(toWire(Exit.fail(domainError('not_found', 'No todo')))).toEqual({ ok: false, error: { code: 'not_found', message: 'No todo' } });
    const defect = toWire(Exit.die(new Error('bug')));
    expect(defect.ok ? 'ok' : defect.error.code).toBe('internal');
  });
});
