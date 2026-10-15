import { describe, expect, it } from 'vitest';
import {
  createIdleTimer,
  formatRemaining,
  getRemainingMs,
  getTimerProgress,
  isTimerDone,
  isTimerPaused,
  pauseTimer,
  resumeTimer,
  startTimer
} from './timer';

const settings = { focusMinutes: 25, breakMinutes: 5 };

describe('timer', () => {
  it('starts idle with nothing remaining', () => {
    const timer = createIdleTimer();

    expect(timer.mode).toBe('idle');
    expect(getRemainingMs(timer, 0)).toBe(0);
    expect(isTimerDone(timer, 0)).toBe(false);
  });

  it('starts a focus timer that ends after focusMinutes', () => {
    const timer = startTimer('focus', settings, 1_000);

    expect(timer.mode).toBe('focus');
    expect(timer.endsAt).toBe(1_000 + 25 * 60_000);
    expect(getRemainingMs(timer, 1_000)).toBe(25 * 60_000);
  });

  it('starts a break timer that ends after breakMinutes', () => {
    const timer = startTimer('break', settings, 0);

    expect(timer.endsAt).toBe(5 * 60_000);
  });

  it('derives remaining time from wall clock so backgrounding does not drift', () => {
    const timer = startTimer('focus', settings, 0);

    expect(getRemainingMs(timer, 10 * 60_000)).toBe(15 * 60_000);
    expect(getRemainingMs(timer, 99 * 60_000)).toBe(0);
  });

  it('is done once the end time has passed', () => {
    const timer = startTimer('focus', settings, 0);

    expect(isTimerDone(timer, 25 * 60_000 - 1)).toBe(false);
    expect(isTimerDone(timer, 25 * 60_000)).toBe(true);
  });

  it('formats remaining time as mm:ss rounding partial seconds up', () => {
    expect(formatRemaining(25 * 60_000)).toBe('25:00');
    expect(formatRemaining(61_001)).toBe('01:02');
    expect(formatRemaining(0)).toBe('00:00');
  });

  it('freezes remaining time while paused and is never done while paused', () => {
    const paused = pauseTimer(startTimer('focus', settings, 0), 10 * 60_000);

    expect(isTimerPaused(paused)).toBe(true);
    expect(getRemainingMs(paused, 99 * 60_000)).toBe(15 * 60_000);
    expect(isTimerDone(paused, 99 * 60_000)).toBe(false);
  });

  it('resumes by pushing the end time back by the paused duration', () => {
    const paused = pauseTimer(startTimer('focus', settings, 0), 10 * 60_000);
    const resumed = resumeTimer(paused, 13 * 60_000);

    expect(isTimerPaused(resumed)).toBe(false);
    expect(resumed.endsAt).toBe(28 * 60_000);
    expect(getRemainingMs(resumed, 13 * 60_000)).toBe(15 * 60_000);
  });

  it('ignores pause on idle timers and resume on running timers', () => {
    const idle = createIdleTimer();
    const running = startTimer('focus', settings, 0);

    expect(pauseTimer(idle, 5)).toBe(idle);
    expect(resumeTimer(running, 5)).toBe(running);
  });

  it('reports elapsed progress from 0 to 1', () => {
    const timer = startTimer('focus', settings, 0);

    expect(getTimerProgress(timer, 0)).toBe(0);
    expect(getTimerProgress(timer, 12.5 * 60_000)).toBeCloseTo(0.5);
    expect(getTimerProgress(timer, 99 * 60_000)).toBe(1);
    expect(getTimerProgress(createIdleTimer(), 0)).toBe(0);
  });
});
