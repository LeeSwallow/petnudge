# Mobile Mock Foundation Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build a simple mobile-first mock structure that proves the app can support pixel-art layers, lighting layers, scene phases, break dialogue gating, todo/planner/timer tools, and future ComfyUI assets.

**Architecture:** Create an Expo/React Native TypeScript app under `apps/mobile`. Use mock React Native views first, with a clear `scene/` layer abstraction that can later be replaced by React Native Skia. Keep real art assets out of scope for this slice; use colored pixel-style blocks and metadata.

**Tech Stack:** Expo, React Native, TypeScript, Zustand, Vitest for pure state tests. Skia is represented by a renderer boundary now and can be installed/connected in the next slice.

---

## Acceptance Criteria

```text
[ ] `apps/mobile` exists with package scripts.
[ ] Scene phase sequence is modeled explicitly.
[ ] Mock layer registry separates background, lighting, weather, room objects, character, FX, UI overlays.
[ ] Focus → break transition is represented as ordered steps: chime, pen down, sip, opener, dialogue, idle.
[ ] Break dialogue is limited to reward turns and then transitions to break idle/planning.
[ ] Planner/todo/timer/audio settings types exist.
[ ] Tests cover scene phase progression and dialogue turn limit.
[ ] `npm test` and `npm run typecheck` run successfully inside `apps/mobile`.
```

## Task 1: Create mobile app package shell

**Objective:** Create a minimal Expo-style TypeScript package without pulling real assets yet.

**Files:**
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/tsconfig.json`
- Create: `apps/mobile/app.json`
- Create: `apps/mobile/App.tsx`

**Steps:**
1. Create package scripts: `typecheck`, `test`.
2. Add dependencies: `expo`, `react`, `react-native`, `zustand`.
3. Add dev dependencies: `typescript`, `vitest`, `@types/react`.
4. Keep app UI simple and mock-only.

## Task 2: Define domain contracts

**Objective:** Define scene, layer, timer, todo, audio, and companion event types.

**Files:**
- Create: `apps/mobile/src/domain/scene.ts`
- Create: `apps/mobile/src/domain/layers.ts`
- Create: `apps/mobile/src/domain/planner.ts`
- Create: `apps/mobile/src/domain/audio.ts`

**Steps:**
1. Define `ScenePhase` union.
2. Define `LayerKind` and `SceneLayer` metadata.
3. Define `TodoItem`, `PlannerState`, `PomodoroSettings`.
4. Define `BgmTrack`, `AudioSettings`.

## Task 3: Write scene machine tests first

**Objective:** Lock the intended focus→break→idle/planning behavior before implementation.

**Files:**
- Create: `apps/mobile/src/scene/sceneMachine.test.ts`

**Tests:**
```text
- initial scene starts at planning_note_open
- startFocus moves to focus_active
- completeFocus starts focus_end_chime
- advanceTransition follows chime → pen_down → sip → dialogue
- dialogue can advance up to max reward turns
- after dialogue is complete, scene moves to break_idle_window
- opening planner during break idle moves to break_planning
```

## Task 4: Implement scene machine

**Objective:** Implement pure state transition functions that tests exercise.

**Files:**
- Create: `apps/mobile/src/scene/sceneMachine.ts`

**Steps:**
1. Export `createInitialSceneState`.
2. Export `startFocus`, `completeFocus`, `advanceTransition`, `advanceDialogue`, `openBreakPlanner`.
3. Do not implement visual code here.

## Task 5: Add mock layer registry

**Objective:** Represent future Skia layers with mock metadata.

**Files:**
- Create: `apps/mobile/src/scene/mockLayers.ts`

**Layers:**
```text
background_base
window_time_variant
weather_overlay
warm_desk_light
cool_window_light
room_objects
character_sprite
fx_sparkle
```

## Task 6: Add lightweight React Native mock screen

**Objective:** Show the structure as mock blocks: top HUD, center scene layers, bottom planner/dialogue controls.

**Files:**
- Create: `apps/mobile/src/screens/StudyRoomScreen.tsx`
- Create: `apps/mobile/src/components/MockPixelScene.tsx`
- Create: `apps/mobile/src/components/DialoguePanel.tsx`
- Create: `apps/mobile/src/components/PlannerPanel.tsx`
- Modify: `apps/mobile/App.tsx`

**Steps:**
1. Use mock blocks and labels, no real art.
2. Show layer names stacked in scene area.
3. Show dialogue only in dialogue phase.
4. Show planner/todo/timer during planning and break planning.

## Task 7: Verify

**Commands:**
```bash
cd apps/mobile
npm install
npm test
npm run typecheck
```

**Expected:** tests pass and TypeScript has no errors.
