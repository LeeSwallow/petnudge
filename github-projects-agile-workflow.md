# GitHub Projects 기반 Agile Agentic Development 구조

## 0. 목적

GitHub Projects를 단순 칸반 보드가 아니라 AI Agent 개발 자동화의 운영 대시보드로 사용한다.

목표:

- FE / BE / AI / Contracts / QA 작업을 Agile하게 분리한다.
- GitHub Issue를 sprint backlog와 agent task 단위로 사용한다.
- Pull Request, CI, AI eval, review 결과를 Project 상태에 반영한다.
- 실패를 다시 Issue로 되돌려 self-improvement loop를 만든다.

핵심 문장:

> GitHub Projects는 “할 일 목록”이 아니라, AI Agent들이 안전하게 병렬 개발하도록 만드는 Agile control board다.

---

## 1. Project 보드 설계

추천 Project 이름:

```text
Study Companion Agentic MVP
```

추천 View:

1. Sprint Board
2. Lane Board
3. Roadmap
4. Review Queue
5. Risk & Blockers
6. Self-improvement Loop

---

## 2. View 1 — Sprint Board

가장 기본 운영 화면이다.

### Columns / Status

```text
Inbox
Ready
In Progress
In Review
Validation
Blocked
Done
Archived
```

### Status 의미

| Status | 의미 | 이동 조건 |
|---|---|---|
| Inbox | 아직 정리되지 않은 아이디어/요청 | Orchestrator가 triage 필요 |
| Ready | acceptance와 validation이 있는 구현 가능 이슈 | lane, scope, DoD 확정 |
| In Progress | agent 또는 사람이 branch 작업 중 | assignee/branch 존재 |
| In Review | PR 생성됨 | linked PR 존재 |
| Validation | CI/eval/e2e 확인 중 | PR checks 실행 중 또는 QA 검증 중 |
| Blocked | 계약/의존성/실패로 진행 불가 | blocker comment 필요 |
| Done | merge 또는 의도한 산출물 완료 | validation 기록 필요 |
| Archived | 완료 후 더 이상 보드에 노출 불필요 | sprint 종료 후 정리 |

### 자동 이동 규칙

```text
Issue created → Inbox
label status:ready → Ready
PR linked/opened → In Review
CI running or qa-needed → Validation
label status:blocked → Blocked
PR merged or issue closed → Done
```

GitHub Projects의 built-in workflow와 GitHub Actions를 같이 사용한다.

---

## 3. View 2 — Lane Board

FE/BE/AI 병렬 개발 상황을 보는 화면이다.

Group by:

```text
Lane
```

Lane options:

```text
Product
Contracts
FE
BE
AI
QA
Docs
Workflow
```

각 lane의 책임:

| Lane | 책임 |
|---|---|
| Product | 사용자 문제, MVP scope, success metric |
| Contracts | state/API/event/AI output schema |
| FE | web UI, timer, companion, Coffee Chat display |
| BE | session/task/reward API, persistence, fallback |
| AI | Coffee Chat provider, prompts, eval cases |
| QA | contract test, e2e, smoke, validation report |
| Docs | product/architecture/report 문서 |
| Workflow | automation, GitHub Actions, scripts, templates |

운영 원칙:

- FE/BE/AI 이슈는 Contracts 이슈가 Ready 또는 Done이 되기 전까지 실제 구현에 들어가지 않는다.
- FE는 mock을 쓸 수 있지만 mock은 contract fixture에서만 온다.
- AI는 BE state를 직접 변경하지 않는다.
- QA는 API smoke, browser E2E, AI eval을 분리해서 보고한다.

---

## 4. View 3 — Roadmap

Milestone 또는 Iteration 기준으로 본다.

추천 milestones:

```text
M0. Workflow Setup
M1. Contracts-first MVP Skeleton
M2. First-session Loop
M3. Agentic Improvement Loop
M4. Demo-ready Study Companion
```

### M0. Workflow Setup

목표:

- GitHub labels
- Issue/PR templates
- Project fields
- CI skeleton
- Agent prompts

완료 기준:

- 모든 Issue가 lane/status/type/priority를 가질 수 있다.
- PR template에 validation/reporting 필드가 있다.
- Project board에서 lane별 상태가 보인다.

### M1. Contracts-first MVP Skeleton

목표:

- `SessionState`
- API draft
- AI output schema
- event type
- invalid state rules

완료 기준:

- FE/BE/AI가 같은 contract를 보고 병렬 개발할 수 있다.

### M2. First-session Loop

목표:

- 할 일 입력
- focus 시작
- focus 완료
- break 전환
- reward 증가
- break-only Coffee Chat

완료 기준:

- 첫 사용자 세션이 E2E로 통과한다.

### M3. Agentic Improvement Loop

목표:

- CI/eval/review 실패를 issue로 되돌린다.
- 반복 실패를 workflow/library/eval 개선으로 승격한다.

완료 기준:

- 실패가 대화로 사라지지 않고 추적 가능한 issue가 된다.

---

## 5. View 4 — Review Queue

PR 중심으로 보는 화면이다.

