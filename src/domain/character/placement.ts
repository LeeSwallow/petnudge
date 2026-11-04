import type { Box, Move } from './pack';
import {
  ancestorsOf, clampCanvas, findPart, isPartId, isVariantName, MAX_DEPTH, partBox, picturesOf, restVariant, ROOT, subtreeOf, unionBox,
  type BodyKind, type CharacterDraft, type Part, type Role
} from './parts';
import { blank, over, shift, type Pixels } from './pixels';
import { DEFAULT_TEMPLATE, fromTemplate, type TemplateId } from './standard';

// Editing the parts on the editor canvas (#58, #71): pictures, adding and
// deleting parts, parents and pivots, moving, the drawing order, the canvas
// size and the guides. Every function answers a new draft (or the same one
// when nothing changes), so a draft can go straight into the undo history.
//
// A part is a full-canvas picture; moving it shifts the picture (and its
// variants and pivot). `draft.parts` is the drawing order, back to front.

type Canvas = { w: number; h: number };

export const emptyDraft = (template: TemplateId = DEFAULT_TEMPLATE): CharacterDraft => fromTemplate(template);

// Every part id, back to front.
export const partIds = (draft: CharacterDraft): string[] => draft.parts.map((p) => p.id);

// The parts with something drawn, back to front.
export const drawOrder = (draft: CharacterDraft): string[] => draft.parts.filter((p) => partBox(p)).map((p) => p.id);

export const isFilled = (draft: CharacterDraft, id: string) => Boolean(findPart(draft, id) && partBox(findPart(draft, id)!));

const withPart = (draft: CharacterDraft, id: string, change: (part: Part) => Part): CharacterDraft => {
  const part = findPart(draft, id);
  if (!part) return draft;
  const next = change(part);
  return next === part ? draft : { ...draft, parts: draft.parts.map((p) => (p.id === id ? next : p)) };
};

const sizeError = (draft: CharacterDraft, id: string) => new Error(`부위 그림은 ${draft.canvas.w}×${draft.canvas.h}여야 해요: ${id}`);

// Puts a picture in a part, at rest or as a variant (`closed` eyes); the
// rest name of the part (`open`, a mouth's `closed`) is the picture at rest.
export const setPixels = (draft: CharacterDraft, id: string, pixels: Pixels, variant?: string): CharacterDraft => {
  const part = findPart(draft, id);
  if (!part) throw new Error(`없는 부위예요: ${id}`);
  if (pixels.w !== draft.canvas.w || pixels.h !== draft.canvas.h) throw sizeError(draft, id);
  if (!variant || variant === restVariant(part)) return withPart(draft, id, (p) => ({ ...p, pixels }));
  if (!isVariantName(variant)) throw new Error(`변형 이름이 맞지 않아요: ${variant}`);
  return withPart(draft, id, (p) => ({ ...p, variants: { ...p.variants, [variant]: pixels } }));
};

// Empties a part (its variants go too); the part stays in the list.
export const clearPart = (draft: CharacterDraft, id: string): CharacterDraft =>
  withPart(draft, id, (p) => {
    if (!partBox(p) && !p.variants) return p;
    const { variants: _, ...rest } = p;
    return { ...rest, pixels: blank(draft.canvas.w, draft.canvas.h) };
  });

const IMAGE_EXT = /\.(png|pxo|aseprite|ase)$/i;

// A part id from a name (a file or layer name, a label), unique among `taken`.
export const newPartId = (name: string, taken: readonly string[], fallback = 'part'): string => {
  const base = name.replace(IMAGE_EXT, '').toLowerCase().replace(/[^a-z0-9.-]/g, '').replace(/\.{2,}/g, '.').replace(/^[^a-z]+/, '').replace(/[.-]+$/, '').slice(0, 32) || fallback;
  const free = (id: string) => isPartId(id) && !taken.includes(id);
  if (free(base)) return base;
  for (let n = 2; ; n++) if (free(`${base}-${n}`)) return `${base}-${n}`;
};

export type NewPart = { label: string; role?: Role; parent?: string; id?: string; pixels?: Pixels };

// A new empty part at the front (drawn over the others). Its id comes from the
// label (or the role, for a name with no Latin letters).
export const addPart = (draft: CharacterDraft, spec: NewPart): { draft: CharacterDraft; id: string } => {
  const taken = partIds(draft);
  const id = spec.id && isPartId(spec.id) && !taken.includes(spec.id) ? spec.id : newPartId(spec.label, taken, spec.role ?? 'part');
  const parent = spec.parent && findPart(draft, spec.parent) ? spec.parent : ROOT;
  if (spec.pixels && (spec.pixels.w !== draft.canvas.w || spec.pixels.h !== draft.canvas.h)) throw sizeError(draft, id);
  const part: Part = { id, label: spec.label.trim().slice(0, 40) || id, parent, pixels: spec.pixels ?? blank(draft.canvas.w, draft.canvas.h), ...(spec.role ? { role: spec.role } : {}) };
  return { draft: { ...draft, parts: [...draft.parts, part] }, id };
};

