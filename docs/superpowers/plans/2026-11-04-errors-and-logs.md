# 예외 처리 표준과 에러 로그 Implementation Plan (#31)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 앱 전체가 같은 방식으로 에러를 사용자 문구와 로그로 나누고, 로그를 파일에 안전하게 남기고, 패널 모듈 하나가 실패해도 나머지는 동작하게 한다.

**Architecture:**
- 순수 규칙은 `src/domain/logging`과 `src/domain/errors`에 둔다. 해당 규칙은 가리기(redaction), 줄 형식, 교체 판단, 사용자 문구다.
- 파일 쓰기는 `src/infra/logger.ts`에 둔다.
- main이 로거를 하나 만들고, 렌더러는 IPC `log`로 보낸다.
- 패널은 모듈마다 Svelte `<svelte:boundary>`로 감싼다.

**Spec:** GitHub #31 본문. 표준은 `src/core/errors.ts`의 `DomainError`/`Wire`를 앱 전체로 넓힌다.

## Global Constraints

- 레이어 규칙은 다음과 같다.
  - `domain`은 패키지를 쓰지 않는다.
  - `node:fs`는 `infra`에서만 쓴다.
  - `src/main`은 옛 폴더라 무엇이든 쓸 수 있다.
- 로그에 대화 내용, 메모 본문, API 키를 남기지 않는다. 남는 것은 범위, 메시지, 짧은 상세(최대 2000자)이고, 모두 가린 뒤 쓴다.
- 로그 파일은 `<userData>/logs/petnudge.log`다. 1MB를 넘으면 `.1` → `.2` → `.3`으로 밀어내고, 셋을 넘는 것은 지운다.
- 사용자 문구는 한국어로 쓴다. 알 수 없는 에러는 `문제가 생겼어요`로 보여 준다.
- 각 작업 끝에 `npm run typecheck && npm test`를 통과시키고, UI 작업이면 `npm run check:ui`도 통과시킨다.

## Review Focus

1. 로그 쓰기가 실패해도(디스크 가득 참, 권한 없음) 앱이 죽지 않는다. → Task 3 테스트
2. 렌더러가 보낸 아주 긴 문자열이나 문자열이 아닌 값 → main이 자르거나 버린다. → Task 4 테스트(`sanitizeLogInput`)
3. 같은 에러가 반복될 때 로그가 폭주하지 않는다(1초에 같은 줄은 한 번). → Task 3 테스트
4. 모듈 경계에서 "다시 시도"를 누르면 그 모듈만 다시 그려지고, 입력 중인 다른 탭의 글은 남는다. → Task 5 수동 확인
5. 진단 정보에 토큰이나 키가 섞이지 않는다. → Task 1 redaction 테스트 + Task 5 check:ui

---

### Task 1: 로그 규칙 (`src/domain/logging/log.ts`)

- Produces:
  - `type Level = 'error' | 'warn' | 'info' | 'debug'`
  - `atLeast(level: Level, min: Level): boolean`
  - `redact(text: string): string`: 다음을 `[가림]`으로 바꾼다.
    - `sk-…`, `sk-ant-…` 같은 키
    - `Bearer <token>`
    - 32자 이상의 hex 또는 base64url 덩어리
  - `formatLine(entry: { at: Date; level: Level; scope: string; message: string; detail?: string }): string`: `2026-11-04T09:00:00.000Z ERROR [scope] message | detail` 형식의 한 줄이다. 줄바꿈은 `⏎`로 바꾸고, 가린 뒤에 만든다.
  - `rotationPlan(base: string, keep: number): [from: string, to: string][]`: `base.2→base.3`, `base.1→base.2`, `base→base.1` 순서다.
- 테스트: 각 함수, 특히 키·토큰 가리기와 줄바꿈 처리

### Task 2: 사용자 문구 (`src/domain/errors/userMessage.ts`)

- Produces: `toUserMessage(error: unknown): { text: string; detail: string }`
  - `{ code, message }` 모양(DomainError, Wire 실패)이면 `text = message`
  - IPC로 감싼 Error면 `Error invoking remote method 'x': Error:` 앞부분을 떼어 낸다.
  - 그 밖의 Error면 message를 쓴다.
  - 알 수 없는 값이면 `text = '문제가 생겼어요'`이고, detail에는 String(value)를 넣는다.
- `src/ui/modules/settings/logic.ts`의 `cleanError`는 이것을 쓰게 바꾼다(기존 테스트 유지).

### Task 3: 파일 로거 (`src/infra/logger.ts`)

- Produces: `createLogger(dir: string, options?: { maxBytes?: number; keep?: number; min?: Level; now?: () => Date }): Logger`
  - `Logger = { log(level, scope, message, detail?): void; recent(n: number): string[]; file: string }`
  - 쓰기는 동기 `appendFileSync`다.
  - 크기를 넘으면 `rotationPlan`대로 `renameSync`한다.
  - 모든 예외를 삼키고 `process.stderr`에만 한 줄 남긴다(1번).
  - 같은 (level, scope, message)는 1초 안에 한 번만 쓴다(3번).
- 테스트: 임시 폴더 기준으로 교체, 수준 거르기, 반복 억제, 쓸 수 없는 폴더에서도 throw하지 않음, `recent`

### Task 4: main과 렌더러 연결

- main(`src/main/main.ts`)
  - `userData/logs`에 로거를 만든다.
  - `console.error` 두 곳을 로거로 바꾼다.
  - `process.on('uncaughtException' | 'unhandledRejection')`을 받아 error로 남긴다.
  - IPC `log`를 받는다. 입력은 `sanitizeLogInput`(main 안의 순수 함수, 테스트)으로 걸러서, 알 수 없는 level은 버리고, scope는 40자, message와 detail은 2000자로 자른다.
  - IPC `logs:open`(로그 폴더 열기)과 `logs:diagnostics`(버전, OS, Electron, 최근 warn/error 20줄)를 둔다.
- preload에는 `log`, `openLogs`, `diagnostics`를 추가한다.
- 렌더러
  - `window`의 `error`와 `unhandledrejection`을 받아 `api.log('error', 'renderer', …)`로 보낸다.
  - `console.error` 두 곳을 바꾼다.
  - 조용히 삼키던 catch 가운데 원인을 숨기던 곳은 warn으로 남긴다. 대화의 캐릭터 목록, 펫 명령, 친구 창 열기가 그렇다. 의도적으로 삼킨 곳(audio.play, readdir)에는 이유를 주석으로 적는다.

### Task 5: 모듈 경계와 설정 화면

- `Panel.svelte`
  - 모듈마다 `<svelte:boundary onerror>`로 감싼다.
  - 실패한 모듈 자리에는 `EmptyState` "이 탭에 문제가 생겼어요"와 [다시 시도](reset)를 보여 주고, `api.log('error', 'panel:<id>', …)`로 남긴다.
- 설정의 "AI 연결 (MCP)" 아래에 "문제 해결" 묶음을 둔다.
  - [로그 폴더 열기]
  - [진단 정보 복사]: 복사 후 "복사됨!"을 표시한다.
- `.github/ISSUE_TEMPLATE/bug.yml`에 "진단 정보(설정 › 문제 해결 › 진단 정보 복사)" 항목을 추가한다.
- `check:ui`에 두 가지를 추가한다.
  - 문제 해결 버튼 두 개가 있다.
  - 진단 정보에 버전이 있고, `Bearer`나 `sk-`가 없다. 정보는 `petApi.diagnostics()`로 직접 받아 확인한다.
