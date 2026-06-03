# Frontend Mobile Technical Direction — Lofi Study Companion

## 0. 결론

Lofi Study Companion의 1차 타겟은 모바일 앱이다. 따라서 프론트엔드는 웹 대시보드가 아니라 모바일 portrait experience를 기준으로 설계한다.

추천 스택:

```text
Expo + React Native + TypeScript
React Native Skia
Zustand
Expo AV 또는 react-native-track-player
React Native Reanimated
React Native Gesture Handler
MMKV or SQLite
```

초기 MVP는 Expo Managed Workflow로 시작한다. 픽셀 룸, 캐릭터 micro-animation, 날씨/시간 layer, 오브젝트 해금 연출은 React Native Skia로 구현한다. 일반 UI, 노트, 타이머, 설정, 대화 선택지는 React Native component로 구현하되, 스타일은 pixel UI design system으로 맞춘다.

## 1. 왜 React Native / Expo인가

모바일 타겟이면 React + Vite + PixiJS 웹앱을 먼저 만드는 것보다 Expo + React Native가 낫다.

이유:

```text
- 모바일 portrait 화면을 처음부터 기준으로 잡을 수 있음
- 터치, safe area, haptic, audio, local notification을 앱스럽게 다룰 수 있음
- Pomodoro 타이머와 휴식 알림에 모바일 OS 기능이 중요함
- 나중에 App Store / Play Store 배포로 이어지기 쉬움
- React 생태계와 TypeScript를 유지할 수 있음
```

단, 이 앱은 일반 React Native CRUD 앱이 아니다. 핵심 화면은 작은 2D pixel study room이므로 Canvas 계층이 필요하다.

## 2. 핵심 렌더링 선택

### 추천: React Native Skia

React Native Skia는 모바일에서 픽셀 방, 캐릭터 sprite, particle, 조명/날씨 layer를 직접 그리기에 적합하다.

사용 영역:

```text
- pixel study room background
- character sprite frame animation
- blink / pen down / cup sip / sleep idle
- room object placement
- rain / snow / star particle
- neon flicker
- object unlock sparkle
- focus → break scene transition
```

### React Native Component 영역

```text
- SafeArea layout
- Timer HUD
- pixel note / study planner input
- Todo list editing
- dialogue box
- choice buttons
- BGM settings
- app settings
```

즉 구조는 다음과 같다.

```text
Screen
├── Skia StudyRoomScene          # 방/캐릭터/날씨/오브젝트
├── React Native HUD Overlay     # 타이머/목표/BGM
├── React Native Dialogue Layer  # 대화창/선택지/typewriter
└── React Native Tool Layer      # 노트/ToDo/타이머 설정
```

## 3. 왜 게임 엔진이 아니라 Skia인가

Phaser, Unity, Godot도 가능하지만 MVP에는 과하다.

```text
Unity / Godot:
- 표현력은 좋지만 앱 UI, 입력, 알림, 오디오 설정, AI/API 연동이 무거워짐

Phaser WebView:
- 웹뷰 기반으로 갈 수 있지만 모바일 앱 네이티브 감각이 약해질 수 있음

React Native Skia:
- 모바일 앱 구조를 유지하면서 픽셀 장면만 canvas처럼 관리 가능
```

현재 제품은 완전한 게임보다 “ambient pixel companion app”에 가깝다. 따라서 React Native + Skia가 가장 적합하다.

## 4. 추천 패키지

```bash
npx create-expo-app apps/mobile --template
cd apps/mobile

npm install zustand
npm install @shopify/react-native-skia
npm install react-native-reanimated react-native-gesture-handler
npm install react-native-mmkv
npm install expo-av expo-haptics expo-notifications expo-keep-awake
```

선택:

```bash
npm install react-native-track-player
npm install expo-sqlite
```

선택 기준:

```text
expo-av:
MVP BGM/효과음에 충분. Expo 관리가 쉬움.

react-native-track-player:
백그라운드 오디오, lock screen controls가 중요해지면 사용.

MMKV:
빠른 local state 저장에 좋음.

SQLite:
세션/대화/이벤트 기록이 많아지면 적합.
```

MVP는 `expo-av + MMKV`로 시작하고, 기록 모델이 커지면 SQLite를 붙인다.

## 5. 모바일 UX 기준

기본 화면은 portrait다.

```text
상단: compact HUD / timer / BGM icon
중앙: pixel study room + character
하단: dialogue box 또는 study planner / timer controls
```

중요 원칙:

```text
- 한 손 엄지로 주요 조작 가능
- 대화 선택지는 하단 40% 안에 배치
- 공부 중에는 UI를 최소화하고 방/캐릭터를 크게 보여줌
- 노트와 타이머 설정은 bottom sheet처럼 열리되, 시각적으로는 책상 위 노트/타이머처럼 보여야 함
- pixel font는 분위기용, 긴 한국어 본문은 읽기 쉬운 폰트 사용
```

## 6. Scene State Machine

이 앱은 단순 화면 전환이 아니라 scene phase 기반으로 움직여야 한다.

```ts
export type ScenePhase =
  | 'planning_note_open'
  | 'planning_timer_set'
  | 'focus_active'
  | 'focus_end_chime'
  | 'character_pen_down'
  | 'character_sip'
  | 'break_dialogue_active'
  | 'break_dialogue_complete'
  | 'break_idle_window'
  | 'break_idle_sleep'
  | 'break_planning'
  | 'event_scene_active'
  | 'return_to_focus';
```

