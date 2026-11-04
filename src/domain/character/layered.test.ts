import { describe, expect, it } from 'vitest';
import { importLayers } from './layered';
import { findPart, partBox } from './parts';
import { blank, bounds, hexToPixel, type Pixels } from './pixels';
import { emptyDraft, partIds, setPixels } from './placement';

const dot = (x: number, y: number, color = '#ff0000', w = 96, h = 112): Pixels => {
  const px = blank(w, h);
  px.data[y * w + x] = hexToPixel(color);
  return px;
};

describe('bringing in a layered file', () => {
  it('fills parts by their id, variants by <id>.<variant>, old layer names by their part', () => {
    const { draft, placed } = importLayers(emptyDraft(), [
      { name: 'body', pixels: dot(40, 60) },
      { name: 'eye.l.closed', pixels: dot(36, 28) },
      { name: 'torso.chest', pixels: dot(41, 60) },
      { name: 'eye.R.open', pixels: dot(56, 26) },
      { name: 'empty', pixels: blank(96, 112) }
    ]);
    expect(placed).toEqual([
      { name: 'body', part: 'body', created: false },
      { name: 'eye.l.closed', part: 'eye.l', variant: 'closed', created: false },
      { name: 'torso.chest', part: 'body', created: false },
      { name: 'eye.R.open', part: 'eye.r', created: false }
    ]);
    expect(bounds(findPart(draft, 'body')!.pixels)).toEqual([40, 60, 42, 61]); // the second layer for a part is drawn over the first
    expect(bounds(findPart(draft, 'eye.l')!.variants!.closed)).toEqual([36, 28, 37, 29]);
    expect(bounds(findPart(draft, 'eye.r')!.pixels)).toEqual([56, 26, 57, 27]);
  });

  it('makes a new part for every other name, at the front, never asking or dropping', () => {
    const { draft, placed } = importLayers(emptyDraft(), [{ name: 'Ribbon 1', pixels: dot(50, 14) }, { name: 'Sketch', pixels: dot(0, 0) }, { name: 'custom.bow', pixels: dot(60, 10) }]);
    expect(placed.map((p) => [p.name, p.part, p.created])).toEqual([['Ribbon 1', 'ribbon1', true], ['Sketch', 'sketch', true], ['custom.bow', 'bow', true]]);
    expect(partIds(draft).slice(-3)).toEqual(['ribbon1', 'sketch', 'bow']);
    expect(findPart(draft, 'ribbon1')).toMatchObject({ label: 'Ribbon 1', parent: 'root' });
    expect(findPart(draft, 'bow')).toMatchObject({ role: 'accessory' });
  });

  it('replaces what a part had, keeps the rest of the draft', () => {
    const start = setPixels(setPixels(emptyDraft(), 'head', dot(5, 5)), 'body', dot(1, 1));
    const { draft } = importLayers(start, [{ name: 'head', pixels: dot(40, 20) }]);
    expect(partBox(findPart(draft, 'head')!)).toEqual([40, 20, 41, 21]);
    expect(findPart(draft, 'body')!.pixels).toBe(findPart(start, 'body')!.pixels);
  });

  it('puts a smaller file in the middle, every layer by the same offset; refuses a bigger one', () => {
    const { draft } = importLayers(emptyDraft(), [{ name: 'head', pixels: dot(0, 0, '#ff0000', 32, 32) }, { name: 'hair.front', pixels: dot(31, 31, '#ff0000', 32, 32) }]);
    expect([bounds(findPart(draft, 'head')!.pixels), bounds(findPart(draft, 'hair.front')!.pixels)]).toEqual([[32, 40, 33, 41], [63, 71, 64, 72]]);
    expect(() => importLayers(emptyDraft(), [{ name: 'head', pixels: blank(128, 128) }])).toThrow('96×112 이하');
  });

  it('places nothing: the same draft back', () => {
    const start = emptyDraft();
    expect(importLayers(start, [{ name: 'x', pixels: blank(96, 112) }]).draft).toBe(start);
  });
});
