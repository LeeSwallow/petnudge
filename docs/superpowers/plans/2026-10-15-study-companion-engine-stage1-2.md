# Study Companion 엔진 1~2단계 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 데스크톱 앱에 Effect-TS 기반 core 엔진(action·event·query·이벤트 기반 스케줄러)과 레이어 규칙 검사를 세우고, `apps/mobile`의 도메인 코드를 `src/domain/`으로 옮긴 뒤 `apps/mobile`을 삭제한다.

**Architecture:** `src/core/`는 Effect 서비스(`Db`, `Scheduler`, `Engine`, `Emitter`)와 모듈 등록기(`defineModule`)로 이루어진다. 엔진은 action을 세마포어로 직렬 처리하고, 핸들러를 트랜잭션 안에서 돌린 뒤 커밋 후에만 이벤트를 발행한다. 스케줄러는 `Queue.sliding(1)` wake 큐와 `Effect.raceFirst(sleep, wake)`로 돌아가는 이벤트 기반 루프다. `src/infra/runtime.ts`가 `ManagedRuntime`으로 엔진을 띄워 `main.ts`에 연결한다. 이 단계에서 등록하는 모듈은 없고, UI는 바뀌지 않는다. 타입이 붙은 action/event 계약(`core/contract.ts`)과 legacy IPC 어댑터는 모듈이 생기는 3단계에서 추가한다.

**Tech Stack:** TypeScript 5.6, Effect 4.0.5, Vitest 2.1.9, `node:sqlite`, Electron 41, esbuild 0.24

**Spec:** `docs/superpowers/specs/2026-10-15-study-companion-architecture-design.md`

## Global Constraints

- 모든 명령은 저장소 루트 기준이며, 데스크톱 명령은 `cd apps/desktop && ...` 형태로 실행한다.
- `effect`는 정확히 `4.0.5`로 고정해 `devDependencies`에 넣는다(`npm i -D --save-exact effect@4.0.5`). esbuild가 main 번들에 포함시키므로 런타임 `dependencies`에 넣지 않는다(기존 `zod`·`zustand`와 같은 방식).
- `@effect/vitest`는 쓰지 않는다(4.x는 Vitest 5를 요구). Vitest 2.1.9를 그대로 쓴다.
- DB는 `node:sqlite`(`DatabaseSync`)만 쓴다. `better-sqlite3` 같은 네이티브 모듈을 추가하지 않는다.
- 레이어 규칙: domain ← core ← app ← infra/ui. domain은 `effect`·`node:*`·`electron` 금지. core는 `electron` 금지, `node:sqlite`는 `import type`만. app은 다른 `app/*`·`electron`·`node:*` 금지. ui는 `effect`·`electron`·`node:*` 금지.
- 테스트에서 엔진을 띄울 때는 **반드시 `TestClock.setTime`을 먼저 하고 그다음에 엔진 layer를 제공한다**(`core/testing.ts`의 `runTest`가 이렇게 되어 있다). 엔진이 1970년 시계로 뜬 뒤 2026년으로 점프시키면, TestClock이 그 사이의 1시간짜리 sleep을 수십만 번 실행해 테스트가 멈춘다.
- 기존 shipped migration은 수정하지 않는다. `jobs` 테이블은 새 migration으로 덧붙인다.
- 기존 데스크톱 테스트(139개)는 모두 통과 상태를 유지한다.
- 이 단계에서는 화면이 바뀌지 않는다. Task 5와 6 끝에서 앱을 빌드·실행해 정상 기동만 확인한다.

## Review Focus

1. **밤새 노트북이 잠들어 있다가 켜짐** — 지난 job은 각각 한 번씩만 실행되고, 2분 넘게 늦은 것은 `late: true`, 늦은 job 목록은 `scheduler/caught-up` 이벤트 하나로 나오며, pending으로 남는 job이 없어야 한다. → Task 3 `catches up overdue jobs on boot…`
2. **핸들러 버그(defect)** — 호출자는 `internal` 에러를 받고, DB는 롤백되며, 이벤트는 하나도 나가지 않아야 한다. → Task 3 `turns a defect into an internal error…`
3. **한 모듈의 구독자가 실패** — 원래 dispatch는 성공하고 다른 구독자는 계속 이벤트를 받아야 한다. → Task 3 `keeps delivering when one subscriber fails`
4. **실패하는 job, 주인 없는 job(모듈 삭제·비활성)** — `done`으로 끝나야 하고, 같은 job을 무한히 다시 돌려 CPU를 잡아먹으면 안 된다. → Task 3 `finishes failing and orphaned jobs…`
5. **wake 신호가 한꺼번에 몰림**(resume + unlock + dispatch) — 하나로 합쳐져 정리 한 번으로 끝나야 한다. → Task 2 `collapses wakes…`

---

### Task 0: 작업 브랜치와 현재 상태 스냅샷

**Files:** 없음(git만)

- [ ] **Step 1: 브랜치를 만들고 현재 작업을 커밋**

`apps/mobile`을 지우기 전에 되살릴 지점을 남긴다. 미커밋 상태인 `apps/desktop/`, `apps/mobile` 변경, 기존 spec 두 개를 그대로 커밋한다(`node_modules`·`dist`·`release`는 `.gitignore`로 빠진다).

