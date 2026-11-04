import { describe, expect, it } from 'vitest';
import { buildPack } from './buildPack';
import { convertPack } from './convert';
import type { CharacterPack, LayerDef } from './pack';
import { blank, hexToPixel, type Pixels } from './pixels';

const W = 96;
const H = 112;
type Rect = [number, number, number, number];
const rect = ([x0, y0, x1, y1]: Rect, color = '#336699'): Pixels => {
  const px = blank(W, H);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) px.data[y * W + x] = hexToPixel(color);
  return px;
};
const at = (px: Pixels, x: number, y: number) => px.data[y * W + x];
const C = (hex: string) => hexToPixel(hex);

const layer = (id: string, extra: Partial<LayerDef> = {}): LayerDef => ({ id, ...extra });

// A small @2 pack shaped like the built-in ones: two torso pictures, shoes,
// iris clipped by sockets, shade, outfit slots, turned heads and walk poses.
const makePack = (patch: Partial<CharacterPack> = {}): CharacterPack => ({
  format: 'study-pet-character@2',
  id: 'bean',
  name: '콩이',
  persona: '느긋한 친구',
  frame: { w: W, h: H },
  feetY: 110,
  sheet: 'sheet.png',
  cells: {},
  layers: [
    layer('hair.back', { follow: ['upper', 'head'] }),
    layer('leg.L', { follow: ['legL'] }),
    layer('leg.R', { follow: ['legR'] }),
    layer('shoe.L', { follow: ['legL'] }),
    layer('shoe.R', { follow: ['legR'] }),
    layer('arm.L'),
    layer('arm.R'),
    layer('torso.belly', { follow: [] }),
    layer('torso.chest', { follow: ['upper'] }),
    layer('bottom', { follow: [] }),
    layer('outer', { from: 'slot' }),
    layer('neck', { follow: ['upper'] }),
    layer('head', { follow: ['upper', 'head'] }),
    layer('shade', { from: 'face' }),
    layer('mouth', { from: 'face' }),
    layer('eye.L', { from: 'face' }),
    layer('eye.R', { from: 'face' }),
    layer('iris.L', { from: 'face', clip: 'socket.L' }),
    layer('iris.R', { from: 'face', clip: 'socket.R' }),
    layer('hair.front'),
    layer('armfront.L', { follow: ['upper'] }),
    layer('headwear', { from: 'slot' })
  ],
  expressions: {
    open: { 'iris.L': 'open', 'iris.R': 'open' },
    closed: { 'eye.L': 'closed', 'eye.R': 'closed', 'iris.L': 'none', 'iris.R': 'none', mouth: 'closed', shade: 'closed' },
    smile: { 'eye.L': 'smile', 'iris.L': 'none', mouth: 'smile' },
    talkA: { mouth: 'talkA' }
  },
  regions: { upper: [[0, 0, 96, 52]], head: [[0, 0, 96, 42]] },
  states: { idle: { loop: [{ ms: 500 }] } },
  slots: {
    hair: { label: '머리색', variants: { ink: { label: '먹색', recolor: { layers: ['hair.front'], map: { '#aa00aa': '#112233' } } }, pink: { label: '분홍' } } },
    outer: { label: '아우터', variants: { jacket: { label: '재킷' }, hoodie: { label: '후디' }, none: { label: '없음' } } },
    headwear: { label: '모자', variants: { none: { label: '없음' }, cap: { label: '모자' } } }
  },
  fallback: 'idle',
  actions: {
    pat: { label: '쓰다듬기', area: 'head', state: 'idle', ms: 1000, lines: ['헤헤'] },
    pokeChest: { label: '가슴 콕', area: 'chest', state: 'idle', ms: 1000, lines: ['앗', '왜요'] },
    flick: { label: '튕기기', state: 'idle', ms: 1000, lines: ['아야'] }
  },
  ...patch
});

