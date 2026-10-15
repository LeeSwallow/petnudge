# 픽셀아트 AI Study Companion

## 한 줄 정의

Lo-fi BGM이 흐르는 픽셀 공부방에서 AI 캐릭터와 함께 뽀모도로를 수행하고, 휴식 시간 Coffee Chat과 장소/복장 해금으로 루틴을 지속시키는 게임형 공부 앱.

## 현재 상태

본격 사업성 평가 후보에서 MVP 구체화와 개발 자동화를 시작한 독립 아이디어 문서 폴더다.

## 문서

- `business-evaluation.md` — 시장성, 차별점, MVP 가능성, 북극성 지표, 수익모델, 리스크 평가
- `product-definition.md` — YouTube Study With Me × Coffee Talk/VA-11 Hall-A 기반 제품 정체성, 핵심 경험, 이벤트/관계 성장 정의
- `product-spec.md` — 첫 타깃, 핵심 루프, AI 사용 위치, MVP 범위, 성공 지표
- `frontend-mobile-technical-direction.md` — 모바일 앱 우선 프론트엔드 기술 방향: Expo/React Native, Skia, scene state, audio, notification, mobile UX
- `automation-workflow.md` — 제품 구체화부터 구현/검증까지 반복 가능한 워크플로우
- `github-orchestration-blueprint.md` — FE/BE/AI 분업, 자가 개선 루프, GitHub issue/PR/review 자동화 설계
- `github-projects-agile-workflow.md` — GitHub Projects 기반 Agile 보드/필드/스프린트/자가개선 운영 설계
- `docs/contracts.md` — FE/BE/AI 병렬 개발을 위한 초기 상태/API/AI/event 계약
- `docs/pixel-art-production-workflow.md` — 픽셀아트 asset 제작, 조명 layer, cleanup, mobile export 워크플로우
- `docs/comfyui-pixel-workflow.md` — ComfyUI 기반 reference/variant/lighting/asset 후보 생성 파이프라인
- `docs/video-generation-prompts.md` — focus→break 전이, reward dialogue, break idle, planner/timer 영상 생성 프롬프트 모음
- `docs/video-generation-prompts-veo.md` — Google Veo용 자연어 콘티형 영상 생성 프롬프트
- `apps/mobile/` — Expo/React Native 모바일 mock foundation: scene state, mock layer registry, planner/timer/dialogue 구조
- `apps/desktop/` — Electron 데스크톱 펫: 투명·항상 위 창의 픽셀 캐릭터, 뽀모도로/플래너, Spotify·Apple Music 재생 감지와 타이머 연동 (mobile의 domain/session 로직 재사용)
- `.github/` — issue/PR 템플릿
- `github-labels.md` — GitHub lane/status/type/priority label 생성 명령
- `workflow.json` — 자동화 스크립트가 읽는 단계/역할/산출물/검증 기준
- `prompts/` — PM, UX, Engineering 에이전트에게 바로 줄 수 있는 프롬프트
- `tools/study_companion_workflow.py` — workflow.json 검증 및 체크리스트/프롬프트 팩 생성 CLI

## 자동화 실행

```bash
cd 01-study-companion
python tools/study_companion_workflow.py validate
python tools/study_companion_workflow.py render
```

생성되는 파일:

- `generated/workflow-checklist.md`
- `generated/agent-prompt-pack.md`

## 데스크톱 펫 실행

```bash
cd apps/desktop
npm install
npm start          # 빌드 후 Electron 실행
npm test           # 도메인·DB·MCP 테스트
npm run bake       # 캐릭터 원화(assets/characters/miso/art.mjs) → sheet.png + character.json
npm run dist:mac   # 설치 파일(release/*.dmg)
```

- 투명·항상 위 창의 픽셀 캐릭터. 드래그로 이동(화면 밖으로는 못 나감), 클릭하면 패널. 잃어버리면 ⌘/Ctrl + Alt + P.
- 패널 모듈: 할 일 · 뽀모도로 · 대시보드(차트) · 음악 · 메모 · 대화(서버 연결 전) · 설정. 데이터는 내장 SQLite(`node:sqlite`).
- 음악: 내 음악 파일 플레이리스트(내장 플레이어)가 기본, Spotify/Apple Music 연동은 선택(macOS).
- 캐릭터: 스프라이트 시트 + JSON 상태표. 머리색·후드·머리 장식·LED를 바꿀 수 있고 커서 쪽으로 고개를 돌린다.
- AI 연결(MCP): 앱 실행 중 `127.0.0.1:47615/mcp` (토큰 인증). 설정 → AI 연결에서 Claude Code / Cursor 설정을 복사.

## 점수

8.4/10

## 판단

본격 검토 강력 후보. 데모/UX/AI/MVP 균형이 가장 좋다. 단, 사업성 문서에서는 “귀여운 앱”이 아니라 집중 루틴 지속 문제를 해결하는 게임형 루틴 서비스로 포지셔닝해야 한다.
