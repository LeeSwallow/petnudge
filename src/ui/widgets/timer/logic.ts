import { formatRemaining, getRemainingMs, isTimerPaused, type TimerState } from '../../../domain/pomodoro/timer';
import { phaseOf, type PhaseKind } from '../../modules/pomodoro/logic';
import { t, type MessageKey } from '../../i18n';

// The timer widget's view, apart from the screen and from whose timer it is
// (tested in logic.test.ts). The source is any pomodoro: the pet's own today,
// a friend's one later.

export type TimerSource = {
  timer: TimerState;
  lengths: { focusMinutes: number; breakMinutes: number; longBreakMinutes: number };
};

export type TimerAction = 'start' | 'pause' | 'resume';

const PHASE_LABEL: Record<PhaseKind, MessageKey> = { idle: 'widgets.timer.idle', focus: 'pomodoro.phase.focus', break: 'pomodoro.phase.break', long: 'pomodoro.phase.long' };

export const timerView = ({ timer, lengths }: TimerSource, now: number) => {
  const phase = phaseOf(timer, lengths);
  const paused = isTimerPaused(timer);
  const action: TimerAction = timer.mode === 'idle' ? 'start' : paused ? 'resume' : 'pause';
  return {
    phase,
    phaseLabel: t(PHASE_LABEL[phase]),
    digits: formatRemaining(timer.mode === 'idle' ? lengths.focusMinutes * 60_000 : getRemainingMs(timer, now)),
    paused,
    action
  };
};
