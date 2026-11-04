import { dateKeyOf, inBounds } from '../../../shared/dateFilter';
import type { Todo } from '../../../shared/types';

// The todo tab's arithmetic, apart from the screen (tested in logic.test.ts).

export type TodoStatus = 'all' | 'open' | 'done';
type Bounds = { from: string | null; to: string | null };

export const clampEstimate = (n: number) => Math.min(12, Math.max(1, n));

// When the remaining pomodoros (each a focus and a break) would end if started now.
export const finishTime = (remaining: number, focusMinutes: number, breakMinutes: number, now: Date) => {
  const finish = new Date(now.getTime() + remaining * (focusMinutes + breakMinutes) * 60_000);
  return `${String(finish.getHours()).padStart(2, '0')}:${String(finish.getMinutes()).padStart(2, '0')}`;
};

export const summarize = (todos: Todo[]) => {
  const open = todos.filter((t) => !t.done);
  return {
    done: todos.length - open.length,
    total: todos.length,
    estimated: todos.reduce((sum, t) => sum + t.estimate, 0),
    spent: todos.reduce((sum, t) => sum + t.pomodoros, 0),
    remaining: open.reduce((sum, t) => sum + Math.max(0, t.estimate - t.pomodoros), 0)
  };
};

// Filtering only hides rows. Open todos count from the day they were made,
// done ones from the day they were finished. Up/down swaps with the neighbour
// in the full list, so it is offered only when no open row is hidden.
export const visibleTodos = (todos: Todo[], bounds: Bounds, status: TodoStatus) => {
  const open = todos.filter((t) => !t.done);
  const shownOpen = status === 'done' ? [] : open.filter((t) => inBounds(dateKeyOf(t.createdAt), bounds));
  const shownDone = status === 'open' ? [] : todos.filter((t) => t.done && inBounds(dateKeyOf(t.completedAt ?? t.createdAt), bounds));
  return { open: shownOpen, done: shownDone, canMove: shownOpen.length === open.length };
};

export const emptyText = (openCount: number) => (openCount ? '조건에 맞는 할 일이 없어요' : '할 일이 비었어요');
