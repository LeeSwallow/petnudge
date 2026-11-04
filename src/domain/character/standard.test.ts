import { describe, expect, it } from 'vitest';
import { draftProblems } from './parts';
import { blank, bounds, hexToPixel, type Pixels } from './pixels';
import { fromLegacyDraft, fromTemplate, legacyPart, TEMPLATES } from './standard';

const rect = ([x0, y0, x1, y1]: [number, number, number, number], w = 96, h = 112): Pixels => {
  const px = blank(w, h);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) px.data[y * w + x] = hexToPixel('#336699');
  return px;
};

describe('starter templates', () => {
  it('are five starting points, from a floating body to a tall person', () => {
    expect(TEMPLATES.map((t) => [t.id, t.kind, t.canvas.w, t.canvas.h, t.merged])).toEqual([
      ['floater', 'legless', 64, 64, true],
      ['critter', 'biped', 72, 72, true],
      ['chibi', 'biped', 80, 96, false],
      ['lila', 'biped', 96, 112, false],
      ['tall', 'biped', 64, 160, false]
    ]);
    expect(fromTemplate('floater').parts.map((p) => [p.id, p.role, p.parent])).toEqual([['body', 'body', 'root'], ['eye.l', 'eye', 'body'], ['eye.r', 'eye', 'body'], ['mouth', 'mouth', 'body']]);
    expect(TEMPLATES.every((t) => t.label.length > 0)).toBe(true);
  });

  it('prefill empty parts with roles and parents, back to front', () => {
    const critter = fromTemplate('critter');
    expect(critter.canvas).toEqual({ w: 72, h: 72 });
    expect(critter.body).toEqual({ kind: 'biped', merged: true });
    expect(critter.parts.map((p) => [p.id, p.role, p.parent])).toEqual([
      ['foot.l', 'foot', 'root'], ['foot.r', 'foot', 'root'], ['body', 'body', 'root'], ['eye.l', 'eye', 'body'], ['eye.r', 'eye', 'body'], ['mouth', 'mouth', 'body']
    ]);
    const lila = fromTemplate('lila');
    expect(lila.parts.map((p) => p.id)).toEqual(['hair.back', 'body', 'leg.l', 'leg.r', 'arm.l', 'arm.r', 'head', 'eye.l', 'eye.r', 'mouth', 'hair.front']);
    expect(Object.fromEntries(lila.parts.map((p) => [p.id, p.parent]))).toMatchObject({ head: 'body', 'eye.l': 'head', 'arm.r': 'body', 'leg.l': 'root', 'hair.back': 'head' });
    for (const t of TEMPLATES) {
      const d = fromTemplate(t.id);
      expect(d.parts.every((p) => p.pixels.w === t.canvas.w && p.pixels.h === t.canvas.h && !bounds(p.pixels))).toBe(true);
      // only missing pictures are wrong with a fresh template
      expect(new Set(draftProblems(d).map((p) => p.code))).toEqual(new Set(t.merged ? ['body'] : ['body', 'head']));
    }
  });

  it('starts a fresh draft each time', () => {
    const a = fromTemplate('chibi');
    a.parts[0].pixels.data[0] = 1;
    expect(fromTemplate('chibi').parts[0].pixels.data[0]).toBe(0);
  });
});

describe('older drafts with the fixed layer names', () => {
  it('maps each old layer name to a part and variant', () => {
    expect(legacyPart('torso.chest')).toMatchObject({ id: 'body', role: 'body' });
    expect(legacyPart('torso.belly')).toMatchObject({ id: 'belly', role: 'body', parent: 'root' });
    expect(legacyPart('eye.L.closed')).toMatchObject({ id: 'eye.l', role: 'eye', variant: 'closed', parent: 'head' });
    expect(legacyPart('mouth.open')).toMatchObject({ id: 'mouth', role: 'mouth', variant: 'open' });
    expect(legacyPart('leg.R')).toMatchObject({ id: 'leg.r', role: 'foot', parent: 'root' });
    expect(legacyPart('custom.Ribbon')).toMatchObject({ id: 'ribbon', role: 'accessory' });
    expect(legacyPart('iris.L.open')).toBeUndefined();
  });

  it('turns an old draft into parts, keeping pictures, order and variants', () => {
    const old = {
      id: 'bean', name: '콩이', persona: '', lines: { pat: [], pokeChest: [], pokeBelly: [] },
      parts: {
        'torso.chest': rect([30, 50, 66, 80]), head: rect([28, 10, 68, 48]), 'leg.L': rect([36, 80, 46, 108]), 'leg.R': rect([50, 80, 60, 108]),
        'eye.L.open': rect([36, 26, 40, 30]), 'eye.L.closed': rect([36, 28, 40, 29]), 'mouth.closed': rect([44, 38, 52, 40]), 'mouth.open': rect([44, 37, 52, 42]),
        'custom.bow': rect([60, 8, 70, 14]), 'custom.tail': rect([70, 70, 80, 80])
      },
      order: ['leg.L', 'leg.R', 'torso.chest', 'head', 'eye.L.open', 'eye.L.closed', 'mouth.closed', 'mouth.open', 'custom.bow', 'custom.tail']
    };
    const d = fromLegacyDraft(old);
    expect(d.canvas).toEqual({ w: 96, h: 112 });
    expect(d.body).toEqual({ kind: 'biped', merged: false });
    expect(d.parts.map((p) => [p.id, p.parent])).toEqual([
      ['leg.l', 'root'], ['leg.r', 'root'], ['body', 'root'], ['head', 'body'], ['eye.l', 'head'], ['mouth', 'head'], ['bow', 'head'], ['tail', 'root']
    ]);
    const eye = d.parts.find((p) => p.id === 'eye.l')!;
    expect(eye.pixels).toBe(old.parts['eye.L.open']);
    expect(eye.variants).toEqual({ closed: old.parts['eye.L.closed'] });
    expect(d.parts.find((p) => p.id === 'mouth')!.variants).toEqual({ open: old.parts['mouth.open'] });
    expect(draftProblems(d)).toEqual([]);
  });

  it('a draft without a head is a merged body; a closed eye alone is the eye at rest', () => {
    const d = fromLegacyDraft({
      id: 'x', name: 'x', persona: '', lines: { pat: [], pokeChest: [], pokeBelly: [] }, order: [],
      parts: { 'torso.chest': rect([30, 50, 66, 80]), 'eye.R.closed': rect([56, 28, 60, 29]), 'iris.L.open': rect([0, 0, 1, 1]) }
    });
    expect(d.body.merged).toBe(true);
    // the eye's parent, the head, is missing: it hangs on the head's parent; a name with no part is left out
    expect(d.parts.map((p) => [p.id, p.parent])).toEqual([['body', 'root'], ['eye.r', 'body']]);
    expect(d.parts.find((p) => p.id === 'eye.r')!.variants).toBeUndefined();
  });
});
