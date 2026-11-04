import { describe, expect, it } from 'vitest';
import { arrowStep, CANVAS, checkerSquares, DEFAULT_ZOOM, dragOffset, pixelAt, ZOOMS } from './canvas';
import { EDITOR_SLOTS } from './slots';

describe('editor canvas', () => {
  it('is the pet canvas, 96×112', () => {
    expect(CANVAS).toEqual({ width: 96, height: 112 });
  });

  it('checkers every other square and stays inside the canvas', () => {
    const squares = checkerSquares(8, 6, 4);
    expect(squares).toEqual([[4, 0, 4, 4], [0, 4, 4, 2]]);
    const all = checkerSquares(CANVAS.width, CANVAS.height);
    expect(all.length).toBe((96 / 4) * (112 / 4) / 2);
    expect(all.every(([x, y, w, h]) => x + w <= 96 && y + h <= 112)).toBe(true);
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
});

describe('editor slots', () => {
  it('lists the standard slots back to front, only the body required', () => {
    expect(EDITOR_SLOTS.map((s) => s.id)).toEqual(['hairBack', 'torso', 'legs', 'arms', 'head', 'eyes', 'mouth', 'hairFront', 'custom']);
    expect(EDITOR_SLOTS.map((s) => s.label)).toEqual(['뒷머리', '몸통', '다리', '팔', '머리(얼굴)', '눈', '입', '앞머리', '장식']);
    expect(EDITOR_SLOTS.filter((s) => s.required).map((s) => s.id)).toEqual(['torso']);
  });
});
