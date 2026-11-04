import { describe, expect, it } from 'vitest';
import { buildPack } from './buildPack';
import { findPart, type CharacterDraft } from './parts';
import { blank, bounds, hexToPixel, type Pixels } from './pixels';
import {
  addPart, bringForward, canSetParent, clampMove, clearPart, composite, copyParts, deletePart, setMerged, drawOrder, emptyDraft, feetLine, framePicture, headBox, movePart,
  newPartId, partAt, partIds, placeBeside, resizeCanvas, sendBackward, setOrder, setParent, setPivot, setPixels, updatePart
} from './placement';

const RED = hexToPixel('#ff0000');
const BLUE = hexToPixel('#0000ff');
const W = 96;
const H = 112;

// A full-canvas picture with one filled rectangle [x0, y0, x1, y1).
const rect = (x0: number, y0: number, x1: number, y1: number, color = RED, w = W, h = H): Pixels => {
  const px = blank(w, h);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) px.data[y * w + x] = color;
  return px;
};
const px = (d: CharacterDraft, id: string) => findPart(d, id)!.pixels;
const two = () => setPixels(setPixels(emptyDraft(), 'body', rect(30, 40, 60, 90, RED)), 'head', rect(35, 20, 55, 50, BLUE));

describe('emptyDraft', () => {
  it('starts from the lila-like template, every part empty', () => {
    const d = emptyDraft();
    expect(d.canvas).toEqual({ w: 96, h: 112 });
    expect(partIds(d)).toEqual(['hair.back', 'body', 'leg.l', 'leg.r', 'arm.l', 'arm.r', 'head', 'eye.l', 'eye.r', 'mouth', 'hair.front']);
    expect(drawOrder(d)).toEqual([]);
    expect(emptyDraft('critter').canvas).toEqual({ w: 72, h: 72 });
  });
});

describe('clampMove', () => {
  it('keeps the box inside the canvas', () => {
    expect(clampMove([10, 10, 20, 20], 5, -3, { w: 96, h: 112 })).toEqual([5, -3]);
    expect(clampMove([10, 10, 20, 20], -50, 0, { w: 96, h: 112 })).toEqual([-10, 0]);
    expect(clampMove([10, 10, 20, 20], 100, 200, { w: 64, h: 160 })).toEqual([44, 140]);
  });
});

describe('pictures in parts', () => {
  it('sets a part picture or a variant, at the canvas size only', () => {
    const d = setPixels(emptyDraft(), 'eye.l', rect(1, 1, 2, 2), 'closed');
    expect(findPart(d, 'eye.l')!.variants!.closed).toBeDefined();
    expect(setPixels(d, 'eye.l', rect(1, 1, 3, 3), 'open') === d).toBe(false); // open is the eye at rest
    expect(bounds(px(setPixels(d, 'eye.l', rect(1, 1, 3, 3), 'open'), 'eye.l'))).toEqual([1, 1, 3, 3]);
    expect(() => setPixels(emptyDraft(), 'tail', rect(0, 0, 1, 1))).toThrow(/tail/);
    expect(() => setPixels(emptyDraft(), 'head', blank(10, 10))).toThrow(/96×112/);
  });

  it('clears a part (its variants too) and keeps it in the list', () => {
    const d = clearPart(setPixels(setPixels(emptyDraft(), 'eye.l', rect(1, 1, 2, 2)), 'eye.l', rect(1, 1, 2, 2), 'closed'), 'eye.l');
    expect(bounds(px(d, 'eye.l'))).toBeUndefined();
    expect(findPart(d, 'eye.l')!.variants).toBeUndefined();
    expect(partIds(d)).toContain('eye.l');
    expect(clearPart(d, 'eye.l')).toBe(d);
  });
});

describe('adding and deleting parts', () => {
  it('adds a named part at the front, with a unique id from its name', () => {
    const { draft, id } = addPart(emptyDraft(), { label: 'Tail', role: 'tail', parent: 'body' });
    expect(id).toBe('tail');
    expect(partIds(draft).at(-1)).toBe('tail');
    expect(findPart(draft, 'tail')).toMatchObject({ label: 'Tail', role: 'tail', parent: 'body' });
    expect(bounds(findPart(draft, 'tail')!.pixels)).toBeUndefined();
    expect(addPart(draft, { label: 'tail' }).id).toBe('tail-2');
    expect(addPart(draft, { label: '귀', role: 'ear' }).id).toBe('ear'); // a Korean name: the role names it
    expect(addPart(draft, { label: '모자' }).id).toBe('part');
    expect(addPart(draft, { label: 'Eyes' }).id).toBe('eyes-2'); // `eyes` is the glance region
  });

  it('makes ids from names', () => {
    expect(newPartId('My Hat (2).png', [])).toBe('myhat2');
    expect(newPartId('Ribbon 1', ['ribbon1'])).toBe('ribbon1-2');
    expect(newPartId('123', [])).toBe('part');
    expect(newPartId('eye.L.open', [])).toBe('eye.l.open');
  });

  it('deletes a part; its children hang on its parent', () => {
    const d = deletePart(two(), 'head');
    expect(partIds(d)).not.toContain('head');
    expect(findPart(d, 'eye.l')!.parent).toBe('body');
    expect(findPart(d, 'hair.front')!.parent).toBe('body');
    expect(deletePart(d, 'head')).toBe(d);
  });

  it('renames a part and changes its role', () => {
    const d = updatePart(two(), 'head', { label: '얼굴', role: 'body' });
    expect(findPart(d, 'head')).toMatchObject({ label: '얼굴', role: 'body' });
    expect(updatePart(d, 'head', { label: '얼굴' })).toBe(d);
  });
});

