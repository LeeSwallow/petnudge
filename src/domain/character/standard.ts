import { findPart, ROOT, type BodyKind, type CharacterDraft, type DraftLines, type Part, type Role } from './parts';
import { blank, bounds, type Pixels } from './pixels';

// Starter templates (#71): where a new character starts. A template is only a
// prefilled list of empty parts with their roles and parents, on a canvas of
// its proportions; every part can be renamed, re-parented or deleted, and
// more can be added; feet are optional (a critter stands or hops). And the older drafts (#54, fixed layer names like
// `torso.chest`, `eye.L.open`) mapped onto parts, so they still load.

export type { CharacterDraft, DraftLines } from './parts';

export type TemplateId = 'floater' | 'critter' | 'chibi' | 'lila' | 'tall';
type TemplatePart = { id: string; label: string; role: Role; parent: string };
export type Template = { id: TemplateId; label: string; hint: string; canvas: { w: number; h: number }; kind: BodyKind; merged: boolean; parts: readonly TemplatePart[] };

const p = (id: string, label: string, role: Role, parent = ROOT): TemplatePart => ({ id, label, role, parent });

// A person: the head on the body, the face and hair on the head, arms on the body, legs on the ground.
const PERSON: readonly TemplatePart[] = [
  p('hair.back', '뒷머리', 'hair', 'head'),
  p('body', '몸', 'body'),
  p('leg.l', '왼다리', 'foot'),
  p('leg.r', '오른다리', 'foot'),
  p('arm.l', '왼팔', 'hand', 'body'),
  p('arm.r', '오른팔', 'hand', 'body'),
  p('head', '머리', 'head', 'body'),
  p('eye.l', '왼눈', 'eye', 'head'),
  p('eye.r', '오른눈', 'eye', 'head'),
  p('mouth', '입', 'mouth', 'head'),
  p('hair.front', '앞머리', 'hair', 'head')
];

export const TEMPLATES: readonly Template[] = [
  {
    id: 'floater', label: '떠다니는 몸', hint: '다리 없이 한 덩어리, 64×64', canvas: { w: 64, h: 64 }, kind: 'legless', merged: true,
    parts: [p('body', '몸', 'body'), p('eye.l', '왼눈', 'eye', 'body'), p('eye.r', '오른눈', 'eye', 'body'), p('mouth', '입', 'mouth', 'body')]
  },
  {
    id: 'critter', label: '작은 생물', hint: '머리와 몸이 한 덩어리, 발은 있어도 없어도, 72×72', canvas: { w: 72, h: 72 }, kind: 'biped', merged: true,
    parts: [p('foot.l', '왼발', 'foot'), p('foot.r', '오른발', 'foot'), p('body', '몸', 'body'), p('eye.l', '왼눈', 'eye', 'body'), p('eye.r', '오른눈', 'eye', 'body'), p('mouth', '입', 'mouth', 'body')]
  },
  { id: 'chibi', label: '꼬마', hint: '2등신, 80×96', canvas: { w: 80, h: 96 }, kind: 'biped', merged: false, parts: PERSON },
  { id: 'lila', label: 'lila형', hint: '4등신, 96×112', canvas: { w: 96, h: 112 }, kind: 'biped', merged: false, parts: PERSON },
  { id: 'tall', label: '키 큰 사람', hint: '8등신, 64×160', canvas: { w: 64, h: 160 }, kind: 'biped', merged: false, parts: PERSON }
];

export const DEFAULT_TEMPLATE: TemplateId = 'lila';

export const fromTemplate = (id: TemplateId): CharacterDraft => {
  const t = TEMPLATES.find((x) => x.id === id) ?? TEMPLATES.find((x) => x.id === DEFAULT_TEMPLATE)!;
  return {
    id: '',
    name: '',
    persona: '',
    lines: { pat: [], pokeChest: [], pokeBelly: [] },
    canvas: { ...t.canvas },
    body: { kind: t.kind, merged: t.merged },
    parts: t.parts.map((part) => ({ ...part, pixels: blank(t.canvas.w, t.canvas.h) }))
  };
};

// ---- Older drafts (#54): fixed layer names on a 96×112 canvas. ----

export const LEGACY_FRAME = { w: 96, h: 112 } as const;

export type LegacyDraft = { id: string; name: string; persona: string; lines: DraftLines; parts: Record<string, Pixels>; order: string[] };

