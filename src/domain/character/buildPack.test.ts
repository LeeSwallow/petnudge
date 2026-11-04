import { describe, expect, it } from 'vitest';
import { buildPack, DEFAULT_LINES } from './buildPack';
import { blank, hexToPixel, type Pixels } from './pixels';
import type { CharacterDraft } from './standard';

const W = 96;
const H = 112;
type Rect = [number, number, number, number];
// A full 96×112 canvas with one filled box.
const rect = ([x0, y0, x1, y1]: Rect, color = '#336699'): Pixels => {
  const px = blank(W, H);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) px.data[y * W + x] = hexToPixel(color);
  return px;
};

const parts: Record<string, Rect> = {
  'hair.back': [24, 6, 72, 50],
  'leg.L': [36, 80, 46, 108],
  'leg.R': [50, 80, 60, 108],
  'arm.L': [22, 50, 30, 76],
  'arm.R': [66, 50, 74, 76],
  'torso.chest': [30, 50, 66, 80],
  head: [28, 10, 68, 48],
  'eye.L.open': [36, 26, 40, 30],
  'eye.L.closed': [36, 28, 40, 29],
  'eye.R.open': [56, 26, 60, 30],
  'mouth.closed': [44, 38, 52, 40],
  'mouth.open': [44, 37, 52, 42],
  'hair.front': [26, 6, 70, 20],
  'custom.ribbon': [60, 8, 70, 14],
  'custom.tail': [70, 70, 80, 80]
};

const draft = (names = Object.keys(parts), extra: Partial<CharacterDraft> = {}): CharacterDraft => ({
  id: 'bean',
  name: '콩이',
  persona: '느긋한 친구',
  lines: { pat: ['좋아!'], pokeChest: [], pokeBelly: ['  ', '간지러워'] },
  parts: Object.fromEntries(names.map((n) => [n, rect(parts[n])])),
  order: names,
  ...extra
});

