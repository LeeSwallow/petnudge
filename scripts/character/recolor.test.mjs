import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { recolorLayers } from './recolor.mjs';
import { readPxo, writePxo } from './pxo.mjs';

// 2×2 layers, RGBA bytes
const layer = (name, pixels) => ({ name, group: 'g', visible: true, rgba: new Uint8Array(pixels.flat()) });
const PALE = [0xfb, 0xf2, 0xf5, 255];
const SKIN = [0xfd, 0xdf, 0xdf, 255];
const NONE = [0, 0, 0, 0];

describe('recolorLayers', () => {
  it('swaps exact colours only in the named layers', () => {
    const layers = [layer('pose.walk1', [PALE, PALE, SKIN, NONE]), layer('head', [PALE, NONE, NONE, NONE])];
    const changed = recolorLayers(layers, [{ layers: ['pose.walk1'], map: { '#fbf2f5': '#fddfdf' } }], 2);
    expect(changed).toEqual({ 'pose.walk1': 2 });
    expect([...layers[0].rgba]).toEqual([SKIN, SKIN, SKIN, NONE].flat());
    expect([...layers[1].rgba]).toEqual([PALE, NONE, NONE, NONE].flat());
  });

  it('keeps to the boxes, takes a pattern for layer names and applies rules in order', () => {
    const layers = [layer('pose.walk1.jacket', [PALE, PALE, PALE, PALE])];
    recolorLayers(layers, [
      { layers: '^pose\\.walk\\d\\.jacket$', map: { '#fbf2f5': '#fddfdf' }, boxes: [[0, 0, 1, 2]] },
      { layers: '^pose', map: { '#fddfdf': '#000000', '#fbf2f5': '#f8edf4' } }
    ], 2);
    const out = [...layers[0].rgba];
    expect(out.slice(0, 4)).toEqual([0, 0, 0, 255]); // swapped twice: rules run in order
    expect(out.slice(4, 8)).toEqual([0xf8, 0xed, 0xf4, 255]);
  });

  it('round-trips through a .pxo file', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'recolor-'));
    try {
      const file = path.join(dir, 'x.pxo');
      await writePxo(file, { width: 2, height: 2, layers: [layer('pose.walk1', [PALE, NONE, NONE, PALE])] });
      const pxo = await readPxo(file);
      recolorLayers(pxo.layers, [{ layers: ['pose.walk1'], map: { '#fbf2f5': '#fddfdf' } }], 2);
      await writePxo(file, pxo);
      expect([...(await readPxo(file)).layers[0].rgba]).toEqual([SKIN, NONE, NONE, SKIN].flat());
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