Filter:

```text
Status = In Review OR Validation
```

보여야 하는 필드:

```text
Title
Lane
Linked PR
Review Type
Risk
Validation
Owner
Sprint
```

Review Type options:

```text
Spec Review
Code Review
Contract Review
AI Eval Review
UX Review
Security Review
Integration Review
```

운영 원칙:

1. Spec Review가 먼저다.
2. Spec Review PASS 전에는 Code Review를 완료 처리하지 않는다.
3. Contract 변경 PR은 FE/BE/AI 영향 범위를 적어야 한다.
4. AI 변경 PR은 eval sample과 실패 케이스를 적어야 한다.
5. FE 변경 PR은 screenshot 또는 e2e 결과가 필요하다.

---

## 6. View 5 — Risk & Blockers

리스크와 blocker만 보는 화면이다.

Filter:

```text
Status = Blocked OR Risk = High OR Priority = P0
```

Risk options:

```text
Low
Medium
High
Critical
```

Blocker 유형:

| Blocker | 예시 | 처리 |
|---|---|---|
| Contract blocker | FE/BE field 불일치 | Contracts 이슈 생성 |
| Integration blocker | FE가 BE API와 연결 안 됨 | Integration issue |
| Eval blocker | AI 응답 schema/품질 실패 | AI eval issue |
| UX blocker | 첫 세션 흐름이 불명확 | FE/UX issue |
| Workflow blocker | agent가 같은 실수를 반복 | Workflow issue |

---

## 7. View 6 — Self-improvement Loop

자가 개선 루프 전용 화면이다.

Filter:

```text
Type = eval-failure OR review-finding OR workflow OR regression
```

목적:

- 실패를 모은다.
- 반복 패턴을 찾는다.
- test/eval/library/docs 개선으로 승격한다.

반복 실패 승격 규칙:

```text
같은 failure category가 2회 발생
  → Workflow issue 생성

같은 boilerplate/utility 코드가 3회 반복
  → Library extraction issue 생성

같은 AI output 실패가 2회 발생
  → Eval case + prompt/schema issue 생성
```

---

## 8. Project Custom Fields

GitHub Projects에 만들 필드:

| Field | Type | Options / 예시 |
|---|---|---|
| Status | Single select | Inbox, Ready, In Progress, In Review, Validation, Blocked, Done, Archived |
| Lane | Single select | Product, Contracts, FE, BE, AI, QA, Docs, Workflow |
| Type | Single select | Epic, Feature, Bug, Review Finding, Eval Failure, Workflow, Refactor, Chore |
| Priority | Single select | P0, P1, P2, P3 |
| Risk | Single select | Low, Medium, High, Critical |
| Review Type | Single select | Spec, Code, Contract, AI Eval, UX, Security, Integration |
| Sprint | Text or Iteration | Sprint name or iteration |
| Validation | Single select | Not Run, Running, Passed, Failed, Waived |
| Agent Owner | Text | fe-agent, be-agent, ai-agent, qa-agent 등 |
| Contract Impact | Single select | None, State, API, AI Output, Events, Multiple |
| Effort | Number | 1, 2, 3, 5, 8 |
| Due | Date | target date |

GitHub 기본 `Status` 필드는 이미 있을 수 있다. 기존 필드가 있으면 중복 생성하지 않는다.

---

## 9. Label 체계와 Project field 매핑

GitHub Labels:

```text
lane:fe → Lane = FE
lane:be → Lane = BE
lane:ai → Lane = AI
lane:contracts → Lane = Contracts
lane:qa → Lane = QA
lane:docs → Lane = Docs

type:feature → Type = Feature
type:bug → Type = Bug
type:eval-failure → Type = Eval Failure
type:review-finding → Type = Review Finding
type:workflow → Type = Workflow

priority:p0 → Priority = P0
priority:p1 → Priority = P1
priority:p2 → Priority = P2

status:ready → Status = Ready
status:blocked → Status = Blocked
status:in-review → Status = In Review
status:validated → Validation = Passed
```

처음에는 label만 붙여도 충분하다. 이후 GitHub Actions에서 label → project field sync를 자동화한다.

---

## 10. Issue 유형

### Epic Issue

사용 시점:

- 하나의 사용자 가치 흐름
- 여러 lane task로 쪼개져야 하는 작업

예:

```text
Epic: MVP first-session loop
```

필수 내용:

```text
- 목표
- 사용자 시나리오
- lane task 목록
- success metric
- out of scope
- demo acceptance
```

### Lane Task Issue

사용 시점:

- FE/BE/AI/Contracts/QA 중 한 lane이 처리할 수 있는 작업

예:

```text
FE: Study room shell using contract fixture
BE: Complete focus session endpoint
AI: Coffee Chat output schema evaluator
```

필수 내용:

```text
- lane
- scope
- contract impact
- acceptance criteria
- validation command
- linked epic
```

### Review Finding Issue

사용 시점:

- PR review에서 발견됐지만 현재 PR에서 바로 고치면 scope creep인 작업

예:

```text
Review Finding: Add invariant test for Coffee Chat disabled during focus
```