describe('parents and pivots', () => {
  it('re-parents a part and keeps its pixels', () => {
    const d = two();
    const moved = setParent(d, 'head', 'root');
    expect(findPart(moved, 'head')!.parent).toBe('root');
    expect(px(moved, 'head')).toBe(px(d, 'head'));
    expect(buildPack({ ...setPixels(setPixels(moved, 'leg.l', rect(30, 90, 40, 100)), 'leg.r', rect(45, 90, 55, 100)) }).pack.layers.find((l) => l.id === 'head')!.follow).toEqual(['head']);
    expect(setParent(moved, 'head', 'root')).toBe(moved);
  });

  it('refuses a parent that would make a loop, or one that does not exist', () => {
    const d = two();
    expect(canSetParent(d, 'body', 'eye.l')).toMatch(/자기/); // eye.l hangs on head, head on body
    expect(canSetParent(d, 'body', 'body')).toMatch(/자기/);
    expect(canSetParent(d, 'body', 'nobody')).toMatch(/없어요/);
    expect(canSetParent(d, 'eye.l', 'arm.l')).toBeNull();
    expect(() => setParent(d, 'body', 'eye.l')).toThrow(/자기/);
  });

  it('moves the pivot inside the canvas, whole pixels', () => {
    const d = setPivot(two(), 'head', [40.6, 300]);
    expect(findPart(d, 'head')!.pivot).toEqual([41, 111]);
    expect(setPivot(d, 'head', [41, 111])).toBe(d);
  });
});

describe('movePart', () => {
  it('shifts the picture, its variants and its pivot by whole pixels', () => {
    let d = setPixels(setPixels(emptyDraft(), 'eye.l', rect(10, 10, 20, 20)), 'eye.l', rect(10, 14, 20, 15), 'closed');
    d = setPivot(d, 'eye.l', [12, 12]);
    const moved = movePart(d, 'eye.l', 3, -2);
    const eye = findPart(moved, 'eye.l')!;
    expect([bounds(eye.pixels), bounds(eye.variants!.closed), eye.pivot]).toEqual([[13, 8, 23, 18], [13, 12, 23, 13], [15, 10]]);
    expect(bounds(px(d, 'eye.l'))).toEqual([10, 10, 20, 20]); // the old draft is untouched
  });

  it('stops at the canvas edge, and answers the same draft when nothing moves', () => {
    const d = setPixels(emptyDraft(), 'head', rect(2, 100, 12, 110));
    expect(bounds(px(movePart(d, 'head', -8, 8), 'head'))).toEqual([0, 102, 10, 112]);
    expect(movePart(d, 'head', 0, 0)).toBe(d);
    expect(movePart(d, 'leg.l', 2, 2)).toBe(d); // an empty part
  });
});

describe('drawing order', () => {
  it('lists the drawn parts back to front, sets an index, steps past the next drawn part', () => {
    expect(drawOrder(two())).toEqual(['body', 'head']);
    const back = setOrder(two(), 'head', 0);
    expect(drawOrder(back)).toEqual(['head', 'body']);
    expect(setOrder(back, 'head', 0)).toBe(back);
    expect(drawOrder(sendBackward(two(), 'head'))).toEqual(['head', 'body']);
    expect(drawOrder(bringForward(sendBackward(two(), 'head'), 'head'))).toEqual(['body', 'head']);
    expect(bringForward(two(), 'head')).toEqual(two());
  });

  it('puts a part just in front of or behind another', () => {
    const behind = placeBeside(two(), 'head', 'body', 'back');
    expect(drawOrder(behind)).toEqual(['head', 'body']);
    expect(drawOrder(placeBeside(behind, 'head', 'body', 'front'))).toEqual(['body', 'head']);
    const d = two();
    expect(placeBeside(d, 'head', 'head', 'back')).toBe(d);
  });

  it('picks the front-most drawn part under a pixel, passing over skipped ones', () => {
    expect(partAt(two(), 40, 45)).toBe('head');
    expect(partAt(setOrder(two(), 'head', 0), 40, 45)).toBe('body');
    expect(partAt(two(), 40, 45, new Set(['head']))).toBe('body');
    expect([partAt(two(), 0, 0), partAt(two(), -1, 45), partAt(two(), 96, 45)]).toEqual([undefined, undefined, undefined]);
  });

  it('composites the drawn parts back to front, without hidden ones', () => {
    expect(composite(two()).data[45 * W + 40]).toBe(BLUE);
    expect(composite(two(), new Set(['head'])).data[45 * W + 40]).toBe(RED);
  });
});

