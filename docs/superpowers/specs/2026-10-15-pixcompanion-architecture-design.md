# PixCompanion: 레이어드 엔진 아키텍처와 데스크톱 배포

## 목표

Study Companion Pet(데스크톱)을 **PixCompanion** — 마감을 알고 먼저 말을 거는 픽셀 캐릭터 할 일 컴패니언 — 로 전환한다. 이를 위해:

1. 흩어진 IPC 채널·타이머·`main.ts` 로직을 **core 엔진(action / event / query / scheduler) + 레이어드 구조**로 표준화한다.
2. 할 일에 마감·리마인더·반복을 더하고, 리마인더에서 바로 뽀모도로로 이어지는 흐름을 만든다.
3. GitHub Releases로 macOS(dmg)·Windows(exe) 설치 파일을 태그 한 번으로 배포한다.

### 확정된 결정

| 항목 | 결정 |
|---|---|
| 출시 대상 | 데스크톱만 (macOS arm64·x64, Windows x64). 모바일 출시 없음 |
| 제품 정체성 | 리마인더형 비서. 할 일(리마인더) + 뽀모도로가 주력 |
| 모듈 위치 | 주력: todos, reminders, pomodoro / 유지: notes, dashboard, chat(AI) / 선택(기본 꺼짐): music |
| 앱 이름 | PixCompanion (`appId: com.leeswallow.pixcompanion`) |
| 배포처 | GitHub Releases만. itch.io는 CI 단계 추가로 나중에 붙일 수 있게 둔다 |
| 서명 | 공증 없이 출시(최소 ad-hoc). CI secret에 인증서를 넣으면 서명·공증이 켜지게 설정 |
| `apps/mobile` | 사용 중인 도메인 코드를 데스크톱으로 옮긴 뒤 삭제 커밋 |
| 엔진 | 직접 구현(얇게). 외부 framework 없음 |
| 신규 의존성 | `rrule`(반복 규칙), `electron-updater`(자동 업데이트) 두 개만 |

### 비목표

- 클라우드 동기화, 계정, 모바일 앱
- Event sourcing(전체 이벤트 로그로 상태 재구성)
- 캘린더 연동(구글 캘린더 등)
- itch.io 업로드(이번 범위에서는 구조만 열어 둔다)

## 경쟁 제품 대비 위치

픽셀 펫 + 뽀모도로 조합은 이미 있다(Desktop Pet by glitchedinorbit, PixPet, Mac Pet). PixCompanion의 차별점은 **마감 기반으로 먼저 말을 거는 캐릭터**, **자연어로 할 일·리마인더 생성**, **리마인더 → 뽀모도로 연결**, **mac/win 동시 지원**이다. 설계의 무게중심은 그래서 스케줄러와 리마인더에 있다.

## 1. 레이어 구조

```
ui/      renderer 패널·캐릭터·preload          ← 화면
infra/   SQLite, Electron, OS 알림, 자동실행,   ← 바깥 세계
         음악 감지, IPC 브리지, MCP 서버
app/     기능 모듈: action·query·event·         ← 유스케이스
         schedule 핸들러, AI 도구
core/    엔진: dispatch, 이벤트 버스, 스케줄러,   ← 뼈대
         clock, 포트(인터페이스), 계약 타입
domain/  순수 규칙: 할 일, 리마인더 계산, rrule, ← 핵심 규칙
         뽀모도로 타이머, 통계, 펫 씬
```

의존은 위 → 아래로만 흐른다.

```
apps/desktop/src/
  domain/   todos/ reminders/ pomodoro/ progress/ pet/ icons/
  core/     engine.ts scheduler.ts clock.ts contract.ts ports.ts module.ts errors.ts
  app/      todos/ reminders/ pomodoro/ notes/ dashboard/ chat/ music/
            pet/ characters/ mods/ friends/ settings/ backup/
  infra/    db/ electron/ ipc/ music/ mcp/ characters/
  ui/       shell/ panels/<기능>/ pet/ character/ preload/
  main.ts   조립만: infra 생성 → 엔진에 app 모듈 등록 → 창 생성
```

