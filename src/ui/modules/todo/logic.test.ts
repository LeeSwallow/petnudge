import { describe, expect, it } from 'vitest';
import type { Todo } from '../../../shared/types';
import { clampEstimate, emptyText, finishTime, summarize, visibleTodos } from './logic';

const day = (d: number) => new Date(2026, 10, d, 12).getTime();
let n = 0;
const todo = (over: Partial<Todo> = {}): Todo => ({
  id: `t${++n}`, title: 'x', done: false, estimate: 1, pomodoros: 0, position: n, createdAt: day(4), completedAt: null, ...over
});
const everything = { from: null, to: null };

describe('todo logic', () => {
  it('keeps the estimate between 1 and 12', () => {
    expect(clampEstimate(0)).toBe(1);
    expect(clampEstimate(5)).toBe(5);
    expect(clampEstimate(13)).toBe(12);
  });

  it('tells when the remaining pomodoros would end', () => {
    expect(finishTime(2, 25, 5, new Date(2026, 10, 4, 9, 0))).toBe('10:00');
    expect(finishTime(1, 25, 5, new Date(2026, 10, 4, 23, 45))).toBe('00:15');
  });

  it('sums the list, counting only what open todos still need', () => {
    expect(summarize([todo({ estimate: 3, pomodoros: 1 }), todo({ done: true, estimate: 1, pomodoros: 1 })]))
      .toEqual({ done: 1, total: 2, estimated: 4, spent: 2, remaining: 2 });
    expect(summarize([todo({ estimate: 1, pomodoros: 3 })]).remaining).toBe(0);
  });

  it('filters by status and by the day made (open) or done (completed)', () => {
    const open = todo({ createdAt: day(1) });
    const done = todo({ done: true, createdAt: day(1), completedAt: day(4) });
    const list = [open, done];
    expect(visibleTodos(list, everything, 'done')).toEqual({ open: [], done: [done], canMove: false });
    expect(visibleTodos(list, everything, 'open').done).toEqual([]);
    const onlyFourth = { from: '2026-11-04', to: '2026-11-04' };
    expect(visibleTodos(list, onlyFourth, 'all')).toEqual({ open: [], done: [done], canMove: false });
    expect(visibleTodos(list, everything, 'all').canMove).toBe(true);
  });

  it('says why the list is empty', () => {
    expect(emptyText(0)).toBe('할 일이 비었어요');
    expect(emptyText(3)).toBe('조건에 맞는 할 일이 없어요');
  });
});
