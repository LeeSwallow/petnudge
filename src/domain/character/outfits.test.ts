import { describe, expect, it } from 'vitest';
import type { CharacterPack } from './pack';
import { chooseOutfit, choiceAllowed, closestOutfit, outfitAllowed, poseDrawable, selectableOutfits, wornOutfit } from './outfits';

// Lila's shape: walk poses drawn whole, with a drawing per outfit and a base
// drawing worn without outer or headwear. The hairpin is not in any drawing.
const makePack = (): CharacterPack => {
  const walk = (n: number) => ({
    cell: `pose.walk${n}`,
    whole: true,
    wears: { outer: 'none', headwear: 'none' },
    outfits: [
      { when: { outer: 'jacket', headwear: 'catphones' }, cell: `pose.walk${n}.jacket` },
      { when: { outer: 'cardigan', headwear: 'none' }, cell: `pose.walk${n}.cardigan` }
    ]
  });
  return {
    format: 'study-pet-character@2',
    id: 't',
    name: 'T',
    frame: { w: 4, h: 4 },
    feetY: 3,
    sheet: 'sheet.png',
    cells: {},
    layers: [{ id: 'body', group: 'body' }, { id: 'outer', from: 'slot' }, { id: 'hairpin', from: 'slot' }, { id: 'headwear', from: 'slot' }],
    regions: {},
    states: { idle: { loop: [{ ms: 100 }] }, walkL: { loop: [{ ms: 100, pose: 'walk1' }, { ms: 100, pose: 'walk2' }] } },
    slots: {
      outer: { label: '아우터', variants: { jacket: { label: 'j' }, cardigan: { label: 'c' }, none: { label: 'n' } } },
      headwear: { label: '머리 장식', variants: { catphones: { label: 'cat' }, none: { label: 'n' } } },
      hairpin: { label: '머리핀', variants: { clip: { label: 'clip' }, none: { label: 'n' } } }
    },
    poses: { walk1: walk(1), walk2: walk(2), stretch: 'pose.stretch' },
    fallback: 'idle'
  };
};

