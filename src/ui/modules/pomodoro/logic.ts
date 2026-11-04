import type { TimerMode, TimerState } from '../../../domain/pomodoro/timer';
import { t } from '../../i18n';

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
    ? phase === 'long' ? t('pomodoro.intent.long') : t('pomodoro.intent.break')
    : activeTodoTitle !== undefined ? t('pomodoro.intent.todo', { title: activeTodoTitle }) : t('pomodoro.intent.none');

// The reflection box starts empty when it opens, and only then: refreshes
// while it is open (a paused break, a finished todo) keep what was typed.
export const reflectionStarts = (wasOpen: boolean, isOpen: boolean) => !wasOpen && isOpen;

export const untilLongBreak = (completedSessions: number, every: number) => every - (completedSessions % every);
