// The desk clock's view, apart from the screen (tested in logic.test.ts):
// the computer's local time as two flip cards (24-hour) and a date line.

import { formatDate } from '../../i18n';

export type Card = 'hours' | 'minutes';
export type ClockFace = { hours: string; minutes: string; date: string };

const two = (n: number) => String(n).padStart(2, '0');

// "11월 4일 수", "Wed, Nov 4", "11月4日(水)"
export const dateLabel = (d: Date) => formatDate(d, { month: 'long', day: 'numeric', weekday: 'short' });

export const clockFace = (now: number): ClockFace => {
  const d = new Date(now);
  return { hours: two(d.getHours()), minutes: two(d.getMinutes()), date: dateLabel(d) };
};

// The cards to flip going from one face to the next; none on the first.
export const changedCards = (before: ClockFace | null, after: ClockFace): Card[] =>
  before ? (['hours', 'minutes'] as const).filter((card) => before[card] !== after[card]) : [];
