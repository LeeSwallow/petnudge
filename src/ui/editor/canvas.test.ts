import { describe, expect, it } from 'vitest';
import { CANVAS, checkerSquares } from './canvas';
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

describe('editor slots', () => {
  it('lists the standard slots back to front, only the body required', () => {
    expect(EDITOR_SLOTS.map((s) => s.label)).toEqual(['뒷머리', '몸통', '다리', '팔', '머리(얼굴)', '눈', '입', '앞머리', '장식']);
    expect(EDITOR_SLOTS.filter((s) => s.required).map((s) => s.id)).toEqual(['torso']);
  });
});
