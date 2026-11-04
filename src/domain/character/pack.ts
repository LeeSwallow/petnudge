// Character pack types ("study-pet-character@2" and the standard pack "@3").
// Pure data shapes, so the domain (buildPack) can produce a pack; validation
// and layer lookup stay in src/shared/characterPack.ts, which re-exports these.
//
// A frame is composed from layers back to front: body parts (hair, head,
// torso, arms, legs...), face features (eyes, iris, mouth...) and outfit
// slots. Moves (breathing, nods, glances) shift a layer whole when it names
// them in `follow`, otherwise they shift its pixels inside the region boxes.

export type Box = [x0: number, y0: number, x1: number, y1: number];
export type Move = [dx: number, dy: number];

export const PACK_FORMATS = ['study-pet-character@2', 'study-pet-character@3'] as const;
export type PackFormat = (typeof PACK_FORMATS)[number];

// `pose` swaps in `<cell>#<pose>` cells (e.g. arms up); `head` forces a turned head.
// `flip` (@3) draws the frame mirrored left-right around the frame centre; L/R
// parts flip with the picture (no renaming).
export type FrameDef = { ms: number; dx?: number; dy?: number; face?: string; pose?: string; head?: string; move?: Record<string, Move>; flip?: boolean };
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
// `unlock` is read from older packs and ignored (unlocks were removed, #38).
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

export type Fx = 'hearts' | 'stars' | 'anger' | 'sweat' | 'sparkles';

// Interactions ("actions") are data in the pack: where they trigger (a hit
// area on the sprite, and/or the right-click menu), which state plays, for how
// long, with what effect and what she says. Adding one is a pack change only.
export type ActionDef = {
  label: string;
  // Hit area that triggers it on right-click (left-click too for `tap`).
  area?: string;
  tap?: boolean;
  // Listed in the right-click menu.
  menu?: boolean;
  state: string;
  ms: number;
  fx?: Fx;
  lines?: string[];
};

// `outfits`: in a whole pose, a cell drawn with the clothes on, used alone
// (no overlays) when the avatar wears every slot variant in `when`. Overlays
// drawn frame by frame never line up as well as one drawing of the outfit.
// `wears`: the slot variants the pose's own cell is drawn in (Lila walks
// without outer or headwear), so that combination counts as drawn too. A
// whole pose with outfit drawings allows only the combinations it has a
// drawing for (outfits.ts), so every state shows the same clothes.
export type PoseOutfit = { when: Record<string, string>; cell: string };
export type PoseDef = string | { cell: string; whole?: boolean; wears?: Record<string, string>; outfits?: PoseOutfit[] };

export type CharacterPack = {
  format: PackFormat;
  // Standard packs (@3) made by the character editor.
  editor?: { version: 1 };
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
