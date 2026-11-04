import { blank, bounds, over, type Pixels } from './pixels';
import { framePicture, setPart } from './placement';
import { standardPart, type CharacterDraft } from './standard';

// Bringing in many pictures at once (#57): the layers of a layered file
// (.pxo, .aseprite) or the parts of another character. Layers named like a
// standard layer fill that slot; the others wait for the user to pick a slot
// or skip them. Placing them is one change to the draft (one undo step).

export type NamedPicture = { name: string; pixels: Pixels };
export type Matched = NamedPicture & { layer: string };

// Every layer as a full 96×112 picture (a smaller file in the middle, all its
// layers by the same offset; a bigger one throws the size guidance), empty
// layers left out, split into those with a standard name and the rest.
export const matchLayers = (layers: readonly NamedPicture[]): { matched: Matched[]; unmatched: NamedPicture[] } => {
  const matched: Matched[] = [];
  const unmatched: NamedPicture[] = [];
  for (const { name, pixels } of layers) {
    const framed = framePicture(pixels.w, pixels.h, pixels.data);
    if (!bounds(framed)) continue;
    if (standardPart(name) && !matched.some((m) => m.layer === name)) matched.push({ name, layer: name, pixels: framed });
    else unmatched.push({ name, pixels: framed });
  }
  return { matched, unmatched };
};

// Puts each picture in its layer: the first one for a layer replaces what the
// draft had there, later ones for the same layer are drawn over it.
export const placeParts = (draft: CharacterDraft, parts: readonly { layer: string; pixels: Pixels }[]): CharacterDraft => {
  const merged = new Map<string, Pixels>();
  for (const { layer, pixels } of parts) {
    const into = merged.get(layer) ?? blank(pixels.w, pixels.h);
    over(into, pixels);
    merged.set(layer, into);
  }
  let next = draft;
  for (const [layer, pixels] of merged) next = setPart(next, layer, pixels);
  return next;
};