// Takes a part out of the draft; what hung on it hangs on its parent.
export const deletePart = (draft: CharacterDraft, id: string): CharacterDraft => {
  const part = findPart(draft, id);
  if (!part) return draft;
  const parts = draft.parts.filter((p) => p.id !== id).map((p) => (p.parent === id ? { ...p, parent: part.parent } : p));
  const expressions = draft.expressions && Object.fromEntries(Object.entries(draft.expressions).map(([name, picks]) => [name, Object.fromEntries(Object.entries(picks).filter(([pid]) => pid !== id))]));
  return { ...draft, parts, ...(expressions ? { expressions } : {}) };
};

export const updatePart = (draft: CharacterDraft, id: string, change: { label?: string; role?: Role | null }): CharacterDraft =>
  withPart(draft, id, (p) => {
    const label = change.label === undefined ? p.label : change.label.trim().slice(0, 40) || p.label;
    const role = change.role === undefined ? p.role : change.role ?? undefined;
    if (label === p.label && role === p.role) return p;
    const { role: _, ...rest } = p;
    return { ...rest, label, ...(role ? { role } : {}) };
  });

// Why `id` cannot hang on `parent`, or null when it can.
export const canSetParent = (draft: CharacterDraft, id: string, parent: string): string | null => {
  if (!findPart(draft, id)) return `없는 부위예요: ${id}`;
  if (parent === ROOT) return null;
  if (!findPart(draft, parent)) return `붙일 부위가 없어요: ${parent}`;
  if (parent === id) return '부위를 자기 자신에게 붙일 수 없어요';
  if (subtreeOf(draft, id).includes(parent)) return '부위를 자기에게 붙은 부위에 붙일 수 없어요';
  const depth = ancestorsOf(draft, parent).length + 1 + Math.max(...subtreeOf(draft, id).map((d) => ancestorsOf(draft, d).length - ancestorsOf(draft, id).length + 1));
  if (depth > MAX_DEPTH) return `부위는 ${MAX_DEPTH}단계까지 이어 붙일 수 있어요`;
  return null;
};

// Hangs a part on another (or `root`). Its pictures stay where they are.
export const setParent = (draft: CharacterDraft, id: string, parent: string): CharacterDraft => {
  const why = canSetParent(draft, id, parent);
  if (why) throw new Error(why);
  return withPart(draft, id, (p) => (p.parent === parent ? p : { ...p, parent }));
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v)) || 0; // `|| 0`: no -0

const clampPoint = ([x, y]: [number, number], { w, h }: Canvas): [number, number] => [clamp(Math.round(x), 0, w - 1), clamp(Math.round(y), 0, h - 1)];

export const setPivot = (draft: CharacterDraft, id: string, point: [number, number]): CharacterDraft => {
  const pivot = clampPoint(point, draft.canvas);
  return withPart(draft, id, (p) => (p.pivot && p.pivot[0] === pivot[0] && p.pivot[1] === pivot[1] ? p : { ...p, pivot }));
};

// The part of a move that keeps `box` inside the canvas.
export const clampMove = ([x0, y0, x1, y1]: Box, dx: number, dy: number, { w, h }: Canvas): Move => [clamp(dx, -x0, w - x1), clamp(dy, -y0, h - y1)];

const shifted = (part: Part, move: Move): Part => ({
  ...part,
  pixels: shift(part.pixels, move),
  ...(part.variants ? { variants: Object.fromEntries(Object.entries(part.variants).map(([v, px]) => [v, shift(px, move)])) } : {}),
  ...(part.pivot ? { pivot: [part.pivot[0] + move[0], part.pivot[1] + move[1]] as [number, number] } : {})
});

// Moves a part (all its pictures and its pivot) by whole pixels. Pixels never
// leave the canvas: the move stops where the part's outer box meets the edge.
export const movePart = (draft: CharacterDraft, id: string, dx: number, dy: number): CharacterDraft =>
  withPart(draft, id, (p) => {
    const box = partBox(p);
    if (!box) return p;
    const [mx, my] = clampMove(box, Math.round(dx), Math.round(dy), draft.canvas);
    return mx === 0 && my === 0 ? p : shifted(p, [mx, my]);
  });