### 레이어 규칙

| 레이어 | 허용 | 금지 |
|---|---|---|
| domain | 순수 함수와 타입. 시간은 인자로 받는다 | IO, `Date.now()`, 다른 레이어 import |
| core | domain 타입, 포트 정의 | `electron`, `node:sqlite` import |
| app | domain + core(엔진·포트) | 다른 `app/*` import, `electron`·`node:sqlite` import |
| infra | 포트 구현, core·domain 타입 | 비즈니스 규칙 판단 |
| ui | `dispatch` / `query` / `on`, domain의 순수 표시용 함수 | DB·엔진 내부 접근, `app/`·`infra/` import |

`src/architecture.test.ts`가 모든 소스의 import 문을 훑어 위 규칙을 검사한다(외부 라이브러리 없이 정규식 + 경로 해석). 위반 시 테스트가 실패한다.

### 기존 코드의 행선지

| 현재 | 이동 |
|---|---|
| `mobile/src/domain/{timer,progress,scene,pixelIcons}` | `domain/{pomodoro,progress,pet,icons}` |
| `mobile/src/scene/sceneMachine`, `mobile/src/session/studySession` | `domain/pet`, `domain/pomodoro` |
| `main/db/repository.ts`, `schema.ts` | `infra/db/` (모듈별 저장소로 분할) |
| `main/main.ts`의 IPC 핸들러 | 각 `app/*` 모듈의 action/query |
| `main/petTools.ts`, `mcpTools.ts`, `mcp.ts` | 각 `app/*/tools.ts` + `infra/mcp/` |
| `main/{characters,mods,friends,backup,nowPlaying,layout}.ts` | 규칙은 `app/*`, 파일·OS 접근은 `infra/*` |
| `shared/*` | 순수 규칙은 `domain/`, 계약 타입은 `core/contract.ts` |
| `renderer/*` | `ui/` |

## 2. 모듈 표준

```ts
export const todosModule = defineModule({
  id: 'todos',
  optional: false,              // true면 설정에서 끌 수 있다 (music)
  actions:   { 'todo/create': { input: zodSchema, run: (ctx, input) => ... } },
  queries:   { 'todo/list':   { input: zodSchema, run: (ctx, input) => ... } },
  on:        { 'pomodoro/completed': (ctx, event) => ... },
  schedules: { 'todo/recur':  (ctx, payload, { late }) => ... },
  tools:     [ /* AI·MCP 도구: action/query를 감싸기만 한다 */ ],
});
```

- `ctx`: `{ repos, emit, scheduler, clock, notify, settings }`. 모두 core의 포트 타입이며 Electron을 모른다.
- 모듈끼리는 import하지 않고 이벤트로만 소통한다. 예: todos는 `pomodoro/completed`를 구독해 `focus_minutes`를 누적한다.
- AI 채팅 도구와 MCP 도구는 같은 `tools` 정의에서 생성한다. UI와 AI가 같은 action을 쓰므로 로직은 한 벌이다.
- 선택 모듈이 꺼져 있으면 엔진이 그 모듈을 등록하지 않는다. 해당 action은 `module_disabled` 에러를 돌려주고, 패널 탭은 숨는다.

## 3. Action / Event / Query 계약

### 이름

- action: 명령형 `도메인/동사` — `todo/create`, `reminder/snooze`, `pomodoro/start`
- event: 과거형 — `todo/created`, `reminder/fired`, `pomodoro/completed`
- query: 읽기 전용 — `todo/list`, `stats/summary`

### 타입

각 모듈이 zod 스키마로 입력·이벤트 payload를 선언하고, `core/contract.ts`가 이를 합쳐 `Action`, `Event`, `Query` 유니온 타입과 런타임 검증기를 만든다.

### 결과와 에러

```ts
type Result<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string } };
```