describe('canvas size', () => {
  it('grows around the feet: centred left-right, the bottom kept', () => {
    const { draft, lost } = resizeCanvas(two(), 112, 128);
    expect(draft.canvas).toEqual({ w: 112, h: 128 });
    expect(lost).toEqual([]);
    expect(draft.parts.every((p) => p.pixels.w === 112 && p.pixels.h === 128)).toBe(true);
    expect(bounds(px(draft, 'body'))).toEqual([38, 56, 68, 106]);
  });

  it('clamps the size to the limits and multiples of 8', () => {
    expect(resizeCanvas(two(), 20, 1000).draft.canvas).toEqual({ w: 48, h: 192 });
    expect(resizeCanvas(two(), 99, 110).draft.canvas).toEqual({ w: 96, h: 112 });
    const d = two();
    expect(resizeCanvas(d, 96, 112).draft).toBe(d);
  });

  it('says which parts lose pixels when it shrinks, and how many', () => {
    const d = setPixels(two(), 'leg.l', rect(0, 100, 4, 112));
    const { draft, lost } = resizeCanvas(d, 64, 112);
    expect(lost).toEqual([{ id: 'leg.l', label: '왼다리', pixels: 48 }]);
    expect(bounds(px(draft, 'body'))).toEqual([14, 40, 44, 90]);
    expect(bounds(px(draft, 'leg.l'))).toBeUndefined();
  });

  it('moves pivots with the pictures, kept inside', () => {
    const d = resizeCanvas(setPivot(two(), 'head', [90, 10]), 64, 112).draft;
    expect(findPart(d, 'head')!.pivot).toEqual([63, 10]);
  });
});

describe('the body and other characters', () => {
  it('sets whether the body is one piece', () => {
    const d = setMerged(two(), true);
    expect(d.body).toEqual({ kind: 'biped', merged: true });
    expect(setMerged(d, true)).toBe(d);
  });

  it('copies parts from another character: same id replaced, others added, pictures moved to this canvas', () => {
    const other = setPixels(setPixels(emptyDraft(), 'head', rect(30, 10, 60, 40)), 'arm.l', rect(20, 50, 28, 80));
    const withTail = addPart(other, { label: '꼬리', role: 'tail', parent: 'body' });
    const source = setPixels(withTail.draft, 'tail', rect(70, 90, 80, 112));
    const into = emptyDraft('critter');
    const d = copyParts(into, source, ['head', 'tail']);
    expect(partIds(d)).toEqual([...partIds(into), 'head', 'tail']);
    expect(findPart(d, 'tail')).toMatchObject({ label: '꼬리', role: 'tail', parent: 'body' });
    expect(findPart(d, 'head')!.parent).toBe('body');
    // 96×112 → 72×72: centred left-right, the bottom kept, the rest cut off
    expect(bounds(findPart(d, 'tail')!.pixels)).toEqual([58, 50, 68, 72]);
    expect(bounds(findPart(d, 'head')!.pixels)).toBeUndefined();
    const replaced = copyParts(two(), source, ['head']);
    expect(partIds(replaced)).toEqual(partIds(two()));
    expect(bounds(findPart(replaced, 'head')!.pixels)).toEqual([30, 10, 60, 40]);
  });
});

describe('guides and pictures', () => {
  it('puts the feet line at the lowest foot pixel, as buildPack does', () => {
    const d = setPixels(setPixels(two(), 'leg.l', rect(30, 90, 40, 104)), 'leg.r', rect(45, 90, 55, 100));
    expect(feetLine(d)).toBe(104);
    expect(feetLine(d)).toBe(buildPack(d).pack.feetY);
    expect(feetLine(emptyDraft())).toBeUndefined();
  });

  it('boxes the head and what hangs on it, or the top half of a one-piece body', () => {
    const d = setPixels(two(), 'hair.front', rect(28, 8, 50, 20));
    expect(headBox(d)).toEqual([28, 8, 55, 50]);
    const critter = setPixels(emptyDraft('critter'), 'body', rect(10, 20, 60, 60, RED, 72, 72));
    expect(headBox(critter)).toEqual([10, 20, 60, 40]);
    expect(headBox(emptyDraft())).toBeUndefined();
  });

  it('frames a smaller picture at the middle of the canvas, refuses a bigger one', () => {
    const framed = framePicture(4, 2, new Uint32Array(8).fill(RED), { w: 96, h: 112 });
    expect([framed.w, framed.h, bounds(framed)]).toEqual([96, 112, [46, 55, 50, 57]]);
    expect(() => framePicture(97, 10, new Uint32Array(970), { w: 96, h: 112 })).toThrow(/96×112/);
    expect(bounds(framePicture(4, 2, new Uint32Array(8).fill(RED), { w: 64, h: 160 }))).toEqual([30, 79, 34, 81]);
  });
});
