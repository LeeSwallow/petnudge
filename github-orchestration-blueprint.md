# Study Companion GitHub Orchestration Blueprint

## 목적

Study Companion 개발을 FE, BE, AI로 나눠 병렬 개발시키고, GitHub Issues/PR/Reviews/Actions를 중심으로 자가 개선 루프를 돌리는 운영 설계다.

핵심 원칙:

1. GitHub Issue가 유일한 작업 지시 단위다.
2. PR은 검증 가능한 작은 변경 단위다.
3. FE/BE/AI는 계약 문서를 통해 병렬화한다.
4. 자가 개선은 “관찰 → 이슈화 → 수정 PR → 리뷰 → 검증 → 회고 반영” 루프다.
5. 자동화는 개발자를 대체하는 것이 아니라, 반복 가능한 분해/검증/리뷰/회고를 강제한다.

---

## 1. FE, BE, AI를 어떻게 나눠서 개발시킬까?

### 권장 구조

```text
study-companion/
  apps/
    web/                  # FE: 화면, 상태 표시, 사용자 플로우
    api/                  # BE: 세션/태스크/보상/저장/API
  packages/
    contracts/            # 공유 타입, OpenAPI, JSON Schema, 이벤트 스펙
    ai-core/              # AI provider interface, prompts, evaluators
  docs/
    product-spec.md
    ux-flow.md
    architecture.md
    contracts.md
    implementation-backlog.md
```

현재 레포는 아직 아이디어 문서 중심이므로, 실제 구현으로 갈 때 위 구조를 만들면 된다.

### 책임 분리

| Lane | 소유 책임 | 만들 산출물 | 하면 안 되는 것 |
|---|---|---|---|
| FE | Study room UX, timer UI, character state, Coffee Chat 표시 | `apps/web`, UI tests, UX screenshots | BE 상태를 임의로 조작, AI 응답을 프론트에서 직접 생성 |
| BE | session/task/reward 저장, API, 이벤트, 인증/사용자 | `apps/api`, OpenAPI, DB schema, API tests | UI 전용 상태를 과도하게 소유, prompt를 BE 내부에 하드코딩 |
| AI | break-only Coffee Chat, reflection, next-action suggestion | `packages/ai-core`, prompts, structured output schema, evals | 집중 중 자유채팅 허용, BE state를 직접 mutation |
| Contracts | FE/BE/AI 경계 | `packages/contracts`, `docs/contracts.md` | 말로만 합의하고 코드/스키마 없이 진행 |
| QA/Orchestrator | 이슈 분해, PR 검증, CI, 회고 | GitHub labels, project board, validation report | 직접 대형 구현을 밀어붙이기 |

### 병렬 개발을 가능하게 하는 계약

처음부터 구현을 나눠 맡기려면 아래 계약이 먼저 있어야 한다.

1. `SessionState` schema
   - timer status: `idle | focus | break | completed`
   - tasks: id/title/status
   - companion: mood/state/message
   - rewards: exp/streak/unlocks
   - chat: only enabled during break

2. API contracts
   - `POST /sessions`
   - `PATCH /sessions/{id}/tasks/{taskId}`
   - `POST /sessions/{id}/start-focus`
   - `POST /sessions/{id}/complete-focus`
   - `POST /sessions/{id}/coffee-chat`

3. AI structured output

```json
{
  "reflection_question": "string",
  "encouragement": "string",
  "next_action": "string",
  "risk": "none | distraction | too_long | unsafe"
}
```

4. Event contract

```json
{
  "type": "SESSION_UPDATED | REWARD_UNLOCKED | COFFEE_CHAT_READY",
  "sessionId": "string",
  "payload": {}
}
```

이 계약을 `packages/contracts` 또는 `docs/contracts.md`에 두고, 각 lane은 계약만 보고 개발한다.

---

## 2. 자가 개선 루프를 어떻게 돌릴까?

