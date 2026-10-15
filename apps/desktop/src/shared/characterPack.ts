import type { ActionDef } from '../renderer/character/actions';

// Character pack v2 ("study-pet-character@2"): layered paper-doll sprites.
// A frame is composed from layers back to front: body parts (hair, head,
// torso, arms, legs...), face features (eyes, iris, mouth...) and outfit
// slots. Moves (breathing, nods, glances) shift a layer whole when it names
// them in `follow`, otherwise they shift its pixels inside the region boxes —
// see timeline.ts and pixels.ts. Authored as <id>.pack.json + <id>.aseprite, built into
// character.json + sheet.png by scripts/build-character.mjs.

export type Box = [x0: number, y0: number, x1: number, y1: number];
export type Move = [dx: number, dy: number];

// `pose` swaps in `<cell>#<pose>` cells (e.g. arms up); `head` forces a turned head.
export type FrameDef = { ms: number; dx?: number; dy?: number; face?: string; pose?: string; head?: string; move?: Record<string, Move> };
export type StateDef = {
  face?: string;
  // Eyes follow the cursor (moves the "eyes" region by the head turn).
  look?: boolean;
  blink?: { everyMs: number; ms: number };
  start?: FrameDef[];
  loop: FrameDef[];
};
export type Recolor = { layers?: string[]; region?: string; map: Record<string, string> };
// `hides`: layers not drawn while this variant is worn (hair that would poke out of a hood).
export type Variant = { label: string; recolor?: Recolor; unlock?: string; hides?: string[] };
export type Slot = { label: string; swatch?: string; variants: Record<string, Variant> };
// `from: 'slot'` draws cell `<id>.<variant>`. `from: 'face'` draws
// `<id>.<variant>` with the variant the expression picks for this layer
// (packs without `expressions` draw `face.<expression>`); otherwise cell `<id>`.
// `follow`: moves that shift the whole layer (summed); without it the layer
// gets the region moves. `clip`: drawn only where cell `<clip>.<variant>` is
// opaque (an iris inside its eye socket), the mask shifted by `clipFollow`.
// `group: 'body'` layers give way to the pose cell while a pose plays.
// `edge`: a 1px contact rim on what is under the layer, just outside it, so
// it stands out (headphones over hair, a jacket over a shirt); `light` is used
// where what is under it is dark.
export type LayerDef = {
  id: string;
  from?: 'slot' | 'face';
  follow?: string[];
  clip?: string;
  clipFollow?: string[];
  group?: 'body';
  edge?: { color: string; opacity: number; light?: string };
  // Region moves this layer ignores (e.g. a jacket keeps still while the arms under it swing).
  ignore?: string[];
};
// Per expression (and `<expression>@<head>` for a turned head): the variant
// each face layer shows. Unlisted layers show `open`; `none` hides the layer.
export type Expression = Record<string, string>;
// A hit area: frame boxes, or the body-part layers it covers.
export type HitArea = Box[] | { layers: string[] };

export type CharacterPack = {
  format: 'study-pet-character@2';
  id: string;
  name: string;
  // How she talks in chat (main/chat.ts), e.g. "밝고 장난기 많은 게이머".
  persona?: string;
  frame: { w: number; h: number };
  feetY: number;
  sheet: string;
  cells: Record<string, [number, number]>;
  layers: LayerDef[];
  expressions?: Record<string, Expression>;
  // Pose name → one cell drawn instead of the `group: 'body'` layers.
  // `whole`: a frame drawn from another view (a side-view walk): only the pose
  // cell and the layers' own `#<pose>` cells are drawn, nothing from the front.
  poses?: Record<string, PoseDef>;
  // Head direction → the one drawn mirrored for it ({ turnR: 'turnL' }): with
  // no cells of its own, it is the other direction flipped left-right.
  mirror?: Record<string, string>;
  regions: Record<string, Box[]>;
  states: Record<string, StateDef>;
  slots: Record<string, Slot>;
  fallback: string;
  // Touch targets on the sprite (frame pixels) and the interactions they start.
  hitAreas?: Record<string, HitArea>;
  actions?: Record<string, ActionDef>;
  // Idle fidgets: every `everyMs` (random in range) idle plays one of these
  // states once, then returns to idle.
  fidgets?: { states: string[]; everyMs: [number, number] };
  // Random emotes: every `everyMs` (random in range) while idle, one of these actions plays.
  emotes?: { actions: string[]; everyMs: [number, number] };
  // Thin silhouette outline drawn by the renderer, `width` in device pixels.
  outline?: { color: string; opacity?: number; width?: number };
};

// Chosen variant id per slot.
export type Avatar = Record<string, string>;

const fail = (message: string): never => {
  throw new Error(`character pack: ${message}`);
};

export const validatePack = (input: unknown): CharacterPack => {
  const pack = input as CharacterPack;
  if (pack?.format !== 'study-pet-character@2') fail(`unsupported format ${String(pack?.format)}`);
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
  for (const [pose, def] of Object.entries(pack.poses ?? {})) if (!pack.cells[poseCellOf(def)!]) fail(`pose "${pose}" uses missing cell "${poseCellOf(def)}"`);
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

export type PoseDef = string | { cell: string; whole?: boolean };
export const poseCellOf = (def: PoseDef | undefined) => (typeof def === 'string' ? def : def?.cell);

export type LayerCell = { layer: string; cell: string; def: LayerDef; clip?: string };

// Cells to draw, back to front, for an avatar showing `face`.
export const layerCells = (pack: CharacterPack, avatar: Avatar, face: string, head?: string, pose?: string): LayerCell[] => {
  const poseDef = pose ? pack.poses?.[pose] : undefined;
  const poseCell = poseCellOf(poseDef);
  const whole = typeof poseDef === 'object' && poseDef.whole;
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