const withOrder = (draft: CharacterDraft, ids: string[]): CharacterDraft => {
  if (ids.every((id, i) => draft.parts[i]?.id === id)) return draft;
  return { ...draft, parts: ids.map((id) => findPart(draft, id)!) };
};

// Puts a part at `toIndex` of the order.
export const setOrder = (draft: CharacterDraft, id: string, toIndex: number): CharacterDraft => {
  if (!findPart(draft, id)) return draft;
  const rest = partIds(draft).filter((p) => p !== id);
  rest.splice(clamp(Math.round(toIndex), 0, rest.length), 0, id);
  return withOrder(draft, rest);
};

// One step forward (toward the viewer) or backward, past the next drawn part.
const step = (draft: CharacterDraft, id: string, by: 1 | -1): CharacterDraft => {
  const drawn = drawOrder(draft);
  const other = drawn[drawn.indexOf(id) + by];
  if (!drawn.includes(id) || !other) return draft;
  const rest = partIds(draft).filter((p) => p !== id);
  rest.splice(rest.indexOf(other) + (by === 1 ? 1 : 0), 0, id);
  return withOrder(draft, rest);
};
export const bringForward = (draft: CharacterDraft, id: string) => step(draft, id, 1);
export const sendBackward = (draft: CharacterDraft, id: string) => step(draft, id, -1);

// Puts `id` just in front of (drawn after) or behind `target` (the layer panel's drop).
export const placeBeside = (draft: CharacterDraft, id: string, target: string, side: 'front' | 'back'): CharacterDraft => {
  if (id === target || !findPart(draft, id) || !findPart(draft, target)) return draft;
  const rest = partIds(draft).filter((p) => p !== id);
  rest.splice(rest.indexOf(target) + (side === 'front' ? 1 : 0), 0, id);
  return withOrder(draft, rest);
};

// The front-most part drawn at (x, y), for picking on the canvas; parts in `skip` (hidden or locked) are passed over.
export const partAt = (draft: CharacterDraft, x: number, y: number, skip: ReadonlySet<string> = new Set()): string | undefined => {
  const { w, h } = draft.canvas;
  if (x < 0 || y < 0 || x >= w || y >= h) return undefined;
  return [...draft.parts].reverse().find((p) => !skip.has(p.id) && p.pixels.data[y * w + x] >>> 24 !== 0)?.id;
};

// The parts at rest flattened back to front (pixel art: any opaque pixel wins), without `hidden`.
export const composite = (draft: CharacterDraft, hidden: ReadonlySet<string> = new Set()): Pixels => {
  const out = blank(draft.canvas.w, draft.canvas.h);
  for (const p of draft.parts) if (!hidden.has(p.id)) over(out, p.pixels);
  return out;
};

const opaqueCount = (px: Pixels) => px.data.reduce((n, p) => n + (p >>> 24 ? 1 : 0), 0);

// A picture moved onto a canvas of another size, `dx`/`dy` from the old corner.
const reframe = (px: Pixels, { w, h }: Canvas, dx: number, dy: number): Pixels => {
  const out = blank(w, h);
  for (let y = 0; y < px.h; y++) {
    const ty = y + dy;
    if (ty < 0 || ty >= h) continue;
    for (let x = 0; x < px.w; x++) {
      const tx = x + dx;
      if (tx >= 0 && tx < w) out.data[ty * w + tx] = px.data[y * px.w + x];
    }
  }
  return out;
};

// A picture from a canvas of size `from` on one of size `to`, the way resizeCanvas moves parts.
export const toCanvas = (px: Pixels, from: Canvas, to: Canvas): Pixels =>
  from.w === to.w && from.h === to.h ? px : reframe(px, to, Math.floor((to.w - from.w) / 2), to.h - from.h);

export type Lost = { id: string; label: string; pixels: number };

