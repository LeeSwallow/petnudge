import { describe, expect, it } from 'vitest';
import { checkLayers, checkPack } from './check.mjs';
import { discover } from './discover.mjs';
import { NAME, ownerOf, splitSuffix } from './names.mjs';

const makePack = () => ({
  frame: { w: 4, h: 4 },
  layers: [
    { id: 'head' },
    { id: 'outer', from: 'slot' },
    { id: 'eye.L', from: 'face' },
    { id: 'iris.L', from: 'face', clip: 'socket.L' }
  ],
  expressions: { open: {}, closed: { 'eye.L': 'closed', 'iris.L': 'none' } },
  poses: { stretch: 'pose.stretch' },
  slots: { outer: { label: 'o', variants: { jacket: { label: 'j' }, none: { label: 'n' } } } },
  states: { idle: { blink: { everyMs: 1000, ms: 100 }, loop: [{ ms: 100 }] } }
});
const cellsOf = (names) => Object.fromEntries(names.map((n) => [n, [0, 0]]));

describe('layer names', () => {
  it('splits head and pose suffixes and finds the owning layer, longest id first', () => {
    expect(splitSuffix('eye.L.smile@turnR')).toEqual({ base: 'eye.L.smile', head: 'turnR', pose: undefined });
    expect(splitSuffix('outer.jacket#stretch')).toEqual({ base: 'outer.jacket', head: undefined, pose: 'stretch' });
    expect(ownerOf(makePack(), 'eye.L.smile')).toEqual({ id: 'eye.L', variant: 'smile' });
    expect(ownerOf(makePack(), 'socket.L.open')).toEqual({ id: 'socket.L', variant: 'open' });
    expect(ownerOf(makePack(), 'tail')).toBeUndefined();
    expect(NAME.test('eye.L.open@turnL')).toBe(true);
    expect(NAME.test('눈 왼쪽')).toBe(false);
  });
});

describe('discover', () => {
  it('adds slot variants and expressions implied by new layer names', () => {
    const pack = makePack();
    const added = discover(pack, ['outer.jacket', 'outer.hoodie', 'eye.L.open', 'eye.L.closed', 'eye.L.wink', 'eye.L.wink@turnL', 'iris.L.open']);
    expect(added).toEqual(['의상 변형 outer.hoodie', '표정 wink', '표정 wink@turnL']);
    expect(pack.slots.outer.variants.hoodie).toEqual({ label: 'hoodie' });
    expect(pack.expressions.wink).toEqual({ 'eye.L': 'wink', 'iris.L': 'none' });
    expect(pack.expressions['wink@turnL']).toEqual({ 'eye.L': 'wink', 'iris.L': 'none' });
    expect(pack.expressions.closed).toEqual({ 'eye.L': 'closed', 'iris.L': 'none' }); // untouched
  });

  it('adds a new head direction once its face art exists', () => {
    const pack = makePack();
    expect(discover(pack, ['head@down', 'eye.L.open@down'])).toEqual(['표정 open@down']);
    expect(pack.expressions['open@down']).toEqual({ 'eye.L': 'open', 'iris.L': 'none' });
  });
});

describe('check', () => {
  it('rejects duplicate or malformed names and a wrong canvas', () => {
    const info = { width: 4, height: 5, frames: 1, layers: [{ name: 'head', group: 'a' }, { name: 'head', group: 'b' }, { name: 'eye L', group: '' }] };
    const { errors } = checkLayers(makePack(), info);
    expect(errors).toHaveLength(3);
    expect(errors.join('\n')).toMatch(/a\/head, b\/head/);
  });

  it('requires what the pack draws and reports layers it never uses', () => {
    const pack = makePack();
    const ok = checkPack(pack, cellsOf(['head', 'outer.jacket', 'eye.L.closed', 'pose.stretch', 'hat']));
    expect(ok.errors).toEqual([]);
    expect(ok.warnings[0]).toMatch(/hat/);
    const missing = checkPack(pack, cellsOf(['outer.jacket']));
    expect(missing.errors.join('\n')).toMatch(/head[\s\S]*eye\.L\.closed[\s\S]*pose\.stretch/);
  });
});

describe('pixelorama files', async () => {
  const { writePxo, readPxo } = await import('./pxo.mjs');
  const { encodePng, decodePng } = await import('./png.mjs');
  const { readZip, writeZip } = await import('./zip.mjs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { mkdtemp } = await import('node:fs/promises');

  it('round-trips zip entries and RGBA PNGs', () => {
    const files = readZip(writeZip([['a.txt', Buffer.from('hello')], ['b/c', Buffer.alloc(1000, 7)]]));
    expect(files.get('a.txt').toString()).toBe('hello');
    expect(files.get('b/c').length).toBe(1000);
    const rgba = Uint8Array.from({ length: 3 * 2 * 4 }, (_, i) => (i * 37) & 0xff);
    expect(decodePng(encodePng(3, 2, rgba))).toEqual({ width: 3, height: 2, rgba });
  });

  it('writes and reads layers with groups, visibility and pixels', async () => {
    const file = path.join(await mkdtemp(path.join(os.tmpdir(), 'pxo-')), 't.pxo');
    const px = (v) => Uint8Array.from({ length: 2 * 2 * 4 }, () => v);
    await writePxo(file, { width: 2, height: 2, layers: [
      { name: 'leg.L', group: 'body', visible: true, rgba: px(9) },
      { name: 'head', group: 'body', visible: false, rgba: px(0) },
      { name: 'eye.L.open', group: 'face', visible: true, rgba: px(200) }
    ] });
    const read = await readPxo(file);
    expect(read.layers.map(({ name, group, visible, empty }) => [name, group, visible, empty])).toEqual([
      ['leg.L', 'body', true, false], ['head', 'body', false, true], ['eye.L.open', 'face', true, false]
    ]);
    expect(read.layers[2].rgba[0]).toBe(200);
  });
});
