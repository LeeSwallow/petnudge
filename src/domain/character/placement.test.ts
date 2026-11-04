import { describe, expect, it } from 'vitest';
import { buildPack } from './buildPack';
import { blank, bounds, hexToPixel, type Pixels } from './pixels';
import { FRAME, STANDARD_SLOTS, type CharacterDraft } from './standard';
import { bringForward, clampMove, customName, framePicture, partAt, placeBeside, composite, drawOrder, emptyDraft, feetLine, fullOrder, headBox, movePart, moveSlot, removePart, sendBackward, setOrder, setPart, slotOrder } from './placement';

const RED = hexToPixel('#ff0000');
const BLUE = hexToPixel('#0000ff');

// A full-canvas picture with one filled rectangle [x0, y0, x1, y1).
const rect = (x0: number, y0: number, x1: number, y1: number, color = RED): Pixels => {
  const px = blank(FRAME.w, FRAME.h);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) px.data[y * FRAME.w + x] = color;
  return px;
};

const STANDARD_NAMES = STANDARD_SLOTS.flatMap((s) => s.parts.map((p) => p.name));

describe('emptyDraft', () => {
  it('starts with no parts and every standard layer in slot order', () => {
    const draft = emptyDraft();
    expect(draft.parts).toEqual({});
    expect(draft.order).toEqual(STANDARD_NAMES);
  });
});

describe('clampMove', () => {
  it('keeps the box inside the 96×112 canvas', () => {
    expect(clampMove([10, 10, 20, 20], 5, -3)).toEqual([5, -3]);
    expect(clampMove([10, 10, 20, 20], -50, 0)).toEqual([-10, 0]);
    expect(clampMove([10, 10, 20, 20], 100, 200)).toEqual([76, 92]);
    expect(clampMove([0, 0, 96, 112], 1, 1)).toEqual([0, 0]);
  });
});

describe('movePart', () => {
  it('shifts the picture by whole pixels', () => {
    const draft = setPart(emptyDraft(), 'head', rect(10, 10, 20, 20));
    const moved = movePart(draft, 'head', 3, -2);
    expect(bounds(moved.parts.head)).toEqual([13, 8, 23, 18]);
    expect(bounds(draft.parts.head)).toEqual([10, 10, 20, 20]); // the old draft is untouched
  });

  it('refuses pixels that would leave the canvas: the move stops at the edge', () => {
    const draft = setPart(emptyDraft(), 'head', rect(2, 100, 12, 110));
    const moved = movePart(draft, 'head', -8, 8);
    expect(bounds(moved.parts.head)).toEqual([0, 102, 10, 112]);
    expect(moved.parts.head.data.filter((p) => p !== 0).length).toBe(100);
  });

  it('answers the same draft when nothing moves', () => {
    const draft = setPart(emptyDraft(), 'head', rect(0, 0, 4, 4));
    expect(movePart(draft, 'head', -1, -1)).toBe(draft);
    expect(movePart(draft, 'head', 0, 0)).toBe(draft);
    expect(movePart(draft, 'leg.L', 2, 2)).toBe(draft); // an empty slot
  });
});

describe('setPart and removePart', () => {
  it('takes only standard layers at 96×112', () => {
    expect(() => setPart(emptyDraft(), 'tail', rect(0, 0, 1, 1))).toThrow();
    expect(() => setPart(emptyDraft(), 'head', blank(10, 10))).toThrow();
  });

  it('adds a decoration at the front and drops it again when removed', () => {
    const draft = setPart(emptyDraft(), 'custom.bow', rect(0, 0, 2, 2));
    expect(fullOrder(draft).at(-1)).toBe('custom.bow');
    const removed = removePart(draft, 'custom.bow');
    expect(removed.parts).toEqual({});
    expect(removed.order).not.toContain('custom.bow');
  });

  it('keeps a standard layer in the order when its picture goes', () => {
    const draft = removePart(setPart(emptyDraft(), 'head', rect(0, 0, 2, 2)), 'head');
    expect(draft.parts).toEqual({});
    expect(draft.order).toEqual(STANDARD_NAMES);
    expect(removePart(draft, 'head')).toBe(draft);
  });
});

