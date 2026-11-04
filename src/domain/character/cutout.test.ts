import { describe, expect, it } from 'vitest';
import { boxMask, combine, countMask, cut, emptyMask, fullMask, maskBounds, sameColor, subtract, union } from './cutout';
import { blank, bounds, hexToPixel, type Pixels } from './pixels';

const W = 8;
const H = 6;
const RED = hexToPixel('#ff0000');
const BLUE = hexToPixel('#0000ff');
const RED_SEMI = (RED & 0x00ffffff) | (0x80 << 24);

// A picture from rows of characters: '.' transparent, 'r' red, 'b' blue, 's' half-transparent red.
const picture = (rows: string[]): Pixels => {
  const px = blank(rows[0].length, rows.length);
  rows.forEach((row, y) => [...row].forEach((c, x) => (px.data[y * px.w + x] = { '.': 0, r: RED, b: BLUE, s: RED_SEMI >>> 0 }[c] ?? 0)));
  return px;
};
// The mask as rows of '#' (selected) and '.'.
const rowsOf = (mask: { w: number; h: number; bits: Uint8Array }) =>
  Array.from({ length: mask.h }, (_, y) => Array.from({ length: mask.w }, (_, x) => (mask.bits[y * mask.w + x] ? '#' : '.')).join(''));

const PIC = picture([
  'rr..bb..',
  'rr..bb..',
  '..rr....',
  '..rrs...',
  'r.......',
  '......bb'
]);

describe('box select', () => {
  it('selects every pixel in the box, end exclusive', () => {
    expect(rowsOf(boxMask(W, H, [1, 1, 4, 3]))).toEqual(['........', '.###....', '.###....', '........', '........', '........']);
  });

  it('takes the corners in any order and clamps to the canvas', () => {
    expect(rowsOf(boxMask(W, H, [9, 7, 6, 4]))).toEqual(['........', '........', '........', '........', '......##', '......##']);
    expect(countMask(boxMask(W, H, [-3, -3, 1, 1]))).toBe(1);
  });

  it('an empty or off-canvas box selects nothing', () => {
    expect(countMask(boxMask(W, H, [2, 2, 2, 5]))).toBe(0);
    expect(countMask(boxMask(W, H, [20, 20, 30, 30]))).toBe(0);
  });
});

describe('same-colour select', () => {
  it('selects the 4-connected region of exactly that colour', () => {
    // The red block at the top left only: (2,2) touches it diagonally, not by a side.
    expect(rowsOf(sameColor(PIC, 0, 0))).toEqual(['##......', '##......', '........', '........', '........', '........']);
    expect(rowsOf(sameColor(PIC, 3, 3))).toEqual(['........', '........', '..##....', '..##....', '........', '........']);
  });

  it('matches RGBA exactly: a half-transparent red is another colour', () => {
    expect(rowsOf(sameColor(PIC, 4, 3))).toEqual(['........', '........', '........', '....#...', '........', '........']);
  });

  it('outside the picture selects nothing', () => {
    expect(countMask(sameColor(PIC, -1, 0))).toBe(0);
    expect(countMask(sameColor(PIC, 0, H))).toBe(0);
  });
});

describe('combining selections', () => {
  const a = boxMask(W, H, [0, 0, 4, 2]);
  const b = boxMask(W, H, [2, 0, 6, 1]);

  it('union adds, subtract takes away', () => {
    expect(rowsOf(union(a, b))).toEqual(['######..', '####....', '........', '........', '........', '........']);
    expect(rowsOf(subtract(a, b))).toEqual(['##......', '####....', '........', '........', '........', '........']);
  });

  it('combine: replace, add (Shift) or subtract (Alt), without changing its inputs', () => {
    expect(combine(a, b, 'replace')).toEqual(b);
    expect(combine(a, b, 'add')).toEqual(union(a, b));
    expect(combine(a, b, 'subtract')).toEqual(subtract(a, b));
    expect(countMask(a)).toBe(8);
  });

  it('select all and an empty selection', () => {
    expect(countMask(fullMask(W, H))).toBe(W * H);
    expect(countMask(emptyMask(W, H))).toBe(0);
    expect(maskBounds(emptyMask(W, H))).toBeUndefined();
    expect(maskBounds(union(a, b))).toEqual([0, 0, 6, 2]);
  });
});

describe('cutting a selection out', () => {
  it('keeps the selected pixels at their exact positions', () => {
    const { part } = cut(PIC, sameColor(PIC, 3, 3));
    expect(part.w).toBe(W);
    expect(part.h).toBe(H);
    expect(bounds(part)).toEqual([2, 2, 4, 4]);
    expect(part.data[2 * W + 2]).toBe(RED);
    expect(part.data[3 * W + 4]).toBe(0); // the half-transparent pixel was not selected
  });

  it('removes the cut pixels from the source, so each pixel belongs to one part', () => {
    const mask = boxMask(W, H, [0, 0, 6, 2]);
    const { part, rest } = cut(PIC, mask);
    expect(rowsOf({ w: W, h: H, bits: Uint8Array.from(part.data, (p) => (p >>> 24 ? 1 : 0)) })).toEqual(['##..##..', '##..##..', '........', '........', '........', '........']);
    expect(bounds(rest)).toEqual([0, 2, 8, 6]);
    for (let i = 0; i < PIC.data.length; i++) expect(part.data[i] && rest.data[i]).toBe(0); // never both
    for (let i = 0; i < PIC.data.length; i++) expect(part.data[i] || rest.data[i]).toBe(PIC.data[i]); // nothing lost
  });

  it('does not change the source picture', () => {
    const before = PIC.data.slice();
    cut(PIC, fullMask(W, H));
    expect(PIC.data).toEqual(before);
  });

  it('refuses a selection with no drawn pixel in it', () => {
    expect(() => cut(PIC, emptyMask(W, H))).toThrow('고른 픽셀이 없어요');
    expect(() => cut(PIC, boxMask(W, H, [6, 0, 8, 4]))).toThrow('고른 픽셀이 없어요');
  });

  it('refuses a mask of another size', () => {
    expect(() => cut(PIC, emptyMask(W + 1, H))).toThrow();
  });
});