describe('buildPack', () => {
  it('makes a standard @3 pack with the editor mark and the draft identity', () => {
    const { pack } = buildPack(draft());
    expect(pack).toMatchObject({ format: 'study-pet-character@3', editor: { version: 1 }, id: 'bean', name: '콩이', persona: '느긋한 친구', frame: { w: 96, h: 112 }, fallback: 'idle' });
    expect(pack.feetY).toBe(108); // the lowest drawn row + 1
  });

  it('lists layers back to front, one pack layer per face feature, and one picture per cell', () => {
    const { pack, layers } = buildPack(draft());
    expect(pack.layers.map((l) => l.id)).toEqual(['hair.back', 'leg.L', 'leg.R', 'arm.L', 'arm.R', 'torso.chest', 'head', 'eye.L', 'eye.R', 'mouth', 'hair.front', 'custom.ribbon', 'custom.tail']);
    expect(pack.layers.filter((l) => l.from === 'face').map((l) => l.id)).toEqual(['eye.L', 'eye.R', 'mouth']);
    expect(layers.map((l) => l.name)).toEqual(['hair.back', 'leg.L', 'leg.R', 'arm.L', 'arm.R', 'torso.chest', 'head', 'eye.L.open', 'eye.L.closed', 'eye.R.open', 'mouth.closed', 'mouth.open', 'hair.front', 'custom.ribbon', 'custom.tail']);
    expect(layers.every((l) => l.pixels.w === 96 && l.pixels.h === 112)).toBe(true);
    // cells side by side in one row, in the same order (a preview sheet)
    expect(layers.map((l) => pack.cells[l.name])).toEqual(layers.map((_, i) => [i * 96, 0]));
  });

  it('follows the draft order, back to front', () => {
    const names = ['torso.chest', 'hair.front', 'head'];
    expect(buildPack(draft(names)).pack.layers.map((l) => l.id)).toEqual(['torso.chest', 'hair.front', 'head']);
  });

  it('makes regions from part bounding boxes, upper from the waist line', () => {
    const { regions } = buildPack(draft()).pack;
    expect(regions.head).toEqual([[24, 6, 72, 50]]); // back hair, head, eyes, mouth, front hair
    expect(regions.upper).toEqual([[0, 0, 96, 65]]); // one torso picture: waist at its middle
    expect(regions.eyes).toEqual([[36, 26, 40, 30], [56, 26, 60, 30]]);
    expect(regions.legL).toEqual([[36, 80, 46, 108]]);
    expect(regions.legR).toEqual([[50, 80, 60, 108]]);
    expect(regions.armL).toEqual([[22, 50, 30, 76]]);
    expect(regions.armR).toEqual([[66, 50, 74, 76]]);
  });

  it('moves parts with their regions, decorations with what they sit on', () => {
    const follow = Object.fromEntries(buildPack(draft()).pack.layers.map((l) => [l.id, l.follow]));
    expect(follow).toMatchObject({
      'hair.back': ['upper', 'head'], head: ['upper', 'head'], 'hair.front': ['upper', 'head'], mouth: ['upper', 'head'],
      'eye.L': ['upper', 'head', 'eyes'], 'arm.L': ['upper', 'armL'], 'leg.R': ['legR'],
      'custom.ribbon': ['upper', 'head'], 'custom.tail': []
    });
    // one torso picture bends at the waist by region moves instead of moving whole
    expect(follow['torso.chest']).toBeUndefined();
  });

  it('splits one torso picture into chest and belly boxes', () => {
    const { hitAreas } = buildPack(draft()).pack;
    expect(hitAreas!.head).toEqual({ layers: ['hair.back', 'head', 'eye.L', 'eye.R', 'mouth', 'hair.front'] });
    expect(hitAreas!.chest).toEqual([[30, 50, 66, 65]]);
    expect(hitAreas!.belly).toEqual([[30, 65, 66, 80]]);
    expect(hitAreas!.armL).toEqual({ layers: ['arm.L'] });
    expect(hitAreas!.legR).toEqual({ layers: ['leg.R'] });
  });

  it('uses the two torso pictures as chest and belly, the waist at the belly top', () => {
    const two = draft(['torso.chest', 'head']);
    two.parts['torso.chest'] = rect([30, 50, 66, 64]);
    two.parts['torso.belly'] = rect([32, 62, 64, 82]);
    const { pack } = buildPack(two);
    expect(pack.hitAreas!.chest).toEqual({ layers: ['torso.chest'] });
    expect(pack.hitAreas!.belly).toEqual({ layers: ['torso.belly'] });
    expect(pack.regions.upper).toEqual([[0, 0, 96, 62]]);
    expect(pack.layers.find((l) => l.id === 'torso.chest')!.follow).toEqual(['upper']);
    expect(pack.layers.find((l) => l.id === 'torso.belly')!.follow).toEqual([]);
  });

  it('puts actions only on head, chest and belly, never on arms or legs', () => {
    const { actions } = buildPack(draft()).pack;
    expect(Object.fromEntries(Object.entries(actions!).map(([id, a]) => [id, [a.area, a.state]]))).toEqual({
      pat: ['head', 'patted'], pokeChest: ['chest', 'pouty'], pokeBelly: ['belly', 'poked']
    });
    expect(actions!.pat.tap).toBe(true);
  });

  it('uses the draft lines, neutral defaults for empty ones', () => {
    const { actions } = buildPack(draft()).pack;
    expect(actions!.pat.lines).toEqual(['좋아!']);
    expect(actions!.pokeChest.lines).toEqual(DEFAULT_LINES.pokeChest);
    expect(actions!.pokeBelly.lines).toEqual(['간지러워']);
    expect(DEFAULT_LINES.pat.length).toBeGreaterThan(0);
  });

  it('makes expressions from eye and mouth variants, reusing what exists', () => {
    const { expressions } = buildPack(draft()).pack;
    expect(expressions!.open).toEqual({ 'eye.L': 'open', 'eye.R': 'open', mouth: 'closed' });
    // eye.R has no closed picture: it keeps the open one
    expect(expressions!.closed).toEqual({ 'eye.L': 'closed', 'eye.R': 'open', mouth: 'closed' });
    expect(expressions!.talkA).toEqual({ 'eye.L': 'open', 'eye.R': 'open', mouth: 'open' });
    expect(Object.keys(expressions!)).toEqual(expect.arrayContaining(['open', 'closed', 'talkA', 'smile', 'surprised']));
    const closedOnly = buildPack(draft(['torso.chest', 'eye.L.closed', 'mouth.open'])).pack.expressions!;
    expect(closedOnly.open).toEqual({ 'eye.L': 'closed', mouth: 'open' });
  });

  it('has the template states, walking by flipping the picture', () => {
    const { states } = buildPack(draft()).pack;
    expect(Object.keys(states)).toEqual(['idle', 'patted', 'pouty', 'poked', 'dragged', 'sleep', 'celebrate', 'walkL', 'walkR']);
    expect(states.idle.blink).toBeDefined();
    expect(states.sleep.face).toBe('closed');
    expect([...(states.dragged.start ?? []), ...states.dragged.loop].some((f) => f.pose)).toBe(false);
    expect(states.walkR.loop.every((f) => f.flip === true)).toBe(true);
    expect(states.walkL.loop.some((f) => f.flip)).toBe(false);
    expect(states.walkL.loop.some((f) => f.dy)).toBe(true); // bobs
  });

  it('builds from the body alone, leaving out moves on regions it has not', () => {
    const { pack, layers } = buildPack(draft(['torso.chest'], { lines: { pat: [], pokeChest: [], pokeBelly: [] } }));
    expect(layers.map((l) => l.name)).toEqual(['torso.chest']);
    expect(Object.keys(pack.regions)).toEqual(['upper']);
    expect(pack.hitAreas!.head).toBeUndefined();
    expect(pack.actions!.pat).toBeUndefined();
    expect(Object.keys(pack.actions!)).toEqual(['pokeChest', 'pokeBelly']);
    const moved = Object.values(pack.states).flatMap((s) => [...(s.start ?? []), ...s.loop]).flatMap((f) => Object.keys(f.move ?? {}));
    expect(new Set(moved)).toEqual(new Set(['upper']));
    expect(pack.expressions!.closed).toEqual({});
  });

  it('treats an empty picture as a missing part', () => {
    const d = draft(['torso.chest', 'head']);
    d.parts.head = blank(W, H);
    expect(buildPack(d).layers.map((l) => l.name)).toEqual(['torso.chest']);
  });

  it('needs a body and standard parts of the canvas size', () => {
    expect(() => buildPack(draft(['head']))).toThrow(/몸통/);
    const empty = draft(['torso.chest']);
    empty.parts['torso.chest'] = blank(W, H);
    expect(() => buildPack(empty)).toThrow(/몸통/);
    const odd = draft(['torso.chest']);
    odd.parts['iris.L.open'] = rect([0, 0, 1, 1]);
    expect(() => buildPack(odd)).toThrow(/iris\.L\.open/);
    const small = draft(['torso.chest']);
    small.parts['torso.chest'] = blank(32, 32);
    expect(() => buildPack(small)).toThrow(/96×112/);
  });
});