### Workflow Improvement Issue

사용 시점:

- agent가 같은 실수를 반복하거나 validation이 비어 있는 경우

예:

```text
Workflow: Add PR checklist guard for validation command output
```

---

## 11. Sprint 운영 방식

추천 cadence:

```text
1주 sprint
```

### Sprint Planning

Orchestrator가 한다.

입력:

```text
- Product brief
- current blockers
- previous review findings
- roadmap milestone
```

출력:

```text
- sprint goal
- selected epic/issues
- lane별 capacity
- risk list
```

### Daily 운영

Agent 개발에서는 daily standup 대신 Project board snapshot을 쓴다.

확인 질문:

```text
- Blocked가 생겼는가?
- In Review가 오래 머무는가?
- Validation Failed가 있는가?
- Contracts 변경이 FE/BE/AI에 전파됐는가?
- 같은 failure가 반복되는가?
```

### Sprint Review

확인:

```text
- demo 가능한 user flow가 생겼는가?
- CI/eval/e2e evidence가 있는가?
- ready vs WIP vs blocker가 분리됐는가?
```

### Retrospective

확인:

```text
- agent가 반복한 실수는 무엇인가?
- issue template을 고쳐야 하는가?
- PR checklist를 강화해야 하는가?
- shared library로 뺄 것이 있는가?
- eval case를 추가해야 하는가?
```

---

## 12. 자동화 단계

### Level 0. Manual Project Board

가장 먼저 한다.

```text
- Project 생성
- field 생성
- view 생성
- issue/PR template 적용
- label 생성
```

### Level 1. Issue/PR 자동 연결

```text
- PR body에 Closes #issue 사용
- issue를 project에 자동 추가
- PR opened 시 Status = In Review
- PR merged 시 Status = Done
```

### Level 2. CI 결과 반영

```text
- CI running → Validation = Running
- CI success → Validation = Passed
- CI failure → Validation = Failed + status:blocked
```

### Level 3. 실패 자동 이슈화

```text
- GitHub Actions failure log 수집
- failure category 분류
- lane/type/priority label 부착
- follow-up issue 생성
```

### Level 4. 자가 개선 제안

```text
- 최근 N개 failed issues/reviews 분석
- 반복 failure pattern 탐지
- workflow/library/eval 개선 issue 생성
```

---

## 13. gh CLI 기본 명령

권한 확인:

```bash
gh auth status
```

Project 권한 추가:

```bash
gh auth refresh -s project
```

Project 생성:

```bash
gh project create --owner "@me" --title "Study Companion Agentic MVP" --format json
```

Project 목록:

```bash
gh project list --owner "@me"
```

필드 생성 예:

```bash
gh project field-create 1 --owner "@me"   --name "Lane"   --data-type SINGLE_SELECT   --single-select-options "Product,Contracts,FE,BE,AI,QA,Docs,Workflow"
```

이슈를 프로젝트에 추가:

```bash
gh project item-add 1 --owner "@me" --url "https://github.com/OWNER/REPO/issues/1"
```

---

## 14. Study Companion 첫 Project 구성 예시

### Sprint Goal

```text
MVP first-session loop를 contract-first 방식으로 구현 가능한 상태로 만든다.
```

### 첫 Epic

```text
Epic: MVP first-session loop
```

### 첫 Task Issues

```text
Contracts: Define SessionState/API/AI output/event contract
FE: Study room shell using contract fixtures
BE: Session/task/reward API skeleton
AI: Coffee Chat provider interface and eval cases
QA: First-session e2e skeleton
Workflow: GitHub Projects field/label/PR gate setup
```

### 첫 Definition of Done

```text
- Project board has lane/status/type/priority fields
- Every issue has lane and acceptance criteria
- Contract issue is Done before FE/BE/AI implementation starts
- FE/BE/AI PRs link back to issues
- CI/eval result is recorded in PR body or comment
```

---

## 15. Agent Orchestrator 운영 규칙

Orchestrator Agent는 코드를 직접 고치는 역할이 아니다.

해야 할 일:

```text
- Inbox issue triage
- Epic을 lane task로 분해
- dependency 지정
- Project field 업데이트
- blocked issue 원인 분류
- review/eval failure를 follow-up issue로 전환
- sprint review/retro report 작성
```

하지 말아야 할 일:

```text
- 모든 코드를 직접 수정
- 큰 PR을 묵인
- contract 없이 FE/BE/AI 병렬 개발 시작
- 실패를 comment로만 남기고 issue화하지 않음
- WIP를 Done으로 이동
```

---

## 16. 최종 운영 원칙

1. Board는 현재 상태를 보여야 한다.
2. Issue는 agent에게 줄 수 있을 정도로 구체적이어야 한다.
3. PR은 작고 검증 가능해야 한다.
4. Contract 변경은 가장 먼저, 가장 명확하게 처리한다.
5. 실패는 반드시 Project로 되돌아와야 한다.
6. 반복 실패는 workflow, library, eval, docs 개선으로 승격한다.
7. Agile의 핵심은 회의가 아니라 짧은 feedback loop다.
