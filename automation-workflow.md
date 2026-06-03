# Study Companion Development Automation Workflow

## 목적

이 워크플로우는 `study-companion` 아이디어를 매번 새로 설명하지 않고도 제품 구체화, MVP 설계, 작업 분해, 구현, 검증을 반복 가능하게 자동화한다.

## 산출물 구조

- `product-spec.md`: 제품 정의, MVP 루프, AI 사용 위치, 성공 지표
- `workflow.json`: 자동화 가능한 단계/역할/입력/산출물/검증 기준
- `prompts/*.md`: 에이전트 또는 사람에게 그대로 줄 수 있는 역할별 작업 프롬프트
- `tools/study_companion_workflow.py`: workflow.json을 검증하고 체크리스트/프롬프트 팩을 생성하는 CLI
- `generated/`: CLI가 생성하는 실행용 체크리스트와 프롬프트 번들

## 표준 진행 순서

1. Product pass
   - 목표: 아이디어를 “누구의 어떤 루틴 문제를 해결하는가”로 좁힌다.
   - 입력: README, business-evaluation, product-spec
   - 산출물: MVP 가설, 제외 범위, 성공 지표

2. UX pass
   - 목표: 한 화면에서 Study with me 루프가 보이는 UX를 정의한다.
   - 입력: product-spec
   - 산출물: 화면 구성, 상태 전환, 카피, 캐릭터 상태

3. Architecture pass
   - 목표: MVP 구현에 필요한 최소 상태 모델과 서비스 경계를 정한다.
   - 입력: product-spec, UX 산출물
   - 산출물: state schema, API/로컬 저장 전략, AI provider interface

4. Backlog pass
   - 목표: 2~5분 단위 개발 태스크로 분해한다.
   - 입력: product/UX/architecture 산출물
   - 산출물: 구현 체크리스트, 테스트/검증 명령

5. Build pass
   - 목표: 태스크를 작은 단위로 구현하고 매번 검증한다.
   - 입력: backlog
   - 산출물: 동작하는 MVP increment

6. Validation pass
   - 목표: 데모가 핵심 루프를 증명하는지 확인한다.
   - 입력: 실행 앱, 체크리스트
   - 산출물: ready/WIP/blocker 보고서

## 자동화 사용법

```bash
cd /home/min/Projects/Lofi-Study-With-Me/01-study-companion
python tools/study_companion_workflow.py validate
python tools/study_companion_workflow.py render
```

생성물:

- `generated/workflow-checklist.md`
- `generated/agent-prompt-pack.md`

## 운영 규칙

- 기능을 늘리기 전에 MVP 루프가 데모에서 보이는지 먼저 확인한다.
- AI는 집중을 방해하지 않아야 한다. 집중 중 자유 채팅은 기본 금지다.
- 구현 태스크는 작은 검증 가능한 단위로 쪼갠다.
- 각 단계는 산출물과 acceptance 기준을 남긴다.
- 실제 개발 시 ready/WIP/blocker를 분리해서 보고한다.
