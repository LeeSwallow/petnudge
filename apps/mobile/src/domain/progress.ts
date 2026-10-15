export type UnlockKind = 'place' | 'outfit';

export type Unlockable = {
  id: string;
  kind: UnlockKind;
  title: string;
  requiredSessions: number;
};

export type ProgressState = {
  exp: number;
  completedSessions: number;
  streakDays: number;
  // Local calendar date of the last completed session, as YYYY-MM-DD.
  lastSessionDate: string | null;
  unlockedIds: string[];
};

export const EXP_PER_FOCUS_MINUTE = 1;
export const EXP_PER_LEVEL = 100;

export const unlockables: Unlockable[] = [
  { id: 'place-rain-cafe', kind: 'place', title: '비 오는 창가 카페', requiredSessions: 4 },
  { id: 'outfit-knit-cardigan', kind: 'outfit', title: '니트 가디건', requiredSessions: 12 }
];

export const createInitialProgress = (): ProgressState => ({
  exp: 0,
  completedSessions: 0,
  streakDays: 0,
  lastSessionDate: null,
  unlockedIds: []
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
): { progress: ProgressState; newlyUnlocked: string[] } => {
  const completedSessions = progress.completedSessions + 1;
  const newlyUnlocked = unlockables
    .filter((item) => completedSessions >= item.requiredSessions && !progress.unlockedIds.includes(item.id))
    .map((item) => item.id);

  return {
    progress: {
      exp: progress.exp + focusMinutes * EXP_PER_FOCUS_MINUTE,
      completedSessions,
      streakDays: nextStreak(progress, todayKey),
      lastSessionDate: todayKey,
      unlockedIds: [...progress.unlockedIds, ...newlyUnlocked]
    },
    newlyUnlocked
  };
};

export const getLevel = (exp: number): number => Math.floor(exp / EXP_PER_LEVEL) + 1;