- 규칙 위반: 핸들러가 `DomainError(code, message)`를 던지면 `ok:false`로 변환된다(`not_found`, `invalid_input`, `module_disabled` 등).
- 예상 못한 예외: 로그를 남기고 `code: 'internal'`로 반환한다. 엔진은 계속 동작한다.
- 경계(IPC, AI 도구 인자)에서 zod 검증 실패는 `invalid_input`.

### 처리 순서

1. `dispatch`는 직렬 큐로 하나씩 처리한다(재진입 방지).
2. 핸들러는 DB 트랜잭션 안에서 실행된다. 핸들러 안의 `emit`은 버퍼에 쌓인다.
3. 커밋 성공 후에만 버퍼의 이벤트를 발행한다. 실패하면 롤백하고 이벤트는 버린다.
4. 발행 순서: app 모듈 구독자(`on`) → renderer 창들에 broadcast. 구독자가 dispatch하는 action은 큐 뒤에 붙는다.

### 전송

IPC 채널은 세 개만 둔다.

| 채널 | 방향 | 용도 |
|---|---|---|
| `engine:dispatch` | renderer → main (invoke) | action 실행, `Result` 반환 |
| `engine:query` | renderer → main (invoke) | query 실행, `Result` 반환 |
| `engine:event` | main → renderer (send) | 이벤트 broadcast |

preload는 `dispatch(action)`, `query(q)`, `on(type, listener) → unsubscribe` 세 함수만 노출한다.

창 이동·마우스 통과처럼 **엔진 상태가 아닌 창 제어**(`move-by`, `set-ignore-mouse`, `pet-layout`, `cursor`)는 `infra/electron/window`가 소유하는 별도의 `window:*` 채널로 남긴다. 고빈도 호출이라 엔진 큐를 거치지 않는다.

이전 기간 동안 기존 채널은 `infra/ipc/legacy.ts` 어댑터가 엔진 호출로 바꿔 준다. 모든 모듈 이전이 끝나면 어댑터를 삭제한다.

## 4. 스케줄러와 타이밍

### 저장

```sql
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,          -- 'reminder/fire', 'pomodoro/end', 'todo/recur' ...
  payload TEXT NOT NULL,       -- JSON
  due_at INTEGER NOT NULL,
  owner TEXT,                  -- 'todo:<id>' — 소유자 단위 일괄 취소용
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | done | cancelled
  created_at INTEGER NOT NULL
);
CREATE INDEX jobs_pending ON jobs(status, due_at);
```

### API (`ctx.scheduler`)

`at(dueAt, kind, payload, owner?) → jobId`, `reschedule(jobId, dueAt)`, `cancel(jobId)`, `cancelOwner(owner)`.

### 동작

- 타이머는 하나다. 가장 가까운 pending job의 `due_at`까지 `setTimeout`을 걸되 최대 60초로 끊어 다시 확인한다(시계 오차, `setTimeout` 상한, 절전 대비).
- 발화 시 해당 kind의 `schedules` 핸들러를 엔진 큐를 통해 실행한다. 핸들러가 성공하면 job은 `done`이 된다. 실패하면 로그를 남기고 `done`으로 둔다(무한 재시도 금지).
- **놓친 job 처리**: 앱 시작, `powerMonitor` 의 `resume`·`unlock-screen`, 그리고 60초 확인 시 실제 경과 시간이 예상보다 2분 넘게 크면(시계 변경·절전) 지난 job을 `due_at` 순으로 모두 실행한다. `now - due_at > 2분`이면 핸들러에 `late: true`가 전달된다.
- reminders 모듈은 한 번의 따라잡기에서 들어온 `late` 알림을 묶어 `reminder/missed-summary` 이벤트 하나로 보여준다("놓친 알림 3개").

### 시계

`core/clock.ts`의 `Clock` 포트(`now()`, `setTimer(ms, fn) → cancel`)를 통해서만 시간을 다룬다. 실제 구현은 `Date.now`/`setTimeout`, 테스트는 Vitest 가짜 타이머(`vi.useFakeTimers`, `vi.setSystemTime`)로 시간을 앞당긴다.

### 기존 타이밍의 정리

