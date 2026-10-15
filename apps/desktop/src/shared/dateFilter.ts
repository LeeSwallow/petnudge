import { toDateKey } from '../../../mobile/src/domain/progress';
import { shiftDateKey } from './stats';

// Date-range filtering and day grouping shared by the notes, todo and focus
// record lists. Everything works on local YYYY-MM-DD keys so "오늘" matches
// the user's calendar, not UTC.

export type RangePreset = 'all' | 'today' | '7d' | '30d' | 'custom';

export type DateRange = { preset: RangePreset; from: string; to: string };

export const RANGE_PRESETS: [RangePreset, string][] = [
  ['all', '전체'],
  ['today', '오늘'],
  ['7d', '최근 7일'],
  ['30d', '최근 30일'],
  ['custom', '직접 선택']
];

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export const dateKeyOf = (ms: number) => toDateKey(new Date(ms));

// Inclusive bounds; null means open-ended. A reversed custom range is
// swapped rather than matching nothing.
export const rangeBounds = (range: DateRange, todayKey: string): { from: string | null; to: string | null } => {
  switch (range.preset) {
    case 'today':
      return { from: todayKey, to: todayKey };
    case '7d':
      return { from: shiftDateKey(todayKey, -6), to: todayKey };
    case '30d':
      return { from: shiftDateKey(todayKey, -29), to: todayKey };
    case 'custom': {
      const from = DATE_KEY.test(range.from) ? range.from : null;
      const to = DATE_KEY.test(range.to) ? range.to : null;
      return from && to && from > to ? { from: to, to: from } : { from, to };
    }
    default:
      return { from: null, to: null };
  }
};

export const inBounds = (dateKey: string, bounds: { from: string | null; to: string | null }) =>
  (bounds.from === null || dateKey >= bounds.from) && (bounds.to === null || dateKey <= bounds.to);

export const dayLabel = (dateKey: string, todayKey: string) => {
  if (dateKey === todayKey) return '오늘';
  if (dateKey === shiftDateKey(todayKey, -1)) return '어제';
  return dateKey.replaceAll('-', '.');
};

// Groups already-sorted items by day, newest day first; items keep their
// order inside a day.
export const groupByDay = <T>(items: T[], keyOf: (item: T) => string): { dateKey: string; items: T[] }[] => {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()].sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0)).map(([dateKey, list]) => ({ dateKey, items: list }));
};
