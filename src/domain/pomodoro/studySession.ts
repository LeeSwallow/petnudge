import { createEmptyPlannerState, type PlannerState } from './planner';
import { createInitialProgress, recordFocusSession, type ProgressState } from '../progress/progress';
import type { SceneState } from '../pet/scene';
import { createIdleTimer, isTimerDone, startTimer, type TimerState } from './timer';
import { completeFocus, createInitialSceneState, openBreakPlanner, startFocus } from '../pet/sceneMachine';

export type StudySession = {
  planner: PlannerState;
  progress: ProgressState;
  timer: TimerState;
  scene: SceneState;
  // Unlock ids earned but not yet shown to the user.
  pendingUnlocks: string[];
};

export const createInitialSession = (): StudySession => ({
  planner: createEmptyPlannerState(),
  progress: createInitialProgress(),
  timer: createIdleTimer(),
  scene: createInitialSceneState(),
  pendingUnlocks: []
});

export const beginFocus = (session: StudySession, now: number): StudySession => ({
  ...session,
  timer: startTimer('focus', session.planner.timer, now),
  scene: startFocus(session.scene)
});

export const finishFocusIfDue = (session: StudySession, now: number, todayKey: string): StudySession => {
  if (session.timer.mode !== 'focus' || !isTimerDone(session.timer, now)) return session;

  const settings = session.planner.timer;
  const { progress, newlyUnlocked } = recordFocusSession(session.progress, settings.focusMinutes, todayKey);
  const isLongBreak =
    settings.longBreakMinutes !== undefined &&
    settings.longBreakEvery !== undefined &&
    settings.longBreakEvery > 0 &&
    progress.completedSessions % settings.longBreakEvery === 0;
  const breakSettings = isLongBreak ? { ...settings, breakMinutes: settings.longBreakMinutes! } : settings;
  return {
    ...session,
    progress,
    // The break starts when focus was due, not when the app noticed it.
    timer: startTimer('break', breakSettings, session.timer.endsAt ?? now),
    scene: completeFocus(session.scene),
    pendingUnlocks: [...session.pendingUnlocks, ...newlyUnlocked]
  };
};

export const abandonFocus = (session: StudySession): StudySession => ({
  ...session,
  timer: createIdleTimer(),
  scene: createInitialSceneState()
});

export const finishBreak = (session: StudySession, now: number): StudySession => {
  if (session.timer.mode !== 'break' || !isTimerDone(session.timer, now)) return session;
  return { ...session, timer: createIdleTimer(), scene: openBreakPlanner(session.scene) };
};

export const skipBreak = (session: StudySession): StudySession => {
  if (session.timer.mode !== 'break') return session;
  return { ...session, timer: createIdleTimer(), scene: openBreakPlanner(session.scene) };
};