자가 개선 루프는 LLM이 마음대로 코드를 고치는 루프가 아니라, 검증 가능한 실패를 자동으로 작업화하는 루프여야 한다.

### 기본 루프

```text
Observe
  ↓
Classify
  ↓
Create GitHub Issue
  ↓
Assign lane: FE / BE / AI / Contracts / QA
  ↓
Implement branch + PR
  ↓
Automated checks + agent review + human optional review
  ↓
Merge or request changes
  ↓
Update playbook/eval/checklist
  ↓
Next loop
```

### 관찰 소스

| Source | 수집 내용 | 생성할 이슈 유형 |
|---|---|---|
| CI | build/test/lint 실패 | `bug`, `ci`, lane label |
| Playwright/E2E | 첫 세션 루프 실패, UI 깨짐 | `bug:ux`, `fe` |
| API smoke | endpoint contract 불일치 | `be`, `contracts` |
| AI eval | 응답이 길다/집중 방해/형식 불일치 | `ai`, `eval` |
| PR review | 설계 누락, 보안, 테스트 부족 | `review-finding` |
| User feedback | 루틴 지속에 도움 안 됨 | `product`, `ux` |

### 자가 개선에서 중요한 금지선

- 실패를 바로 main에 수정하지 않는다. 항상 issue → branch → PR이다.
- AI가 생성한 개선안은 최소 1개 검증을 통과해야 한다.
- AI 응답 품질 개선은 prompt만 바꾸지 말고 eval case를 먼저 추가한다.
- FE/BE/AI 경계 오류는 코드 수정보다 contracts 문서/스키마 수정이 먼저다.
- 같은 유형의 실패가 2회 반복되면 “workflow 개선 이슈”를 만든다.

### 개선 루프 단계별 자동화

1. `collect` — CI, test, eval, user feedback을 모은다.
2. `triage` — 실패를 lane과 severity로 분류한다.
3. `issue` — GitHub Issue를 생성/중복 연결한다.
4. `plan` — issue에 acceptance criteria와 validation command를 추가한다.
5. `implement` — lane별 에이전트가 branch/PR 생성한다.
6. `review` — spec compliance review와 code quality review를 분리한다.
7. `verify` — CI + 수동/자동 smoke 결과를 PR에 댓글로 남긴다.
8. `learn` — 재발 방지를 위해 docs/eval/checklist/library 중 하나를 업데이트한다.

---

## 3. GitHub에서 어떻게 총괄하고 orchestration 할까?

### GitHub를 control plane으로 쓴다

GitHub는 코드 저장소가 아니라 다음 네 가지를 총괄하는 control plane이 된다.

1. Issues: 작업 큐
2. Labels/Milestones/Projects: 우선순위와 lane routing
3. Pull Requests: 변경 단위와 리뷰 공간
4. Actions: 자동 검증/자가 개선 트리거

### Issue label 체계

```text
lane:fe
lane:be
lane:ai
lane:contracts
lane:qa
lane:docs

type:feature
type:bug
type:review-finding
type:eval-failure
type:workflow

priority:p0
priority:p1
priority:p2

status:needs-triage
status:ready
status:blocked
status:in-review
status:validated
```

### Orchestrator의 역할

Orchestrator는 구현자가 아니라 교통정리자다.

해야 할 일:

- issue를 lane별로 쪼갠다.
- contract 선행 작업을 먼저 만든다.
- 병렬 가능한 FE/BE/AI 작업을 동시에 ready로 만든다.
- 서로 의존하는 작업은 parent/blocked 관계로 묶는다.
- PR마다 acceptance criteria와 validation 결과가 있는지 확인한다.
- CI/review/eval 실패를 다시 issue로 되돌린다.

하지 말아야 할 일:

- 큰 feature를 한 PR에 몰아넣기
- FE가 BE/AI mock을 영구 fallback으로 들고 가게 방치하기
- AI 품질 실패를 “prompt 조금 수정”으로만 처리하기
- review 없이 auto-merge하기

