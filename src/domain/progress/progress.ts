export type ProgressState = {
  exp: number;
  completedSessions: number;
  streakDays: number;
  // Local calendar date of the last completed session, as YYYY-MM-DD.
  lastSessionDate: string | null;
};

export const EXP_PER_FOCUS_MINUTE = 1;
export const EXP_PER_LEVEL = 100;

export const createInitialProgress = (): ProgressState => ({
  exp: 0,
  completedSessions: 0,
  streakDays: 0,
  lastSessionDate: null
});

export const toDateKey = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const daysBetween = (fromKey: string, toKey: string): number => {
  const toUtc = (key: string) => {
    const [year, month, day] = key.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtc(toKey) - toUtc(fromKey)) / 86_400_000);
};

const nextStreak = (progress: ProgressState, todayKey: string): number => {
  if (progress.lastSessionDate === null) return 1;
  const gap = daysBetween(progress.lastSessionDate, todayKey);
  if (gap <= 0) return Math.max(progress.streakDays, 1);
  if (gap === 1) return progress.streakDays + 1;
  return 1;
};

export const recordFocusSession = (
  progress: ProgressState,
  focusMinutes: number,
  todayKey: string
): { progress: ProgressState } => ({
  // Built field by field, so fields of older saves (unlockedIds) fall away.
  progress: {
    exp: progress.exp + focusMinutes * EXP_PER_FOCUS_MINUTE,
    completedSessions: progress.completedSessions + 1,
    streakDays: nextStreak(progress, todayKey),
    lastSessionDate: todayKey
  }
});

export const getLevel = (exp: number): number => Math.floor(exp / EXP_PER_LEVEL) + 1;
