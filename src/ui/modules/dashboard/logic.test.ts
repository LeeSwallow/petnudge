import { describe, expect, it } from 'vitest';
import { clock, completionRate, emptyLogText, filterSessions, logSummary, shortMinutes, type SessionRow } from './logic';

let n = 0;
const row = (over: Partial<SessionRow> = {}): SessionRow => ({
  id: `s${++n}`, todoId: null, todoTitle: null, startedAt: 0, endedAt: 0, plannedMinutes: 25, minutes: 25,
  completed: true, pauseCount: 0, note: null, mood: null, dateKey: '2026-11-04', ...over
});

describe('dashboard logic', () => {
  it('writes the time of day', () => {
    expect(clock(new Date(2026, 10, 4, 7, 5).getTime())).toBe('07:05');
  });

  it('writes the today tile in minutes or hours', () => {
    expect(shortMinutes(45)).toBe('45m');
    expect(shortMinutes(60)).toBe('1h');
    expect(shortMinutes(95)).toBe('1h35');
  });

  it('rates completion, zero when nothing was tried', () => {
    expect(completionRate(3, 1)).toBe(75);
    expect(completionRate(0, 0)).toBe(0);
  });

  it('filters the focus records by result and todo', () => {
    const done = row({ todoId: 't1', todoTitle: '수학' }), dropped = row({ completed: false }), free = row();
    const rows = [done, dropped, free];
    expect(filterSessions(rows, 'done', 'all')).toEqual([done, free]);
    expect(filterSessions(rows, 'abandoned', 'all')).toEqual([dropped]);
    expect(filterSessions(rows, 'all', 'free')).toEqual([dropped, free]);
    expect(filterSessions(rows, 'all', 't1')).toEqual([done]);
  });

  it('sums the shown records, counting only finished focus time', () => {
    const shown = [row({ minutes: 25 }), row({ completed: false, minutes: 10 })];
    expect(logSummary(shown)).toBe('2회 · 완료 1 / 중단 1 · 집중 25분');
    expect(logSummary([])).toBe('');
  });

  it('says why the log is empty', () => {
    expect(emptyLogText(0, false)).toBe('첫 뽀모도로를 끝내면 여기에 기록돼요');
    expect(emptyLogText(3, false)).toBe('조건에 맞는 기록이 없어요');
    expect(emptyLogText(0, true)).toBe('조건에 맞는 기록이 없어요');
  });
});
