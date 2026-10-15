import { describe, expect, it } from 'vitest';
import { dayLabel, groupByDay, inBounds, rangeBounds } from './dateFilter';

const today = '2026-10-15';

describe('date filter', () => {
  it('turns presets into inclusive local-day bounds', () => {
    expect(rangeBounds({ preset: 'all', from: '', to: '' }, today)).toEqual({ from: null, to: null });
    expect(rangeBounds({ preset: 'today', from: '', to: '' }, today)).toEqual({ from: today, to: today });
    expect(rangeBounds({ preset: '7d', from: '', to: '' }, today)).toEqual({ from: '2026-10-09', to: today });
    expect(rangeBounds({ preset: '30d', from: '', to: '' }, today)).toEqual({ from: '2026-09-16', to: today });
  });

  it('accepts half-open and reversed custom ranges', () => {
    expect(rangeBounds({ preset: 'custom', from: '2026-10-01', to: '' }, today)).toEqual({ from: '2026-10-01', to: null });
    expect(rangeBounds({ preset: 'custom', from: '2026-10-10', to: '2026-10-01' }, today)).toEqual({ from: '2026-10-01', to: '2026-10-10' });
    expect(inBounds('2026-10-05', { from: '2026-10-01', to: '2026-10-10' })).toBe(true);
    expect(inBounds('2026-10-11', { from: '2026-10-01', to: '2026-10-10' })).toBe(false);
    expect(inBounds('1999-01-01', { from: null, to: null })).toBe(true);
  });

  it('labels and groups days newest first', () => {
    expect(dayLabel(today, today)).toBe('오늘');
    expect(dayLabel('2026-10-14', today)).toBe('어제');
    expect(dayLabel('2026-09-01', today)).toBe('2026.09.01');
    const groups = groupByDay(['2026-10-14:a', '2026-10-15:b', '2026-10-14:c'], (s) => s.slice(0, 10));
    expect(groups.map((g) => [g.dateKey, g.items.length])).toEqual([['2026-10-15', 1], ['2026-10-14', 2]]);
    expect(groups[1].items).toEqual(['2026-10-14:a', '2026-10-14:c']);
  });
});
