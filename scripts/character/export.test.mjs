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

  it('warns, per selectable outfit, about a pose it cannot draw (#50)', () => {
    const pack = makePack();
    pack.layers.push({ id: 'headwear', from: 'slot' });
    pack.slots.headwear = { label: 'h', variants: { cap: { label: 'c' }, none: { label: 'n' } } };
    pack.poses = { ...pack.poses, walk1: { cell: 'pose.walk1', whole: true } };
    pack.states.walk = { loop: [{ ms: 100, pose: 'walk1' }] };
    const names = ['head', 'outer.jacket', 'eye.L.closed', 'pose.stretch', 'headwear.cap', 'pose.walk1', 'outer.jacket#walk1'];
    const { errors, warnings } = checkPack(pack, cellsOf(names));
    expect(errors).toEqual([]);
    // the cap has no walk cell: every outfit with the cap is reported, with the state that walks
    expect(warnings.filter((w) => w.startsWith('의상 조합'))).toEqual([
      '의상 조합 outer.jacket + headwear.cap: 그릴 수 없는 자세 walk1 (동작 walk)',
      '의상 조합 outer.none + headwear.cap: 그릴 수 없는 자세 walk1 (동작 walk)'
    ]);
    // outfit drawings of a whole pose count as used layers
    pack.poses.walk1 = { cell: 'pose.walk1', whole: true, outfits: [{ when: { headwear: 'cap' }, cell: 'pose.walk1.cap' }] };
    expect(checkPack(pack, cellsOf([...names, 'pose.walk1.cap'])).warnings).toEqual([]);
  });

  it('takes a standard @3 pack as it is: nothing missing, unused or discovered', async () => {
    const { buildPack } = await import('../../src/domain/character/buildPack.ts');
    const { fromLegacyDraft } = await import('../../src/domain/character/standard.ts');
    const part = (x0, y0, x1, y1) => {
      const data = new Uint32Array(96 * 112);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data[y * 96 + x] = 0xff336699;
      return { w: 96, h: 112, data };
    };
    const parts = { 'torso.chest': part(30, 50, 66, 80), head: part(28, 10, 68, 48), 'eye.L.open': part(36, 26, 40, 30), 'eye.L.closed': part(36, 28, 40, 29), 'mouth.closed': part(44, 38, 52, 40), 'mouth.open': part(44, 37, 52, 42), 'custom.bow': part(60, 8, 70, 14), 'leg.L': part(36, 80, 46, 108), 'leg.R': part(50, 80, 60, 108) };
    const { pack, layers } = buildPack(fromLegacyDraft({ id: 'bean', name: '콩이', persona: '', lines: { pat: [], pokeChest: [], pokeBelly: [] }, parts, order: Object.keys(parts) }));
    const names = layers.map((l) => l.name);
    expect(checkLayers(pack, { width: 96, height: 112, frames: 1, layers: names.map((name) => ({ name, group: '' })) })).toEqual({ errors: [], warnings: [] });
    expect(discover(pack, names)).toEqual([]);
    expect(checkPack(pack, cellsOf(names))).toEqual({ errors: [], warnings: [] });
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