const art: Record<string, Pixels> = {
  'hair.back': rect([24, 6, 72, 50], '#202020'),
  'hair.back@turnL': rect([24, 6, 70, 50]),
  'leg.L': rect([36, 80, 46, 108], '#d0a080'),
  'leg.R': rect([50, 80, 60, 108], '#d0a080'),
  'shoe.L': rect([35, 104, 47, 110], '#101010'),
  'shoe.R': rect([49, 104, 61, 110], '#101010'),
  'arm.L': rect([22, 50, 30, 76]),
  'arm.R': rect([66, 50, 74, 76]),
  'arm.L#walk1': rect([22, 50, 30, 70]),
  'torso.belly': rect([32, 64, 64, 82], '#ffffff'),
  'torso.chest': rect([30, 50, 66, 66], '#eeeeee'),
  bottom: rect([32, 76, 64, 86], '#000080'),
  'outer.jacket': rect([28, 48, 68, 70], '#008000'),
  'outer.hoodie': rect([28, 48, 68, 72], '#800000'),
  neck: rect([44, 46, 52, 52], '#d0a080'),
  head: rect([28, 10, 68, 48], '#f0c0a0'),
  'head@turnL': rect([28, 10, 66, 48]),
  'shade.closed': rect([30, 30, 34, 32], '#ff8080'),
  'mouth.open': rect([44, 38, 52, 40], '#800000'),
  'mouth.talkA': rect([44, 37, 52, 42], '#400000'),
  'mouth.smile': rect([44, 38, 52, 41], '#a00000'),
  'mouth.closed': rect([44, 39, 52, 40], '#600000'),
  'eye.L.open': rect([36, 26, 42, 32], '#ffffff'),
  'eye.L.closed': rect([36, 29, 42, 30], '#000000'),
  'eye.L.smile': rect([36, 28, 42, 30], '#000000'),
  'eye.R.open': rect([54, 26, 60, 32], '#ffffff'),
  'eye.R.closed': rect([54, 29, 60, 30], '#000000'),
  // the iris spills out of the eye; the socket keeps only its middle
  'iris.L.open': rect([35, 25, 43, 33], '#0000ff'),
  'iris.R.open': rect([53, 25, 61, 33], '#0000ff'),
  'socket.L.open': rect([37, 27, 41, 31]),
  'socket.R.open': rect([55, 27, 59, 31]),
  'hair.front': rect([26, 6, 70, 20], '#aa00aa'),
  'armfront.L': blank(W, H),
  'headwear.cap': rect([26, 2, 70, 12], '#ff0000'),
  'pose.walk1': rect([30, 10, 66, 110]),
  'outer.jacket#walk1': rect([28, 48, 68, 70])
};
const layers = (names = Object.keys(art)) => names.map((name) => ({ name, pixels: art[name] }));
const reasons = (dropped: { name: string; reason: string }[]) => Object.fromEntries(dropped.map((d) => [d.name, d.reason]));

