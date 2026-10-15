import { describe, expect, it } from 'vitest';
import { faceTurns, layerCells, recolorsFor, resolveHead, validatePack, variantOf, type CharacterPack } from './pack';
import { applyMoves, blank, clipTo, hexToPixel, moveRegion, over, recolor, rimUnder, shift, type Pixels } from './pixels';
import { frameAt, isBlinking, poseAt, stateLength, talkFace } from './timeline';
import { actionForArea, areaAt, menuActions, pickLine } from './actions';

const makePack = (): CharacterPack => ({
  format: 'study-pet-character@2',
  id: 't',
  name: 'T',
  frame: { w: 4, h: 4 },
  feetY: 3,
  sheet: 'sheet.png',
  cells: { body: [0, 0], 'outer.jacket': [4, 0], 'face.closed': [8, 0], 'face.smile': [12, 0] },
  layers: [{ id: 'body' }, { id: 'outer', from: 'slot' }, { id: 'face', from: 'face' }],
  regions: { upper: [[0, 0, 4, 2]], eyes: [[1, 1, 3, 2]] },
  states: {
    idle: {
      look: true,
      blink: { everyMs: 1000, ms: 100 },
      loop: [{ ms: 100 }, { ms: 200, move: { upper: [0, -1] } }]
    },
    sleep: { face: 'closed', loop: [{ ms: 500, dy: 1 }] },
    celebrate: { start: [{ ms: 50, face: 'smile' }], loop: [{ ms: 100 }] }
  },
  slots: {
    outer: { label: 'o', variants: { jacket: { label: 'j' }, none: { label: 'n' } } },
    hair: {
      label: 'h',
      variants: {
        a: { label: 'a' },
        b: { label: 'b', recolor: { layers: ['body'], region: 'upper', map: { '#112233': '#445566' } } }
      }
    }
  },
  fallback: 'idle'
});

// Rows of single-character keys → pixels ('.' = transparent).
const grid = (rows: string[]): Pixels => {
  const px = blank(rows[0].length, rows.length);
  rows.forEach((row, y) => [...row].forEach((ch, x) => (px.data[y * px.w + x] = ch === '.' ? 0 : hexToPixel(`#0000${ch}${ch}`))));
  return px;
};
const show = (px: Pixels) =>
  Array.from({ length: px.h }, (_, y) =>
    Array.from({ length: px.w }, (_, x) => {
      const p = px.data[y * px.w + x];
      return p >>> 24 === 0 ? '.' : ((p >> 16) & 0xff).toString(16)[0];
    }).join('')
  );

