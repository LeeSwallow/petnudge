import { boxMask, combine, countMask, emptyMask, fullMask, maskBounds, sameColor, type CutTarget, type Mask, type SelectMode } from '../../domain/character/cutout';
import type { Box } from '../../domain/character/pack';
import type { Pixels } from '../../domain/character/pixels';
import { framePicture } from '../../domain/character/placement';
import { editorApi, logEditorError } from './api';
import { cutInto, editor, setUnderlay } from './draft.svelte';
import { notice } from './pictures.svelte';

// The cut-out flow's view state (#57): the canvas tool and the pixel
// selection over the 원본 underlay. Neither is saved or undoable; the cut
// itself goes through the draft store (cutInto), one undo step.
//
//   cutout.tool   'move' (pick and drag parts) | 'box' (drag a box) | 'color' (click a colour)
//   cutout.mask   the selection, or null (also when the canvas size changed under it)
// A new selection replaces the old one; with Shift it is added, with Alt taken away.

export type Tool = 'move' | 'box' | 'color';
export const TOOLS: readonly { id: Tool; label: string; hint: string }[] = [
  { id: 'move', label: '옮기기', hint: '부위를 골라 끌어서 옮겨요' },
  { id: 'box', label: '상자 선택', hint: '끌어서 상자 안의 픽셀을 골라요' },
  { id: 'color', label: '같은 색 선택', hint: '누른 곳과 이어진 같은 색을 골라요' }
];

// Dragging the selection onto a part row puts it there.
export const SELECTION_TYPE = 'application/x-petnudge-selection';

let mask = $state.raw<Mask | null>(null);
let tool = $state<Tool>('move');

const current = () => {
  const { w, h } = editor.draft.canvas;
  return editor.underlay && mask && mask.w === w && mask.h === h ? mask : null;
};

export const cutout = {
  get tool() {
    return tool;
  },
  get mask() {
    return current();
  },
  get count() {
    const m = current();
    return m ? countMask(m) : 0;
  },
  get box(): Box | undefined {
    const m = current();
    return m ? maskBounds(m) : undefined;
  }
};

export const modeOf = (e: { shiftKey: boolean; altKey: boolean }): SelectMode => (e.altKey ? 'subtract' : e.shiftKey ? 'add' : 'replace');

export const setTool = (next: Tool) => {
  tool = next;
};

const apply = (next: Mask, mode: SelectMode) => {
  const { w, h } = editor.draft.canvas;
  mask = combine(current() ?? emptyMask(w, h), next, mode);
};

// A box from one pixel to another, both included.
export const selectBox = (from: [number, number], to: [number, number], mode: SelectMode) => {
  if (!editor.underlay) return;
  const { w, h } = editor.draft.canvas;
  apply(boxMask(w, h, [Math.min(from[0], to[0]), Math.min(from[1], to[1]), Math.max(from[0], to[0]) + 1, Math.max(from[1], to[1]) + 1]), mode);
};

export const selectColor = (x: number, y: number, mode: SelectMode) => {
  const underlay = editor.underlay;
  if (!underlay) return;
  apply(sameColor(underlay.rest, x, y), mode);
};

export const selectAll = () => {
  if (editor.underlay) mask = fullMask(editor.draft.canvas.w, editor.draft.canvas.h);
};
export const clearSelection = () => {
  mask = null;
};

// The picture to cut parts out of, fitted to the canvas; the box tool is ready for it.
export const loadUnderlay = (name: string, pixels: Pixels) => {
  setUnderlay(name, framePicture(pixels.w, pixels.h, pixels.data, editor.draft.canvas));
  mask = null;
  tool = 'box';
  notice.text = '';
};

// Opens the file dialog (main reads the PNG).
export const importImage = async () => {
  const result = await editorApi.importImage();
  if (!result.ok) {
    notice.text = result.error.message;
    logEditorError('editor', result, 'warn');
    return;
  }
  try {
    if (result.value) loadUnderlay(result.value.name, result.value.pixels);
  } catch (error) {
    notice.text = error instanceof Error ? error.message : String(error);
  }
};

// 부위에 넣기: the selected pixels into a part (or a variant, or a new part), at the same place.
export const cutSelection = (target: CutTarget) => {
  try {
    const m = current();
    if (!m) throw new Error('먼저 넣을 픽셀을 골라 주세요');
    cutInto(target, m);
    mask = null;
    notice.text = '';
  } catch (error) {
    notice.text = error instanceof Error ? error.message : String(error);
  }
};
