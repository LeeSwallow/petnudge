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

export type LightingMood =
  | 'focus_steady'
  | 'break_warm'
  | 'event_dim'
  | 'rain_neon'
  | 'late_night_quiet'
  | 'morning_soft';

export type CharacterAnimationKey =
  | 'idle_blink'
  | 'focus_writing'
  | 'pen_down'
  | 'cup_sip'
  | 'look_up'
  | 'window_idle'
  | 'sleep_idle'
  | 'object_sparkle';

export type SceneState = {
  phase: ScenePhase;
  lightingMood: LightingMood;
  characterAnimation: CharacterAnimationKey;
  dialogueTurn: number;
  maxRewardDialogueTurns: number;
  inputLocked: boolean;
};
