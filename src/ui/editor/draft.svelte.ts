import { createHistory, canRedo as historyCanRedo, canUndo as historyCanUndo, record, redo as historyRedo, undo as historyUndo, type RecordOptions } from '../../domain/character/history';
import type { Pixels } from '../../domain/character/pixels';
import * as placement from '../../domain/character/placement';
import { STANDARD_SLOTS, standardPart, type CharacterDraft, type SlotId } from '../../domain/character/standard';

// The editor's draft store (#58): the character being edited, the selected
// part and the undo history. One store per editor window; components read it
// directly (Svelte 5 runes, no subscribe) and change it only through these
// functions, so every change to the draft is one undo step.
//
// Reads (reactive in a component or $effect):
//   editor.draft      CharacterDraft — parts are full 96×112 pictures under layer names
//   editor.selected   string | null  — the selected layer name (may be an empty layer)
//   editor.canUndo / editor.canRedo
//   editor.hidden / editor.locked   ReadonlySet<string> — the layer panel's eye and lock
//   editor.hovered    string | null  — the part the pointer is over (row or canvas)
//
// Draft changes (each undoable; a change that changes nothing adds no step):
//   setPart(layer, pixels)    put a 96×112 picture in a standard layer (or `custom.<name>`)
//                             and select it; throws on an unknown layer or a wrong size
//   removePart(layer)         empty that layer
//   move(dx, dy, how?)        move the selected part by whole pixels, clamped to the canvas;
//                             how = { merge: 'nudge' } merges presses within 500ms. A locked
//                             part does not move.
//   moveFrom(start, layer, dx, dy, dragId)  a drag: `start` moved by the total offset, one step per drag
//   reorder(layer, toIndex)   put a layer at an index of the full back-to-front order
//   placeBeside(layer, target, 'front' | 'back')  the layer panel's drop
//   forward(layer) / backward(layer)  one step past the next drawn layer
//   reorderSlot(slot, toIndex) move a slot's layers together
//   undo() / redo()
// Not undoable, not saved (view state of this window): select, setHover,
// toggleHidden, toggleLocked; reset(draft?) starts over with an empty history.

let history = $state.raw(createHistory<CharacterDraft>(placement.emptyDraft()));
let selected = $state<string | null>(null);
let hovered = $state<string | null>(null);
let hidden = $state.raw<ReadonlySet<string>>(new Set());
let locked = $state.raw<ReadonlySet<string>>(new Set());

export const editor = {
  get draft() {
    return history.present;
  },
  get selected() {
    return selected;
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

const commit = (next: CharacterDraft, how?: RecordOptions) => {
  history = record(history, next, how);
};

export const reset = (draft: CharacterDraft = placement.emptyDraft()) => {
  history = createHistory(draft);
  selected = hovered = null;
  hidden = new Set();
  locked = new Set();
};

export const select = (layer: string | null) => {
  selected = layer && standardPart(layer) ? layer : null;
};
export const setHover = (layer: string | null) => {
  hovered = layer;
};

const toggled = (set: ReadonlySet<string>, layer: string) => {
  const next = new Set(set);
  if (!next.delete(layer)) next.add(layer);
  return next;
};
export const toggleHidden = (layer: string) => {
  hidden = toggled(hidden, layer);
};
export const toggleLocked = (layer: string) => {
  locked = toggled(locked, layer);
};

// The layer a click on a slot selects: its first drawn layer, else its first layer.
export const layerForSlot = (draft: CharacterDraft, slot: SlotId): string | null => {
  const names = placement.fullOrder(draft).filter((name) => standardPart(name)?.slot === slot);
  return names.find((name) => placement.isFilled(draft, name)) ?? names[0] ?? STANDARD_SLOTS.find((s) => s.id === slot)?.parts[0]?.name ?? null;
};

export const setPart = (layer: string, pixels: Pixels) => {
  commit(placement.setPart(history.present, layer, pixels));
  selected = layer;
};

export const removePart = (layer: string) => commit(placement.removePart(history.present, layer));

export const move = (dx: number, dy: number, how: { merge?: 'nudge' } = {}) => {
  if (!selected || locked.has(selected)) return;
  commit(placement.movePart(history.present, selected, dx, dy), how.merge ? { merge: `nudge:${selected}` } : undefined);
};

export const moveFrom = (start: CharacterDraft, layer: string, dx: number, dy: number, dragId: string) => {
  if (locked.has(layer)) return;
  const merge = `drag:${dragId}`;
  const moved = placement.movePart(start, layer, dx, dy);
  if (moved !== start) commit(moved, { merge, window: Infinity });
  // Dragged back to where it started: show the start again (a copy, so it
  // still merges into the drag's step; that step then changes nothing).
  else if (history.merge?.key === merge) commit({ ...start }, { merge, window: Infinity });
};

export const reorder = (layer: string, toIndex: number) => commit(placement.setOrder(history.present, layer, toIndex));
export const placeBeside = (layer: string, target: string, side: 'front' | 'back') => commit(placement.placeBeside(history.present, layer, target, side));
export const forward = (layer: string) => commit(placement.bringForward(history.present, layer));
export const backward = (layer: string) => commit(placement.sendBackward(history.present, layer));
export const reorderSlot = (slot: SlotId, toIndex: number) => commit(placement.moveSlot(history.present, slot, toIndex));

export const undo = () => {
  history = historyUndo(history);
};
export const redo = () => {
  history = historyRedo(history);
};
