// The desk clock's view, apart from the screen (tested in logic.test.ts):
// the computer's local time as two flip cards (24-hour) and a date line.

export type Card = 'hours' | 'minutes';
export type ClockFace = { hours: string; minutes: string; date: string };

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'] as const;
const two = (n: number) => String(n).padStart(2, '0');

export const dateLabel = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAY[d.getDay()]}`;

export const clockFace = (now: number): ClockFace => {
  const d = new Date(now);
  return { hours: two(d.getHours()), minutes: two(d.getMinutes()), date: dateLabel(d) };
};

// The cards to flip going from one face to the next; none on the first.
export const changedCards = (before: ClockFace | null, after: ClockFace): Card[] =>
  before ? (['hours', 'minutes'] as const).filter((card) => before[card] !== after[card]) : [];
