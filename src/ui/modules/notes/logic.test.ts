import { describe, expect, it } from 'vitest';
import type { Note } from '../../../shared/types';
import { ago, emptyText, snippet, visibleNotes, when } from './logic';

const now = new Date(2026, 10, 4, 15, 0).getTime();
const min = 60_000;
let n = 0;
const note = (over: Partial<Note> = {}): Note =>
  ({ id: `n${++n}`, title: '', body: '', pinned: false, createdAt: now, updatedAt: now, ...over }) as Note;
const everything = { from: null, to: null };

describe('notes logic', () => {
  it('says how long ago a note changed', () => {
    expect(ago(now - 20_000, now)).toBe('방금');
    expect(ago(now - 5 * min, now)).toBe('5분 전');
    expect(ago(now - 3 * 60 * min, now)).toBe('3시간 전');
    expect(ago(new Date(2026, 9, 30, 9).getTime(), now)).toBe('10. 30.');
  });

  it('shows the time of day for notes of an earlier day', () => {
    expect(when(now - 5 * min, '2026-11-04', now)).toBe('5분 전');
    expect(when(new Date(2026, 10, 2, 8, 5).getTime(), '2026-11-04', now)).toBe('08:05');
  });

  it('cuts the preview at 90 characters', () => {
    expect(snippet('가'.repeat(100))).toHaveLength(90);
  });

  it('puts pinned notes apart and filters by last edit', () => {
    const a = note({ pinned: true }), b = note(), old = note({ updatedAt: new Date(2026, 9, 1).getTime() });
    expect(visibleNotes([a, b, old], everything, false)).toEqual({ shown: [a, b, old], pinned: [a], others: [b, old] });
    expect(visibleNotes([a, b, old], everything, true).shown).toEqual([a]);
    expect(visibleNotes([a, b, old], { from: '2026-11-01', to: null }, false).shown).toEqual([a, b]);
  });

  it('says why the list is empty', () => {
    expect(emptyText(3, true, '')).toBe('조건에 맞는 메모가 없어요');
    expect(emptyText(0, false, '수학')).toBe('검색 결과가 없어요');
    expect(emptyText(0, false, '')).toBe('첫 메모를 남겨보세요');
  });
});
