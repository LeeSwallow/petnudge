import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readPxo } from './pxo.mjs';
import { convertPack } from '../../src/domain/character/convert.ts';
import { buildPack } from '../../src/domain/character/buildPack.ts';
import { blank, clipTo, hexToPixel, over, recolor, rimUnder } from '../../src/domain/character/pixels.ts';
import { layerCells, recolorsFor } from '../../src/shared/characterPack.ts';
import { validateImportedPack } from '../../src/shared/characterImport.ts';

// The three built-in @2 packs, converted to drafts of parts from their real
// source art (.pxo), as the editor's "start from an existing character" does.

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../assets/characters');
const W = 96;
const H = 112;

const load = async (id) => {
  const pack = JSON.parse(await readFile(path.join(root, id, `${id}.pack.json`), 'utf8'));
  const pxo = await readPxo(path.join(root, id, `${id}.pxo`));
  const layers = pxo.layers.map((l) => ({ name: l.name, pixels: { w: pxo.width, h: pxo.height, data: new Uint32Array(l.rgba.buffer.slice(l.rgba.byteOffset, l.rgba.byteOffset + l.rgba.length)) } }));
  // The pack JSON has no cells (export adds them): each layer is a cell of its name.
  pack.cells = Object.fromEntries(layers.map((l) => [l.name, [0, 0]]));
  return { pack, layers };
};

// The front view the renderer draws for the default avatar, open face, no
// moves (frame 1 of idle): the same steps as frameFor in src/renderer/character.ts,
// minus the device-pixel outline. `edges: false` leaves out the contact rims.
const frontView = (pack, pictures, { edges = true } = {}) => {
  const out = blank(W, H);
  for (const { layer, cell, def, clip } of layerCells(pack, {}, 'open')) {
    const px = { w: W, h: H, data: pictures.get(cell).data.slice() };
    for (const r of recolorsFor(pack, {})) {
      if (r.layers && !r.layers.includes(layer)) continue;
      recolor(px, new Map(Object.entries(r.map).map(([a, b]) => [hexToPixel(a), hexToPixel(b)])), r.region ? pack.regions[r.region] : undefined);
    }
    const drawn = clip ? clipTo(px, pictures.get(clip)) : px;
    if (edges && def.edge) rimUnder(out, drawn, hexToPixel(def.edge.color), def.edge.opacity, def.edge.light ? hexToPixel(def.edge.light) : undefined);
    over(out, drawn);
  }
  return out;
};

const diff = (a, b) => {
  const at = [];
  for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) at.push(i);
  return at;
};

const convert = async (id) => {
  const { pack, layers } = await load(id);
  const { draft, dropped } = convertPack(pack, layers);
  const built = buildPack(draft);
  const pictures = new Map(layers.map((l) => [l.name, l.pixels]));
  return {
    pack, layers, draft, dropped, built,
    before: frontView(pack, pictures),
    beforeWithoutRims: frontView(pack, pictures, { edges: false }),
    after: frontView(built.pack, new Map(built.layers.map((l) => [l.name, l.pixels])))
  };
};

// How far the converted front view may differ from the original, beyond the
// contact rims (below). Merging moves a layer to its part's place in the
// drawing order: maru's neck, drawn over the hoodie in @2, goes into the
// torso, which is drawn under the hoodie decoration, so 3 neck pixels at the
// collar end up under it. lila and moa have no such overlap.
const REORDER_TOLERANCE = 4;

describe.each(['lila', 'moa', 'maru'])('converting %s', (id) => {
  it('makes a draft that builds into a pack the importer accepts', async () => {
    const { built } = await convert(id);
    expect(() => validateImportedPack(JSON.parse(JSON.stringify(built.pack)), built.layers.length * W, H)).not.toThrow();
    expect(built.layers.map((l) => l.name)).toEqual(expect.arrayContaining(['body', 'belly', 'head', 'leg.l', 'leg.r', 'eye.l.open', 'eye.l.closed', 'mouth.closed', 'mouth.open', 'outer', 'headwear']));
  });

  it('carries over the persona and the reaction lines', async () => {
    const { pack, draft } = await convert(id);
    expect(draft.persona).toBe(pack.persona);
    expect(draft.lines).toEqual({ pat: pack.actions.pat.lines, pokeChest: pack.actions.pokeChest.lines, pokeBelly: pack.actions.pokeBelly.lines });
  });

  it('lists every layer it leaves out with a reason, and leaves out nothing the front view draws', async () => {
    const { pack, layers, draft, dropped } = await convert(id);
    const names = new Set(dropped.map((d) => d.name));
    expect(dropped.length).toBeGreaterThan(0);
    expect(dropped.every((d) => /[가-힣]/.test(d.reason))).toBe(true);
    for (const name of layers.map((l) => l.name)) if (/[@#]/.test(name) || name.startsWith('pose.') || name.startsWith('socket.')) expect(names).toContain(name);
    for (const { cell } of layerCells(pack, {}, 'open')) expect(names).not.toContain(cell);
    // each left-out layer is listed once
    expect(names.size).toBe(dropped.length);
    expect(draft.parts.length).toBeGreaterThan(0);
  });

  it('looks like the original from the front, but for the contact rims and a few reordered pixels', async () => {
    const { before, beforeWithoutRims, after } = await convert(id);
    // The @2 packs draw a 1px contact rim (`edge`) under shoes, bottom and
    // outfits; the standard pack has no rims, so those blended pixels go back
    // to what is under them. Everything else matches but for the reorder above.
    const reordered = diff(beforeWithoutRims, after);
    expect(reordered.length).toBeLessThanOrEqual(REORDER_TOLERANCE);
    const rims = new Set(diff(before, beforeWithoutRims));
    expect(diff(before, after).filter((i) => !rims.has(i) && !reordered.includes(i))).toEqual([]);
  });
});

describe('converting lila', () => {
  it('leaves out the turned head, the walk poses and the other outfits, saying why', async () => {
    const { dropped } = await convert('lila');
    const why = Object.fromEntries(dropped.map((d) => [d.name, d.reason]));
    expect(why['head@turnL']).toMatch(/고개/);
    expect(why['pose.walk1']).toMatch(/자세/);
    expect(why['hair.back#walk1']).toMatch(/자세/);
    expect(why['outer.cardigan']).toMatch(/jacket/);
    expect(why['eye.L.smile']).toMatch(/표정/);
    expect(why['socket.L.open']).toMatch(/마스크/);
  });
});

describe('converting maru', () => {
  it('leaves out the back hair the default shark hood hides', async () => {
    const { draft, dropped } = await convert('maru');
    expect(draft.parts.find((p) => p.id === 'hair.back')).toBeUndefined();
    expect(dropped.find((d) => d.name === 'hair.back')?.reason).toMatch(/headwear\.sharkhood/);
  });
});
