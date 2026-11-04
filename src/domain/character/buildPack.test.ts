import { describe, expect, it } from 'vitest';
import { buildPack, DEFAULT_LINES } from './buildPack';
import type { Box, FrameDef } from './pack';
import type { CharacterDraft, Part } from './parts';
import { blank, hexToPixel, type Pixels } from './pixels';
import { fromTemplate, type TemplateId } from './standard';

type Rect = [number, number, number, number];
const rectOn = (w: number, h: number, [x0, y0, x1, y1]: Rect, color = '#336699'): Pixels => {
  const px = blank(w, h);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) px.data[y * w + x] = hexToPixel(color);
  return px;
};

// Synthetic art for each template, as fractions of the canvas (so one table
// fits every proportion): [x0, y0, x1, y1] in 1/16ths of width and height.
const ART: Record<string, Rect> = {
  body: [5, 6, 11, 12], 'leg.l': [6, 12, 8, 15], 'leg.r': [8, 12, 10, 15], 'foot.l': [5, 12, 7, 15], 'foot.r': [9, 12, 11, 15],
  'arm.l': [3, 6, 5, 10], 'arm.r': [11, 6, 13, 10], head: [4, 1, 12, 6], 'eye.l': [6, 3, 7, 4], 'eye.r': [9, 3, 10, 4], mouth: [7, 5, 9, 6],
  'hair.back': [4, 1, 12, 5], 'hair.front': [4, 1, 12, 2]
};
const CRITTER_EYES: Record<string, Rect> = { 'eye.l': [6, 8, 7, 9], 'eye.r': [9, 8, 10, 9], mouth: [7, 10, 9, 11] };

const filled = (template: TemplateId): CharacterDraft => {
  const d = fromTemplate(template);
  const { w, h } = d.canvas;
  const at = ([x0, y0, x1, y1]: Rect): Rect => [Math.floor((x0 * w) / 16), Math.floor((y0 * h) / 16), Math.floor((x1 * w) / 16), Math.floor((y1 * h) / 16)];
  const art = { ...ART, ...(template === 'critter' || template === 'floater' ? CRITTER_EYES : {}) };
  const parts: Part[] = d.parts.map((p) => {
    const box = at(art[p.id]);
    const pixels = rectOn(w, h, box);
    if (p.role === 'eye') return { ...p, pixels, variants: { closed: rectOn(w, h, [box[0], box[1] + 1, box[2], box[1] + 2]) } };
    if (p.role === 'mouth') return { ...p, pixels, variants: { open: rectOn(w, h, [box[0], box[1], box[2], box[3] + 1]) } };
    return { ...p, pixels };
  });
  return { ...d, id: 'bean', name: '콩이', persona: '느긋한 친구', lines: { pat: ['좋아!'], pokeChest: [], pokeBelly: ['  ', '간지러워'] }, parts };
};

const grown = ([x0, y0, x1, y1]: Box, w: number, h: number): Box => [Math.max(0, x0 - 1), Math.max(0, y0 - 1), Math.min(w, x1 + 1), Math.min(h, y1 + 1)];
const framesOf = (states: Record<string, { start?: FrameDef[]; loop: FrameDef[] }>) => Object.values(states).flatMap((s) => [...(s.start ?? []), ...s.loop]);

