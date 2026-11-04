import { cutToPart, type CutTarget, type Mask } from '../../domain/character/cutout';
import { createHistory, canRedo as historyCanRedo, canUndo as historyCanUndo, record, redo as historyRedo, undo as historyUndo, type RecordOptions } from '../../domain/character/history';
import { importLayers, type NamedPicture, type Placed } from '../../domain/character/layered';
import { findPart, type BodyKind, type CharacterDraft, type Role } from '../../domain/character/parts';
import type { Pixels } from '../../domain/character/pixels';
import * as placement from '../../domain/character/placement';

// The editor's draft store (#58, #71): the character being edited (a list of
// free parts), the selected part and the undo history. One store per editor
// window; components read it directly (Svelte 5 runes, no subscribe) and
// change it only through these functions, so every change to the draft is
// one undo step.
//
// Reads (reactive in a component or $effect):
//   editor.draft      CharacterDraft — canvas size, body, parts back to front
//   editor.selected   string | null  — the selected part id (may be an empty part)
//   editor.canUndo / editor.canRedo
//   editor.hidden / editor.locked   ReadonlySet<string> — the layer panel's eye and lock
//   editor.hovered    string | null  — the part the pointer is over (row or canvas)
//
// Draft changes (each undoable; a change that changes nothing adds no step):
//   setPart(id, pixels, variant?)  a canvas-sized picture into a part (or one of
//                             its variants) and select it; throws on an unknown part or a wrong size
//   clearPart(id)             empty a part (it stays in the list)
//   addPart({ label, role?, parent? })  a new empty part at the front, selected; answers its id
//   deletePart(id)            take a part out; its children hang on its parent
//   updatePart(id, { label?, role? }) / setParent(id, parent) (throws why not)
//   setMerged(merged) / setBodyKind('biped' | 'legless')
//   setPivot(id, [x, y], dragId?)  a pivot drag merges into one step
//   move(dx, dy, how?)        move the selected part by whole pixels, clamped to the canvas;
//                             how = { merge: 'nudge' } merges presses within 500ms. A locked
//                             part does not move.
//   moveFrom(start, id, dx, dy, dragId)  a drag: `start` moved by the total offset, one step per drag
//   reorder(id, toIndex) / placeBeside(id, target, 'front' | 'back') / forward(id) / backward(id)
//   resizeCanvas(w, h)        clamped; parts (and the underlay) keep standing on the same ground
//   importLayered(layers)     a layered file's layers into parts, one step (layered.ts)
//   copyParts(from, ids)      another character's parts, one step
//   replaceDraft(draft)       a whole new draft (새로 만들기), one step, so it can be undone;
//                             the underlay goes and the view state starts over
//   undo() / redo()
//
// The 원본 underlay (#57): one picture to cut parts out of. It is in the undo
// history with the draft (a cut changes both) but is never saved as a part.
//   editor.underlay   { name, original, rest } | null — `rest`: what is not cut out yet
//   setUnderlay(name, pixels) (canvas-sized) / removeUnderlay()
//   cutInto(target, mask)     the selected drawn pixels of `rest` into a part, a variant
//                             or a new part (cutout.ts), at the same positions
// Not undoable, not saved (view state of this window): select, setHover,
// toggleHidden, toggleLocked, toggleUnderlay (editor.underlayShown);
// reset(draft?) starts over with an empty history and no underlay.

export type Underlay = { readonly name: string; readonly original: Pixels; readonly rest: Pixels };
type Work = { readonly draft: CharacterDraft; readonly underlay: Underlay | null };

let history = $state.raw(createHistory<Work>({ draft: placement.emptyDraft(), underlay: null }));
let underlayShown = $state(true);
let selected = $state<string | null>(null);
let hovered = $state<string | null>(null);
let hidden = $state.raw<ReadonlySet<string>>(new Set());
let locked = $state.raw<ReadonlySet<string>>(new Set());

export const editor = {
  get draft() {
    return history.present.draft;
  },
  get underlay() {
    return history.present.underlay;
  },
  get underlayShown() {
    return underlayShown;
  },
  get selected() {
    return selected && findPart(history.present.draft, selected) ? selected : null;
  },
  get canUndo() {
    return historyCanUndo(history);
  },
  get canRedo() {
    return historyCanRedo(history);
  },
  get hidden() {
    return hidden;
  },
  get locked() {
    return locked;
  },
  get hovered() {
    return hovered;
  }
};

const draft = () => history.present.draft;

// A change to the draft; the same draft back adds no step.
const commit = (next: CharacterDraft, how?: RecordOptions) => {
  if (next === draft()) return;
  history = record(history, { ...history.present, draft: next }, how);
};

const clearView = () => {
  selected = hovered = null;
  hidden = new Set();
  locked = new Set();
};

