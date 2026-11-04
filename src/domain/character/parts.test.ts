import { describe, expect, it } from 'vitest';
import { blank, hexToPixel, type Pixels } from './pixels';
import { ancestorsOf, CANVAS_LIMITS, clampCanvas, depthOf, draftProblems, isPartId, partBox, pivotOf, restVariant, type CharacterDraft, type Part } from './parts';

const W = 72;
const H = 72;
const rect = ([x0, y0, x1, y1]: [number, number, number, number], w = W, h = H): Pixels => {
  const px = blank(w, h);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) px.data[y * w + x] = hexToPixel('#336699');
  return px;
};
const part = (id: string, extra: Partial<Part> = {}): Part => ({ id, label: id, pixels: rect([10, 10, 20, 20]), parent: 'root', ...extra });
const draft = (parts: Part[], extra: Partial<CharacterDraft> = {}): CharacterDraft => ({
  id: 'bean', name: '콩이', persona: '', lines: { pat: [], pokeChest: [], pokeBelly: [] },
  canvas: { w: W, h: H }, body: { kind: 'biped', merged: true }, parts, ...extra
});
const biped = () => [
  part('foot.l', { role: 'foot', pixels: rect([20, 60, 30, 70]) }),
  part('foot.r', { role: 'foot', pixels: rect([40, 60, 50, 70]) }),
  part('body', { role: 'body', pixels: rect([16, 20, 56, 62]) }),
  part('eye', { role: 'eye', parent: 'body', pixels: rect([30, 30, 34, 34]), variants: { closed: rect([30, 32, 34, 33]) } })
];
const codes = (d: CharacterDraft) => draftProblems(d).map((p) => p.code);

describe('part ids', () => {
  it('are lowercase a-z0-9, dots and dashes, starting with a letter', () => {
    expect(['body', 'eye.l', 'hair-front', 'tail2', 'a.b.c'].every(isPartId)).toBe(true);
    expect(['', 'Eye', '1eye', 'eye..l', 'eye.', '.eye', 'eye l', 'root', 'eyes', 'a'.repeat(41)].some(isPartId)).toBe(false);
  });
});

describe('the part model', () => {
  it('accepts a one-piece biped: a body and two feet, no head', () => {
    expect(draftProblems(draft(biped()))).toEqual([]);
  });

  it('needs only a drawn body: feet are optional, a body alone is a whole (legless) character', () => {
    expect(codes(draft(biped().filter((p) => p.role !== 'body')))).toContain('body'); // (and the eye hangs on nothing)
    const empty = biped();
    empty[2] = { ...empty[2], pixels: blank(W, H) };
    expect(codes(draft(empty))).toEqual(['body']);
    expect(draftProblems(draft(biped().filter((p) => p.role !== 'foot')))).toEqual([]);
    expect(draftProblems(draft(biped().filter((p) => p.id !== 'foot.r'), { body: { kind: 'legless', merged: true } }))).toEqual([]);
  });

  it('needs a head unless the body is merged', () => {
    expect(codes(draft(biped(), { body: { kind: 'biped', merged: false } }))).toContain('head');
    const withHead = [...biped(), part('head', { role: 'head', parent: 'body', pixels: rect([20, 4, 50, 22]) })];
    expect(codes(draft(withHead, { body: { kind: 'biped', merged: false } }))).toEqual([]);
  });

  it('checks the canvas: 48–160 wide, 48–192 tall, multiples of 8, and part sizes', () => {
    expect(codes(draft(biped(), { canvas: { w: 40, h: 72 } }))).toContain('canvas');
    expect(codes(draft(biped(), { canvas: { w: 72, h: 200 } }))).toContain('canvas');
    expect(codes(draft(biped(), { canvas: { w: 70, h: 72 } }))).toContain('canvas');
    const odd = biped();
    odd[2] = { ...odd[2], pixels: blank(10, 10) };
    expect(codes(draft(odd))).toContain('size');
  });

  it('checks ids, parents (no loops, not too deep) and variant names', () => {
    expect(codes(draft([...biped(), part('body')]))).toContain('duplicate');
    expect(codes(draft([...biped(), part('Hat')]))).toContain('id');
    expect(codes(draft([...biped(), part('hat', { parent: 'nobody' })]))).toContain('parent');
    const loop = [...biped(), part('a', { parent: 'b' }), part('b', { parent: 'a' })];
    expect(codes(draft(loop))).toContain('loop');
    const deep = [...biped(), ...Array.from({ length: 8 }, (_, i) => part(`d${i}`, { parent: i ? `d${i - 1}` : 'root' }))];
    expect(codes(draft(deep))).toContain('depth');
    expect(codes(draft([...biped(), part('mouth', { role: 'mouth', variants: { closed: rect([1, 1, 2, 2]) } })]))).toContain('variant');
    expect(codes(draft([...biped(), part('eye.closed')]))).toContain('cell'); // the eye's closed picture is already cell eye.closed
  });

  it('knows ancestors, depth, the rest variant, the box and the pivot', () => {
    const d = draft([...biped(), part('lash', { parent: 'eye', pixels: rect([29, 28, 35, 29]) })]);
    expect(ancestorsOf(d, 'lash')).toEqual(['body', 'eye']);
    expect(depthOf(d, 'lash')).toBe(3);
    expect(restVariant(part('m', { role: 'mouth' }))).toBe('closed');
    expect(restVariant(part('e', { role: 'eye' }))).toBe('open');
    const eye = d.parts.find((p) => p.id === 'eye')!;
    expect(partBox(eye)).toEqual([30, 30, 34, 34]);
    expect(pivotOf(eye)).toEqual([32, 32]); // the box centre by default
    expect(pivotOf({ ...eye, pivot: [1, 2] })).toEqual([1, 2]);
    expect(partBox(part('none', { pixels: blank(W, H) }))).toBeUndefined();
  });

  it('clamps a canvas size to the limits, in multiples of 8', () => {
    expect(CANVAS_LIMITS).toEqual({ w: [48, 160], h: [48, 192], step: 8 });
    expect(clampCanvas(10, 500)).toEqual({ w: 48, h: 192 });
    expect(clampCanvas(70, 101)).toEqual({ w: 72, h: 104 });
    expect(clampCanvas(Number.NaN, 64)).toEqual({ w: 48, h: 64 });
  });
});
