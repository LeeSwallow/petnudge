import { describe, expect, it } from 'vitest';
import { matchLayers, placeParts } from './layered';
import { emptyDraft, setPart } from './placement';
import { blank, bounds, hexToPixel, type Pixels } from './pixels';
import { FRAME } from './standard';

const dot = (x: number, y: number, color = '#ff0000', w: number = FRAME.w, h: number = FRAME.h): Pixels => {
  const px = blank(w, h);
  px.data[y * w + x] = hexToPixel(color);
  return px;
};

describe('matching a layered file to the standard slots', () => {
  it('standard layer names fill their slots; the rest wait for the user; empty layers are left out', () => {
    const { matched, unmatched } = matchLayers([
      { name: 'torso.chest', pixels: dot(40, 60) },
      { name: 'Layer 3', pixels: dot(10, 10) },
      { name: 'head', pixels: dot(40, 20) },
      { name: 'eye.L.open', pixels: blank(FRAME.w, FRAME.h) },
      { name: 'custom.bow', pixels: dot(50, 10) }
    ]);
    expect(matched.map((m) => [m.name, m.layer])).toEqual([['torso.chest', 'torso.chest'], ['head', 'head'], ['custom.bow', 'custom.bow']]);
    expect(unmatched.map((m) => m.name)).toEqual(['Layer 3']);
  });

  it('a second layer with a name already taken waits for the user', () => {
    const { matched, unmatched } = matchLayers([{ name: 'head', pixels: dot(1, 1) }, { name: 'head', pixels: dot(2, 2) }]);
    expect(matched).toHaveLength(1);
    expect(unmatched.map((m) => m.name)).toEqual(['head']);
  });

  it('a smaller file is placed in the middle, every layer by the same offset', () => {
    const { matched } = matchLayers([{ name: 'head', pixels: dot(0, 0, '#ff0000', 32, 32) }, { name: 'hair.front', pixels: dot(31, 31, '#ff0000', 32, 32) }]);
    expect(matched.map((m) => bounds(m.pixels))).toEqual([[32, 40, 33, 41], [63, 71, 64, 72]]);
  });

  it('a bigger file is refused with the size guidance', () => {
    expect(() => matchLayers([{ name: 'head', pixels: blank(128, 128) }])).toThrow('96×112 이하');
  });
});

describe('placing chosen layers in the draft', () => {
  it('replaces what the slot had, and draws later layers for the same slot over earlier ones', () => {
    const start = setPart(emptyDraft(), 'head', dot(5, 5));
    const next = placeParts(start, [
      { layer: 'head', pixels: dot(40, 20) },
      { layer: 'head', pixels: dot(41, 20, '#00ff00') },
      { layer: 'torso.chest', pixels: dot(40, 60) }
    ]);
    expect(bounds(next.parts.head)).toEqual([40, 20, 42, 21]);
    expect(next.parts.head.data[5 * FRAME.w + 5]).toBe(0);
    expect(bounds(next.parts['torso.chest'])).toEqual([40, 60, 41, 61]);
    expect(start.parts['torso.chest']).toBeUndefined();
  });

  it('places nothing: the same draft back', () => {
    const start = emptyDraft();
    expect(placeParts(start, [])).toBe(start);
  });
});