```bash
git switch -c feat/effect-engine
git add -A
git status --short | grep -E "node_modules|/dist/|/release/" && echo "STOP: build output staged" || true
git commit -m "chore: snapshot desktop app and mobile work before engine refactor"
```

Expected: 마지막 줄에 커밋 해시. `STOP`이 출력되면 커밋하지 말고 `.gitignore`를 확인한다.

- [ ] **Step 2: 기준선 확인**

Run: `cd apps/desktop && npm test 2>&1 | tail -4 && npm run typecheck`
Expected: `Tests  139 passed (139)`, typecheck 오류 없음.

---

### Task 1: core 기초 — 에러, DB 트랜잭션, 이벤트, 모듈 정의

**Files:**
- Modify: `apps/desktop/package.json` (`effect` 추가)
- Create: `apps/desktop/src/core/errors.ts`
- Create: `apps/desktop/src/core/db.ts`
- Create: `apps/desktop/src/core/events.ts`
- Create: `apps/desktop/src/core/module.ts`
- Test: `apps/desktop/src/core/db.test.ts`

**Interfaces:**
- Produces:
  - `class DomainError` (`_tag: 'DomainError'`, `code: string`, `message: string`), `domainError(code, message): DomainError`
  - `type Wire<A> = { ok: true; value: A } | { ok: false; error: { code; message } }`, `toWire<A>(exit: Exit<A, DomainError>): Wire<A>` — defect는 `code: 'internal'`
  - `class Db` 서비스 `{ sql: DatabaseSync }`, `layerDb(sql): Layer<Db>`, `transaction(effect): Effect<A, E, R | Db>`
  - `interface AppEvent { type: string; payload: unknown }`, `class Emitter` 서비스 `{ emit(event): Effect<void> }`, `emit(type, payload?): Effect<void, never, Emitter>`
  - `interface JobInfo { id; dueAt; late }`, `interface Handler<R>`, `handler(inputSchema, run): Handler<R>`, `interface ModuleDef<R>`, `defineModule(module): ModuleDef<요구 서비스 합집합>`

- [ ] **Step 1: effect 설치**

```bash
cd apps/desktop && npm i -D --save-exact effect@4.0.5
```

Expected: `package.json`의 `devDependencies`에 `"effect": "4.0.5"`.

- [ ] **Step 2: 실패하는 테스트 작성** — `apps/desktop/src/core/db.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { Effect, Exit } from 'effect';
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
});

describe('toWire', () => {
  it('maps success, domain errors and defects to plain data', () => {
    expect(toWire(Exit.succeed(1))).toEqual({ ok: true, value: 1 });
    expect(toWire(Exit.fail(domainError('not_found', 'No todo')))).toEqual({ ok: false, error: { code: 'not_found', message: 'No todo' } });
    const defect = toWire(Exit.die(new Error('bug')));
    expect(defect.ok ? 'ok' : defect.error.code).toBe('internal');
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `cd apps/desktop && npx vitest run src/core/db.test.ts`
Expected: FAIL — `Failed to resolve import "./db"`.

- [ ] **Step 4: 구현** — `apps/desktop/src/core/errors.ts`

```ts
import { Cause, Data, Exit, Option } from 'effect';

// A rule the caller broke (unknown id, bad input, disabled module). Anything
// else that goes wrong is a defect and reaches the caller as `internal`.
export class DomainError extends Data.TaggedError('DomainError')<{
  readonly code: string;
  readonly message: string;
}> {}

export const domainError = (code: string, message: string) => new DomainError({ code, message });

// What crosses IPC and AI-tool boundaries: plain data, never an Error object.
export type Wire<A> =
  | { readonly ok: true; readonly value: A }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };

export const toWire = <A>(exit: Exit.Exit<A, DomainError>): Wire<A> => {
  if (Exit.isSuccess(exit)) return { ok: true, value: exit.value };
  const failure = Cause.findErrorOption(exit.cause);
  if (Option.isSome(failure)) return { ok: false, error: { code: failure.value.code, message: failure.value.message } };
  return { ok: false, error: { code: 'internal', message: Cause.pretty(exit.cause) } };
};
```

`apps/desktop/src/core/db.ts`

```ts
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
```

`apps/desktop/src/core/events.ts`

```ts
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
```

`apps/desktop/src/core/module.ts`

```ts
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
```

- [ ] **Step 5: 통과 확인**

Run: `cd apps/desktop && npx vitest run src/core/db.test.ts && npm run typecheck`
Expected: `3 passed`, typecheck 오류 없음.

- [ ] **Step 6: 커밋**

```bash
git add apps/desktop/package.json apps/desktop/package-lock.json apps/desktop/src/core
git commit -m "feat(core): add effect errors, db transaction, events and module definition"
```

---

### Task 2: 스케줄러 저장소와 wake 큐

**Files:**
- Create: `apps/desktop/src/core/scheduler.ts`
- Create: `apps/desktop/src/core/testing.ts` (이 Task에서는 `memoryDb`·`START`만, Task 3에서 전체로 교체)
- Test: `apps/desktop/src/core/scheduler.test.ts`

**Interfaces:**
- Consumes: `Db`, `layerDb` (Task 1)
- Produces:
  - `type WakeReason = 'boot' | 'job-changed' | 'timer' | 'resume' | 'unlock' | 'active' | 'dispatch'`
  - `interface Job { id; kind; payload: unknown; dueAt; owner: string | null }`
  - `jobsTableSql: string`
  - `class Scheduler` 서비스: `at(dueAt, kind, payload, owner?) → Effect<string>`, `reschedule(id, dueAt)`, `cancel(id)`, `cancelOwner(owner)`, `wake(reason)`, `awaitWake: Effect<WakeReason>`, `due(now) → Effect<ReadonlyArray<Job>>`, `nextDueAt: Effect<number | null>`, `finish(id)`
  - `layerScheduler: Layer<Scheduler, never, Db>`
  - `memoryDb(...migrations): DatabaseSync` (`jobs` 테이블 포함), `START: number` (2026-10-15 09:00 KST)

- [ ] **Step 1: 테스트 헬퍼 작성** — `apps/desktop/src/core/testing.ts` (임시 버전)

```ts
import type { DatabaseSync } from 'node:sqlite';
import { jobsTableSql } from './scheduler';

