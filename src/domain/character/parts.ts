import type { Box } from './pack';
import { bounds, type Pixels } from './pixels';

// The character editor's free part model (#71, spec "자율 구조 › 1. 도트").
// A character is a list of parts the user makes, back to front; nothing about
// it is a fixed table. A part is a full-canvas picture with a parent (another
// part or `root`), a pivot, an optional role tag and optional variants (eyes
// open/closed, a mouth closed/open). Every body but a four-legged animal:
// `biped` (on feet) or `legless` (a one-piece mascot, a slime, a floating
// ghost). Only a body part is required; feet are optional; a head is needed
// only when the body is not one piece with it.
// Proportions are never a setting: buildPack reads them from the pictures.

export const ROLES = ['body', 'head', 'eye', 'mouth', 'foot', 'hand', 'hair', 'ear', 'tail', 'accessory'] as const;
export type Role = (typeof ROLES)[number];

export type Part = {
  // Unique in the draft: a-z0-9 words joined by dots or dashes; the pack's layer and region name.
  id: string;
  label: string;
  // The part at rest, a full-canvas picture (the part keeps its place on the canvas).
  pixels: Pixels;
  parent: string;
  // Centre of follow and sway; the box centre when unset.
  pivot?: [number, number];
  role?: Role;
  // Other pictures of the part (`closed` eyes, an `open` mouth), each full-canvas.
  variants?: Record<string, Pixels>;
};

// Quadrupeds are left out for now; more kinds can come later.
export const BODY_KINDS = ['biped', 'legless'] as const;
export type BodyKind = (typeof BODY_KINDS)[number];
export type BodyDef = { kind: BodyKind; merged: boolean };

// Reaction lines the user writes in the editor, per interaction.
export type DraftLines = { pat: string[]; pokeChest: string[]; pokeBelly: string[] };

export type CharacterDraft = {
  id: string;
  name: string;
  persona: string;
  lines: DraftLines;
  canvas: { w: number; h: number };
  body: BodyDef;
  // Back to front.
  parts: Part[];
  // Named expressions: per part, the variant it shows (`웃음 = 눈:smile + 입:open`).
  expressions?: Record<string, Record<string, string>>;
};

export const ROOT = 'root';
export const CANVAS_LIMITS = { w: [48, 160], h: [48, 192], step: 8 } as const;
// A follow chain holds a part and its ancestors (and `eyes`); the pack allows 8.
export const MAX_DEPTH = 7;
export const MAX_PARTS = 64;
// Region names the runtime gives a meaning (the eyes glance by `eyes`).
const RESERVED = new Set([ROOT, 'eyes']);
const ID = /^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)*$/;
const VARIANT = /^[a-z][a-z0-9-]{0,15}$/;

export const isPartId = (id: string) => id.length <= 40 && ID.test(id) && !RESERVED.has(id);
export const isVariantName = (name: string) => VARIANT.test(name);

// The name of the picture at rest among a part's variants: a mouth rests closed, the rest open.
export const restVariant = (part: Pick<Part, 'role'>) => (part.role === 'mouth' ? 'closed' : 'open');

const snap = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, Math.round((Number.isFinite(v) ? v : lo) / CANVAS_LIMITS.step) * CANVAS_LIMITS.step));
export const clampCanvas = (w: number, h: number) => ({ w: snap(w, CANVAS_LIMITS.w), h: snap(h, CANVAS_LIMITS.h) });
export const validCanvas = ({ w, h }: { w: number; h: number }) => clampCanvas(w, h).w === w && clampCanvas(w, h).h === h;

const unionBox = (boxes: Box[]): Box | undefined =>
  boxes.length ? [Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1])), Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3]))] : undefined;
export { unionBox };

// Every picture of a part: at rest, then its variants.
export const picturesOf = (part: Part): Pixels[] => [part.pixels, ...Object.values(part.variants ?? {})];

// The box around everything drawn in the part (all its pictures), or undefined when it is empty.
export const partBox = (part: Part): Box | undefined => unionBox(picturesOf(part).map(bounds).filter((b): b is Box => Boolean(b)));

export const isDrawn = (part: Part) => Boolean(bounds(part.pixels));

export const pivotOf = (part: Part): [number, number] => {
  if (part.pivot) return part.pivot;
  const box = partBox(part);
  return box ? [Math.floor((box[0] + box[2]) / 2), Math.floor((box[1] + box[3]) / 2)] : [Math.floor(part.pixels.w / 2), Math.floor(part.pixels.h / 2)];
};

export const findPart = (draft: CharacterDraft, id: string) => draft.parts.find((p) => p.id === id);