| 현재 | 이후 |
|---|---|
| 뽀모도로 종료를 renderer가 감지 | `pomodoro/end` job. 화면 카운트다운은 `endsAt`으로 계산해 표시만 |
| renderer의 5초 store rehydrate polling | 삭제. 이벤트로 갱신 |
| main의 now-playing polling | `infra/music` 폴러. 곡이 바뀔 때만 `music/now-playing-changed` 발행 |
| 말풍선 숨김, 저장 debounce, 파일 감시 debounce | 엔진 밖. `ui/`·`infra/`의 작은 헬퍼(`debounce`, `later`) |

## 5. 할 일 · 리마인더 · 뽀모도로

### 데이터 (기존 migration은 수정하지 않고 새 migration을 덧붙인다)

```sql
ALTER TABLE todos ADD COLUMN due_at INTEGER;          -- 마감 (null = 없음)
ALTER TABLE todos ADD COLUMN all_day INTEGER NOT NULL DEFAULT 0;
ALTER TABLE todos ADD COLUMN rrule TEXT;              -- RFC 5545 반복 규칙
ALTER TABLE todos ADD COLUMN focus_minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE todos ADD COLUMN series_id TEXT;            -- 반복 시리즈 묶음 (첫 인스턴스 id)
ALTER TABLE todos ADD COLUMN occurrence_at INTEGER;     -- 이 인스턴스의 발생 시각
CREATE UNIQUE INDEX todos_occurrence ON todos(series_id, occurrence_at) WHERE series_id IS NOT NULL;

CREATE TABLE reminders (
  id TEXT PRIMARY KEY,
  todo_id TEXT NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  offset_minutes INTEGER,      -- 마감 기준 N분 전 (due_at 있을 때)
  at INTEGER,                  -- 절대 시각 (마감 없이 "3시에 알려줘")
  job_id TEXT,
  CHECK ((offset_minutes IS NULL) <> (at IS NULL))
);
```

`estimate`(예상 뽀모도로 수)와 `pomodoros`는 그대로 둔다. 기존 `focus_minutes`는 migration에서 `sessions.actual_minutes` 합으로 채운다.

### 규칙

- 마감이 있는 할 일을 만들면 기본 리마인더 두 개(설정 `reminders.defaultOffsets`, 기본값 `[60, 0]` 분 전)가 붙는다. all-day 할 일은 마감일 09:00 기준으로 계산한다.
- 리마인더 시각이 이미 지났으면 job을 만들지 않는다.
- 할 일 완료·삭제 시 `cancelOwner('todo:<id>')`.
- 반복: 완료하면 domain이 `rrule`로 다음 발생 시각을 계산해 새 할 일 인스턴스를 만들고 리마인더를 복제한다. 완료하지 않아도 다음 발생 시각이 오면 `todo/recur` job이 다음 인스턴스를 만든다(같은 발생이 두 번 만들어지지 않게 `todos_occurrence` 유니크 인덱스로 막는다).

### 알림 전달

- `reminder/fired` 이벤트 → 캐릭터 말풍선 + OS 알림(`infra/electron/notifier`).
- 말풍선 버튼: [지금 한 판] [미루기 ▾ 10분·30분·1시간·내일 아침] [완료]. OS 알림은 클릭 시 캐릭터 옆 패널을 연다(알림 버튼 지원이 OS마다 달라 버튼은 말풍선에 둔다).
- [지금 한 판] → `pomodoro/start { todoId }` → 종료 시 `pomodoro/completed { todoId, minutes }` → todos가 `focus_minutes` 누적 → 캐릭터가 [완료 처리] [한 판 더] 제안.
- 알림 일시정지(트레이 메뉴): 설정 `reminders.pausedUntil`. 일시정지 중 발화한 리마인더는 해제 시 놓친 알림 요약으로 보여준다.

### OS 연동

- 로그인 시 자동 실행(`app.setLoginItemSettings`, 기본 켬, 설정에서 끄기).
- 트레이 아이콘 메뉴: 캐릭터 보이기, 알림 일시정지(1시간·오늘), 종료.

