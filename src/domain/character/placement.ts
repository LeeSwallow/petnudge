import type { Box, Move } from './pack';
import { blank, bounds, over, shift, type Pixels } from './pixels';
import { FRAME, STANDARD_SLOTS, standardPart, type CharacterDraft, type SlotId } from './standard';

// Placing parts on the editor canvas (#58): moving a part, its drawing order,
// and the guides. Every function answers a new draft (or the same one when
// nothing changes), so a draft can go straight into the undo history.
//
// A part is a full 96×112 picture under a layer name (standard.ts); moving it
// shifts the picture. `order` holds every layer name back to front: the
// editor keeps it full, so buildPack draws exactly what the canvas shows.

const STANDARD_NAMES = STANDARD_SLOTS.flatMap((s) => s.parts.map((p) => p.name));

export const emptyDraft = (): CharacterDraft => ({
  id: '',
  name: '',
  persona: '',
  lines: { pat: [], pokeChest: [], pokeBelly: [] },
  parts: {},
  order: [...STANDARD_NAMES]
});

// Every layer back to front: the draft's order, then what it leaves out (as buildPack reads it).
export const fullOrder = (draft: CharacterDraft): string[] => [...new Set([...draft.order, ...STANDARD_NAMES, ...Object.keys(draft.parts)])];

// The layers with a picture, back to front.
export const drawOrder = (draft: CharacterDraft): string[] => fullOrder(draft).filter((name) => draft.parts[name]);

// Whether a layer has anything drawn.
export const isFilled = (draft: CharacterDraft, layer: string) => Boolean(draft.parts[layer] && bounds(draft.parts[layer]));

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((v, i) => v === b[i]);
const withOrder = (draft: CharacterDraft, order: string[]): CharacterDraft => (sameList(order, fullOrder(draft)) ? draft : { ...draft, order });

export const setPart = (draft: CharacterDraft, layer: string, pixels: Pixels): CharacterDraft => {
  if (!standardPart(layer)) throw new Error(`표준 칸에 없는 부위예요: ${layer}`);
  if (pixels.w !== FRAME.w || pixels.h !== FRAME.h) throw new Error(`부위 그림은 ${FRAME.w}×${FRAME.h}여야 해요: ${layer}`);
  const order = fullOrder(draft);
  return { ...draft, parts: { ...draft.parts, [layer]: pixels }, order: order.includes(layer) ? order : [...order, layer] };
};

// Empties a slot. A decoration leaves the order too; a standard layer keeps its place.
export const removePart = (draft: CharacterDraft, layer: string): CharacterDraft => {
  if (!draft.parts[layer]) return draft;
  const { [layer]: _, ...parts } = draft.parts;
  const order = fullOrder(draft).filter((name) => name !== layer || STANDARD_NAMES.includes(name));
  return { ...draft, parts, order };
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v)) || 0; // `|| 0`: no -0

// The part of a move that keeps `box` inside the canvas.
export const clampMove = ([x0, y0, x1, y1]: Box, dx: number, dy: number): Move => [clamp(dx, -x0, FRAME.w - x1), clamp(dy, -y0, FRAME.h - y1)];

// Moves a part by whole pixels. Pixels never leave the canvas: the move stops
// where the part's outer box meets the edge.
export const movePart = (draft: CharacterDraft, layer: string, dx: number, dy: number): CharacterDraft => {
  const pixels = draft.parts[layer];
  const box = pixels && bounds(pixels);
  if (!box) return draft;
  const [mx, my] = clampMove(box, Math.round(dx), Math.round(dy));
  if (mx === 0 && my === 0) return draft;
  return { ...draft, parts: { ...draft.parts, [layer]: shift(pixels, [mx, my]) } };
};

// Puts a layer at `toIndex` of the full order.
export const setOrder = (draft: CharacterDraft, layer: string, toIndex: number): CharacterDraft => {
  const order = fullOrder(draft);
  if (!order.includes(layer)) return draft;
  const rest = order.filter((name) => name !== layer);
  rest.splice(clamp(Math.round(toIndex), 0, rest.length), 0, layer);
  return withOrder(draft, rest);
};

// One step forward (toward the viewer) or backward, past the next layer with a picture.
const step = (draft: CharacterDraft, layer: string, by: 1 | -1): CharacterDraft => {
  const drawn = drawOrder(draft);
  const other = drawn[drawn.indexOf(layer) + by];
  if (!drawn.includes(layer) || !other) return draft;
  const rest = fullOrder(draft).filter((name) => name !== layer);
  rest.splice(rest.indexOf(other) + (by === 1 ? 1 : 0), 0, layer);
  return withOrder(draft, rest);
};
export const bringForward = (draft: CharacterDraft, layer: string) => step(draft, layer, 1);
export const sendBackward = (draft: CharacterDraft, layer: string) => step(draft, layer, -1);

const slotOf = (layer: string): SlotId | undefined => standardPart(layer)?.slot;

// The slots back to front, by their first layer; a slot with no layer (no decorations yet) goes last.
export const slotOrder = (draft: CharacterDraft): SlotId[] => {
  const seen = new Set(fullOrder(draft).map(slotOf).filter((s): s is SlotId => Boolean(s)));
  return [...new Set([...seen, ...STANDARD_SLOTS.map((s) => s.id)])];
};

// Moves a whole slot (all its layers, in their order) to `toIndex` of slotOrder.
export const moveSlot = (draft: CharacterDraft, slot: SlotId, toIndex: number): CharacterDraft => {
  const slots = slotOrder(draft).filter((s) => s !== slot);
  slots.splice(clamp(Math.round(toIndex), 0, slots.length), 0, slot);
  const order = fullOrder(draft);
  return withOrder(draft, slots.flatMap((s) => order.filter((name) => slotOf(name) === s)));
};

// The drawn parts flattened back to front (pixel art: any opaque pixel wins).
export const composite = (draft: CharacterDraft): Pixels => {
  const out = blank(FRAME.w, FRAME.h);
  for (const name of drawOrder(draft)) over(out, draft.parts[name]);
  return out;
};

const boxes = (draft: CharacterDraft, pick: (layer: string) => boolean): Box[] =>
  drawOrder(draft).filter(pick).flatMap((name) => {
    const box = bounds(draft.parts[name]);
    return box ? [box] : [];
  });

// Guide: the feet line, the lowest drawn pixel (buildPack's feetY).
export const feetLine = (draft: CharacterDraft): number | undefined => {
  const all = boxes(draft, () => true);
  return all.length ? Math.max(...all.map((b) => b[3])) : undefined;
};

// Guide: the head area, one box around the parts that move with the head (buildPack's `head` region).
export const headBox = (draft: CharacterDraft): Box | undefined => {
  const all = boxes(draft, (name) => Boolean(standardPart(name)?.regions.includes('head')));
  if (!all.length) return undefined;
  return [Math.min(...all.map((b) => b[0])), Math.min(...all.map((b) => b[1])), Math.max(...all.map((b) => b[2])), Math.max(...all.map((b) => b[3]))];
};
