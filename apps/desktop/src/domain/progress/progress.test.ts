import { describe, expect, it } from 'vitest';
import {
  EXP_PER_FOCUS_MINUTE,
  createInitialProgress,
  getLevel,
  recordFocusSession,
  unlockables
} from './progress';

describe('progress', () => {
  it('starts with no exp, streak, or unlocks', () => {
    const progress = createInitialProgress();

    expect(progress).toEqual({
      exp: 0,
      completedSessions: 0,
      streakDays: 0,
      lastSessionDate: null,
      unlockedIds: []
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

  it('unlocks the first place after enough completed sessions and reports it once', () => {
    const first = unlockables[0];
    let progress = createInitialProgress();
    let newlyUnlocked: string[] = [];

    for (let i = 0; i < first.requiredSessions; i += 1) {
      ({ progress, newlyUnlocked } = recordFocusSession(progress, 25, '2026-10-15'));
    }

    expect(progress.unlockedIds).toContain(first.id);
    expect(newlyUnlocked).toEqual([first.id]);

    ({ newlyUnlocked } = recordFocusSession(progress, 25, '2026-10-15'));
    expect(newlyUnlocked).toEqual([]);
  });

  it('derives level from exp', () => {
    expect(getLevel(0)).toBe(1);
    expect(getLevel(99)).toBe(1);
    expect(getLevel(100)).toBe(2);
  });
});
