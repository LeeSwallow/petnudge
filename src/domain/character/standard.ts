import type { Pixels } from './pixels';

// The standard pack (@3): the character editor's part slots. Each part is a
// full-canvas picture stored under a fixed layer name (the same names as the
// built-in packs), so parts move between characters and draw the same way in
// the app. buildPack turns a draft of these parts into a pack.

export const FRAME = { w: 96, h: 112 } as const;

// Touch targets (pack `hitAreas`) and moving boxes (pack `regions`) a part
// feeds. `upper` is not fed by a part: it is everything above the waist line.
export type HitAreaName = 'head' | 'chest' | 'belly' | 'armL' | 'armR' | 'legL' | 'legR';
export type RegionName = 'head' | 'upper' | 'eyes' | 'armL' | 'armR' | 'legL' | 'legR';

export type SlotId = 'hairBack' | 'torso' | 'legs' | 'arms' | 'head' | 'eyes' | 'mouth' | 'hairFront' | 'custom';

// `name`: the picture's layer name in the source file (and its sheet cell).
// Eyes and mouth are face layers: `eye.L.closed` is variant `closed` of pack
// layer `eye.L`.
export type StandardPart = { name: string; hitArea?: HitAreaName; regions: RegionName[] };
export type StandardSlot = { id: SlotId; label: string; required: boolean; parts: StandardPart[] };

const headPart = (name: string, regions: RegionName[] = ['head']): StandardPart => ({ name, hitArea: 'head', regions });

// Back to front, the default drawing order.
export const STANDARD_SLOTS: readonly StandardSlot[] = [
  { id: 'hairBack', label: '뒷머리', required: false, parts: [headPart('hair.back')] },
  // One torso picture goes in `torso.chest`; buildPack splits it into chest and belly.
  { id: 'torso', label: '몸통', required: true, parts: [{ name: 'torso.chest', hitArea: 'chest', regions: [] }, { name: 'torso.belly', hitArea: 'belly', regions: [] }] },
  { id: 'legs', label: '다리', required: false, parts: [{ name: 'leg.L', hitArea: 'legL', regions: ['legL'] }, { name: 'leg.R', hitArea: 'legR', regions: ['legR'] }] },
  { id: 'arms', label: '팔', required: false, parts: [{ name: 'arm.L', hitArea: 'armL', regions: ['armL'] }, { name: 'arm.R', hitArea: 'armR', regions: ['armR'] }] },
  { id: 'head', label: '머리(얼굴)', required: false, parts: [headPart('head')] },
  // One picture of both eyes goes in `eye.L.*`.
  { id: 'eyes', label: '눈', required: false, parts: ['eye.L.open', 'eye.L.closed', 'eye.R.open', 'eye.R.closed'].map((n) => headPart(n, ['head', 'eyes'])) },
  { id: 'mouth', label: '입', required: false, parts: [headPart('mouth.closed'), headPart('mouth.open')] },
  { id: 'hairFront', label: '앞머리', required: false, parts: [headPart('hair.front')] },
  // Decorations: `custom.<name>`, any number.
  { id: 'custom', label: '장식', required: false, parts: [] }
];

// The required body part.
export const BODY = 'torso.chest';

// Face layers and their variants (an expression picks one per layer).
export const FACE_LAYERS: Readonly<Record<string, readonly string[]>> = {
  'eye.L': ['open', 'closed'],
  'eye.R': ['open', 'closed'],
  mouth: ['closed', 'open']
};

const CUSTOM = /^custom\.[a-zA-Z][a-zA-Z0-9-]{0,31}$/;

// `layer`: the pack layer the picture draws in; `variant`: its face variant.
export type PartInfo = StandardPart & { slot: SlotId; layer: string; variant?: string };

// What a layer name is in the standard pack, or undefined for a name it has no slot for.
export const standardPart = (name: string): PartInfo | undefined => {
  if (CUSTOM.test(name)) return { name, slot: 'custom', layer: name, regions: [] };
  for (const slot of STANDARD_SLOTS) {
    const part = slot.parts.find((p) => p.name === name);
    if (!part) continue;
    const face = Object.keys(FACE_LAYERS).find((layer) => name.startsWith(`${layer}.`));
    return { ...part, slot: slot.id, layer: face ?? name, variant: face ? name.slice(face.length + 1) : undefined };
  }
  return undefined;
};

// Reaction lines the user writes in the editor, per interaction.
export type DraftLines = { pat: string[]; pokeChest: string[]; pokeBelly: string[] };

// What the editor edits: identity, lines and the part pictures, each a full
// 96×112 canvas (the part keeps its place on the canvas). `order`: layer
// names back to front; parts it leaves out go after, in slot order.
export type CharacterDraft = {
  id: string;
  name: string;
  persona: string;
  lines: DraftLines;
  parts: Record<string, Pixels>;
  order: string[];
};