type LegacyInfo = { id: string; label: string; role: Role; parent: string; variant?: string };
// Back to front, the old slot order.
const LEGACY: readonly [string, LegacyInfo][] = [
  ['hair.back', { id: 'hair.back', label: '뒷머리', role: 'hair', parent: 'head' }],
  ['torso.chest', { id: 'body', label: '몸', role: 'body', parent: ROOT }],
  ['torso.belly', { id: 'belly', label: '배', role: 'body', parent: ROOT }],
  ['leg.L', { id: 'leg.l', label: '왼다리', role: 'foot', parent: ROOT }],
  ['leg.R', { id: 'leg.r', label: '오른다리', role: 'foot', parent: ROOT }],
  ['arm.L', { id: 'arm.l', label: '왼팔', role: 'hand', parent: 'body' }],
  ['arm.R', { id: 'arm.r', label: '오른팔', role: 'hand', parent: 'body' }],
  ['head', { id: 'head', label: '머리', role: 'head', parent: 'body' }],
  ['eye.L.open', { id: 'eye.l', label: '왼눈', role: 'eye', parent: 'head', variant: 'open' }],
  ['eye.L.closed', { id: 'eye.l', label: '왼눈', role: 'eye', parent: 'head', variant: 'closed' }],
  ['eye.R.open', { id: 'eye.r', label: '오른눈', role: 'eye', parent: 'head', variant: 'open' }],
  ['eye.R.closed', { id: 'eye.r', label: '오른눈', role: 'eye', parent: 'head', variant: 'closed' }],
  ['mouth.closed', { id: 'mouth', label: '입', role: 'mouth', parent: 'head', variant: 'closed' }],
  ['mouth.open', { id: 'mouth', label: '입', role: 'mouth', parent: 'head', variant: 'open' }],
  ['hair.front', { id: 'hair.front', label: '앞머리', role: 'hair', parent: 'head' }]
];
const LEGACY_MAP = new Map(LEGACY);
const CUSTOM = /^custom\.([a-zA-Z][a-zA-Z0-9-]{0,31})$/;

// The part (and variant) an old layer name is, or undefined for a name with no part.
// A decoration `custom.<name>` is an accessory named in lowercase; its parent is decided by place.
export const legacyPart = (name: string): LegacyInfo | undefined => {
  const custom = CUSTOM.exec(name);
  if (custom) return { id: custom[1].toLowerCase(), label: custom[1], role: 'accessory', parent: ROOT };
  return LEGACY_MAP.get(name);
};

const inside = (box: [number, number, number, number] | undefined, x: number, y: number) => Boolean(box && x >= box[0] && x < box[2] && y >= box[1] && y < box[3]);

// An old draft as parts: its order kept (each part where its first picture was),
// the open eye / closed mouth as the picture at rest and the others as variants.
export const fromLegacyDraft = (old: LegacyDraft): CharacterDraft => {
  const names = [...new Set([...old.order, ...LEGACY.map(([n]) => n), ...Object.keys(old.parts)])].filter((n) => old.parts[n] && bounds(old.parts[n]) && legacyPart(n));
  const pictures = new Map<string, { info: LegacyInfo; byVariant: Map<string, Pixels> }>();
  for (const name of names) {
    const info = legacyPart(name)!;
    const entry = pictures.get(info.id) ?? { info, byVariant: new Map() };
    entry.byVariant.set(info.variant ?? '', old.parts[name]);
    pictures.set(info.id, entry);
  }
  const parts: Part[] = [...pictures.values()].map(({ info, byVariant }) => {
    const rest = info.role === 'mouth' ? 'closed' : 'open';
    const restPicture = byVariant.get(rest) ?? byVariant.get('') ?? [...byVariant.values()][0];
    const variants = Object.fromEntries([...byVariant].filter(([v, px]) => v && px !== restPicture));
    const part: Part = { id: info.id, label: info.label, role: info.role, parent: info.parent, pixels: restPicture };
    return Object.keys(variants).length ? { ...part, variants } : part;
  });
  const draft: CharacterDraft = {
    id: old.id, name: old.name, persona: old.persona, lines: old.lines, canvas: { ...LEGACY_FRAME },
    body: { kind: parts.some((part) => part.role === 'foot') ? 'biped' : 'legless', merged: !parts.some((part) => part.role === 'head') }, parts
  };
  // A missing parent: the parent's own parent (an eye without a head hangs on the body).
  const parentOf = (id: string): string => {
    if (id === ROOT || findPart(draft, id)) return id;
    const via = LEGACY.find(([, i]) => i.id === id)?.[1].parent;
    return via ? parentOf(via) : ROOT;
  };
  const head = findPart(draft, 'head');
  const body = findPart(draft, 'body');
  draft.parts = parts.map((part) => {
    if (part.role !== 'accessory') return { ...part, parent: parentOf(part.parent) };
    const box = bounds(part.pixels)!;
    const [cx, cy] = [Math.floor((box[0] + box[2]) / 2), Math.floor((box[1] + box[3]) / 2)];
    return { ...part, parent: head && inside(bounds(head.pixels), cx, cy) ? 'head' : body && inside(bounds(body.pixels), cx, cy) ? 'body' : ROOT };
  });
  return draft;
};