// A new canvas size, clamped to the limits (multiples of 8). The pictures keep
// standing on the same ground: centred left-right, the bottom edge kept.
// `lost`: the parts that lose drawn pixels outside the new canvas, and how
// many, so the editor can ask first.
export const resizeCanvas = (draft: CharacterDraft, w: number, h: number): { draft: CharacterDraft; lost: Lost[] } => {
  const canvas = clampCanvas(w, h);
  if (canvas.w === draft.canvas.w && canvas.h === draft.canvas.h) return { draft, lost: [] };
  const dx = Math.floor((canvas.w - draft.canvas.w) / 2);
  const dy = canvas.h - draft.canvas.h;
  const lost: Lost[] = [];
  const parts = draft.parts.map((p): Part => {
    const before = picturesOf(p).reduce((n, px) => n + opaqueCount(px), 0);
    const next: Part = {
      ...p,
      pixels: reframe(p.pixels, canvas, dx, dy),
      ...(p.variants ? { variants: Object.fromEntries(Object.entries(p.variants).map(([v, px]) => [v, reframe(px, canvas, dx, dy)])) } : {}),
      ...(p.pivot ? { pivot: clampPoint([p.pivot[0] + dx, p.pivot[1] + dy], canvas) } : {})
    };
    const gone = before - picturesOf(next).reduce((n, px) => n + opaqueCount(px), 0);
    if (gone) lost.push({ id: p.id, label: p.label, pixels: gone });
    return next;
  });
  return { draft: { ...draft, canvas, parts }, lost };
};

// Whether the body is one piece with the head (then a head part is not needed).
export const setMerged = (draft: CharacterDraft, merged: boolean): CharacterDraft => (draft.body.merged === merged ? draft : { ...draft, body: { ...draft.body, merged } });

// On feet (biped) or without legs (legless: it hovers instead of hopping when it has no feet).
export const setBodyKind = (draft: CharacterDraft, kind: BodyKind): CharacterDraft => (draft.body.kind === kind ? draft : { ...draft, body: { ...draft.body, kind } });

// Parts of another character into this draft: a part with the same id gets
// its pictures, any other is added at the front with its label, role and
// parent (when this draft has that parent). Pictures move to this canvas the
// way resizeCanvas would move them (centred, standing on the same ground).
export const copyParts = (draft: CharacterDraft, from: CharacterDraft, ids: readonly string[]): CharacterDraft => {
  let next = draft;
  for (const id of ids) {
    const source = findPart(from, id);
    if (!source) continue;
    const fit = (px: Pixels) => toCanvas(px, from.canvas, draft.canvas);
    const variants = source.variants && Object.fromEntries(Object.entries(source.variants).map(([v, px]) => [v, fit(px)]));
    if (findPart(next, id)) {
      next = withPart(next, id, (p) => {
        const { variants: _, ...rest } = p;
        return { ...rest, pixels: fit(source.pixels), ...(variants ? { variants } : {}) };
      });
      continue;
    }
    const added = addPart(next, { id, label: source.label, role: source.role, parent: source.parent, pixels: fit(source.pixels) });
    next = variants ? withPart(added.draft, added.id, (p) => ({ ...p, variants })) : added.draft;
  }
  return next;
};

// A picture of at most the canvas size (RGBA as uint32, row by row) as a
// full-canvas part picture: a smaller one goes in the middle, to be moved from there.
export const framePicture = (w: number, h: number, data: Uint32Array, canvas: Canvas): Pixels => {
  if (w > canvas.w || h > canvas.h) throw new Error(`그림이 ${w}×${h}예요. ${canvas.w}×${canvas.h} 이하로 줄여 주세요 (격자 정리)`);
  if (w === canvas.w && h === canvas.h) return { w, h, data: data.slice() };
  return reframe({ w, h, data }, canvas, Math.floor((canvas.w - w) / 2), Math.floor((canvas.h - h) / 2));
};

// Guide: the feet line, the lowest foot pixel (buildPack's feetY); without feet, the lowest pixel.
export const feetLine = (draft: CharacterDraft): number | undefined => {
  const feet = draft.parts.filter((p) => p.role === 'foot').map(partBox).filter((b): b is Box => Boolean(b));
  const all = feet.length ? feet : draft.parts.map(partBox).filter((b): b is Box => Boolean(b));
  return all.length ? Math.max(...all.map((b) => b[3])) : undefined;
};

// Guide: the head area (buildPack's `head` hit area): the head and what hangs
// on it, or the top half of a body with no head.
export const headBox = (draft: CharacterDraft): Box | undefined => {
  const heads = draft.parts.filter((p) => p.role === 'head' && partBox(p));
  if (heads.length) {
    const ids = new Set([...heads.flatMap((p) => subtreeOf(draft, p.id)), ...draft.parts.filter((p) => p.role === 'hair').map((p) => p.id)]);
    return unionBox(draft.parts.filter((p) => ids.has(p.id)).map(partBox).filter((b): b is Box => Boolean(b)));
  }
  const body = unionBox(draft.parts.filter((p) => p.role === 'body').map(partBox).filter((b): b is Box => Boolean(b)));
  if (!body) return undefined;
  return [body[0], body[1], body[2], Math.max(body[1] + 1, Math.floor((body[1] + body[3]) / 2))];
};