### 권장 task graph

```text
Epic: MVP first-session loop

T0 Contracts: SessionState/API/AI output schema
  ├─ T1 FE: Study room shell using contract mock
  ├─ T2 BE: Session/task/reward API implementing contract
  ├─ T3 AI: Coffee Chat provider + evals implementing contract
  └─ T4 QA: contract tests and first-session E2E
        └─ T5 Integration PR: remove mocks, wire FE→BE→AI
```

T1/T2/T3는 T0 이후 병렬 가능하다. T5는 T1~T4가 끝난 뒤에만 시작한다.

---

## 4. Issue, review, library 등 전체 플로우 자동화

### 자동화 대상

| Flow | 자동화 내용 | GitHub primitive |
|---|---|---|
| Idea → Epic | product-spec에서 epic issue 생성 | Issue |
| Epic → Tasks | FE/BE/AI/Contracts/QA task 분해 | Issue + labels |
| Task → Branch | issue 번호 기반 branch 생성 | branch |
| Branch → PR | PR 템플릿, linked issue, checklist | Pull Request |
| PR → Review | spec review + code review + tests | PR review + Actions |
| Failure → Issue | CI/eval/E2E 실패를 issue로 전환 | Issue |
| Merge → Learn | docs/evals/library 업데이트 확인 | PR checklist |
| Reusable code | shared contracts/client/eval utils 관리 | packages/contracts, packages/ai-core |

### Library 자동화 원칙

`library`는 “언젠가 쓸 공용 코드”가 아니라 반복되는 실수를 줄이기 위한 shared package다.

처음부터 만들 library:

1. `packages/contracts`
   - TypeScript types
   - JSON Schema
   - OpenAPI snippets
   - contract test fixtures

2. `packages/ai-core`
   - `CoffeeChatProvider` interface
   - prompt templates
   - output parser/validator
   - eval cases

나중에 만들 library:

- design system
- analytics SDK
- reward engine package
- character asset pipeline

### PR gate

모든 PR은 아래 중 최소 하나를 업데이트해야 한다.

- production code
- tests/evals
- contracts
- docs/checklist

그리고 아래를 PR body에 적어야 한다.

- linked issue
- lane
- acceptance criteria
- validation command/result
- screenshots or logs if FE/AI behavior changed
- known WIP/blockers

---

## 5. 최소 GitHub Actions 설계

### CI matrix

```yaml
name: ci

on:
  pull_request:
  push:
    branches: [main]

jobs:
  contracts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: echo "validate contracts here"

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: echo "install/build/test web here"

  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: echo "install/test api here"

  ai-evals:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: echo "run deterministic AI contract/eval tests here"
```

처음에는 echo placeholder로 시작해도 되지만, 실제 앱 구조가 생기면 각 lane의 실제 명령으로 대체해야 한다.

---

## 6. 추천 MVP 자동화 순서

1. GitHub repo 초기화/remote 연결
2. issue/PR 템플릿 추가
3. label taxonomy 생성
4. `docs/contracts.md` 작성
5. `packages/contracts` 생성
6. 첫 Epic issue 생성: MVP first-session loop
7. FE/BE/AI/QA task issue 자동 생성
8. 각 task branch/PR 생성
9. CI skeleton 추가
10. E2E/eval 실패를 issue로 되돌리는 triage script 추가

---

## 7. 답변 요약

1. FE/BE/AI 분업은 `contracts` 선행 후 lane별 책임과 PR gate로 나눈다.
2. 자가 개선은 실패를 관찰해서 issue로 만들고, PR/리뷰/검증 후 docs/eval/library에 반영하는 루프다.
3. GitHub는 Issues/Labels/Projects/PR/Actions를 묶은 control plane으로 쓴다.
4. 전체 자동화의 핵심은 “작업 생성, 라우팅, 브랜치/PR, 리뷰, 실패 재이슈화, 학습 반영”을 스크립트와 Actions로 고정하는 것이다.
