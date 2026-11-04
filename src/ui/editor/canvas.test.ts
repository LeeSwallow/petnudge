import { describe, expect, it } from 'vitest';
import { fromTemplate } from '../../domain/character/standard';
import { arrowStep, checkerSquares, DEFAULT_ZOOM, dragOffset, nearPoint, pixelAt, ZOOMS } from './canvas';
import { picturesFor, ROLE_CHOICES } from './roles';

describe('editor canvas', () => {
  it('checkers every other square and stays inside any canvas size', () => {
    const squares = checkerSquares(8, 6, 4);
    expect(squares).toEqual([[4, 0, 4, 4], [0, 4, 4, 2]]);
    for (const [w, h] of [[96, 112], [64, 160], [72, 72]]) {
      const all = checkerSquares(w, h);
      expect(all.length).toBe((w / 4) * (h / 4) / 2);
      expect(all.every(([x, y, sw, sh]) => x + sw <= w && y + sh <= h)).toBe(true);
    }
  });
});

describe('canvas input', () => {
  it('zooms 2, 4 or 6 times, 4 by default', () => {
    expect([ZOOMS, DEFAULT_ZOOM]).toEqual([[2, 4, 6], 4]);
  });

  it('maps a screen point to the canvas pixel under it', () => {
    const rect = { left: 100, top: 50 };
    expect(pixelAt(100, 50, rect, 4)).toEqual([0, 0]);
    expect(pixelAt(103.9, 57, rect, 4)).toEqual([0, 1]);
    expect(pixelAt(160, 80, rect, 6)).toEqual([10, 5]);
  });

  it('snaps a drag to whole pixels', () => {
    expect(dragOffset(0, 0, 9, -7, 4)).toEqual([2, -2]);
    expect(dragOffset(0, 0, 1, -1, 4)).toEqual([0, 0]);
    expect(dragOffset(10, 10, 46, 10, 6)).toEqual([6, 0]);
  });

  it('moves 1px on an arrow, 8px with Shift', () => {
    expect(arrowStep('ArrowLeft', false)).toEqual([-1, 0]);
    expect(arrowStep('ArrowDown', true)).toEqual([0, 8]);
    expect(arrowStep('a', false)).toBeUndefined();
  });

  it('grabs the pivot on its pixel or next to it', () => {
    expect([nearPoint([10, 10], [11, 9]), nearPoint([10, 10], [12, 10])]).toEqual([true, false]);
  });
});

describe('part roles', () => {
  it('offers every role in Korean', () => {
    expect(ROLE_CHOICES.map((r) => r.label)).toEqual(['몸', '머리', '눈', '입', '발·다리', '손·팔', '머리카락', '귀', '꼬리', '장식']);
  });

  it('lists where a picture can go in a part: at rest, and the closed eye or open mouth', () => {
    const parts = fromTemplate('critter').parts;
    const of = (id: string) => picturesFor(parts.find((p) => p.id === id)!);
    expect(of('body')).toEqual([{ variant: '', label: '몸' }]);
    expect(of('eye.l')).toEqual([{ variant: '', label: '왼눈 · 뜬 눈' }, { variant: 'closed', label: '왼눈 · 감은 눈' }]);
    expect(of('mouth')).toEqual([{ variant: '', label: '입 · 닫은 입' }, { variant: 'open', label: '입 · 연 입' }]);
  });
});