describe('pack', () => {
  it('accepts a well-formed pack', () => {
    expect(() => validatePack(makePack())).not.toThrow();
  });

  it('rejects moves on unknown regions and missing faces', () => {
    const pack = makePack();
    pack.states.idle.loop[0].move = { legs: [1, 0] };
    expect(() => validatePack(pack)).toThrow(/unknown region "legs"/);
    const other = makePack();
    other.states.sleep.face = 'wink';
    expect(() => validatePack(other)).toThrow(/missing face "wink"/);
  });

  it('falls back to the first variant for unknown ids', () => {
    expect(variantOf(makePack(), 'outer', 'violet')?.[0]).toBe('jacket');
  });

  it('lists layer cells back to front, skipping empty variants and the open face', () => {
    const pack = makePack();
    expect(layerCells(pack, { outer: 'jacket' }, 'open').map((c) => c.cell)).toEqual(['body', 'outer.jacket']);
    expect(layerCells(pack, { outer: 'none' }, 'closed').map((c) => c.cell)).toEqual(['body', 'face.closed']);
  });

  it('skips layers the chosen variants hide', () => {
    const pack = makePack();
    pack.slots.outer.variants.jacket.hides = ['body'];
    expect(layerCells(pack, { outer: 'jacket' }, 'open').map((c) => c.cell)).toEqual(['outer.jacket']);
    expect(layerCells(pack, { outer: 'none' }, 'open').map((c) => c.cell)).toEqual(['body']);
    pack.slots.outer.variants.jacket.hides = ['tail'];
    expect(() => validatePack(pack)).toThrow(/outer.jacket hides unknown layer "tail"/);
  });

  it('draws only the pose cell and its own #pose cells in a whole-frame pose', () => {
    const pack = makePack();
    pack.layers[0].group = 'body';
    pack.cells['pose.walk1'] = [16, 0];
    pack.cells['outer.jacket#walk1'] = [20, 0];
    pack.poses = { walk1: { cell: 'pose.walk1', whole: true } };
    expect(() => validatePack(pack)).not.toThrow();
    expect(layerCells(pack, { outer: 'jacket' }, 'closed', undefined, 'walk1').map((c) => [c.layer, c.cell])).toEqual([['pose', 'pose.walk1'], ['outer', 'outer.jacket#walk1']]);
    expect(layerCells(pack, { outer: 'none' }, 'open', undefined, 'walk1').map((c) => c.cell)).toEqual(['pose.walk1']);
    // A hidden first body layer still leaves the pose cell in its place.
    pack.slots.outer.variants.jacket.hides = ['body'];
    expect(layerCells(pack, { outer: 'jacket' }, 'open', undefined, 'walk1').map((c) => c.cell)).toEqual(['pose.walk1', 'outer.jacket#walk1']);
  });

  it('draws an outfit\'s own whole cell, alone, when the avatar wears it', () => {
    const pack = makePack();
    pack.layers[0].group = 'body';
    pack.cells['pose.walk1'] = [16, 0];
    pack.cells['pose.walk1.jacket'] = [24, 0];
    pack.cells['outer.jacket#walk1'] = [20, 0];
    pack.poses = { walk1: { cell: 'pose.walk1', whole: true, outfits: [{ when: { outer: 'jacket' }, cell: 'pose.walk1.jacket' }] } };
    expect(() => validatePack(pack)).not.toThrow();
    expect(layerCells(pack, { outer: 'jacket' }, 'open', undefined, 'walk1').map((c) => [c.layer, c.cell])).toEqual([['outfit', 'pose.walk1.jacket']]);
    // Another outfit: the base cell and its overlays, as before.
    expect(layerCells(pack, { outer: 'none' }, 'open', undefined, 'walk1').map((c) => c.cell)).toEqual(['pose.walk1']);
    // The first slot variant is the default when the avatar names none.
    expect(layerCells(pack, {}, 'open', undefined, 'walk1').map((c) => c.cell)).toEqual(['pose.walk1.jacket']);
    pack.poses.walk1 = { cell: 'pose.walk1', whole: true, outfits: [{ when: { outer: 'jacket' }, cell: 'pose.walk1.cape' }] };
    expect(() => validatePack(pack)).toThrow(/missing cell "pose.walk1.cape"/);
  });

  it('prefers pose cells, then turned-head cells, then the plain cell', () => {
    const pack = makePack();
    pack.cells['body@turnL'] = [16, 0];
    pack.cells['body#stretch'] = [20, 0];
    pack.cells['face.closed@turnL'] = [24, 0];
    expect(layerCells(pack, { outer: 'jacket' }, 'closed', 'turnL').map((c) => c.cell)).toEqual(['body@turnL', 'outer.jacket', 'face.closed@turnL']);
    expect(layerCells(pack, { outer: 'none' }, 'open', 'turnL', 'stretch').map((c) => c.cell)).toEqual(['body#stretch']);
  });

  it('rejects fidgets that are not states', () => {
    const pack = makePack();
    pack.fidgets = { states: ['dance'], everyMs: [1, 2] };
    expect(() => validatePack(pack)).toThrow(/fidget "dance"/);
  });

  it('collects recolors of the chosen variants', () => {
    expect(recolorsFor(makePack(), { hair: 'b' })).toHaveLength(1);
    expect(recolorsFor(makePack(), { hair: 'a' })).toHaveLength(0);
  });
});

// Part layers with per-feature expressions (the Lila layout in miniature).
const makePartPack = (): CharacterPack => ({
  ...makePack(),
  cells: {
    head: [0, 0], 'head@turnL': [4, 0], torso: [8, 0], 'eye.open': [12, 0], 'eye.closed': [16, 0], 'eye.open@turnL': [20, 0],
    'iris.open': [24, 0], 'socket.open': [28, 0], 'mouth.open': [32, 0], 'mouth.talkA': [36, 0], 'pose.stretch': [40, 0], 'outer.jacket': [44, 0]
  },
  layers: [
    { id: 'torso', follow: ['upper'], group: 'body' },
    { id: 'outer', from: 'slot' },
    { id: 'head', follow: ['upper'], group: 'body' },
    { id: 'mouth', from: 'face', group: 'body' },
    { id: 'eye', from: 'face', group: 'body' },
    { id: 'iris', from: 'face', follow: ['upper', 'eyes'], clip: 'socket', clipFollow: ['upper'], group: 'body' }
  ],
  expressions: { open: {}, closed: { eye: 'closed', iris: 'none' }, smile: { eye: 'closed', iris: 'none' }, talkA: { mouth: 'talkA' }, 'open@turnL': { iris: 'none' } },
  poses: { stretch: 'pose.stretch' },
  slots: { outer: makePack().slots.outer }
});