export const reset = (start: CharacterDraft = placement.emptyDraft()) => {
  history = createHistory<Work>({ draft: start, underlay: null });
  underlayShown = true;
  clearView();
};

export const select = (id: string | null) => {
  selected = id && findPart(draft(), id) ? id : null;
};
export const setHover = (id: string | null) => {
  hovered = id;
};

const toggled = (set: ReadonlySet<string>, id: string) => {
  const next = new Set(set);
  if (!next.delete(id)) next.add(id);
  return next;
};
export const toggleHidden = (id: string) => {
  hidden = toggled(hidden, id);
};
export const toggleLocked = (id: string) => {
  locked = toggled(locked, id);
};
export const toggleUnderlay = () => {
  underlayShown = !underlayShown;
};

export const setPart = (id: string, pixels: Pixels, variant?: string) => {
  commit(placement.setPixels(draft(), id, pixels, variant));
  selected = id;
};
export const clearPart = (id: string) => commit(placement.clearPart(draft(), id));

export const addPart = (spec: { label: string; role?: Role; parent?: string }): string => {
  const { draft: next, id } = placement.addPart(draft(), spec);
  commit(next);
  selected = id;
  return id;
};
export const deletePart = (id: string) => {
  commit(placement.deletePart(draft(), id));
  if (selected === id) selected = null;
};
export const updatePart = (id: string, change: { label?: string; role?: Role | null }) => commit(placement.updatePart(draft(), id, change));
export const setParent = (id: string, parent: string) => commit(placement.setParent(draft(), id, parent));
export const setMerged = (merged: boolean) => commit(placement.setMerged(draft(), merged));
export const setBodyKind = (kind: BodyKind) => commit(placement.setBodyKind(draft(), kind));
export const setPivot = (id: string, point: [number, number], dragId?: string) =>
  commit(placement.setPivot(draft(), id, point), dragId ? { merge: `pivot:${dragId}`, window: Infinity } : undefined);

export const move = (dx: number, dy: number, how: { merge?: 'nudge' } = {}) => {
  const id = editor.selected;
  if (!id || locked.has(id)) return;
  commit(placement.movePart(draft(), id, dx, dy), how.merge ? { merge: `nudge:${id}` } : undefined);
};

export const moveFrom = (start: CharacterDraft, id: string, dx: number, dy: number, dragId: string) => {
  if (locked.has(id)) return;
  const merge = `drag:${dragId}`;
  const moved = placement.movePart(start, id, dx, dy);
  if (moved !== start) commit(moved, { merge, window: Infinity });
  // Dragged back to where it started: show the start again (a copy, so it
  // still merges into the drag's step; that step then changes nothing).
  else if (history.merge?.key === merge) commit({ ...start }, { merge, window: Infinity });
};

export const reorder = (id: string, toIndex: number) => commit(placement.setOrder(draft(), id, toIndex));
export const placeBeside = (id: string, target: string, side: 'front' | 'back') => commit(placement.placeBeside(draft(), id, target, side));
export const forward = (id: string) => commit(placement.bringForward(draft(), id));
export const backward = (id: string) => commit(placement.sendBackward(draft(), id));

export const resizeCanvas = (w: number, h: number) => {
  const before = draft().canvas;
  const { draft: next } = placement.resizeCanvas(draft(), w, h);
  if (next === draft()) return;
  const underlay = history.present.underlay;
  const fit = (px: Pixels) => placement.toCanvas(px, before, next.canvas);
  history = record(history, { draft: next, underlay: underlay && { ...underlay, original: fit(underlay.original), rest: fit(underlay.rest) } });
};

export const importLayered = (layers: readonly NamedPicture[]): Placed[] => {
  const { draft: next, placed } = importLayers(draft(), layers);
  commit(next);
  return placed;
};
export const copyParts = (from: CharacterDraft, ids: readonly string[]) => commit(placement.copyParts(draft(), from, ids));

export const replaceDraft = (next: CharacterDraft) => {
  history = record(history, { draft: next, underlay: null });
  clearView();
};

export const setUnderlay = (name: string, pixels: Pixels) => {
  history = record(history, { ...history.present, underlay: { name, original: pixels, rest: pixels } });
  underlayShown = true;
};
export const removeUnderlay = () => {
  if (history.present.underlay) history = record(history, { ...history.present, underlay: null });
};

export const cutInto = (target: CutTarget, mask: Mask): string => {
  const underlay = history.present.underlay;
  if (!underlay) throw new Error('먼저 그림을 불러와 주세요');
  const { draft: next, rest, id } = cutToPart(draft(), underlay.rest, mask, target);
  history = record(history, { draft: next, underlay: { ...underlay, rest } });
  selected = id;
  return id;
};

export const undo = () => {
  history = historyUndo(history);
};
export const redo = () => {
  history = historyRedo(history);
};