describe('convertPack', () => {
  it('turns @2 layers into standard parts, in the pack order back to front', () => {
    const { draft } = convertPack(makePack(), layers());
    expect(draft.order).toEqual([
      'hair.back', 'leg.L', 'leg.R', 'arm.L', 'arm.R', 'torso.belly', 'torso.chest', 'custom.outer',
      'head', 'mouth.closed', 'mouth.open', 'eye.L.open', 'eye.L.closed', 'eye.R.open', 'eye.R.closed', 'hair.front'
    ]);
    expect(Object.keys(draft.parts).sort()).toEqual([...draft.order].sort());
    expect(Object.values(draft.parts).every((p) => p.w === W && p.h === H)).toBe(true);
  });

  it('draws each iris over its eye, clipped by the socket, and leaves the closed eye bare', () => {
    const { draft } = convertPack(makePack(), layers());
    const eye = draft.parts['eye.L.open'];
    expect(at(eye, 38, 28)).toBe(C('#0000ff')); // iris inside the socket
    expect(at(eye, 36, 26)).toBe(C('#ffffff')); // eye white outside the socket
    expect(at(eye, 35, 25)).toBe(0); // iris outside the socket is cut away
    expect(at(draft.parts['eye.L.closed'], 38, 29)).toBe(C('#000000'));
    expect(at(draft.parts['eye.L.closed'], 38, 28)).toBe(0);
  });

  it('merges shoes into the legs, neck into the chest and bottom into the belly', () => {
    const { draft } = convertPack(makePack(), layers());
    expect(at(draft.parts['leg.L'], 40, 90)).toBe(C('#d0a080'));
    expect(at(draft.parts['leg.L'], 35, 106)).toBe(C('#101010'));
    expect(at(draft.parts['leg.R'], 60, 106)).toBe(C('#101010'));
    expect(at(draft.parts['torso.chest'], 45, 47)).toBe(C('#d0a080')); // neck
    expect(at(draft.parts['torso.belly'], 40, 84)).toBe(C('#000080')); // bottom
    expect(at(draft.parts['torso.belly'], 40, 80)).toBe(C('#000080')); // bottom over the belly
  });

  it('merges everything into one torso picture when the pack has one', () => {
    const pack = makePack({ layers: makePack().layers.filter((l) => l.id !== 'torso.belly') });
    const { draft } = convertPack(pack, layers(Object.keys(art).filter((n) => n !== 'torso.belly')));
    expect(draft.parts['torso.belly']).toBeUndefined();
    expect(at(draft.parts['torso.chest'], 40, 84)).toBe(C('#000080'));
    expect(at(draft.parts['torso.chest'], 45, 47)).toBe(C('#d0a080'));
  });

  it('merges the face shade the open face shows into the head', () => {
    const pack = makePack({ expressions: { ...makePack().expressions, open: { 'iris.L': 'open', 'iris.R': 'open', shade: 'closed' } } });
    const { draft } = convertPack(pack, layers());
    expect(at(draft.parts.head, 31, 31)).toBe(C('#ff8080'));
    // the default open face shows no shade here, so the head stays plain
    expect(at(convertPack(makePack(), layers()).draft.parts.head, 31, 31)).toBe(C('#f0c0a0'));
  });

  it('makes the resting mouth closed and the talking one open', () => {
    const { draft } = convertPack(makePack(), layers());
    expect(draft.parts['mouth.closed']).toEqual(art['mouth.open']); // what the open face shows
    expect(draft.parts['mouth.open']).toEqual(art['mouth.talkA']);
    const noTalk = makePack({ expressions: { ...makePack().expressions } });
    delete noTalk.expressions!.talkA;
    expect(convertPack(noTalk, layers()).draft.parts['mouth.open']).toEqual(art['mouth.smile']);
  });

  it('keeps only the default outfit, as a decoration, recoloured like the default avatar', () => {
    const { draft } = convertPack(makePack(), layers());
    expect(draft.parts['custom.outer']).toEqual(art['outer.jacket']);
    expect(draft.parts['custom.headwear']).toBeUndefined(); // default is none
    expect(at(draft.parts['hair.front'], 30, 10)).toBe(C('#112233'));
  });

  it('leaves out layers a default outfit hides', () => {
    const pack = makePack();
    pack.slots.outer.variants.jacket.hides = ['hair.back'];
    const { draft, dropped } = convertPack(pack, layers());
    expect(draft.parts['hair.back']).toBeUndefined();
    expect(reasons(dropped)['hair.back']).toMatch(/outer\.jacket/);
  });

  it('lists what it leaves out, with a reason in Korean', () => {
    const { dropped } = convertPack(makePack(), layers());
    const why = reasons(dropped);
    expect(Object.keys(why).sort()).toEqual([
      'arm.L#walk1', 'eye.L.smile', 'hair.back@turnL', 'head@turnL', 'headwear.cap', 'mouth.closed', 'mouth.smile', 'outer.hoodie', 'outer.jacket#walk1',
      'pose.walk1', 'shade.closed', 'socket.L.open', 'socket.R.open'
    ].sort());
    expect(why['head@turnL']).toMatch(/고개/);
    expect(why['arm.L#walk1']).toMatch(/자세/);
    expect(why['pose.walk1']).toMatch(/자세/);
    expect(why['eye.L.smile']).toMatch(/표정/);
    expect(why['socket.L.open']).toMatch(/마스크/);
    expect(why['outer.hoodie']).toMatch(/jacket/);
    expect(why['headwear.cap']).toMatch(/옷/);
    expect(Object.values(why).every((r) => /[가-힣]/.test(r))).toBe(true);
  });

  it('keeps unknown body layers as decorations and drops layers the pack never uses', () => {
    const pack = makePack({ layers: [...makePack().layers, layer('tail')] });
    const { draft, dropped } = convertPack(pack, [...layers(), { name: 'tail', pixels: rect([70, 70, 80, 80]) }, { name: 'sketch', pixels: rect([0, 0, 4, 4]) }]);
    expect(draft.parts['custom.tail']).toBeDefined();
    expect(draft.order.at(-1)).toBe('custom.tail');
    expect(reasons(dropped).sketch).toMatch(/[가-힣]/);
  });

  it('carries over the identity, persona and reaction lines, or the ones given', () => {
    const { draft } = convertPack(makePack(), layers());
    expect(draft).toMatchObject({ id: 'bean', name: '콩이', persona: '느긋한 친구', lines: { pat: ['헤헤'], pokeChest: ['앗', '왜요'], pokeBelly: [] } });
    const given = convertPack(makePack(), layers(), { name: '새 콩이', persona: '수다쟁이', lines: { pat: ['좋아'], pokeChest: [], pokeBelly: ['히익'] } }).draft;
    expect(given).toMatchObject({ name: '새 콩이', persona: '수다쟁이', lines: { pat: ['좋아'], pokeChest: [], pokeBelly: ['히익'] } });
  });

  it('makes a draft buildPack accepts', () => {
    const { pack, layers: built } = buildPack(convertPack(makePack(), layers()).draft);
    expect(pack.format).toBe('study-pet-character@3');
    expect(built.map((l) => l.name)).toContain('custom.outer');
    expect(pack.expressions!.closed).toMatchObject({ 'eye.L': 'closed', mouth: 'closed' });
  });

  it('does not change the layers it was given', () => {
    const before = art['eye.L.open'].data.slice();
    convertPack(makePack(), layers());
    expect(art['eye.L.open'].data).toEqual(before);
  });
});