describe('part layers', () => {
  it('accepts a well-formed part pack', () => {
    expect(() => validatePack(makePartPack())).not.toThrow();
  });

  it('picks each feature from the expression, open by default, and hides `none`', () => {
    const pack = makePartPack();
    const cells = (face: string, head?: string, pose?: string) => layerCells(pack, { outer: 'none' }, face, head, pose).map((c) => c.cell);
    expect(cells('open')).toEqual(['torso', 'head', 'mouth.open', 'eye.open', 'iris.open']);
    expect(cells('closed')).toEqual(['torso', 'head', 'mouth.open', 'eye.closed']);
    expect(cells('talkA')).toEqual(['torso', 'head', 'mouth.talkA', 'eye.open', 'iris.open']);
    expect(layerCells(pack, { outer: 'none' }, 'open').find((c) => c.layer === 'iris')?.clip).toBe('socket.open');
  });

  it('uses the turned expression and cells for a turned head', () => {
    const pack = makePartPack();
    expect(layerCells(pack, { outer: 'none' }, 'open', 'turnL').map((c) => c.cell)).toEqual(['torso', 'head@turnL', 'mouth.open', 'eye.open@turnL']);
    expect(faceTurns(pack, 'open', 'turnL')).toBe(true);
    expect(faceTurns(pack, 'closed', 'turnL')).toBe(false);
  });

  it('mirrors a head direction that has no cells of its own', () => {
    const pack = makePartPack();
    pack.mirror = { turnR: 'turnL' };
    expect(resolveHead(pack, 'turnR')).toEqual({ head: 'turnL', flip: true });
    expect(resolveHead(pack, 'turnL')).toEqual({ head: 'turnL', flip: false });
    expect(faceTurns(pack, 'open', 'turnR')).toBe(true); // uses open@turnL
    pack.cells['head@turnR'] = [52, 0];
    expect(resolveHead(pack, 'turnR')).toEqual({ head: 'turnR', flip: false }); // own art wins
  });

  it('turns with open eyes when the face has no art for the turned head', () => {
    const pack = makePartPack();
    pack.states.idle.blink = undefined;
    pack.states.idle.face = 'smile'; // smile has no smile@turnL
    expect(poseAt(pack, 'idle', 0, 0, -2, 0)).toMatchObject({ head: 'turnL', face: 'open' });
    expect(poseAt(pack, 'idle', 0, 0, 0, 0).face).toBe('smile');
  });

  it('draws the pose cell once in place of the body layers, keeping outfit slots', () => {
    const pack = makePartPack();
    expect(layerCells(pack, { outer: 'jacket' }, 'open', undefined, 'stretch').map((c) => c.cell)).toEqual(['pose.stretch', 'outer.jacket']);
  });

  it('rejects expressions and follows that point nowhere', () => {
    const pack = makePartPack();
    pack.expressions!.smile = { eye: 'smile' };
    expect(() => validatePack(pack)).toThrow(/missing cell "eye.smile"/);
    const other = makePartPack();
    other.layers[0].follow = ['tail'];
    expect(() => validatePack(other)).toThrow(/unknown region "tail"/);
    const third = makePartPack();
    third.hitAreas = { head: { layers: ['hat'] } };
    expect(() => validatePack(third)).toThrow(/unknown layer "hat"/);
  });

  it('matches layer hit areas by the part on top', () => {
    const pack = makePartPack();
    pack.hitAreas = { head: { layers: ['head', 'eye'] }, belly: [[0, 3, 4, 4]] };
    expect(areaAt(pack, 1, 1, () => 'eye')).toBe('head');
    expect(areaAt(pack, 1, 3, () => 'torso')).toBe('belly');
    expect(areaAt(pack, 1, 1, () => 'torso')).toBeUndefined();
  });
});

