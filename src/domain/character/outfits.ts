import type { CharacterPack, PoseDef } from './pack';

// Which outfit combinations a character can wear (#50). A whole pose drawn
// with the clothes on (Lila's side-view walk) has one drawing per outfit;
// overlays drawn frame by frame never line up as well. So a combination is
// selectable only when every such pose has a drawing for it, or its own cell
// is drawn in exactly that combination (`wears`). Slots a drawing does not
// name are free (the hairpin is on the far side in a side view).
//
// Imported by scripts/character/check.mjs as plain Node (type stripping):
// type-only imports here, nothing else.

export type Outfit = Record<string, string>;
type Cells = Record<string, [number, number]>;
type WholePose = Exclude<PoseDef, string>;

// Each pack slot's chosen variant, or its first one; slots the pack does not
// have (old colour choices: hair, glow, skin) are dropped.
export const wornOutfit = (pack: CharacterPack, avatar: Outfit): Outfit =>
  Object.fromEntries(Object.entries(pack.slots).map(([slot, def]) => [slot, def.variants[avatar[slot]] ? avatar[slot] : Object.keys(def.variants)[0]]));

const matches = (when: Outfit, outfit: Outfit) => Object.entries(when).every(([slot, id]) => outfit[slot] === id);

// The whole poses that have outfit drawings: they decide what is allowed.
const restricting = (pack: CharacterPack): [string, WholePose][] =>
  Object.entries(pack.poses ?? {}).flatMap(([name, def]) => (typeof def === 'object' && def.whole && def.outfits?.length ? [[name, def] as [string, WholePose]] : []));

const drawings = (def: WholePose): Outfit[] => [...(def.outfits ?? []).map((o) => o.when), ...(def.wears ? [def.wears] : [])];

export const outfitAllowed = (pack: CharacterPack, avatar: Outfit): boolean => {
  const worn = wornOutfit(pack, avatar);
  return restricting(pack).every(([, def]) => drawings(def).some((when) => matches(when, worn)));
};

// Partial combinations every restricting pose has a drawing for: merges one
// drawing per pose where they agree. Slots left out are free.
const allowedParts = (pack: CharacterPack): Outfit[] => {
  let parts: Outfit[] = [{}];
  for (const [, def] of restricting(pack)) {
    const next = new Map<string, Outfit>();
    for (const part of parts) for (const when of drawings(def)) {
      if (Object.entries(when).some(([slot, id]) => part[slot] !== undefined && part[slot] !== id)) continue;
      const merged = { ...part, ...when };
      if (Object.entries(merged).some(([slot, id]) => !pack.slots[slot]?.variants[id])) continue;
      next.set(JSON.stringify(Object.entries(merged).sort()), merged);
    }
    parts = [...next.values()].slice(0, 1024);
  }
  return parts;
};

// The closest allowed combination to `avatar` with the `pinned` slots kept:
// fewest slot changes, then keeping the outer. Undefined when there is none.
const closest = (pack: CharacterPack, avatar: Outfit, pinned: string[]): Outfit | undefined => {
  const worn = wornOutfit(pack, avatar);
  let best: { outfit: Outfit; cost: number } | undefined;
  for (const part of allowedParts(pack)) {
    if (pinned.some((slot) => part[slot] !== undefined && part[slot] !== worn[slot])) continue;
    const changed = Object.keys(part).filter((slot) => part[slot] !== worn[slot]);
    const cost = changed.length * 2 + (changed.includes('outer') ? 1 : 0);
    if (!best || cost < best.cost) best = { outfit: { ...worn, ...part }, cost };
  }
  return best?.outfit;
};

export const closestOutfit = (pack: CharacterPack, avatar: Outfit): Outfit | undefined =>
  outfitAllowed(pack, avatar) ? wornOutfit(pack, avatar) : closest(pack, avatar, []);

// Slots in the order a choice keeps them: the outer first, then pack order.
const priority = (pack: CharacterPack) => {
  const slots = Object.keys(pack.slots);
  return slots.includes('outer') ? ['outer', ...slots.filter((s) => s !== 'outer')] : slots;
};
const above = (pack: CharacterPack, slot: string) => {
  const order = priority(pack);
  return order.slice(0, order.indexOf(slot));
};

// Whether choosing `slot` = `id` leaves an allowed combination without
// changing the slots above it (choosing a jacket may change the headwear,
// choosing a headwear may not change the jacket).
export const choiceAllowed = (pack: CharacterPack, avatar: Outfit, slot: string, id: string): boolean =>
  Boolean(pack.slots[slot]?.variants[id]) && closest(pack, { ...avatar, [slot]: id }, [...above(pack, slot), slot]) !== undefined;

// The combination after choosing `slot` = `id`: the slots below it move to
// the closest allowed one. A choice that is not allowed changes nothing.
export const chooseOutfit = (pack: CharacterPack, avatar: Outfit, slot: string, id: string): Outfit =>
  (choiceAllowed(pack, avatar, slot, id) && closest(pack, { ...avatar, [slot]: id }, [...above(pack, slot), slot])) || avatar;

// Every allowed full combination, in pack slot and variant order (at most 256).
export const selectableOutfits = (pack: CharacterPack): Outfit[] => {
  let all: Outfit[] = [{}];
  for (const [slot, def] of Object.entries(pack.slots)) {
    all = all.flatMap((outfit) => Object.keys(def.variants).map((id) => ({ ...outfit, [slot]: id }))).slice(0, 4096);
  }
  return all.filter((outfit) => outfitAllowed(pack, outfit)).slice(0, 256);
};

// Whether `pose` can be drawn in `avatar` with the exported `cells`: a whole
// pose with outfit drawings by the rule above; any other whole pose needs a
// `<slot>.<variant>#<pose>` cell for every variant worn that has a front cell;
// a front-view pose falls back to the front cells.
export const poseDrawable = (pack: CharacterPack, cells: Cells, avatar: Outfit, pose: string): boolean => {
  const def = pack.poses?.[pose];
  if (typeof def !== 'object' || !def.whole) return true;
  const worn = wornOutfit(pack, avatar);
  if (def.outfits?.length) return drawings(def).some((when) => matches(when, worn));
  const hidden = new Set(Object.entries(worn).flatMap(([slot, id]) => pack.slots[slot]?.variants[id]?.hides ?? []));
  return pack.layers.every((layer) => {
    if (layer.from !== 'slot' || hidden.has(layer.id)) return true;
    const cell = `${layer.id}.${worn[layer.id]}`;
    return !cells[cell] || Boolean(cells[`${cell}#${pose}`]);
  });
};
