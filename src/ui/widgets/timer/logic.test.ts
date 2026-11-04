import { describe, expect, it } from 'vitest';
import { timerView, type TimerSource } from './logic';

const lengths = { focusMinutes: 25, breakMinutes: 5, longBreakMinutes: 15 };
const at = (timer: TimerSource['timer']): TimerSource => ({ timer, lengths });

describe('timer widget', () => {
  it('shows the full focus length and a start button while idle', () => {
    expect(timerView(at({ mode: 'idle', startedAt: null, endsAt: null }), 0)).toEqual({ phase: 'idle', phaseLabel: '대기', digits: '25:00', paused: false, action: 'start' });
  });

  it('counts down a running focus and offers to pause', () => {
    const view = timerView(at({ mode: 'focus', startedAt: 0, endsAt: 25 * 60_000 }), 61_000);
    expect(view).toEqual({ phase: 'focus', phaseLabel: '집중', digits: '23:59', paused: false, action: 'pause' });
  });

  it('holds a paused timer and offers to resume', () => {
    const view = timerView(at({ mode: 'focus', startedAt: 0, endsAt: 25 * 60_000, pausedAt: 60_000 }), 600_000);
    expect([view.digits, view.paused, view.action]).toEqual(['24:00', true, 'resume']);
  });

  it('names the short and the long break', () => {
    expect(timerView(at({ mode: 'break', startedAt: 0, endsAt: 5 * 60_000 }), 0).phaseLabel).toBe('짧은 휴식');
    expect(timerView(at({ mode: 'break', startedAt: 0, endsAt: 15 * 60_000 }), 0).phaseLabel).toBe('긴 휴식');
  });
});
