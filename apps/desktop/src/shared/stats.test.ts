import { describe, expect, it } from 'vitest';
import { calendarWeeks, fillDays, fillHours, formatMinutes, heatLevel, lastDateKeys, shiftDateKey, weekdayIndex } from './stats';

describe('stats', () => {
  it('shifts date keys across month and year ends', () => {
    expect(shiftDateKey('2026-10-31', 1)).toBe('2026-11-01');
    expect(shiftDateKey('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('lists the last n days ending today, oldest first', () => {
    expect(lastDateKeys('2026-10-15', 3)).toEqual(['2026-10-13', '2026-10-14', '2026-10-15']);
  });

  it('indexes weekdays from Monday', () => {
    expect(weekdayIndex('2026-10-12')).toBe(0); // Monday
    expect(weekdayIndex('2026-10-18')).toBe(6); // Sunday
  });

  it('fills missing days and hours with zero', () => {
    expect(fillDays(['2026-10-14', '2026-10-15'], [{ dateKey: '2026-10-15', minutes: 50, sessions: 2 }])).toEqual([
      { dateKey: '2026-10-14', minutes: 0, sessions: 0 },
      { dateKey: '2026-10-15', minutes: 50, sessions: 2 }
    ]);
    const hours = fillHours([{ hour: 9, minutes: 25 }]);
    expect(hours).toHaveLength(24);
    expect(hours[9]).toEqual({ hour: 9, minutes: 25 });
    expect(hours[10].minutes).toBe(0);
  });

  it('builds Monday-first calendar weeks ending with the current week', () => {
    const grid = calendarWeeks('2026-10-15', 2, [{ dateKey: '2026-10-06', minutes: 25, sessions: 1 }]);

    expect(grid).toHaveLength(2);
    expect(grid[0][0]?.dateKey).toBe('2026-10-05');
    expect(grid[0][1]).toEqual({ dateKey: '2026-10-06', minutes: 25, sessions: 1 });
    expect(grid[1][3]?.dateKey).toBe('2026-10-15');
    expect(grid[1][4]).toBeNull();
  });

  it('buckets heat levels relative to the goal', () => {
    expect(heatLevel(0, 200)).toBe(0);
    expect(heatLevel(25, 200)).toBe(1);
    expect(heatLevel(75, 200)).toBe(2);
    expect(heatLevel(150, 200)).toBe(3);
    expect(heatLevel(250, 200)).toBe(4);
  });

  it('formats minutes in Korean hours and minutes', () => {
    expect(formatMinutes(45)).toBe('45분');
    expect(formatMinutes(120)).toBe('2시간');
    expect(formatMinutes(125)).toBe('2시간 5분');
  });
});
