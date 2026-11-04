import { findPart, isPartId, restVariant, type CharacterDraft } from './parts';
import { blank, bounds, over, type Pixels } from './pixels';
import { addPart, framePicture, newPartId, partIds, setPixels } from './placement';
import { legacyPart } from './standard';

// Bringing in many pictures at once (#57, #71): the layers of a layered file
// (.pxo, .aseprite). A layer named like a part fills it (`<id>.<variant>` a
// variant; an old fixed name like `torso.chest` its part), and every other
// layer becomes a new part named after it: nothing is dropped or asked about.
// Placing them all is one change to the draft (one undo step).

export type NamedPicture = { name: string; pixels: Pixels };
export type Placed = { name: string; part: string; variant?: string; created: boolean };

type Where = { part: string; variant?: string };

// The part (and variant) a layer name fills in the draft, if it names one.
const whereIn = (draft: CharacterDraft, name: string): Where | undefined => {
  if (findPart(draft, name)) return { part: name };
  const dot = name.lastIndexOf('.');
  const part = dot > 0 ? findPart(draft, name.slice(0, dot)) : undefined;
  if (part) {
    const variant = name.slice(dot + 1);
    return variant === restVariant(part) ? { part: part.id } : { part: part.id, variant };
  }
  const old = legacyPart(name);
  if (old && findPart(draft, old.id)) {
    const p = findPart(draft, old.id)!;
    return !old.variant || old.variant === restVariant(p) ? { part: p.id } : { part: p.id, variant: old.variant };
  }
  return undefined;
};

export const importLayers = (draft: CharacterDraft, layers: readonly NamedPicture[]): { draft: CharacterDraft; placed: Placed[] } => {
  let next = draft;
  const placed: Placed[] = [];
  const started = new Set<string>(); // parts (and variants) this import has drawn into
  for (const { name, pixels } of layers) {
    const framed = framePicture(pixels.w, pixels.h, pixels.data, draft.canvas);
    if (!bounds(framed)) continue;
    let where = whereIn(next, name);
    let created = false;
    if (!where) {
      const old = legacyPart(name);
      const id = old && isPartId(old.id) && !findPart(next, old.id) ? old.id : newPartId(name, partIds(next));
      const parent = old && findPart(next, old.parent) ? old.parent : undefined;
      next = addPart(next, { id, label: old?.label ?? name, ...(old ? { role: old.role } : {}), ...(parent ? { parent } : {}) }).draft;
      where = old?.variant && old.variant !== restVariant(old) ? { part: id, variant: old.variant } : { part: id };
      created = true;
    }
    const key = `${where.part}.${where.variant ?? ''}`;
    const part = findPart(next, where.part)!;
    const under = started.has(key) ? (where.variant ? part.variants?.[where.variant] : part.pixels) : undefined;
    const merged: Pixels = under ? { ...under, data: under.data.slice() } : blank(framed.w, framed.h);
    over(merged, framed);
    next = setPixels(next, where.part, merged, where.variant);
    started.add(key);
    placed.push({ name, part: where.part, ...(where.variant ? { variant: where.variant } : {}), created });
  }
  return { draft: next, placed };
};