// The part's ancestors, root-most first (stops at a loop or a missing parent).
export const ancestorsOf = (draft: CharacterDraft, id: string): string[] => {
  const chain: string[] = [];
  let at = findPart(draft, id)?.parent;
  while (at && at !== ROOT && !chain.includes(at) && at !== id) {
    chain.unshift(at);
    at = findPart(draft, at)?.parent;
  }
  return chain;
};
export const depthOf = (draft: CharacterDraft, id: string) => ancestorsOf(draft, id).length + 1;

// `id` and everything hanging on it.
export const subtreeOf = (draft: CharacterDraft, id: string): string[] => [id, ...draft.parts.filter((p) => p.id !== id && ancestorsOf(draft, p.id).includes(id)).map((p) => p.id)];

// The cell names a part's pictures take in the pack: `<id>`, or `<id>.<variant>` each when it has variants.
export const cellsOf = (part: Part): string[] =>
  part.variants && Object.keys(part.variants).length ? [`${part.id}.${restVariant(part)}`, ...Object.keys(part.variants).map((v) => `${part.id}.${v}`)] : [part.id];

export type Problem = { code: 'canvas' | 'id' | 'duplicate' | 'parent' | 'loop' | 'depth' | 'size' | 'variant' | 'cell' | 'count' | 'body' | 'head'; message: string; part?: string };

// What keeps the draft from being a character, each with a message for the user. Empty when it is one.
export const draftProblems = (draft: CharacterDraft): Problem[] => {
  const out: Problem[] = [];
  const { w, h } = draft.canvas;
  if (!validCanvas(draft.canvas)) out.push({ code: 'canvas', message: `캔버스는 너비 ${CANVAS_LIMITS.w.join('~')}, 높이 ${CANVAS_LIMITS.h.join('~')}에 ${CANVAS_LIMITS.step}의 배수여야 해요` });
  if (draft.parts.length > MAX_PARTS) out.push({ code: 'count', message: `부위는 ${MAX_PARTS}개까지 둘 수 있어요` });
  const ids = new Set<string>();
  const cells = new Set<string>();
  for (const part of draft.parts) {
    if (!isPartId(part.id)) out.push({ code: 'id', part: part.id, message: `부위 이름은 영문 소문자, 숫자, 점, 줄표로 써요: ${part.id}` });
    if (ids.has(part.id)) out.push({ code: 'duplicate', part: part.id, message: `같은 이름의 부위가 둘이에요: ${part.id}` });
    ids.add(part.id);
    if (picturesOf(part).some((px) => px.w !== w || px.h !== h)) out.push({ code: 'size', part: part.id, message: `부위 그림은 캔버스(${w}×${h}) 크기여야 해요: ${part.id}` });
    for (const name of Object.keys(part.variants ?? {})) {
      if (!isVariantName(name) || name === restVariant(part)) out.push({ code: 'variant', part: part.id, message: `변형 이름이 맞지 않아요: ${part.id}.${name}` });
    }
    for (const cell of cellsOf(part)) {
      if (cells.has(cell)) out.push({ code: 'cell', part: part.id, message: `그림 이름이 겹쳐요: ${cell}` });
      cells.add(cell);
    }
  }
  for (const part of draft.parts) {
    if (part.parent !== ROOT && !ids.has(part.parent)) out.push({ code: 'parent', part: part.id, message: `붙는 곳이 없어요: ${part.id} → ${part.parent}` });
    else if (part.parent === part.id || ancestorsOf(draft, part.id).includes(part.id) || loops(draft, part.id)) out.push({ code: 'loop', part: part.id, message: `부위가 자기 자신에게 붙어 있어요: ${part.id}` });
    else if (depthOf(draft, part.id) > MAX_DEPTH) out.push({ code: 'depth', part: part.id, message: `부위는 ${MAX_DEPTH}단계까지 이어 붙일 수 있어요: ${part.id}` });
  }
  const drawn = (role: Part['role']) => draft.parts.filter((p) => p.role === role && isDrawn(p)).length;
  if (!drawn('body')) out.push({ code: 'body', message: '몸 부위를 그려 주세요' });
  if (!draft.body.merged && !drawn('head')) out.push({ code: 'head', message: '머리 부위를 그리거나, 몸을 한 덩어리로 정해 주세요' });
  return out;
};

const loops = (draft: CharacterDraft, id: string) => {
  const seen = new Set<string>([id]);
  let at = findPart(draft, id)?.parent;
  while (at && at !== ROOT) {
    if (seen.has(at)) return true;
    seen.add(at);
    at = findPart(draft, at)?.parent;
  }
  return false;
};
