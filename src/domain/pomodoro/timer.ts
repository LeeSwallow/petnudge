import type { PomodoroSettings } from './planner';

export type TimerMode = 'idle' | 'focus' | 'break';

// Stores an absolute end time instead of ticking a counter, so the remaining
// time stays correct after the app is backgrounded or the JS thread stalls.
export type TimerState = {
  mode: TimerMode;
  startedAt: number | null;
  endsAt: number | null;
  // Set while paused; resuming pushes endsAt back by the paused duration.
  pausedAt?: number | null;
};

export const createIdleTimer = (): TimerState => ({ mode: 'idle', startedAt: null, endsAt: null });

export const startTimer = (mode: Exclude<TimerMode, 'idle'>, settings: PomodoroSettings, now: number): TimerState => {
  const minutes = mode === 'focus' ? settings.focusMinutes : settings.breakMinutes;
  return { mode, startedAt: now, endsAt: now + minutes * 60_000, pausedAt: null };
};

export const isTimerPaused = (timer: TimerState): boolean => timer.pausedAt != null;

export const pauseTimer = (timer: TimerState, now: number): TimerState =>
  timer.mode === 'idle' || isTimerPaused(timer) ? timer : { ...timer, pausedAt: now };

export const resumeTimer = (timer: TimerState, now: number): TimerState => {
  if (timer.pausedAt == null || timer.endsAt === null) return timer;
  return { ...timer, endsAt: timer.endsAt + (now - timer.pausedAt), pausedAt: null };
};

export const getRemainingMs = (timer: TimerState, now: number): number =>
  timer.endsAt === null ? 0 : Math.max(0, timer.endsAt - (timer.pausedAt ?? now));

export const isTimerDone = (timer: TimerState, now: number): boolean =>
  timer.endsAt !== null && !isTimerPaused(timer) && now >= timer.endsAt;

// Fraction of the current phase already elapsed, for progress rings.
export const getTimerProgress = (timer: TimerState, now: number): number => {
  if (timer.startedAt === null || timer.endsAt === null) return 0;
  const total = timer.endsAt - timer.startedAt;
  if (total <= 0) return 1;
  return Math.min(1, 1 - getRemainingMs(timer, now) / total);
};

export const formatRemaining = (ms: number): string => {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};
