import { dateKeyOf, inBounds } from '../../../shared/dateFilter';
import type { Note } from '../../../shared/types';

// The notes tab's rules, apart from the screen (tested in logic.test.ts).

type Bounds = { from: string | null; to: string | null };

export const ago = (ms: number, now: number) => {
  const minutes = Math.round((now - ms) / 60_000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}시간 전`;
  return new Date(ms).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
};

// Inside a day group the date is already in the header, so older notes show
// the time of day instead of a date.
export const when = (ms: number, todayKey: string, now: number) => {
  if (dateKeyOf(ms) === todayKey) return ago(ms, now);
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const snippet = (body: string) => body.slice(0, 90);

// Grouped by last edit (updatedAt), not creation: a note you just worked on
// is one you'd look for under "오늘". Pinned notes stand apart, on top.
export const visibleNotes = (notes: Note[], bounds: Bounds, pinnedOnly: boolean) => {
  const shown = notes.filter((n) => (!pinnedOnly || n.pinned) && inBounds(dateKeyOf(n.updatedAt), bounds));
  return { shown, pinned: shown.filter((n) => n.pinned), others: shown.filter((n) => !n.pinned) };
};

export const emptyText = (total: number, filtered: boolean, query: string) =>
  total && filtered ? '조건에 맞는 메모가 없어요' : query ? '검색 결과가 없어요' : '첫 메모를 남겨보세요';
