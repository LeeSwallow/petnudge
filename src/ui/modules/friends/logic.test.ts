import { describe, expect, it } from 'vitest';
import { errorText, friendRow, onScreenCount } from './logic';

describe('friends logic', () => {
  it('counts the main pet plus the friends out', () => {
    expect(onScreenCount([], 'lila')).toBe(1);
    expect(onScreenCount(['moa', 'maru'], 'lila')).toBe(3);
    expect(onScreenCount(['lila', 'moa'], 'lila')).toBe(2);
  });

  it('offers to call a friend out or send it back; the main pet stays', () => {
    expect(friendRow('lila', 'lila', [])).toBe('main');
    expect(friendRow('moa', 'lila', [])).toBe('add');
    expect(friendRow('moa', 'lila', ['moa'])).toBe('remove');
  });

  it('reads an error as text', () => {
    expect(errorText(new Error('창이 너무 많아요'), '부르지 못했어요')).toBe('창이 너무 많아요');
    expect(errorText('?', '부르지 못했어요')).toBe('부르지 못했어요');
  });
});
