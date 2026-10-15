import type { DailyFocus, HourlyFocus } from './types';

const parseKey = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const formatKey = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;

export const shiftDateKey = (key: string, days: number): string => {
  const date = parseKey(key);
  date.setUTCDate(date.getUTCDate() + days);
  return formatKey(date);
};

// Monday = 0 … Sunday = 6
export const weekdayIndex = (key: string): number => (parseKey(key).getUTCDay() + 6) % 7;

// The `count` date keys ending today, oldest first.
export const lastDateKeys = (todayKey: string, count: number): string[] =>
  Array.from({ length: count }, (_, i) => shiftDateKey(todayKey, i - count + 1));

// Fills missing days with zero so charts always get a full, ordered series.
export const fillDays = (keys: string[], rows: DailyFocus[]): DailyFocus[] => {
  const byKey = new Map(rows.map((row) => [row.dateKey, row]));
  return keys.map((dateKey) => byKey.get(dateKey) ?? { dateKey, minutes: 0, sessions: 0 });
};

export const fillHours = (rows: HourlyFocus[]): HourlyFocus[] => {
  const byHour = new Map(rows.map((row) => [row.hour, row.minutes]));
  return Array.from({ length: 24 }, (_, hour) => ({ hour, minutes: byHour.get(hour) ?? 0 }));
};

// Calendar heatmap grid: `weeks` columns of Monday→Sunday, ending with the
// current week. Days after today are null.
export const calendarWeeks = (todayKey: string, weeks: number, rows: DailyFocus[]): (DailyFocus | null)[][] => {
  const monday = shiftDateKey(todayKey, -weekdayIndex(todayKey));
  const start = shiftDateKey(monday, -(weeks - 1) * 7);
  const filled = new Map(rows.map((row) => [row.dateKey, row]));
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const dateKey = shiftDateKey(start, w * 7 + d);
      if (dateKey > todayKey) return null;
      return filled.get(dateKey) ?? { dateKey, minutes: 0, sessions: 0 };
    })
  );
};

// Bucket minutes into 0..4 heat levels relative to the daily focus goal.
export const heatLevel = (minutes: number, goalMinutes: number): number => {
  if (minutes <= 0) return 0;
  const ratio = minutes / Math.max(1, goalMinutes);
  if (ratio < 0.25) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 1) return 3;
  return 4;
};

export const formatMinutes = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}분`;
  return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`;
};
