import type { CharacterAnimationKey, LightingMood, ScenePhase, SceneState } from '../domain/scene';

const transitionOrder: Partial<Record<ScenePhase, ScenePhase>> = {
  focus_end_chime: 'character_pen_down',
  character_pen_down: 'character_sip',
  character_sip: 'break_dialogue_active',
  break_dialogue_complete: 'break_idle_window'
};

const phaseLighting: Partial<Record<ScenePhase, LightingMood>> = {
  planning_note_open: 'morning_soft',
  planning_timer_set: 'morning_soft',
  focus_active: 'focus_steady',
  focus_end_chime: 'focus_steady',
  character_pen_down: 'focus_steady',
  character_sip: 'break_warm',
  break_dialogue_active: 'break_warm',
  break_dialogue_complete: 'break_warm',
  break_idle_window: 'break_warm',
  break_idle_sleep: 'late_night_quiet',
  break_planning: 'break_warm',
  event_scene_active: 'event_dim',
  return_to_focus: 'focus_steady'
};

const phaseAnimation: Partial<Record<ScenePhase, CharacterAnimationKey>> = {
  planning_note_open: 'idle_blink',
  planning_timer_set: 'idle_blink',
  focus_active: 'focus_writing',
  focus_end_chime: 'focus_writing',
  character_pen_down: 'pen_down',
  character_sip: 'cup_sip',
  break_dialogue_active: 'look_up',
  break_dialogue_complete: 'look_up',
  break_idle_window: 'window_idle',
  break_idle_sleep: 'sleep_idle',
  break_planning: 'window_idle',
  event_scene_active: 'object_sparkle',
  return_to_focus: 'focus_writing'
};

const withPhase = (state: SceneState, phase: ScenePhase): SceneState => ({
  ...state,
  phase,
  lightingMood: phaseLighting[phase] ?? state.lightingMood,
  characterAnimation: phaseAnimation[phase] ?? state.characterAnimation,
  inputLocked: phase === 'focus_end_chime' || phase === 'character_pen_down' || phase === 'character_sip'
});

export const createInitialSceneState = (): SceneState => ({
  phase: 'planning_note_open',
  lightingMood: 'morning_soft',
  characterAnimation: 'idle_blink',
  dialogueTurn: 0,
  maxRewardDialogueTurns: 2,
  inputLocked: false
});

export const startFocus = (state: SceneState): SceneState =>
  withPhase({ ...state, dialogueTurn: 0 }, 'focus_active');

export const completeFocus = (state: SceneState): SceneState =>
  withPhase(state, 'focus_end_chime');

export const advanceTransition = (state: SceneState): SceneState => {
  const next = transitionOrder[state.phase];
  return next ? withPhase(state, next) : state;
};

export const advanceDialogue = (state: SceneState): SceneState => {
  if (state.phase !== 'break_dialogue_active') {
    return state;
  }

  const nextTurn = state.dialogueTurn + 1;
  if (nextTurn > state.maxRewardDialogueTurns) {
    return withPhase({ ...state, dialogueTurn: state.maxRewardDialogueTurns }, 'break_idle_window');
  }

  return { ...state, dialogueTurn: nextTurn };
};

export const openBreakPlanner = (state: SceneState): SceneState => {
  if (state.phase !== 'break_idle_window' && state.phase !== 'break_idle_sleep') {
    return state;
  }

  return withPhase({ ...state, inputLocked: false }, 'break_planning');
};
