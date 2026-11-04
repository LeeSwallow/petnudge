import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { encodePng } from '../../scripts/character/png.mjs';
import { writePxo } from '../../scripts/character/pxo.mjs';
import { bounds } from '../domain/character/pixels';
import { characterDraft, imageFromPng, layersFromBytes, layersFromFile } from './editorImport';

const root = path.resolve(__dirname, '../../assets/characters');
const square = (w: number, h: number, [x0, y0, x1, y1]: number[], rgb = [255, 0, 0]) => {
  const rgba = new Uint8Array(w * h * 4);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) rgba.set([...rgb, 255], (y * w + x) * 4);
  return rgba;
};

let dir = '';
afterAll(() => rm(dir, { recursive: true, force: true }));

describe('importing one picture', () => {
  it('decodes a PNG at its own size, colours exact (the editor fits it to its canvas)', () => {
    const { name, pixels } = imageFromPng('me.png', encodePng(10, 4, square(10, 4, [0, 0, 10, 4], [12, 34, 56])));
    expect(name).toBe('me.png');
    expect([pixels.w, pixels.h, bounds(pixels)]).toEqual([10, 4, [0, 0, 10, 4]]);
    expect(pixels.data[0].toString(16)).toBe('ff38220c');
  });

  it('refuses a picture bigger than the largest canvas with the size guidance', () => {
    expect(imageFromPng('ok.png', encodePng(100, 20, new Uint8Array(100 * 20 * 4))).pixels.w).toBe(100);
    expect(() => imageFromPng('big.png', encodePng(170, 20, new Uint8Array(170 * 20 * 4)))).toThrow('160×192 이하로 줄여 주세요');
  });

  it('refuses something that is not a PNG', () => {
    expect(() => imageFromPng('x.png', new Uint8Array([1, 2, 3]))).toThrow('PNG가 아니에요');
  });
});

describe('importing a layered file', () => {
  it('reads every layer of a .pxo, from a file or from bytes', async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'petnudge-import-test-'));
    const file = path.join(dir, 'parts.pxo');
    await writePxo(file, {
      width: 96,
      height: 112,
      layers: [
        { name: 'torso.chest', group: '', rgba: square(96, 112, [30, 50, 60, 100]) },
        { name: 'Layer 2', group: 'extra', rgba: square(96, 112, [10, 10, 12, 12]) }
      ]
    });
    const layers = await layersFromFile(file);
    expect(layers.map((l) => [l.name, bounds(l.pixels)])).toEqual([['torso.chest', [30, 50, 60, 100]], ['Layer 2', [10, 10, 12, 12]]]);
    const again = await layersFromBytes('parts.pxo', await readFile(file));
    expect(again.map((l) => l.name)).toEqual(['torso.chest', 'Layer 2']);
  });

  it('refuses other kinds of files', async () => {
    await expect(layersFromBytes('art.psd', new Uint8Array(4))).rejects.toThrow('.pxo나 .aseprite');
  });
});

describe('importing another character', () => {
  it('converts lila (@2) to parts and lists what it drops', async () => {
    const { draft, dropped } = await characterDraft({ source: path.join(root, 'lila/lila.pxo'), manifest: path.join(root, 'lila/lila.pack.json') });
    expect(draft.id).toBe('lila');
    expect(draft.parts.map((p) => p.id)).toEqual(expect.arrayContaining(['body', 'head', 'hair.front', 'leg.l', 'leg.r']));
    expect(draft.canvas).toEqual({ w: 96, h: 112 });
    expect(draft.parts.every((p) => p.pixels.w === 96 && p.pixels.h === 112)).toBe(true);
    expect(dropped.length).toBeGreaterThan(0);
    expect(dropped.every((d) => d.reason.length > 0)).toBe(true);
  });
});
