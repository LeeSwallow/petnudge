import { PACK_FORMATS, type CharacterPack, type LayerDef, type PoseDef, type Recolor, type Variant } from '../domain/character/pack';

// Character packs: layered paper-doll sprites, format @2 and the standard pack
// @3 (made by the character editor; adds `editor` and frame `flip`). The
// types live in src/domain/character/pack.ts; see timeline.ts and pixels.ts
// for how frames are composed. Authored as <id>.pack.json + <id>.aseprite/.pxo,
// built into character.json + sheet.png by scripts/build-character.mjs.
export type {
  ActionDef, Box, CharacterPack, Expression, FrameDef, Fx, HitArea, LayerDef, Move, PackFormat, PoseDef, PoseOutfit, Recolor, Slot, StateDef, Variant
} from '../domain/character/pack';
export { PACK_FORMATS } from '../domain/character/pack';

// Chosen variant id per slot.
export type Avatar = Record<string, string>;

const fail = (message: string): never => {
  throw new Error(`character pack: ${message}`);
};

export const validatePack = (input: unknown): CharacterPack => {
  const pack = input as CharacterPack;
  if (!(PACK_FORMATS as readonly unknown[]).includes(pack?.format)) fail(`unsupported format ${String(pack?.format)}`);
  if (!/^[a-z][a-z0-9-]{0,47}$/.test(pack.id) || typeof pack.name !== 'string' || pack.name.length > 80) fail('invalid identity');
  if (![pack.frame?.w, pack.frame?.h].every((n) => Number.isInteger(n) && n >= 1 && n <= 256)) fail('frame must be 1..256 pixels');
  if (!Number.isInteger(pack.feetY) || pack.feetY < 0 || pack.feetY > pack.frame.h) fail('invalid feetY');
  if (!pack.cells || !pack.states || !pack.slots || !pack.regions || !Array.isArray(pack.layers)) fail('missing pack sections');
  if (!pack.states[pack.fallback]) fail(`fallback state "${pack.fallback}" missing`);
  for (const layer of pack.layers) {
    if (layer.from === 'slot' && !pack.slots[layer.id]) fail(`layer "${layer.id}" has no slot`);
    if (!layer.from && !pack.cells[layer.id]) fail(`layer "${layer.id}" has no cell`);
    for (const region of [...(layer.follow ?? []), ...(layer.clipFollow ?? [])]) {
      if (!pack.regions[region]) fail(`layer "${layer.id}" follows unknown region "${region}"`);
    }
  }
  const faceLayers = new Set(pack.layers.filter((l) => l.from === 'face').map((l) => l.id));
  for (const [name, expression] of Object.entries(pack.expressions ?? {})) {
    const head = name.split('@')[1];
    for (const [layer, variant] of Object.entries(expression)) {
      if (!faceLayers.has(layer)) fail(`expression "${name}" sets unknown face layer "${layer}"`);
      const cell = `${layer}.${variant}`;
      if (variant !== 'none' && variant !== 'open' && !pack.cells[cell] && !(head && pack.cells[`${cell}@${head}`])) fail(`expression "${name}" uses missing cell "${cell}"`);
    }
  }
  for (const [pose, def] of Object.entries(pack.poses ?? {})) {
    const cells = [poseCellOf(def)!, ...(typeof def === 'object' ? def.outfits ?? [] : []).map((outfit) => outfit.cell)];
    for (const cell of cells) if (!pack.cells[cell]) fail(`pose "${pose}" uses missing cell "${cell}"`);
    for (const [slot, id] of Object.entries(typeof def === 'object' ? def.wears ?? {} : {})) if (!pack.slots[slot]?.variants[id]) fail(`pose "${pose}" names unknown outfit "${slot}.${id}"`);
  }
  for (const [head, source] of Object.entries(pack.mirror ?? {})) {
    if (!Object.keys(pack.cells).some((cell) => cell.endsWith(`@${source}`))) fail(`mirror "${head}" uses head "${source}" with no cells`);
  }
  for (const [name, state] of Object.entries(pack.states)) {
    if (state.loop.length === 0) fail(`state "${name}" has an empty loop`);
    for (const frame of [...(state.start ?? []), ...state.loop]) {
      for (const region of Object.keys(frame.move ?? {})) {
        if (!pack.regions[region]) fail(`state "${name}" moves unknown region "${region}"`);
      }
      const face = frame.face ?? state.face;
      if (face && !hasFace(pack, face)) fail(`state "${name}" uses missing face "${face}"`);
    }
  }
  for (const name of pack.fidgets?.states ?? []) if (!pack.states[name]) fail(`fidget "${name}" is not a state`);
  for (const id of pack.emotes?.actions ?? []) if (!pack.actions?.[id]) fail(`emote "${id}" is not an action`);
  for (const [id, action] of Object.entries(pack.actions ?? {})) {
    if (!pack.states[action.state]) fail(`action "${id}" plays unknown state "${action.state}"`);
    if (action.area && !pack.hitAreas?.[action.area]) fail(`action "${id}" uses unknown hit area "${action.area}"`);
  }
  const layerIds = new Set(pack.layers.map((l) => l.id));
  for (const [name, area] of Object.entries(pack.hitAreas ?? {})) {
    if (!Array.isArray(area)) for (const layer of area.layers) if (!layerIds.has(layer)) fail(`hit area "${name}" covers unknown layer "${layer}"`);
  }
  for (const [slot, def] of Object.entries(pack.slots)) {
    for (const [id, variant] of Object.entries(def.variants)) {
      for (const layer of variant.hides ?? []) if (!layerIds.has(layer)) fail(`${slot}.${id} hides unknown layer "${layer}"`);
      const recolor = variant.recolor;
      if (!recolor) continue;
      if (recolor.region && !pack.regions[recolor.region]) fail(`${slot}.${id} recolors unknown region "${recolor.region}"`);
      for (const layer of recolor.layers ?? []) if (!layerIds.has(layer)) fail(`${slot}.${id} recolors unknown layer "${layer}"`);
    }
  }
  return pack;
};

