import { describe, expect, it } from 'vitest';
import {
  EXP_PER_FOCUS_MINUTE,
  createInitialProgress,
  getLevel,
  recordFocusSession
} from './progress';

describe('progress', () => {
  it('starts with no exp or streak', () => {
    const progress = createInitialProgress();

    expect(progress).toEqual({
      exp: 0,
      completedSessions: 0,
      streakDays: 0,
      lastSessionDate: null
    });
  });

  it('grants exp proportional to focus minutes', () => {
    const { progress } = recordFocusSession(createInitialProgress(), 25, '2026-10-15');

    expect(progress.exp).toBe(25 * EXP_PER_FOCUS_MINUTE);
    expect(progress.completedSessions).toBe(1);
  });

  it('starts a streak on the first session and keeps it on the same day', () => {
    let { progress } = recordFocusSession(createInitialProgress(), 25, '2026-10-15');
    expect(progress.streakDays).toBe(1);

    ({ progress } = recordFocusSession(progress, 25, '2026-10-15'));
    expect(progress.streakDays).toBe(1);
  });

  it('extends the streak on the next day, including across month ends', () => {
    let { progress } = recordFocusSession(createInitialProgress(), 25, '2026-10-31');
    ({ progress } = recordFocusSession(progress, 25, '2026-11-01'));

    expect(progress.streakDays).toBe(2);
    expect(progress.lastSessionDate).toBe('2026-11-01');
  });

  it('resets the streak after a missed day', () => {
    let { progress } = recordFocusSession(createInitialProgress(), 25, '2026-10-15');
    ({ progress } = recordFocusSession(progress, 25, '2026-10-17'));

    expect(progress.streakDays).toBe(1);
  });

  // Unlocks were removed (#38): progress saved before still loads, and the
  // old unlock list is dropped on the next session.
  it('reads progress saved with the old unlock list and drops it', () => {
    const saved = { ...createInitialProgress(), completedSessions: 11, unlockedIds: ['place-rain-cafe'] };
    const { progress } = recordFocusSession(saved, 25, '2026-10-15');

    expect(progress.completedSessions).toBe(12);
    expect(progress).not.toHaveProperty('unlockedIds');
  });

  it('derives level from exp', () => {
    expect(getLevel(0)).toBe(1);
    expect(getLevel(99)).toBe(1);
    expect(getLevel(100)).toBe(2);
  });
});