describe('buildPack', () => {
  it('makes a standard @3 pack with the draft identity, canvas and part structure', () => {
    const { pack } = buildPack(filled('lila'));
    expect(pack).toMatchObject({ format: 'study-pet-character@3', id: 'bean', name: '콩이', persona: '느긋한 친구', frame: { w: 96, h: 112 }, fallback: 'idle' });
    expect(pack.editor).toMatchObject({ version: 1, body: { kind: 'biped', merged: false } });
    expect(pack.editor!.parts!.find((p) => p.id === 'eye.l')).toEqual({ id: 'eye.l', label: '왼눈', parent: 'head', role: 'eye' });
  });

  it.each(['floater', 'critter', 'chibi', 'lila', 'tall'] as const)('builds the %s template at its own canvas size', (template) => {
    const d = filled(template);
    const { w, h } = d.canvas;
    const { pack, layers } = buildPack(d);
    expect(pack.frame).toEqual({ w, h });
    // one layer per drawn part, back to front; face parts carry their variants as cells
    expect(pack.layers.map((l) => l.id)).toEqual(d.parts.map((p) => p.id));
    expect(pack.layers.filter((l) => l.from === 'face').map((l) => l.id)).toEqual(['eye.l', 'eye.r', 'mouth']);
    expect(layers.map((l) => l.name)).toEqual(d.parts.flatMap((p) => (p.role === 'eye' ? [`${p.id}.open`, `${p.id}.closed`] : p.role === 'mouth' ? ['mouth.closed', 'mouth.open'] : [p.id])));
    expect(layers.every((l) => l.pixels.w === w && l.pixels.h === h)).toBe(true);
    expect(layers.map((l) => pack.cells[l.name])).toEqual(layers.map((_, i) => [i * w, 0]));
    // a region per part: its box grown by 1px, inside the canvas; the eyes region for glances
    const boxOf = (id: string) => {
      const p = d.parts.find((q) => q.id === id)!;
      const all = [p.pixels, ...Object.values(p.variants ?? {})];
      let [x0, y0, x1, y1] = [w, h, 0, 0];
      for (const px of all) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px.data[y * w + x]) [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x + 1), Math.max(y1, y + 1)];
      return [x0, y0, x1, y1] as Box;
    };
    for (const p of d.parts) expect(pack.regions[p.id]).toEqual([grown(boxOf(p.id), w, h)]);
    expect(pack.regions.eyes).toEqual([boxOf('eye.l'), boxOf('eye.r')]);
    // every layer follows its ancestors' regions and its own, eyes also glance
    const follow = Object.fromEntries(pack.layers.map((l) => [l.id, l.follow]));
    if (template === 'floater') {
      expect(follow).toEqual({ body: ['body'], 'eye.l': ['body', 'eye.l', 'eyes'], 'eye.r': ['body', 'eye.r', 'eyes'], mouth: ['body', 'mouth'] });
    } else if (template === 'critter') {
      expect(follow).toEqual({ 'foot.l': ['foot.l'], 'foot.r': ['foot.r'], body: ['body'], 'eye.l': ['body', 'eye.l', 'eyes'], 'eye.r': ['body', 'eye.r', 'eyes'], mouth: ['body', 'mouth'] });
    } else {
      expect(follow).toMatchObject({ body: ['body'], 'leg.l': ['leg.l'], 'arm.r': ['body', 'arm.r'], head: ['body', 'head'], 'eye.l': ['body', 'head', 'eye.l', 'eyes'], mouth: ['body', 'head', 'mouth'], 'hair.front': ['body', 'head', 'hair.front'] });
    }
    // feet on the ground: the lowest foot pixel, or the lowest pixel of a body without feet
    const feet = d.parts.filter((p) => p.role === 'foot');
    expect(pack.feetY).toBe(Math.max(...(feet.length ? feet : d.parts).map((p) => boxOf(p.id)[3])));
    // template moves only name regions it has, and every state is there
    expect(Object.keys(pack.states)).toEqual(['idle', 'patted', 'pouty', 'poked', 'dragged', 'sleep', 'celebrate', 'walkL', 'walkR']);
    for (const f of framesOf(pack.states)) for (const r of Object.keys(f.move ?? {})) expect(pack.regions[r]).toBeDefined();
  });

  it('moves "head" template moves on the head, or on the body when it is one piece', () => {
    const headMoves = (template: TemplateId) => new Set(buildPack(filled(template)).pack.states.sleep.loop.flatMap((f) => Object.keys(f.move ?? {})));
    expect(headMoves('lila')).toEqual(new Set(['head', 'body']));
    expect(headMoves('critter')).toEqual(new Set(['body']));
    const walk = buildPack(filled('critter')).pack.states.walkL.loop;
    expect(walk.flatMap((f) => Object.keys(f.move ?? {}))).toEqual(['foot.l', 'foot.r']); // the left foot is the one on the left
    expect(buildPack(filled('chibi')).pack.states.walkL.loop[1].move).toEqual({ 'leg.l': [0, -1], 'arm.r': [0, 1] });
  });

  it('makes hit areas from roles', () => {
    const lila = buildPack(filled('lila')).pack.hitAreas!;
    // the head and everything on it
    expect(lila.head).toEqual({ layers: ['hair.back', 'head', 'eye.l', 'eye.r', 'mouth', 'hair.front'] });
    // one body picture: chest and belly split at its middle
    const [x0, y0, x1, y1] = [30, 42, 66, 84];
    expect(lila.chest).toEqual([[x0, y0, x1, 63]]);
    expect(lila.belly).toEqual([[x0, 63, x1, y1]]);
    expect(lila.armL).toEqual({ layers: ['arm.l'] });
    expect(lila.legR).toEqual({ layers: ['leg.r'] });
    // a one-piece body: the top half is the head, the rest chest and belly
    const critter = buildPack(filled('critter')).pack.hitAreas!;
    expect(critter.head).toEqual([[22, 27, 49, 40]]);
    expect(critter.chest).toEqual([[22, 40, 49, 47]]);
    expect(critter.belly).toEqual([[22, 47, 49, 54]]);
    expect(critter.armL).toBeUndefined();
  });

  it('puts actions on head, chest and belly with the draft lines, neutral ones for the empty', () => {
    const { actions } = buildPack(filled('critter')).pack;
    expect(Object.fromEntries(Object.entries(actions!).map(([id, a]) => [id, [a.area, a.state]]))).toEqual({ pat: ['head', 'patted'], pokeChest: ['chest', 'pouty'], pokeBelly: ['belly', 'poked'] });
    expect(actions!.pat.lines).toEqual(['좋아!']);
    expect(actions!.pokeChest.lines).toEqual(DEFAULT_LINES.pokeChest);
    expect(actions!.pokeBelly.lines).toEqual(['간지러워']);
  });

  it('makes expressions from eye and mouth variants, and the draft\'s own expressions', () => {
    const d = filled('chibi');
    const { expressions, states } = buildPack(d).pack;
    expect(expressions!.open).toEqual({ 'eye.l': 'open', 'eye.r': 'open', mouth: 'closed' });
    expect(expressions!.closed).toEqual({ 'eye.l': 'closed', 'eye.r': 'closed', mouth: 'closed' });
    expect(expressions!.talkA).toEqual({ 'eye.l': 'open', 'eye.r': 'open', mouth: 'open' });
    expect(states.idle.blink).toBeDefined();
    // an eye without a closed picture keeps its open one
    d.parts = d.parts.map((p) => (p.id === 'eye.r' ? { ...p, variants: undefined } : p));
    expect(buildPack(d).pack.expressions!.closed).toMatchObject({ 'eye.l': 'closed' });
    expect(buildPack(d).pack.layers.find((l) => l.id === 'eye.r')!.from).toBeUndefined();
    // a named expression: variants per part, the rest at rest
    const wink = buildPack({ ...filled('chibi'), expressions: { wink: { 'eye.l': 'closed' } } }).pack.expressions!;
    expect(wink.wink).toEqual({ 'eye.l': 'closed', 'eye.r': 'open', mouth: 'closed' });
  });

  it('walks by flipping the picture and bobbing', () => {
    const { states } = buildPack(filled('tall')).pack;
    expect(states.walkR.loop.every((f) => f.flip === true)).toBe(true);
    expect(states.walkL.loop.some((f) => f.flip)).toBe(false);
    expect(states.walkL.loop.some((f) => f.dy)).toBe(true);
  });

  it('a child follows a new parent: changing the parent changes the follow chain only', () => {
    const d = filled('lila');
    d.parts = d.parts.map((p) => (p.id === 'hair.front' ? { ...p, parent: 'root' } : p));
    expect(buildPack(d).pack.layers.find((l) => l.id === 'hair.front')!.follow).toEqual(['hair.front']);
  });

  it('leaves empty parts out, also from follow chains', () => {
    const d = filled('lila');
    d.parts = d.parts.map((p) => (p.id === 'head' ? { ...p, pixels: blank(96, 112) } : p.id === 'arm.l' ? { ...p, pixels: blank(96, 112) } : p));
    d.body = { kind: 'biped', merged: true };
    const { pack } = buildPack(d);
    expect(pack.layers.map((l) => l.id)).not.toContain('head');
    expect(pack.layers.find((l) => l.id === 'eye.l')!.follow).toEqual(['body', 'eye.l', 'eyes']);
    expect(pack.regions.head).toBeUndefined();
  });

  it('refuses a draft without a body, or without a head when the body is not one piece', () => {
    const d = filled('lila');
    expect(() => buildPack({ ...d, parts: d.parts.filter((p) => p.role !== 'body') })).toThrow(/몸/);
    expect(() => buildPack({ ...d, parts: d.parts.filter((p) => p.id !== 'head') })).toThrow(/머리/);
    expect(() => buildPack({ ...d, parts: d.parts.filter((p) => p.id !== 'leg.r') })).not.toThrow(); // feet are optional
  });

  it('builds a legless floating body: no feet, it hovers instead of stepping', () => {
    const d = filled('floater');
    const { pack } = buildPack(d);
    expect(pack.editor!.body).toEqual({ kind: 'legless', merged: true });
    expect(Object.keys(pack.regions)).toEqual(['body', 'eye.l', 'eye.r', 'mouth', 'eyes']);
    // hit areas from roles: the one-piece body split into head, chest and belly
    expect(Object.keys(pack.hitAreas!)).toEqual(['head', 'chest', 'belly']);
    expect(Object.keys(pack.actions!)).toEqual(['pat', 'pokeChest', 'pokeBelly']);
    // walking: the whole body bobs up and down, no part steps; flipped toward where it goes
    const walk = pack.states.walkL.loop;
    expect(walk.flatMap((f) => Object.keys(f.move ?? {}))).toEqual([]);
    expect(new Set(walk.map((f) => f.dy ?? 0)).size).toBeGreaterThan(1);
    expect(walk.every((f) => (f.dy ?? 0) <= 0)).toBe(true);
    expect(pack.states.walkR.loop.every((f) => f.flip)).toBe(true);
    expect(pack.states.walkR.loop.map((f) => f.dy)).toEqual(walk.map((f) => f.dy));
    // expressions from the eyes and the mouth, blinking too
    expect(pack.expressions!.closed).toEqual({ 'eye.l': 'closed', 'eye.r': 'closed', mouth: 'closed' });
    expect(pack.expressions!.talkA).toMatchObject({ mouth: 'open' });
    expect(pack.states.idle.blink).toBeDefined();
    // no state moves a region it does not have
    for (const f of framesOf(pack.states)) for (const r of Object.keys(f.move ?? {})) expect(pack.regions[r]).toBeDefined();
  });

  it('a critter without feet hops: squash, then up, the whole body', () => {
    const d = filled('critter');
    const { pack } = buildPack({ ...d, parts: d.parts.filter((p) => p.role !== 'foot') });
    const walk = pack.states.walkL.loop;
    expect(Math.min(...walk.map((f) => f.dy ?? 0))).toBeLessThanOrEqual(-2);
    expect(walk.some((f) => f.move?.body)).toBe(true); // the squash before the hop
    expect(walk.flatMap((f) => Object.keys(f.move ?? {})).every((r) => r === 'body')).toBe(true);
    expect(pack.feetY).toBe(54); // the body's lowest pixel (12/16 of 72)
  });
});
