import { formatRemaining, getRemainingMs, isTimerPaused, type TimerState } from '../../../domain/pomodoro/timer';
import { phaseOf, type PhaseKind } from '../../modules/pomodoro/logic';

// The timer widget's view, apart from the screen and from whose timer it is
// (tested in logic.test.ts). The source is any pomodoro: the pet's own today,
// a friend's one later.

export type TimerSource = {
  timer: TimerState;
  lengths: { focusMinutes: number; breakMinutes: number; longBreakMinutes: number };
};

export type TimerAction = 'start' | 'pause' | 'resume';

const PHASE_LABEL: Record<PhaseKind, string> = { idle: '대기', focus: '집중', break: '짧은 휴식', long: '긴 휴식' };

export const timerView = ({ timer, lengths }: TimerSource, now: number) => {
  const phase = phaseOf(timer, lengths);
  const paused = isTimerPaused(timer);
  const action: TimerAction = timer.mode === 'idle' ? 'start' : paused ? 'resume' : 'pause';
  return {
    phase,
    phaseLabel: PHASE_LABEL[phase],
    digits: formatRemaining(timer.mode === 'idle' ? lengths.focusMinutes * 60_000 : getRemainingMs(timer, now)),
    paused,
    action
  };
};