describe('timeline', () => {
  it('plays start frames once, then loops', () => {
    const def = makePack().states.celebrate;
    expect(frameAt(def, 10).face).toBe('smile');
    expect(frameAt(def, 60).face).toBeUndefined();
    expect(frameAt(makePack().states.idle, 350).ms).toBe(100); // 350 % 300 = 50 → first frame
  });

  it('blinks once per window for the configured length', () => {
    const blink = { everyMs: 1000, ms: 100 };
    const hits = Array.from({ length: 3000 }, (_, t) => isBlinking(t, blink)).filter(Boolean).length;
    expect(hits).toBe(300);
  });

  it('closes the eyes during a blink and lets the state face win otherwise', () => {
    const pack = makePack();
    const blinkAt = Array.from({ length: 1000 }, (_, t) => t).find((t) => isBlinking(t, pack.states.idle.blink!))!;
    expect(poseAt(pack, 'idle', 0, blinkAt, 0).face).toBe('closed');
    expect(poseAt(pack, 'sleep', 0, 0, 0)).toMatchObject({ face: 'closed', dx: 0, dy: 1, moves: {} });
  });

  it('moves the eyes toward the cursor only in looking states', () => {
    const pack = makePack();
    const awake = Array.from({ length: 1000 }, (_, t) => t).find((t) => !isBlinking(t, pack.states.idle.blink!))!;
    expect(poseAt(pack, 'idle', 0, awake, -1).moves.eyes).toEqual([-1, 0]);
    expect(poseAt(pack, 'sleep', 0, awake, -1).moves.eyes).toBeUndefined();
  });

  it('turns the head for a far cursor when the pack has turned cells', () => {
    const pack = makePack();
    const awake = Array.from({ length: 1000 }, (_, t) => t).find((t) => !isBlinking(t, pack.states.idle.blink!))!;
    expect(poseAt(pack, 'idle', 0, awake, -2).moves.eyes).toEqual([-1, 0]); // no turned cells yet: glance
    pack.cells['body@turnL'] = [16, 0];
    const pose = poseAt(pack, 'idle', 0, awake, -2);
    expect(pose.head).toBe('turnL');
    expect(pose.moves.eyes).toBeUndefined();
  });

  it('glances up or down, nods when far, and uses up/down head cells when drawn', () => {
    const pack = makePack();
    const awake = Array.from({ length: 1000 }, (_, t) => t).find((t) => !isBlinking(t, pack.states.idle.blink!))!;
    expect(poseAt(pack, 'idle', 0, awake, 0, 1).moves).toEqual({ eyes: [0, 1] });
    expect(poseAt(pack, 'idle', 0, awake, -1, 2).moves).toEqual({ eyes: [-1, 1], head: [0, 1] });
    pack.cells['body@down'] = [16, 0];
    expect(poseAt(pack, 'idle', 0, awake, 0, 2).head).toBe('down');
    expect(poseAt(pack, 'idle', 0, awake, 2, -2).head).toBeUndefined(); // no turnR / up cells: glance
  });

  it('nods a turned head and swaps to the lookDown expression when the pack has one', () => {
    const pack = makePartPack();
    pack.states.idle.blink = undefined;
    expect(poseAt(pack, 'idle', 0, 0, -2, 2)).toMatchObject({ head: 'turnL', moves: { head: [0, 1] } });
    pack.cells['eye.lookDown'] = [48, 0];
    pack.expressions!.lookDown = { eye: 'lookDown', iris: 'none' };
    expect(poseAt(pack, 'idle', 0, 0, 0, 2)).toMatchObject({ face: 'lookDown', moves: { head: [0, 1] } });
    expect(poseAt(pack, 'idle', 0, 0, 0, 1).face).toBe('open'); // near: just a glance
  });

  it('looks far up or down even with a non-open expression, but not with closed eyes', () => {
    const pack = makePartPack();
    pack.states.idle.blink = undefined;
    pack.cells['eye.lookDown'] = [48, 0];
    pack.expressions!.lookDown = { eye: 'lookDown', iris: 'none' };
    pack.states.idle.face = 'smile';
    expect(poseAt(pack, 'idle', 0, 0, 0, 2).face).toBe('lookDown');
    pack.states.idle.face = 'closed';
    expect(poseAt(pack, 'idle', 0, 0, 0, 2).face).toBe('closed');
  });

  it('measures one play-through of a state', () => {
    expect(stateLength(makePack().states.celebrate)).toBe(150);
  });

  it('uses the fallback state for unknown names', () => {
    expect(poseAt(makePack(), 'nope', 150, 0, 0).moves.upper).toEqual([0, -1]);
  });
});