## 6. 빌드와 배포

### 이름 변경과 데이터 이전

- `productName: "PixCompanion"`, `appId: "com.leeswallow.pixcompanion"`.
- 이름이 바뀌면 `userData` 경로가 바뀐다. 첫 실행 시 새 경로에 DB가 없고 옛 경로(`Study Companion Pet`)에 있으면 DB·mods·characters를 복사한다. 원본은 지우지 않는다.

### 파이프라인 (`.github/workflows/release.yml`)

- 트리거: `v*.*.*` 태그 push. 태그 버전과 `package.json` 버전이 다르면 실패.
- 매트릭스: `macos-latest`(arm64·x64 dmg + zip), `windows-latest`(x64 nsis exe). 각 러너에서 `npm ci` → `npm test` → `npm run typecheck` → electron-builder.
- 결과물은 GitHub Release **draft**에 첨부한다. 사람이 확인 후 publish.
- 서명: secret(`CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`)이 있으면 서명·공증, 없으면 ad-hoc 서명으로 빌드한다. 출시 전 다운로드한 dmg로 Gatekeeper 동작을 실제 확인하고 README에 첫 실행 안내를 쓴다.

### 자동 업데이트

- `electron-updater`가 GitHub Releases를 확인한다(시작 시 + 6시간마다, 스케줄러 job으로).
- 새 버전이 있으면 캐릭터가 알려주고 사용자가 동의하면 내려받아 재시작 시 설치한다.
- macOS 자동 업데이트는 서명된 앱에서만 동작하므로, 미서명 빌드에서는 "새 버전이 있어요" 알림과 Release 페이지 링크만 보여준다.
- 빌드 시 `PIXCOMPANION_CHANNEL`(`github` 기본, 나중에 `itch`)을 주입해 배포처별로 업데이트 동작을 고른다.

## 7. 테스트

- **domain**: 순수 함수 단위 테스트(리마인더 시각 계산, rrule 다음 발생, all-day 기준 시각, 뽀모도로 상태).
- **core**: 엔진(트랜잭션 후 이벤트 발행, 롤백 시 이벤트 폐기, 직렬 처리, 에러 변환), 스케줄러(가짜 시계로 발화·재예약·취소·놓친 job 따라잡기·`late` 플래그).
- **app**: 모듈별로 메모리 SQLite + 가짜 시계 위에 엔진을 띄워 시나리오 테스트. 예: "마감 15:30 할 일 생성 → 14:30에 `reminder/fired` → snooze 30분 → 15:00 재발화 → 완료 시 남은 job 취소".
- **architecture.test.ts**: 레이어 import 규칙.
- **수동 확인**: 화면이 바뀌는 단계마다 빌드 → 앱 재실행 → 캡처.
- 기존 테스트(데스크톱 139개)는 위치를 옮기되 전부 유지한다.

## 8. 진행 단계

모든 단계에서 앱이 실행되고 테스트가 통과하는 상태를 유지한다.

| 단계 | 내용 |
|---|---|
| 0 | 현재 작업 커밋, worktree에 작업 브랜치 |
| 1 | `core/` 엔진·스케줄러·clock·모듈 등록기·`architecture.test.ts` (UI 변경 없음, TDD) |
| 2 | `mobile` 도메인 코드를 `domain/`으로 이동, `apps/mobile` 삭제 |
| 3 | 모듈 이전: todos → pomodoro → notes → dashboard → chat/AI·MCP 도구 → music → pet·characters·mods·friends·settings·backup. `main.ts` 분해, legacy 어댑터 제거 |
| 4 | 리마인더: 마감·알림·반복, 말풍선 액션, 놓친 알림, 트레이, 자동 실행, 리마인더→뽀모도로 |
| 5 | PixCompanion 이름 변경·데이터 이전, release workflow, electron-updater, 첫 공개 빌드 `v0.2.0` |

plan은 단계별로 쓴다. 1~2단계 plan을 먼저 쓰고, 3단계 이후는 앞 단계 결과를 반영해 그때 쓴다.
