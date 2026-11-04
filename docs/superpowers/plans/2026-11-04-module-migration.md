# 패널 모듈 Svelte 이전 Implementation Plan (#13)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/renderer/modules/*`의 옛 패널 모듈 8개를 `src/ui/modules/<id>/`의 Svelte 컴포넌트로 하나씩 옮긴다. 동작과 겉모습은 그대로 두고, 계산은 테스트가 붙은 순수 함수로 뺀다.

**Architecture:**
- 옛 `data` 캐시와 `petStore`는 그대로 두고, 바뀔 때마다 숫자를 올리는 반응형 `revision`(`src/ui/state/revision.svelte.ts`)으로 Svelte 화면에 잇는다.
- 셸(`Panel.svelte`)은 옛 `PanelModule`과 새 `UiModule`을 함께 받는다. 그래서 모듈을 하나씩 바꿔 끼울 수 있다.
- 마크업은 옛 클래스 이름(`todo`, `todo-list`, `frame well` …)을 그대로 써서 `styles.css`가 같은 모습을 그린다. 토큰 기반으로 다시 칠하는 일은 이 계획 밖이다.

**Tech Stack:** Svelte 5(runes, `.svelte.ts` 모듈), esbuild-svelte, vitest 5, TypeScript 7.

**Spec:** `docs/superpowers/specs/2026-11-04-ui-design-system-design.md`(#13, "점진 이전", "확인 방법")

## Global Constraints

- 레이어: `src/ui`는 `ui`, `domain`, 옛 폴더만 가져온다. electron, effect, `node:`는 쓰지 않는다.
- 동작은 바뀌면 안 된다. 각 모듈의 옛 `mount/render` 코드가 명세다. 옮긴 뒤 옛 파일은 지운다.
- 순수 함수는 `src/ui/modules/<id>/logic.ts`에 두고, `logic.test.ts`로 검사한다. `.svelte`나 `.svelte.ts`는 vitest로 테스트하지 않는다.
- 한국어 IME: Enter 처리는 `TextInput`의 `onenter`나 `onEnter`처럼 `isComposing`을 존중한다.
- 모듈 하나를 옮길 때마다 아래를 확인한다.
  1. `npm run typecheck && npm test`
  2. `node scripts/demo-shots.mjs <scratch>`로 찍은 스크린샷을 이전 것과 나란히 비교한다.
  3. `PETNUDGE_PROFILE` 임시 폴더로 앱을 띄워 직접 눌러 본다.
- 브랜치는 모듈마다 `chore/13-<id>`로 만들고, 앞 브랜치 위에 쌓는다. 커밋에는 `Refs: #13`을 단다. 마지막 PR에만 `Closes #13`을 넣는다.
- 커밋은 Conventional Commits로 쓰고, AI 도구 트레일러는 넣지 않는다.

## Review Focus

1. **패널이 닫혀 있는 동안 바뀐 데이터:** 다시 열었을 때 최신 내용이 보여야 한다. 옛 코드는 열 때 `render()`를 불렀고, 새 코드는 `revision`으로 반응한다. → Task 1 테스트 `bumps on every data kind`
2. **입력 중인 글이 남는가:** 묶음을 바꾸거나 데이터가 갱신되어도 입력칸의 글이 지워지지 않아야 한다. 할 일, 메모 제목·본문, 대화 입력이 해당된다. → 각 모듈 Task의 수동 확인 단계
3. **필터 상태 유지:** 할 일·메모·대시보드의 필터는 kv(`filter.*`)에 저장되어 다시 켜도 남는다. → 각 Task 수동 확인 + 기존 `filterBar` 재사용
4. **빈 목록과 첫 실행:** 항목이 0개일 때 문구가 옛 것과 같다(예: "할 일이 비었어요", "조건에 맞는 할 일이 없어요"). → 각 모듈 `logic.test.ts`
5. **숫자 경계:** 예상 뽀모도로는 1~12로 묶이고, 남은 개수가 0이면 "모든 예상 뽀모도로를 채웠어요!"가 나온다. → Task 2 테스트

---

### Task 1: 반응형 다리와 셸의 두 가지 모듈 지원

**Files:**
- Create: `src/ui/state/revision.svelte.ts`, `src/ui/state/bridge.ts`, `src/ui/state/bridge.test.ts`
- Create: `src/ui/modules/module.ts`
- Modify: `src/ui/panel/Panel.svelte`, `src/ui/panel/controller.ts`, `src/renderer/renderer.ts`(`MODULES` 타입)

**Interfaces:**
- Produces:
  - `type Cause = DataKind | 'session' | 'clock' | 'music'`
  - `bridge.ts`: `createRevisions(): { counts: Record<Cause, number>; bump(cause: Cause): void }`. 순수 TS이고 테스트 대상이다.
  - `revision.svelte.ts`: `export const revision = $state<Record<Cause, number>>(…)`, `export const bump = (cause: Cause) => …`
    - `renderer.ts`의 `onData`, `petStore.subscribe`, `onMusic`, 250ms 시계 루프가 이미 `renderActive(cause)`를 부르는 곳마다 `bump(cause)`도 부른다.
  - `src/ui/modules/module.ts`: `type UiModule = { id: ModuleId; label: string; icon: PixelIconName; component: Component }`
  - `type AnyModule = PanelModule | UiModule`
  - `isUiModule(m: AnyModule): m is UiModule`(`'component' in m`)
  - `Panel.svelte`는 `UiModule`이면 `<div class="tab-body" data-body={id} hidden={!visible}><m.component /></div>`를 그리고, 아니면 `LegacyModule`을 그린다.
  - `controller.render(cause)`와 `refresh()`는 `UiModule`이면 아무것도 하지 않는다(반응형이므로).

- [ ] **Step 1: 실패하는 테스트**: `bridge.test.ts`

```ts
it('bumps on every data kind', () => {
  const r = createRevisions();
  r.bump('todos'); r.bump('todos'); r.bump('session');
  expect(r.counts.todos).toBe(2);
  expect(r.counts.session).toBe(1);
  expect(r.counts.notes).toBe(0);
});
```

- [ ] **Step 2:** `npx vitest run src/ui/state` → FAIL(모듈 없음)
- [ ] **Step 3:** `bridge.ts`, `revision.svelte.ts`(`createRevisions`의 counts를 `$state`로 감싼다), `module.ts`를 만들고, `Panel.svelte`, `controller.ts`, `renderer.ts`를 바꾼다.
  - tsc가 `.svelte.ts`의 rune을 모르면 `src/ui/svelte.d.ts`에 `declare function $state<T>(v: T): T;`를 둔다. 아니면 `tsconfig` `types`에 `svelte`를 추가한다. 되는 쪽을 쓰고, 고른 것을 ledger에 적는다.
- [ ] **Step 4:** `npx vitest run src/ui && npm run typecheck && npm run build` → PASS
- [ ] **Step 5: Commit** `refactor(ui): let the panel host Svelte modules next to older ones` (Refs: #13)

### Task 2: 할 일 (`todo`)

**Files:**
- Create: `src/ui/modules/todo/logic.ts`, `logic.test.ts`, `Todo.svelte`, `index.ts`(`todoUi: UiModule`)
- Modify: `src/renderer/renderer.ts`(`todoModule` → `todoUi`)
- Delete: `src/renderer/modules/todo.ts`

**Interfaces:**
- Consumes: Task 1의 `revision`, `UiModule`, 그리고 옛 `data`, `api`, `petStore`, `filterBar`(`createFilter`, `dayHead`, `funnelButton`, `segmented`), `charts`(`splitBar`, `pomodoroCells`)
- Produces(`logic.ts`):
  - `clampEstimate(n: number): number`: 1~12로 묶는다.
  - `finishTime(remaining: number, focusMinutes: number, breakMinutes: number, now: Date): string`: `'HH:MM'` 형식이다.
  - `summarize(todos: Todo[]): { done: number; total: number; estimated: number; spent: number; remaining: number }`
  - `visibleTodos(todos: Todo[], bounds: DateRange, status: 'all' | 'open' | 'done'): { open: Todo[]; done: Todo[]; canMove: boolean }`
  - `emptyText(openCount: number): string`: 0이면 `'할 일이 비었어요'`, 아니면 `'조건에 맞는 할 일이 없어요'`

- [ ] **Step 1: 실패하는 테스트**: 각 함수에 하나 이상 쓴다. 예:

```ts
expect(clampEstimate(0)).toBe(1); expect(clampEstimate(13)).toBe(12);
expect(finishTime(2, 25, 5, new Date(2026, 10, 4, 9, 0))).toBe('10:00');
expect(summarize([todo({ estimate: 3, pomodoros: 1 }), todo({ done: true, estimate: 1, pomodoros: 1 })])).toEqual({ done: 1, total: 2, estimated: 4, spent: 2, remaining: 2 });
expect(visibleTodos(list, all, 'done').open).toEqual([]);
expect(visibleTodos(list, narrow, 'all').canMove).toBe(false);
```

- [ ] **Step 2:** `npx vitest run src/ui/modules/todo` → FAIL
- [ ] **Step 3:** `logic.ts`를 구현하고, `Todo.svelte`로 옛 `todo.ts`의 마크업과 동작을 옮긴다.
  - 입력칸은 `TextInput`의 `onenter`를 쓴다.
  - 필터는 `createFilter`를 `onMount`에서 그대로 쓴다.
  - 목록은 `$derived`로 `revision.todos`, `revision.settings`, `revision.session`에 반응한다.
- [ ] **Step 4:** `npx vitest run src/ui/modules/todo` → PASS. 옛 파일을 지운 뒤 `npm run typecheck && npm test` → PASS
- [ ] **Step 5: 확인**
  - 스크린샷 `panel-todo.png`를 이전 것과 비교한다.
  - 앱에서 확인한다: 추가(Enter, 한글), 완료 토글, 지금 할 일 지정, 위/아래 이동, 삭제, 완료 비우기, 필터, 예상 −/+.
- [ ] **Step 6: Commit** `refactor(ui): move the todo list to Svelte` (Refs: #13)

### Task 3~9: 나머지 모듈

Task 2와 같은 다섯 단계로 진행한다. 실패하는 `logic.test.ts` → 구현과 Svelte 화면 → 옛 파일 삭제 → 스크린샷과 수동 확인 → 커밋. 옛 파일에 있는 계산 도우미는 아래 이름 그대로 `logic.ts`로 옮겨 테스트한다. 렌더 함수 안에 섞인 계산(합계, 정렬, 묶기)도 이름을 붙여 뺀다.

| Task | 모듈 | 옛 파일 | `logic.ts`로 옮길 것 (최소) | 반응 원인 | 커밋 |
| --- | --- | --- | --- | --- | --- |
| 3 | pomodoro | `pomodoro.ts` | `phaseOf`, 오늘 칸 계산(`renderToday`의 합계) | session, clock, settings, stats | `refactor(ui): move the pomodoro to Svelte` |
| 4 | notes | `notes.ts` | `ago(ms, now)`, `when(ms, todayKey, now)`, 카드 미리보기(90자) | notes | `refactor(ui): move the notes to Svelte` |
| 5 | dashboard | `dashboard.ts` | `clock(ms)`, 기록 줄 문구 | stats, todos | `refactor(ui): move the dashboard to Svelte` |
| 6 | playlist | `playlist.ts` | `sourceBadge(player)`, `selected(playlists, id)` | playlists, music | `refactor(ui): move the music tab to Svelte` |
| 7 | friends | `friends.ts` | 캐릭터 줄 문구(`row`의 내용) | settings | `refactor(ui): move the character tab to Svelte` |
| 8 | settings (+`backup.ts`, `aiSettings.ts`) | 세 파일 | `counts(summary)`, `exportedOn(iso)`, `errorText`/`cleanError` | settings | `refactor(ui): move the settings to Svelte` |
| 9 | chat | `chat.ts` | `when(time)`, `preview(session)` | session, music(없음), chat 상태 | `refactor(ui): move the chat tab to Svelte` |

추가로 지켜야 할 것:
- **Task 4 (메모):** 자동 저장 지연(`scheduleSave`)과 "저장 중…/저장됨" 문구를 그대로 둔다.
- **Task 8 (설정):** `settings.ts:135`의 `.module-host` 스크롤을 새 구조에 맞춘다. 스크롤 컨테이너는 `.tab-body`다.
- **Task 9 (대화):** 채팅 상태(`chatState`, `onChat`)는 `revision`에 `'chat'` 원인을 하나 더해서 반응하게 한다. `Cause`에 `'chat'`을 추가하고 `bridge.test.ts`도 늘린다. `showActiveSession` export는 그대로 둔다.
- **Task 9 끝:** `src/renderer/modules/`에 `module.ts`만 남는다. `LegacyModule.svelte`와 `PanelModule` 지원은 지운다. `src/renderer/modules/module.ts`의 `$`, `onAction`, `onEnter`를 아직 쓰는 곳이 없으면 그 파일도 지운다. 이 커밋의 PR 본문에 `Closes #13`을 넣는다.