describe('outfits', () => {
  it('fills in each slot\'s first variant and drops slots the pack does not have', () => {
    expect(wornOutfit(makePack(), { outer: 'cardigan', hair: 'pink', glow: 'cyan', headwear: 'bogus' })).toEqual({ outer: 'cardigan', headwear: 'catphones', hairpin: 'clip' });
  });

  it('allows a combination only when every whole pose has a drawing for it', () => {
    const pack = makePack();
    expect(outfitAllowed(pack, { outer: 'jacket', headwear: 'catphones' })).toBe(true);
    expect(outfitAllowed(pack, { outer: 'cardigan', headwear: 'none', hairpin: 'none' })).toBe(true);
    // the base drawing is exactly this combination
    expect(outfitAllowed(pack, { outer: 'none', headwear: 'none' })).toBe(true);
    expect(outfitAllowed(pack, { outer: 'jacket', headwear: 'none' })).toBe(false);
    expect(outfitAllowed(pack, { outer: 'cardigan', headwear: 'catphones' })).toBe(false);
    expect(outfitAllowed(pack, { outer: 'none', headwear: 'catphones' })).toBe(false);
  });

  it('counts the base drawing only when the pack says what it wears', () => {
    const pack = makePack();
    for (const def of Object.values(pack.poses!)) if (typeof def === 'object') delete def.wears;
    expect(outfitAllowed(pack, { outer: 'none', headwear: 'none' })).toBe(false);
    expect(outfitAllowed(pack, { outer: 'jacket', headwear: 'catphones' })).toBe(true);
  });

  it('needs every pose: one pose without the drawing blocks the combination', () => {
    const pack = makePack();
    const walk2 = pack.poses!.walk2;
    if (typeof walk2 === 'object') walk2.outfits = walk2.outfits!.slice(0, 1);
    expect(outfitAllowed(pack, { outer: 'cardigan', headwear: 'none' })).toBe(false);
  });

  it('allows everything when no whole pose has outfit drawings', () => {
    const pack = makePack();
    pack.poses = { walk1: { cell: 'pose.walk1', whole: true } };
    expect(outfitAllowed(pack, { outer: 'none', headwear: 'catphones' })).toBe(true);
    expect(selectableOutfits(pack)).toHaveLength(12);
  });

  it('lists the selectable combinations', () => {
    expect(selectableOutfits(makePack())).toEqual([
      { outer: 'jacket', headwear: 'catphones', hairpin: 'clip' },
      { outer: 'jacket', headwear: 'catphones', hairpin: 'none' },
      { outer: 'cardigan', headwear: 'none', hairpin: 'clip' },
      { outer: 'cardigan', headwear: 'none', hairpin: 'none' },
      { outer: 'none', headwear: 'none', hairpin: 'clip' },
      { outer: 'none', headwear: 'none', hairpin: 'none' }
    ]);
  });

  it('moves a combination that is not allowed to the closest one, keeping the outer', () => {
    const pack = makePack();
    expect(closestOutfit(pack, { outer: 'jacket', headwear: 'none', hairpin: 'none' })).toEqual({ outer: 'jacket', headwear: 'catphones', hairpin: 'none' });
    expect(closestOutfit(pack, { outer: 'cardigan', headwear: 'catphones' })).toEqual({ outer: 'cardigan', headwear: 'none', hairpin: 'clip' });
    expect(closestOutfit(pack, { outer: 'none', headwear: 'catphones' })).toEqual({ outer: 'none', headwear: 'none', hairpin: 'clip' });
    // an allowed one stays as it is
    expect(closestOutfit(pack, { outer: 'cardigan', headwear: 'none', hairpin: 'none' })).toEqual({ outer: 'cardigan', headwear: 'none', hairpin: 'none' });
  });

  it('keeps the closest by fewest changes before keeping the outer', () => {
    const pack = makePack();
    pack.poses = { walk1: { cell: 'pose.walk1', whole: true, outfits: [
      { when: { outer: 'none', headwear: 'catphones', hairpin: 'clip' }, cell: 'a' },
      { when: { outer: 'jacket', headwear: 'none', hairpin: 'none' }, cell: 'b' }
    ] } };
    // jacket+catphones+clip: one change to the first (outer), two to the second
    expect(closestOutfit(pack, { outer: 'jacket', headwear: 'catphones', hairpin: 'clip' })).toEqual({ outer: 'none', headwear: 'catphones', hairpin: 'clip' });
  });

  it('enables a choice when an allowed combination keeps the slots above it', () => {
    const pack = makePack();
    const worn = { outer: 'jacket', headwear: 'catphones', hairpin: 'clip' };
    // the outer comes first: every outer has some allowed combination
    expect(['jacket', 'cardigan', 'none'].map((id) => choiceAllowed(pack, worn, 'outer', id))).toEqual([true, true, true]);
    // under a jacket, only the cat headphones have walk drawings
    expect(['catphones', 'none'].map((id) => choiceAllowed(pack, worn, 'headwear', id))).toEqual([true, false]);
    expect(['catphones', 'none'].map((id) => choiceAllowed(pack, { ...worn, outer: 'cardigan' }, 'headwear', id))).toEqual([false, true]);
    expect(['clip', 'none'].map((id) => choiceAllowed(pack, worn, 'hairpin', id))).toEqual([true, true]);
  });

  it('choosing a variant moves the slots below it to the closest allowed combination', () => {
    const pack = makePack();
    const worn = { outer: 'jacket', headwear: 'catphones', hairpin: 'none' };
    expect(chooseOutfit(pack, worn, 'outer', 'cardigan')).toEqual({ outer: 'cardigan', headwear: 'none', hairpin: 'none' });
    expect(chooseOutfit(pack, worn, 'hairpin', 'clip')).toEqual({ outer: 'jacket', headwear: 'catphones', hairpin: 'clip' });
    // a disabled choice changes nothing
    expect(chooseOutfit(pack, worn, 'headwear', 'none')).toEqual(worn);
  });

  it('tells whether a pose can be drawn in a combination', () => {
    const pack = makePack();
    const cells = { 'outer.jacket': [0, 0], 'headwear.catphones': [0, 0], 'outer.jacket#flail': [0, 0] } as Record<string, [number, number]>;
    // whole pose with drawings: the drawing rule
    expect(poseDrawable(pack, cells, { outer: 'jacket', headwear: 'catphones' }, 'walk1')).toBe(true);
    expect(poseDrawable(pack, cells, { outer: 'jacket', headwear: 'none' }, 'walk1')).toBe(false);
    // whole pose without drawings: every worn variant needs its own #pose cell
    pack.poses!.flail = { cell: 'pose.flail', whole: true };
    expect(poseDrawable(pack, cells, { outer: 'jacket', headwear: 'none' }, 'flail')).toBe(true);
    expect(poseDrawable(pack, cells, { outer: 'jacket', headwear: 'catphones' }, 'flail')).toBe(false);
    // a front-view pose falls back to the front cells
    expect(poseDrawable(pack, cells, { outer: 'jacket', headwear: 'catphones' }, 'stretch')).toBe(true);
  });
});
