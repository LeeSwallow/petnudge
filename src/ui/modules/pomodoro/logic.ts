import type { TimerMode, TimerState } from '../../../domain/pomodoro/timer';

// The pomodoro tab's rules, apart from the screen (tested in logic.test.ts).

export type PhaseKind = 'idle' | 'focus' | 'break' | 'long';

export const PHASE_COLOR: Record<PhaseKind, string> = {
  idle: 'var(--edge-hi)',
  focus: 'var(--focus)',
  break: 'var(--break)',
  long: 'var(--long)'
};

// A break is the long one when it lasts the long-break length (and the two differ).
export const phaseOf = (timer: TimerState, lengths: { breakMinutes: number; longBreakMinutes: number }): PhaseKind => {
  if (timer.mode !== 'break') return timer.mode;
  const minutes = timer.startedAt !== null && timer.endsAt !== null ? (timer.endsAt - timer.startedAt) / 60_000 : 0;
  return lengths.longBreakMinutes !== lengths.breakMinutes && Math.round(minutes) === lengths.longBreakMinutes ? 'long' : 'break';
};

export const intentText = (mode: TimerMode, phase: PhaseKind, activeTodoTitle: string | undefined) =>
  mode === 'break'
    ? phase === 'long' ? '긴 휴식 · 스트레칭 어때?' : '짧은 휴식 · 물 한 잔'
    : activeTodoTitle !== undefined ? `지금 할 일: ${activeTodoTitle}` : '할 일 탭에서 지금 할 일 지정';

export const untilLongBreak = (completedSessions: number, every: number) => every - (completedSessions % every);
