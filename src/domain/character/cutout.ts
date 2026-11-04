import type { Box } from './pack';
import { blank, type Pixels } from './pixels';

// Cutting parts out of one picture (#57, the editor's "한 장 + 오려 내기"):
// a selection is a mask over the picture, made with a box or a same-colour
// region and combined with add (Shift) or subtract (Alt). Cutting takes the
// selected drawn pixels into a part at their exact positions and removes them
// from the picture, so each pixel belongs to one part. Every function answers
// a new value; nothing is changed in place.

// One byte per pixel, 1 = selected, row by row.
export type Mask = { w: number; h: number; bits: Uint8Array };
export type SelectMode = 'replace' | 'add' | 'subtract';

export const emptyMask = (w: number, h: number): Mask => ({ w, h, bits: new Uint8Array(w * h) });
export const fullMask = (w: number, h: number): Mask => ({ w, h, bits: new Uint8Array(w * h).fill(1) });

export const countMask = (mask: Mask) => mask.bits.reduce((n, b) => n + b, 0);

// The pixels inside `box` ([x0, y0, x1, y1), corners in any order), clamped to the canvas.
export const boxMask = (w: number, h: number, [ax, ay, bx, by]: Box): Mask => {
  const mask = emptyMask(w, h);
  const [x0, x1] = [Math.max(0, Math.min(ax, bx)), Math.min(w, Math.max(ax, bx))];
  const [y0, y1] = [Math.max(0, Math.min(ay, by)), Math.min(h, Math.max(ay, by))];
  for (let y = y0; y < y1; y++) mask.bits.fill(1, y * w + x0, y * w + Math.max(x0, x1));
  return mask;
};

// The 4-connected region around (x, y) of exactly its RGBA colour.
export const sameColor = (px: Pixels, x: number, y: number): Mask => {
  const mask = emptyMask(px.w, px.h);
  if (x < 0 || y < 0 || x >= px.w || y >= px.h) return mask;
  const color = px.data[y * px.w + x];
  const stack = [y * px.w + x];
  mask.bits[stack[0]] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    const cx = i % px.w;
    const next = [cx > 0 ? i - 1 : -1, cx < px.w - 1 ? i + 1 : -1, i - px.w, i + px.w];
    for (const n of next) {
      if (n < 0 || n >= px.data.length || mask.bits[n] || px.data[n] !== color) continue;
      mask.bits[n] = 1;
      stack.push(n);
    }
  }
  return mask;
};

const sameSize = (a: { w: number; h: number }, b: { w: number; h: number }) => {
  if (a.w !== b.w || a.h !== b.h) throw new Error(`선택 크기가 달라요: ${a.w}×${a.h}, ${b.w}×${b.h}`);
};

export const union = (a: Mask, b: Mask): Mask => {
  sameSize(a, b);
  return { w: a.w, h: a.h, bits: a.bits.map((v, i) => v | b.bits[i]) };
};

export const subtract = (a: Mask, b: Mask): Mask => {
  sameSize(a, b);
  return { w: a.w, h: a.h, bits: a.bits.map((v, i) => v & (b.bits[i] ^ 1)) };
};

// A new selection `next` made with `mode`, from the current one.
export const combine = (current: Mask, next: Mask, mode: SelectMode): Mask =>
  mode === 'add' ? union(current, next) : mode === 'subtract' ? subtract(current, next) : next;

// The smallest box around the selection, or undefined when nothing is selected.
export const maskBounds = (mask: Mask): Box | undefined => {
  let [x0, y0, x1, y1] = [mask.w, mask.h, 0, 0];
  for (let i = 0; i < mask.bits.length; i++) {
    if (!mask.bits[i]) continue;
    const x = i % mask.w;
    const y = (i - x) / mask.w;
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x + 1);
    y1 = Math.max(y1, y + 1);
  }
  return x1 > 0 ? [x0, y0, x1, y1] : undefined;
};

// The selected drawn pixels as `part` (same size, same positions) and the
// picture without them as `rest`. Throws when the selection holds no drawn pixel.
export const cut = (source: Pixels, mask: Mask): { part: Pixels; rest: Pixels } => {
  sameSize(source, mask);
  const part = blank(source.w, source.h);
  const rest: Pixels = { w: source.w, h: source.h, data: source.data.slice() };
  let taken = 0;
  for (let i = 0; i < source.data.length; i++) {
    if (!mask.bits[i] || source.data[i] >>> 24 === 0) continue;
    part.data[i] = source.data[i];
    rest.data[i] = 0;
    taken++;
  }
  if (!taken) throw new Error('고른 픽셀이 없어요. 그림이 있는 곳을 골라 주세요');
  return { part, rest };
};
