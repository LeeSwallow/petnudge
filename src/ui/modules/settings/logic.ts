import { toUserMessage } from '../../../domain/errors/userMessage';

// The settings tab's wording, apart from the screen (tested in logic.test.ts).

export type NumberKey = 'focusMinutes' | 'breakMinutes' | 'longBreakMinutes' | 'longBreakEvery' | 'dailyGoalSessions' | 'petScale';
export type BoolKey = 'autoStartFocus' | 'alwaysOnTop' | 'eyesFollowCursor' | 'walkAround' | 'reduceMotion';

// dailyGoalSessions is drawn with a tomato icon by the screen; the text is the number.
export const stepperText = (key: NumberKey, value: number) =>
  key === 'longBreakEvery' ? `${value}회마다` : key === 'petScale' ? `${value}배` : key === 'dailyGoalSessions' ? String(value) : `${value}분`;

// What to show for an error (the app-wide rule, src/domain/errors).
export const cleanError = (error: unknown) => toUserMessage(error).text;

export const backupCounts = (s: { todos: number; notes: number; sessions: number; playlists: number }) =>
  `할 일 ${s.todos} · 메모 ${s.notes} · 집중 기록 ${s.sessions} · 플레이리스트 ${s.playlists}`;

export const exportedOn = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : `${date.toLocaleDateString('ko-KR')} 백업`;
};