// Vite strips the `node:` prefix from imports it does not know, so load the
// built-in through Node directly.
export const memoryDb = (...migrations: string[]): DatabaseSync => {
  const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  for (const sql of [jobsTableSql, ...migrations]) db.exec(sql);
  return db;
};

export const START = Date.parse('2026-10-15T09:00:00+09:00');
```

- [ ] **Step 2: 실패하는 테스트 작성** — `apps/desktop/src/core/scheduler.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { Effect, Layer } from 'effect';
import { TestClock } from 'effect/testing';
import { layerDb } from './db';
import { Scheduler, layerScheduler } from './scheduler';
import { memoryDb, START } from './testing';

const run = <A>(effect: Effect.Effect<A, never, Scheduler>) =>
  Effect.runPromise(
    Effect.gen(function* () {
      yield* TestClock.setTime(START);
      return yield* effect.pipe(Effect.provide(layerScheduler.pipe(Layer.provide(layerDb(memoryDb())))));
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
```

- [ ] **Step 3: 실패 확인**

Run: `cd apps/desktop && npx vitest run src/core/scheduler.test.ts`
Expected: FAIL — `Failed to resolve import "./scheduler"`.

- [ ] **Step 4: 구현** — `apps/desktop/src/core/scheduler.ts`

```ts
import { Clock, Context, Effect, Layer, Queue } from 'effect';
import { Db } from './db';

export type WakeReason = 'boot' | 'job-changed' | 'timer' | 'resume' | 'unlock' | 'active' | 'dispatch';

export interface Job {
  readonly id: string;
  readonly kind: string;
  readonly payload: unknown;
  readonly dueAt: number;
  readonly owner: string | null;
}

// Appended to the app's migrations as-is; never edit after it ships.
export const jobsTableSql = `
  CREATE TABLE jobs (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    payload TEXT NOT NULL,
    due_at INTEGER NOT NULL,
    owner TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX jobs_pending ON jobs(status, due_at);
`;

export class Scheduler extends Context.Service<
  Scheduler,
  {
    readonly at: (dueAt: number, kind: string, payload: unknown, owner?: string) => Effect.Effect<string>;
    readonly reschedule: (id: string, dueAt: number) => Effect.Effect<void>;
    readonly cancel: (id: string) => Effect.Effect<void>;
    readonly cancelOwner: (owner: string) => Effect.Effect<void>;
    readonly wake: (reason: WakeReason) => Effect.Effect<void>;
    // Engine-facing.
    readonly awaitWake: Effect.Effect<WakeReason>;
    readonly due: (now: number) => Effect.Effect<ReadonlyArray<Job>>;
    readonly nextDueAt: Effect.Effect<number | null>;
    readonly finish: (id: string) => Effect.Effect<void>;
  }
>()('core/Scheduler') {}

type Row = Record<string, unknown>;
const toJob = (row: Row): Job => ({
  id: String(row.id),
  kind: String(row.kind),
  payload: JSON.parse(String(row.payload)),
  dueAt: Number(row.due_at),
  owner: row.owner === null ? null : String(row.owner)
});

export const layerScheduler = Layer.effect(
  Scheduler,
  Effect.gen(function* () {
    const { sql } = yield* Db;
    // Capacity 1 + sliding: wakes that arrive before the loop looks collapse into one.
    const wakes = yield* Queue.sliding<WakeReason>(1);
    const wake = (reason: WakeReason) => Queue.offer(wakes, reason).pipe(Effect.asVoid);
    const run = (statement: string, ...params: Array<string | number | null>) =>
      Effect.sync(() => sql.prepare(statement).run(...params)).pipe(Effect.andThen(wake('job-changed')));

    return {
      at: (dueAt, kind, payload, owner) =>
        Effect.gen(function* () {
          const id = crypto.randomUUID();
          const now = yield* Clock.currentTimeMillis;
          yield* run(
            'INSERT INTO jobs (id, kind, payload, due_at, owner, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            id, kind, JSON.stringify(payload ?? null), dueAt, owner ?? null, now
          );
          return id;
        }),
      reschedule: (id, dueAt) => run("UPDATE jobs SET due_at = ? WHERE id = ? AND status = 'pending'", dueAt, id),
      cancel: (id) => run("UPDATE jobs SET status = 'cancelled' WHERE id = ? AND status = 'pending'", id),
      cancelOwner: (owner) => run("UPDATE jobs SET status = 'cancelled' WHERE owner = ? AND status = 'pending'", owner),
      wake,
      awaitWake: Queue.take(wakes),
      due: (now) =>
        Effect.sync(() =>
          (sql.prepare("SELECT * FROM jobs WHERE status = 'pending' AND due_at <= ? ORDER BY due_at, created_at").all(now) as Row[]).map(toJob)
        ),
      nextDueAt: Effect.sync(() => {
        const row = sql.prepare("SELECT MIN(due_at) AS next FROM jobs WHERE status = 'pending'").get() as Row | undefined;
        return row?.next == null ? null : Number(row.next);
      }),
      finish: (id) => Effect.sync(() => void sql.prepare("UPDATE jobs SET status = 'done' WHERE id = ?").run(id))
    };
  })
);
```

- [ ] **Step 5: 통과 확인**

Run: `cd apps/desktop && npx vitest run src/core/scheduler.test.ts && npm run typecheck`
Expected: `3 passed`, typecheck 오류 없음.

- [ ] **Step 6: 커밋**

```bash
git add apps/desktop/src/core
git commit -m "feat(core): add persisted scheduler store with coalescing wake queue"
```

---

### Task 3: 엔진 — 직렬 dispatch, 커밋 후 발행, 이벤트 기반 스케줄러 루프

**Files:**
- Create: `apps/desktop/src/core/engine.ts`
- Modify: `apps/desktop/src/core/testing.ts` (전체 교체)
- Test: `apps/desktop/src/core/engine.test.ts`

**Interfaces:**
- Consumes: Task 1의 `Db`, `transaction`, `DomainError`, `domainError`, `Emitter`, `AppEvent`, `Handler`, `JobInfo`, `ModuleDef`; Task 2의 `Scheduler`, `Job`, `jobsTableSql`, `layerScheduler`
- Produces:
  - `LATE_AFTER_MS = 120000`, `MAX_SLEEP_MS = 3600000`
  - `class Engine` 서비스: `dispatch(type, input?) → Effect<unknown, DomainError>`, `query(type, input?) → Effect<unknown, DomainError>`, `subscribe: Effect<PubSub.Subscription<AppEvent>, never, Scope>`
  - `interface EngineOptions { disabled?: ReadonlySet<string> }`
  - `layerEngine(modules, options?): Layer<Engine, never, 모듈 요구 서비스 | Db | Scheduler>`
  - 이벤트 `scheduler/caught-up` payload `{ jobs: Job[] }`
  - 에러 코드 `unknown_type`, `module_disabled`, `invalid_input`, `internal`
  - 테스트 헬퍼: `testEngine(db, modules, options?)`, `runTest(effect, layer)`, `recordEvents: Effect<AppEvent[], never, Engine | Scope>`, `settle`

동작 규칙(spec §3·§4):
- action과 query, 스케줄 실행은 `Semaphore(1)`로 하나씩만 돈다. 그래서 `on` 구독자는 action을 dispatch하지 않는다(재진입 교착). 구독자는 작업하고 `emit`만 한다.
- 핸들러 안의 `emit`은 버퍼에 쌓였다가 트랜잭션 커밋 뒤에 발행된다. 순서: PubSub 발행 → 그 이벤트의 모듈 구독자 실행(각자 트랜잭션) → 구독자가 낸 이벤트는 큐 뒤로. 연쇄는 1000개에서 끊는다.
- 핸들러는 트랜잭션을 연 채로 네트워크 같은 외부 대기를 하면 안 된다. 세마포어를 쥐고 있어서 모든 UI 요청이 멈춘다.
- dispatch가 끝나면(성공·실패 모두) `wake('dispatch')`.
- 스케줄 job은 핸들러와 `finish`가 같은 트랜잭션이다. 핸들러가 실패하면 로그를 남기고 따로 `finish`한다.

- [ ] **Step 1: 테스트 헬퍼 교체** — `apps/desktop/src/core/testing.ts` 전체를 아래로 바꾼다

```ts
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
```

- [ ] **Step 2: 실패하는 테스트 작성** — `apps/desktop/src/core/engine.test.ts`

```ts
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
```

- [ ] **Step 3: 실패 확인**

Run: `cd apps/desktop && npx vitest run src/core/engine.test.ts`
Expected: FAIL — `Failed to resolve import "./engine"`.

- [ ] **Step 4: 구현** — `apps/desktop/src/core/engine.ts`

```ts
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
```

- [ ] **Step 5: 통과 확인**

Run: `cd apps/desktop && npx vitest run src/core && npm run typecheck`
Expected: `16 passed`(db 3 + scheduler 3 + engine 10). 실패하는 구독자·스케줄 테스트가 `ERROR … failed` 로그를 찍는 것은 정상이다. typecheck 오류 없음.

- [ ] **Step 6: 커밋**

```bash
git add apps/desktop/src/core
git commit -m "feat(core): add engine with serial dispatch, post-commit events and event-driven scheduler loop"
```

---

### Task 4: 레이어 규칙 테스트

**Files:**
- Test: `apps/desktop/src/architecture.test.ts`

**Interfaces:**
- Produces: `importsOf(source): { spec; typeOnly }[]`, `violations(file, source): string[]` (테스트 파일 안에서만 export)

규칙 검사기 자체를 fixture로 검증하는 테스트와, 실제 `src/` 전체를 검사하는 테스트가 한 파일에 있다. 레거시 폴더(`main`, `renderer`, `preload`, `shared`)는 3단계에서 비워질 때까지 검사하지 않는다. `infra`와 `ui`는 이전 기간 동안 레거시 폴더를 import할 수 있다.

- [ ] **Step 1: 테스트 작성** — `apps/desktop/src/architecture.test.ts`

```ts
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Layer rules from docs/superpowers/specs/2026-10-15-study-companion-architecture-design.md §1.
// Dependencies point down: ui/infra → app → core → domain. Legacy folders
// (main, renderer, preload, shared) are unchecked until stage 3 empties them.
const LAYERS = ['domain', 'core', 'app', 'infra', 'ui'] as const;
type Layer = (typeof LAYERS)[number];
const LEGACY = ['main', 'renderer', 'preload', 'shared'];

const mayImport: Record<Layer, readonly string[]> = {
  domain: ['domain'],
  core: ['core', 'domain'],
  app: ['app', 'core', 'domain'],
  infra: ['infra', 'core', 'domain', ...LEGACY],
  ui: ['ui', 'domain', ...LEGACY]
};

interface ImportRef {
  readonly spec: string;
  readonly typeOnly: boolean;
}

const IMPORT = /(?:^|\n)\s*(?:import|export)\s+(type\s+)?(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/g;
// `typeof import('x')` is a type position, not a runtime import.
const DYNAMIC = /(?<!typeof )import\(\s*['"]([^'"]+)['"]\s*\)/g;

export const importsOf = (source: string): ImportRef[] => [
  ...[...source.matchAll(IMPORT)].map((m) => ({ spec: m[2], typeOnly: Boolean(m[1]) })),
  ...[...source.matchAll(DYNAMIC)].map((m) => ({ spec: m[1], typeOnly: false }))
];

const layerOf = (file: string): string => file.split('/')[0];

// `file` and the result are paths relative to src/, with forward slashes.
export const violations = (file: string, source: string): string[] => {
  const layer = layerOf(file) as Layer;
  if (!LAYERS.includes(layer)) return [];
  const found: string[] = [];
  for (const { spec, typeOnly } of importsOf(source)) {
    if (spec.startsWith('.')) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
      const targetLayer = layerOf(target);
      if (!mayImport[layer].includes(targetLayer)) found.push(`${file} → ${target}`);
      // app modules talk through events only: app/todos must not import app/notes.
      else if (layer === 'app' && targetLayer === 'app' && file.split('/')[1] !== target.split('/')[1]) found.push(`${file} → ${target}`);
      continue;
    }
    const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
    const forbidden =
      (pkg === 'electron' && layer !== 'infra') ||
      (pkg === 'effect' && (layer === 'domain' || layer === 'ui')) ||
      (pkg.startsWith('node:') && layer !== 'infra' && !(layer === 'core' && spec === 'node:sqlite' && typeOnly));
    if (forbidden) found.push(`${file} → ${spec}`);
  }
  return found;
};

const SRC = path.resolve(__dirname);
const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith('.ts') ? [path.relative(SRC, full).split(path.sep).join('/')] : [];
  });

describe('layer rule checker', () => {
  it('reads static, type-only, re-export and dynamic imports', () => {
    expect(
      importsOf(`import { a } from './a';\nimport type { B } from "../b";\nexport * from './c';\nimport './d';\nconst e = await import('./e');\ntype S = typeof import('node:sqlite');\nimport {\n  f,\n  g\n} from './fg';`)
    ).toEqual([
      { spec: './a', typeOnly: false },
      { spec: '../b', typeOnly: true },
      { spec: './c', typeOnly: false },
      { spec: './d', typeOnly: false },
      { spec: './fg', typeOnly: false },
      { spec: './e', typeOnly: false }
    ]);
  });

  it('allows downward imports and rejects upward ones', () => {
    expect(violations('core/engine.ts', "import { x } from '../domain/todos/todo';")).toEqual([]);
    expect(violations('domain/todos/todo.ts', "import { Engine } from '../../core/engine';")).toEqual([
      'domain/todos/todo.ts → core/engine'
    ]);
    expect(violations('core/engine.ts', "import { a } from '../app/todos/module';")).toEqual(['core/engine.ts → app/todos/module']);
  });

  it('keeps app modules apart and away from legacy folders', () => {
    expect(violations('app/todos/module.ts', "import { r } from './repo';")).toEqual([]);
    expect(violations('app/todos/module.ts', "import { n } from '../notes/module';")).toEqual(['app/todos/module.ts → app/notes/module']);
    expect(violations('app/todos/module.ts', "import { r } from '../../main/db/repository';")).toEqual([
      'app/todos/module.ts → main/db/repository'
    ]);
  });

  it('limits packages per layer', () => {
    expect(violations('core/db.ts', "import type { DatabaseSync } from 'node:sqlite';")).toEqual([]);
    expect(violations('core/db.ts', "import { DatabaseSync } from 'node:sqlite';")).toEqual(['core/db.ts → node:sqlite']);
    expect(violations('app/x/m.ts', "import { app } from 'electron';")).toEqual(['app/x/m.ts → electron']);
    expect(violations('domain/x.ts', "import { Effect } from 'effect';")).toEqual(['domain/x.ts → effect']);
    expect(violations('infra/electron/power.ts', "import { powerMonitor } from 'electron';")).toEqual([]);
    expect(violations('main/main.ts', "import { app } from 'electron';")).toEqual([]);
  });
});

describe('source tree', () => {
  it('follows the layer rules', () => {
    const found = sourceFiles(SRC).flatMap((file) => violations(file, readFileSync(path.join(SRC, file), 'utf8')));
    expect(found).toEqual([]);
  });
});
```

- [ ] **Step 2: 실행**

Run: `cd apps/desktop && npx vitest run src/architecture.test.ts`
Expected: `5 passed`. 검사기와 대상(`core/`)이 이미 있으므로 처음부터 통과한다. 규칙이 실제로 잡는지 확인하려고, `src/core/events.ts` 맨 위에 `import { app } from 'electron';`을 임시로 넣고 다시 돌리면 `source tree > follows the layer rules`가 `core/events.ts → electron`으로 실패해야 한다. 확인 후 그 줄을 지운다.

- [ ] **Step 3: 커밋**

```bash
git add apps/desktop/src/architecture.test.ts
git commit -m "test: enforce layer import rules across src"
```

---

### Task 5: main 프로세스에 엔진 연결

**Files:**
- Modify: `apps/desktop/src/main/db/schema.ts` (migration 추가)
- Create: `apps/desktop/src/infra/runtime.ts`
- Create: `apps/desktop/src/infra/electron/power.ts`
- Modify: `apps/desktop/src/main/main.ts` (import, 엔진 시작, 종료 순서)
- Test: `apps/desktop/src/infra/runtime.test.ts`

**Interfaces:**
- Consumes: `layerDb`, `layerScheduler`, `Scheduler`, `WakeReason`, `jobsTableSql`, `layerEngine`, `Engine`, `toWire`, `Wire`, `ModuleDef`, `Emitter`
- Produces:
  - `type CoreServices = Db | Scheduler | Emitter`
  - `startEngine(db, modules: ReadonlyArray<ModuleDef<CoreServices>>): Promise<EngineHandle>`
  - `EngineHandle = { dispatch(type, input?): Promise<Wire<unknown>>; query(type, input?): Promise<Wire<unknown>>; wake(reason): Promise<void>; dispose(): Promise<void> }`
  - `bridgePower(wake: (reason: WakeReason) => void): void`

- [ ] **Step 1: 실패하는 테스트 작성** — `apps/desktop/src/infra/runtime.test.ts`

```ts
import { expect, it } from 'vitest';
import { memoryDb } from '../core/testing';
import { startEngine } from './runtime';

it('starts the engine on a database and answers over plain data', async () => {
  const engine = await startEngine(memoryDb(), []);
  expect(await engine.dispatch('todo/create', {})).toEqual({ ok: false, error: { code: 'unknown_type', message: 'Unknown todo/create' } });
  await engine.wake('resume');
  await engine.dispose();
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/desktop && npx vitest run src/infra/runtime.test.ts`
Expected: FAIL — `Failed to resolve import "./runtime"`.

- [ ] **Step 3: 구현** — `apps/desktop/src/infra/runtime.ts`

```ts
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
```

`apps/desktop/src/infra/electron/power.ts`

```ts
import { powerMonitor } from 'electron';
import type { WakeReason } from '../../core/scheduler';

// Electron has no "system clock changed" event. These are the moments a
// sleeping timer may have missed time, so the scheduler re-checks its jobs.
export const bridgePower = (wake: (reason: WakeReason) => void) => {
  powerMonitor.on('resume', () => wake('resume'));
  powerMonitor.on('unlock-screen', () => wake('unlock'));
  if (process.platform === 'darwin') powerMonitor.on('user-did-become-active', () => wake('active'));
};
```

- [ ] **Step 4: 통과 확인**

Run: `cd apps/desktop && npx vitest run src/infra src/architecture.test.ts`
Expected: `6 passed`(runtime 1 + architecture 5). `infra/electron/power.ts`는 `electron`을 import하므로 Vitest에서 실행하지 않고 typecheck와 실제 실행으로 확인한다.

- [ ] **Step 5: `jobs` migration 추가** — `apps/desktop/src/main/db/schema.ts`

파일 맨 위 import 아래에 추가:

```ts
import { jobsTableSql } from '../../core/scheduler';
```

`migrations` 배열의 마지막 항목 뒤(현재 62번째 줄 `];` 바로 앞, 첫 migration을 닫는 백틱 뒤)에 쉼표와 새 항목을 덧붙인다. 기존 항목의 SQL은 한 글자도 바꾸지 않는다:

```ts
  `,
  // v2: scheduler jobs (core/scheduler.ts).
  jobsTableSql
];
```

- [ ] **Step 6: main.ts 연결** — `apps/desktop/src/main/main.ts`

import 블록(20번째 줄 `import { createFriends } from './friends';` 아래)에 추가:

```ts
import { startEngine, type EngineHandle } from '../infra/runtime';
import { bridgePower } from '../infra/electron/power';
```

`let database: DatabaseSync;`(71번째 줄) 아래에 추가:

```ts
// Core engine (docs/superpowers/specs/2026-10-15-study-companion-architecture-design.md).
// No modules are registered yet; stage 3 moves features onto it one by one.
let engine: EngineHandle | null = null;
```

`openDatabase` 안의 종료 처리를 엔진 정리 뒤 DB를 닫도록 바꾼다:

```ts
  app.on('will-quit', () => db.close());
```
→
```ts
  // Stop the scheduler loop before the database it reads goes away.
  app.on('will-quit', () => {
    void engine?.dispose();
    db.close();
  });
```

`app.whenReady().then(() => {` 안의 `openDatabase();` 바로 아래에 추가:

```ts
  void startEngine(database, [])
    .then((handle) => {
      engine = handle;
      bridgePower((reason) => void handle.wake(reason));
    })
    .catch((error) => console.error('engine failed to start', error));
```

- [ ] **Step 7: 전체 확인**

Run: `cd apps/desktop && npm test 2>&1 | tail -4 && npm run typecheck`
Expected: `Tests  161 passed (161)`(기존 139 + core 16 + architecture 5 + runtime 1). typecheck 오류 없음.

- [ ] **Step 8: 빌드하고 실제로 띄워서 기동 확인**

Run: `cd apps/desktop && npm run build && (npx electron . > /tmp/sc-run.log 2>&1 &) && sleep 8 && cat /tmp/sc-run.log; pkill -f "electron \." || true`

Expected: `built dist/` 출력, 앱 창(캐릭터)이 뜨고 로그에 `engine failed to start`가 없음. 기존 사용자 DB가 `user_version` 2로 올라가는지 확인:

```bash
sqlite3 "$HOME/Library/Application Support/Study Companion Pet/study-companion.sqlite" "PRAGMA user_version; SELECT name FROM sqlite_master WHERE name='jobs';"
```

Expected: `2`, `jobs`. 확인 후 캡처를 사용자에게 보여준다.

- [ ] **Step 9: 커밋**

```bash
git add apps/desktop/src/main apps/desktop/src/infra
git commit -m "feat: start core engine in main process with power wake bridge"
```

---

### Task 6: 도메인 코드 이동과 `apps/mobile` 삭제

**Files:**
- Move: `apps/mobile/src/domain/timer.ts` → `apps/desktop/src/domain/pomodoro/timer.ts` (+ `timer.test.ts`)
- Move: `apps/mobile/src/domain/planner.ts` → `apps/desktop/src/domain/pomodoro/planner.ts` (+ `planner.test.ts`)
- Move: `apps/mobile/src/session/studySession.ts` → `apps/desktop/src/domain/pomodoro/studySession.ts` (+ `studySession.test.ts`)
- Move: `apps/mobile/src/domain/progress.ts` → `apps/desktop/src/domain/progress/progress.ts` (+ `progress.test.ts`)
- Move: `apps/mobile/src/domain/scene.ts` → `apps/desktop/src/domain/pet/scene.ts`
- Move: `apps/mobile/src/scene/sceneMachine.ts` → `apps/desktop/src/domain/pet/sceneMachine.ts` (+ `sceneMachine.test.ts`)
- Move: `apps/mobile/src/domain/pixelIcons.ts` → `apps/desktop/src/domain/icons/pixelIcons.ts`
- Create (일회용, 커밋 안 함): `apps/desktop/scripts/rewrite-mobile-imports.mjs`
- Modify: 데스크톱에서 `../../../mobile/src/...`를 import하는 16개 파일
- Delete: `apps/mobile/`
- Modify: `README.md`

**Interfaces:**
- Produces: 옮긴 모듈의 export는 이름·시그니처 그대로. 경로만 바뀐다.

- [ ] **Step 1: 파일 이동**

```bash
cd apps && mkdir -p desktop/src/domain/pomodoro desktop/src/domain/progress desktop/src/domain/pet desktop/src/domain/icons
for f in timer timer.test planner planner.test; do git mv mobile/src/domain/$f.ts desktop/src/domain/pomodoro/$f.ts; done
for f in studySession studySession.test; do git mv mobile/src/session/$f.ts desktop/src/domain/pomodoro/$f.ts; done
for f in progress progress.test; do git mv mobile/src/domain/$f.ts desktop/src/domain/progress/$f.ts; done
git mv mobile/src/domain/scene.ts desktop/src/domain/pet/scene.ts
for f in sceneMachine sceneMachine.test; do git mv mobile/src/scene/$f.ts desktop/src/domain/pet/$f.ts; done
git mv mobile/src/domain/pixelIcons.ts desktop/src/domain/icons/pixelIcons.ts
cd ..
```

- [ ] **Step 2: 옮긴 파일끼리의 import 수정**

```bash
cd apps/desktop/src/domain
sed -i '' "s#from '../domain/scene'#from './scene'#" pet/sceneMachine.ts
sed -i '' -e "s#from '../domain/planner'#from './planner'#" -e "s#from '../domain/progress'#from '../progress/progress'#" -e "s#from '../domain/scene'#from '../pet/scene'#" -e "s#from '../domain/timer'#from './timer'#" -e "s#from '../scene/sceneMachine'#from '../pet/sceneMachine'#" pomodoro/studySession.ts
sed -i '' "s#from '../scene/sceneMachine'#from '../pet/sceneMachine'#" pomodoro/studySession.test.ts
grep -rn "from '\.\./\(domain\|scene\|session\)/" . ; cd ../../../..
```

Expected: 마지막 `grep`이 아무것도 출력하지 않음.

- [ ] **Step 3: 데스크톱 import 경로 변환 스크립트 작성** — `apps/desktop/scripts/rewrite-mobile-imports.mjs`

```js
// One-off (stage 2): point desktop imports of apps/mobile at src/domain.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve('src');
const MOVED = {
  'mobile/src/domain/timer': 'domain/pomodoro/timer',
  'mobile/src/domain/planner': 'domain/pomodoro/planner',
  'mobile/src/domain/progress': 'domain/progress/progress',
  'mobile/src/domain/scene': 'domain/pet/scene',
  'mobile/src/domain/pixelIcons': 'domain/icons/pixelIcons',
  'mobile/src/scene/sceneMachine': 'domain/pet/sceneMachine',
  'mobile/src/session/studySession': 'domain/pomodoro/studySession'
};

const files = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(path.join(dir, entry.name)) : entry.name.endsWith('.ts') ? [path.join(dir, entry.name)] : []
  );

let changed = 0;
for (const file of files(SRC)) {
  const before = readFileSync(file, 'utf8');
  const after = before.replace(/(['"])(?:\.\.\/)+mobile\/src\/([\w/]+)\1/g, (match, quote, rest) => {
    const target = MOVED[`mobile/src/${rest}`];
    if (!target) throw new Error(`${path.relative(SRC, file)}: no destination for mobile/src/${rest}`);
    let relative = path.relative(path.dirname(file), path.join(SRC, target)).split(path.sep).join('/');
    if (!relative.startsWith('.')) relative = `./${relative}`;
    return `${quote}${relative}${quote}`;
  });
  if (after !== before) {
    writeFileSync(file, after);
    changed += 1;
  }
}
console.log(`rewrote imports in ${changed} files`);
```

- [ ] **Step 4: 스크립트 실행 후 삭제**

```bash
cd apps/desktop && node scripts/rewrite-mobile-imports.mjs && rm scripts/rewrite-mobile-imports.mjs && grep -rn "mobile/" src || echo "no mobile imports left"
```

Expected: `rewrote imports in 16 files`, `no mobile imports left`.

- [ ] **Step 5: 전체 확인(아직 mobile 폴더가 있는 상태)**

Run: `cd apps/desktop && npm test 2>&1 | tail -4 && npm run typecheck`
Expected: `Tests  201 passed (201)`(161 + 옮겨온 mobile 테스트 40). typecheck 오류 없음. 숫자가 다르면 옮긴 테스트 파일이 빠지지 않았는지 `git status`로 확인한다.

- [ ] **Step 6: `apps/mobile` 삭제와 README 정리**

```bash
git rm -r -q apps/mobile && rm -rf apps/mobile
```

`README.md`에서 아래 줄을 지운다:

```
- `apps/mobile/` — Expo/React Native 모바일 mock foundation: scene state, mock layer registry, planner/timer/dialogue 구조
```

그리고 데스크톱 줄의 꼬리를 바꾼다:

```
(mobile의 domain/session 로직 재사용)
```
→
```
(도메인 로직은 `apps/desktop/src/domain`, 엔진은 `apps/desktop/src/core`)
```

- [ ] **Step 7: 다시 전체 확인, 빌드, 실행**

Run: `cd apps/desktop && npm test 2>&1 | tail -4 && npm run typecheck && npm run build && (npx electron . > /tmp/sc-run.log 2>&1 &) && sleep 8 && cat /tmp/sc-run.log; pkill -f "electron \." || true`
Expected: `Tests  201 passed (201)`, typecheck 오류 없음, `built dist/`, 앱이 뜨고 뽀모도로·할 일 패널이 전과 같이 동작. 캡처를 사용자에게 보여준다.

- [ ] **Step 8: 커밋**

```bash
git add -A apps README.md
git commit -m "refactor: move shared domain code into desktop and remove apps/mobile"
```