describe('drawing order', () => {
  const two = () => setPart(setPart(emptyDraft(), 'torso.chest', rect(30, 40, 60, 90, RED)), 'head', rect(35, 20, 55, 50, BLUE));

  it('lists the drawn layers back to front', () => {
    expect(drawOrder(two())).toEqual(['torso.chest', 'head']);
  });

  it('sets a layer to an index in the full order', () => {
    const draft = setOrder(two(), 'head', 0);
    expect(fullOrder(draft)[0]).toBe('head');
    expect(drawOrder(draft)).toEqual(['head', 'torso.chest']);
    expect(setOrder(draft, 'head', 0)).toBe(draft);
  });

  it('brings forward and sends backward past the next drawn layer', () => {
    const back = sendBackward(two(), 'head');
    expect(drawOrder(back)).toEqual(['head', 'torso.chest']);
    expect(drawOrder(bringForward(back, 'head'))).toEqual(['torso.chest', 'head']);
    expect(bringForward(two(), 'head')).toEqual(two()); // already at the front
  });

  it('orders slots by their first layer and moves a slot as a group', () => {
    const draft = setPart(setPart(emptyDraft(), 'eye.L.open', rect(0, 0, 1, 1)), 'eye.L.closed', rect(1, 0, 2, 1));
    expect(slotOrder(draft)).toEqual(STANDARD_SLOTS.map((s) => s.id));
    const moved = moveSlot(draft, 'eyes', 0);
    expect(slotOrder(moved)[0]).toBe('eyes');
    expect(fullOrder(moved).slice(0, 4)).toEqual(['eye.L.open', 'eye.L.closed', 'eye.R.open', 'eye.R.closed']);
    expect(moveSlot(moved, 'eyes', 0)).toBe(moved);
  });

  it('picks the front-most part under a pixel', () => {
    expect(partAt(two(), 40, 45)).toBe('head');
    expect(partAt(setOrder(two(), 'head', 0), 40, 45)).toBe('torso.chest');
    expect(partAt(two(), 31, 80)).toBe('torso.chest');
    expect([partAt(two(), 0, 0), partAt(two(), -1, 45), partAt(two(), 96, 45)]).toEqual([undefined, undefined, undefined]);
  });

  it('composites the drawn layers back to front', () => {
    const top = composite(two());
    expect(top.data[45 * FRAME.w + 40]).toBe(BLUE);
    expect(composite(setOrder(two(), 'head', 0)).data[45 * FRAME.w + 40]).toBe(RED);
    expect(top.data[0]).toBe(0);
  });
});

describe('guides', () => {
  it('puts the feet line at the lowest drawn pixel, as buildPack does', () => {
    const draft: CharacterDraft = setPart(setPart(emptyDraft(), 'torso.chest', rect(30, 40, 60, 90)), 'leg.L', rect(30, 90, 40, 104));
    expect(feetLine(draft)).toBe(104);
    expect(feetLine(draft)).toBe(buildPack(draft).pack.feetY);
    expect(feetLine(emptyDraft())).toBeUndefined();
  });

  it('boxes the head parts together', () => {
    const draft = setPart(setPart(setPart(emptyDraft(), 'head', rect(30, 10, 60, 40)), 'hair.front', rect(28, 8, 50, 20)), 'torso.chest', rect(0, 50, 96, 112));
    expect(headBox(draft)).toEqual([28, 8, 60, 40]);
    expect(headBox(setPart(emptyDraft(), 'torso.chest', rect(0, 0, 2, 2)))).toBeUndefined();
  });
});

describe('layer panel helpers', () => {
  const two = () => setPart(setPart(emptyDraft(), 'torso.chest', rect(30, 40, 60, 90, RED)), 'head', rect(35, 20, 55, 50, BLUE));

  it('puts a layer just in front of or behind another', () => {
    const behind = placeBeside(two(), 'head', 'torso.chest', 'back');
    expect(drawOrder(behind)).toEqual(['head', 'torso.chest']);
    expect(drawOrder(placeBeside(behind, 'head', 'torso.chest', 'front'))).toEqual(['torso.chest', 'head']);
    const draft = two();
    expect(drawOrder(placeBeside(draft, 'head', 'torso.chest', 'front'))).toEqual(['torso.chest', 'head']);
    expect(placeBeside(draft, 'head', 'head', 'back')).toBe(draft);
    const twice = placeBeside(draft, 'head', 'torso.chest', 'front');
    expect(placeBeside(twice, 'head', 'torso.chest', 'front')).toBe(twice);
  });

  it('leaves hidden layers out of the picture and skipped layers out of picking', () => {
    const hidden = new Set(['head']);
    expect(composite(two(), hidden).data[45 * FRAME.w + 40]).toBe(RED);
    expect(partAt(two(), 40, 45, hidden)).toBe('torso.chest');
    expect(partAt(two(), 40, 25, hidden)).toBeUndefined();
  });

  it('frames a picture of at most 96×112 at the middle of the canvas', () => {
    const framed = framePicture(4, 2, new Uint32Array(4 * 2).fill(RED));
    expect([framed.w, framed.h]).toEqual([96, 112]);
    expect(bounds(framed)).toEqual([46, 55, 50, 57]);
    expect(framePicture(96, 112, new Uint32Array(96 * 112).fill(BLUE)).data[0]).toBe(BLUE);
    expect(() => framePicture(97, 10, new Uint32Array(970))).toThrow(/96×112/);
  });

  it('names a decoration from a file name, unique in the draft', () => {
    expect(customName('bow.png', {})).toBe('custom.bow');
    expect(customName('My Hat (2).png', {})).toBe('custom.MyHat2');
    expect(customName('123.png', {})).toBe('custom.deco');
    const draft = setPart(emptyDraft(), 'custom.bow', rect(0, 0, 1, 1));
    expect(customName('bow.png', draft.parts)).toBe('custom.bow-2');
  });
});