// The chosen variant, or the slot's first one when the id is unknown (old settings).
export const variantOf = (pack: CharacterPack, slot: string, id: string | undefined): [string, Variant] | undefined => {
  const variants = pack.slots[slot]?.variants ?? {};
  if (id && variants[id]) return [id, variants[id]];
  return Object.entries(variants)[0];
};

export const hasFace = (pack: CharacterPack, face: string) =>
  face === 'open' || Boolean(pack.expressions ? pack.expressions[face] : pack.cells[`face.${face}`]);

// Whether `face` has art for a turned head.
export const faceTurns = (pack: CharacterPack, face: string, head: string): boolean => {
  const own = resolveHead(pack, head).head!;
  return pack.expressions ? Boolean(pack.expressions[`${face}@${own}`]) : face === 'open' || Boolean(pack.cells[`face.${face}@${own}`]);
};

const hasOwnHead = (pack: CharacterPack, head: string) => Object.keys(pack.cells).some((cell) => cell.endsWith(`@${head}`));

// The head cells to draw and whether to flip the frame for them.
export const resolveHead = (pack: CharacterPack, head?: string): { head?: string; flip: boolean } => {
  if (!head || hasOwnHead(pack, head) || !pack.mirror?.[head]) return { head, flip: false };
  return { head: pack.mirror[head], flip: true };
};

export const hasHead = (pack: CharacterPack, head: string) => hasOwnHead(pack, resolveHead(pack, head).head!);

// `<base>#<pose>` (body pose) or else `<base>@<head>` (turned head) when it exists.
const pick = (pack: CharacterPack, base: string, head?: string, pose?: string) => {
  if (pose && pack.cells[`${base}#${pose}`]) return `${base}#${pose}`;
  if (head && pack.cells[`${base}@${head}`]) return `${base}@${head}`;
  return pack.cells[base] ? base : undefined;
};

export const poseCellOf = (def: PoseDef | undefined) => (typeof def === 'string' ? def : def?.cell);

export type LayerCell = { layer: string; cell: string; def: LayerDef; clip?: string };

// Cells to draw, back to front, for an avatar showing `face`.
export const layerCells = (pack: CharacterPack, avatar: Avatar, face: string, head?: string, pose?: string): LayerCell[] => {
  const poseDef = pose ? pack.poses?.[pose] : undefined;
  const poseCell = poseCellOf(poseDef);
  const whole = typeof poseDef === 'object' && poseDef.whole;
  const outfit = whole && typeof poseDef === 'object'
    ? poseDef.outfits?.find(({ when }) => Object.entries(when).every(([slot, id]) => variantOf(pack, slot, avatar[slot])?.[0] === id))
    : undefined;
  if (outfit) return [{ layer: 'outfit', cell: outfit.cell, def: { id: 'outfit' } }];
  const expression = pack.expressions && ((head && pack.expressions[`${face}@${head}`]) || pack.expressions[face] || {});
  let posed = false;
  const hidden = new Set(Object.keys(pack.slots).flatMap((slot) => variantOf(pack, slot, avatar[slot])?.[1].hides ?? []));
  return pack.layers.flatMap((layer): LayerCell[] => {
    // The pose cell takes the first body layer's place; in a whole pose the
    // body layers with their own #pose cell (hair, for its recolor) still draw.
    const first = poseCell && layer.group === 'body' && !posed;
    if (first) posed = true;
    const poseFirst: LayerCell[] = first ? [{ layer: whole ? 'pose' : layer.id, cell: poseCell, def: { id: layer.id } }] : [];
    if (hidden.has(layer.id) || (poseCell && layer.group === 'body' && !whole)) return poseFirst;
    let base = layer.id;
    let variant = '';
    if (layer.from === 'slot') base = `${layer.id}.${variantOf(pack, layer.id, avatar[layer.id])?.[0]}`;
    if (layer.from === 'face') {
      if (!expression) base = `face.${face}`;
      else {
        variant = expression[layer.id] ?? 'open';
        if (variant === 'none') return poseFirst;
        base = `${layer.id}.${variant}`;
      }
    }
    const cell = whole ? (pack.cells[`${base}#${pose}`] ? `${base}#${pose}` : undefined) : pick(pack, base, head, pose);
    if (!cell) return poseFirst;
    if (!layer.clip) return [...poseFirst, { layer: layer.id, cell, def: layer }];
    // A turned head has no mask for this layer: its art is baked into the turned cells.
    const clip = head ? (pack.cells[`${layer.clip}.${variant}@${head}`] ? `${layer.clip}.${variant}@${head}` : undefined) : pick(pack, `${layer.clip}.${variant}`);
    return clip ? [...poseFirst, { layer: layer.id, cell, def: layer, clip }] : poseFirst;
  });
};

export const recolorsFor = (pack: CharacterPack, avatar: Avatar): Recolor[] =>
  Object.keys(pack.slots).flatMap((slot) => {
    const recolor = variantOf(pack, slot, avatar[slot])?.[1].recolor;
    return recolor ? [recolor] : [];
  });