describe('actions', () => {
  const withActions = () => {
    const pack = makePack();
    pack.hitAreas = { head: [[0, 0, 4, 2]], belly: [[0, 2, 4, 4]] };
    pack.actions = {
      pat: { label: 'pat', area: 'head', tap: true, menu: true, state: 'celebrate', ms: 100 },
      poke: { label: 'poke', area: 'belly', state: 'sleep', ms: 100 },
      flick: { label: 'flick', menu: true, state: 'sleep', ms: 100 }
    };
    return pack;
  };

  it('finds the hit area and its action', () => {
    const pack = withActions();
    expect(areaAt(pack, 1, 1)).toBe('head');
    expect(areaAt(pack, 1, 3)).toBe('belly');
    expect(areaAt(pack, 9, 9)).toBeUndefined();
    expect(actionForArea(pack, 'belly')).toBe('poke');
    expect(actionForArea(pack, 'belly', true)).toBeUndefined(); // not a tap action
    expect(actionForArea(pack, 'head', true)).toBe('pat');
  });

  it('lists menu actions in pack order', () => {
    expect(menuActions(withActions()).map((a) => a.id)).toEqual(['pat', 'flick']);
  });

  it('rejects actions with unknown states or areas', () => {
    const pack = withActions();
    pack.actions!.poke.state = 'nope';
    expect(() => validatePack(pack)).toThrow(/unknown state "nope"/);
    const other = withActions();
    other.actions!.poke.area = 'tail';
    expect(() => validatePack(other)).toThrow(/unknown hit area "tail"/);
  });

  it('never repeats the last line', () => {
    expect(pickLine(['a', 'b'], 'a', () => 0)).toBe('b');
    expect(pickLine(['a'], 'a', () => 0)).toBe('a');
    expect(pickLine(undefined, undefined)).toBeUndefined();
  });

  it('cycles mouth shapes only over open faces and when the pack has them', () => {
    const pack = makePack();
    expect(talkFace(pack, 'open', 0)).toBe('open');
    pack.cells['face.talkA'] = [16, 0];
    pack.cells['face.talkB'] = [20, 0];
    expect([0, 110, 220, 330].map((t) => talkFace(pack, 'open', t))).toEqual(['talkA', 'talkB', 'talkA', 'open']);
    expect(talkFace(pack, 'smile', 0)).toBe('smile');
  });
});

describe('pixels', () => {
  it('lifts a region and stretches its bottom edge instead of tearing', () => {
    const px = grid(['1111', '2222', '3333', '4444']);
    expect(show(moveRegion(px, [[0, 0, 4, 3]], [0, -1]))).toEqual(['2222', '3333', '3333', '4444']);
  });

  it('pushes pixels past the region edge over what is below', () => {
    const px = grid(['.11.', '.22.', '3333', '4444']);
    expect(show(moveRegion(px, [[0, 0, 4, 2]], [0, 1]))).toEqual(['.11.', '.11.', '3223', '4444']);
  });

  it('shifts sideways inside multi-box regions', () => {
    const px = grid(['1..2', '1..2']);
    expect(show(moveRegion(px, [[0, 0, 1, 2], [3, 0, 4, 2]], [1, 0]))).toEqual(['11.2', '11.2']);
  });

  it('applies moves in region order', () => {
    const px = grid(['1111', '2222', '3333']);
    const regions = { all: [[0, 0, 4, 3]] as [number, number, number, number][], top: [[0, 0, 4, 1]] as [number, number, number, number][] };
    expect(show(applyMoves(px, regions, { top: [0, 1], all: [0, -1] }))).toEqual(['2222', '2222', '3333']);
  });

  it('shifts a whole layer, leaving what it uncovers transparent', () => {
    expect(show(shift(grid(['12.', '34.']), [1, 0]))).toEqual(['.12', '.34']);
    expect(show(shift(grid(['12', '34']), [0, -1]))).toEqual(['34', '..']);
  });

  it('rims only what is drawn just outside a layer, leaving the layer alone', () => {
    const dst = grid(['222.', '2222', '2222']);
    rimUnder(dst, grid(['....', '.11.', '....']), hexToPixel('#000000'), 1);
    expect(show(dst)).toEqual(['200.', '0220', '2002']);
    const dark = grid(['0000', '0000']);
    rimUnder(dark, grid(['....', '.11.']), hexToPixel('#000000'), 1, hexToPixel('#0000ff'));
    expect(show(dark)).toEqual(['0ff0', 'f00f']);
  });

  it('clips a layer to the opaque pixels of a mask', () => {
    expect(show(clipTo(grid(['123', '456']), grid(['.1.', '11.'])))).toEqual(['.2.', '45.']);
  });

  it('composites opaque pixels and recolors only inside the given boxes', () => {
    const dst = grid(['11', '11']);
    over(dst, grid(['.2', '..']));
    expect(show(dst)).toEqual(['12', '11']);
    recolor(dst, new Map([[hexToPixel('#000011'), hexToPixel('#000099')]]), [[0, 0, 2, 1]]);
    expect(show(dst)).toEqual(['92', '11']);
  });
});