이 상태가 Skia animation, React overlay, audio layer를 동시에 움직인다.

예:

```text
focus_end_chime:
- audio: chime
- Skia: timer flash, character stops writing
- React: controls locked briefly

character_sip:
- audio: BGM fade down, cup sfx
- Skia: cup sip sprite
- React: dialogue hidden

break_dialogue_active:
- React: dialogue box + typewriter
- Skia: character look up expression
- audio: ambience up

break_idle_window:
- React: note/timer tools available
- Skia: character looks out window
- audio: quiet BGM loop
```

## 7. 폴더 구조

```text
apps/mobile/
├── app/
│   ├── _layout.tsx
│   └── index.tsx
├── src/
│   ├── screens/
│   │   └── StudyRoomScreen.tsx
│   ├── scene/
│   │   ├── StudyRoomCanvas.tsx
│   │   ├── sceneMachine.ts
│   │   ├── layers/
│   │   │   ├── BackgroundLayer.ts
│   │   │   ├── WeatherLayer.ts
│   │   │   ├── RoomObjectLayer.ts
│   │   │   ├── CharacterLayer.ts
│   │   │   └── EffectsLayer.ts
│   │   └── sprites/
│   │       ├── spriteTypes.ts
│   │       └── spriteAtlas.ts
│   ├── components/
│   │   ├── hud/
│   │   ├── dialogue/
│   │   ├── planner/
│   │   ├── timer/
│   │   └── audio/
│   ├── store/
│   │   ├── sceneStore.ts
│   │   ├── sessionStore.ts
│   │   ├── plannerStore.ts
│   │   ├── companionStore.ts
│   │   ├── roomStore.ts
│   │   └── audioStore.ts
│   ├── domain/
│   │   ├── session.ts
│   │   ├── todo.ts
│   │   ├── timer.ts
│   │   ├── companion.ts
│   │   ├── storyEvent.ts
│   │   ├── roomObject.ts
│   │   └── audio.ts
│   ├── services/
│   │   ├── audioManager.ts
│   │   ├── notificationService.ts
│   │   ├── storage.ts
│   │   └── aiClient.ts
│   └── styles/
│       ├── tokens.ts
│       └── pixelTheme.ts
└── assets/
    ├── sprites/
    ├── backgrounds/
    ├── audio/
    └── fonts/
```

## 8. 모바일에서 특히 중요한 기능

### Keep Awake

Focus 중 화면이 꺼지면 Study With Me 감각이 깨진다.

```text
focus_active 동안 expo-keep-awake 활성화
break_idle/planning에서는 사용자 설정에 따라 유지
```

### Notifications

앱이 백그라운드로 가도 focus 종료 알림이 필요하다.

```text
focus start → local notification 예약
focus complete in foreground → scene transition
focus complete in background → notification
```

### Audio Session

BGM이 핵심이므로 모바일 오디오 정책을 고려해야 한다.

```text
- mute switch 대응 여부 결정
- background playback은 MVP에서 optional
- focus 중 BGM 유지
- break dialogue 중 volume ducking
```

### Haptics

작게만 사용한다.

```text
- timer start
- todo stamp
- event unlock
- dialogue choice select
```

과하면 감성이 깨진다.

## 9. 모바일 UI 구현 방식

### Pixel Note / Todo

React Native input을 쓰되, 시각적으로는 Skia/PNG 노트 위에 적는 느낌을 만든다.

```text
- bottom sheet가 아니라 책상 노트가 확대되는 듯한 transition
- 실제 입력은 TextInput
- 저장 후 pixel text/stamp 상태로 표시
- 완료 체크는 stamp animation + haptic light
```

### Timer Setting

```text
- 책상 위 pixel timer object 선택
- 하단에 wheel/stepper control
- 숫자는 pixel LCD 스타일
- start 시 timer object가 HUD 위치로 축소 이동하는 듯한 연출
```

### Dialogue

```text
- 하단 VN dialogue box
- typewriter
- 2~3개 선택지
- 2~4턴 이후 자동으로 break idle 전환
- 무한 대화 금지
```

## 10. MVP 구현 순서

1. Expo app scaffold
2. StudyRoomScreen portrait layout
3. Skia background + character static sprite
4. Zustand scene/session store
5. Timer HUD + focus countdown
6. focus complete → pen down → sip → dialogue transition
7. DialogueBox + typewriter + 2~4턴 제한
8. Break idle 상태 + 캐릭터 window/sleep idle
9. Pixel note Todo input/check
10. Timer setting UI
11. BGM selection + volume + fade
12. Room object unlock placeholder
13. First character event mini scenario

## 11. 핵심 판단

이 앱은 모바일 생산성 앱이 아니라 모바일에서 켜두는 pixel Study With Me companion이다.

따라서 기술 판단도 다음을 우선한다.

```text
1. portrait에서 캐릭터와 방이 가장 중요하게 보이는가
2. focus → break → dialogue → idle → planning 전이가 자연스러운가
3. 대화가 무한 채팅이 아니라 짧은 보상처럼 느껴지는가
4. Todo/Timer가 앱 위젯이 아니라 노트/책상 타이머처럼 느껴지는가
5. BGM과 micro-animation이 오래 켜둘 만한 감성을 만드는가
```

최종 추천:

```text
Expo + React Native + TypeScript
React Native Skia for pixel scene
React Native overlays for HUD/dialogue/planner
Zustand for scene state
Expo AV for BGM/SFX MVP
MMKV for local persistence
```
