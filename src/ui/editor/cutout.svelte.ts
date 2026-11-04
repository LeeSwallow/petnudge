import { boxMask, combine, countMask, emptyMask, fullMask, maskBounds, sameColor, type Mask, type SelectMode } from '../../domain/character/cutout';
import type { Box } from '../../domain/character/pack';
import type { Pixels } from '../../domain/character/pixels';
import { customName } from '../../domain/character/placement';
import { FRAME, type SlotId } from '../../domain/character/standard';
import { editorApi, logEditorError } from './api';
import { cutInto, editor, layerForSlot, setUnderlay } from './draft.svelte';
import { notice } from './pictures.svelte';

// The cut-out flow's view state (#57): the canvas tool and the pixel
// selection over the 원본 underlay. Neither is saved or undoable; the cut
// itself goes through the draft store (cutInto), one undo step.
//
//   cutout.tool   'move' (pick and drag parts) | 'box' (drag a box) | 'color' (click a colour)
//   cutout.mask   the selection, or null
// A new selection replaces the old one; with Shift it is added, with Alt taken away.

export type Tool = 'move' | 'box' | 'color';
export const TOOLS: readonly { id: Tool; label: string; hint: string }[] = [
  { id: 'move', label: '옮기기', hint: '부위를 골라 끌어서 옮겨요' },
  { id: 'box', label: '상자 선택', hint: '끌어서 상자 안의 픽셀을 골라요' },
  { id: 'color', label: '같은 색 선택', hint: '누른 곳과 이어진 같은 색을 골라요' }
];

// Dragging the selection onto a layer row puts it there.
export const SELECTION_TYPE = 'application/x-petnudge-selection';

let mask = $state.raw<Mask | null>(null);
let tool = $state<Tool>('move');

export const cutout = {
  get tool() {
    return tool;
  },
  get mask() {
    return editor.underlay ? mask : null;
  },
  get count() {
    return editor.underlay && mask ? countMask(mask) : 0;
  },
  get box(): Box | undefined {
    return editor.underlay && mask ? maskBounds(mask) : undefined;
  }
};

export const modeOf = (e: { shiftKey: boolean; altKey: boolean }): SelectMode => (e.altKey ? 'subtract' : e.shiftKey ? 'add' : 'replace');

export const setTool = (next: Tool) => {
  tool = next;
};

const apply = (next: Mask, mode: SelectMode) => {
  mask = combine(mask ?? emptyMask(FRAME.w, FRAME.h), next, mode);
};

// A box from one pixel to another, both included.
export const selectBox = (from: [number, number], to: [number, number], mode: SelectMode) => {
  if (!editor.underlay) return;
  apply(boxMask(FRAME.w, FRAME.h, [Math.min(from[0], to[0]), Math.min(from[1], to[1]), Math.max(from[0], to[0]) + 1, Math.max(from[1], to[1]) + 1]), mode);
};

export const selectColor = (x: number, y: number, mode: SelectMode) => {
  const underlay = editor.underlay;
  if (!underlay) return;
  apply(sameColor(underlay.rest, x, y), mode);
};

export const selectAll = () => {
  if (editor.underlay) mask = fullMask(FRAME.w, FRAME.h);
};
export const clearSelection = () => {
  mask = null;
};

// The picture to cut parts out of; the box tool is ready for it.
export const loadUnderlay = (name: string, pixels: Pixels) => {
  setUnderlay(name, pixels);
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
  if (result.value) loadUnderlay(result.value.name, result.value.pixels);
};

// Where 칸에 넣기 puts the selection: a layer name, or a slot (its layer), or a new decoration.
export type CutTarget = { layer: string } | { slot: SlotId };
export const targetLayer = (target: CutTarget): string | null =>
  'layer' in target ? target.layer : target.slot === 'custom' ? customName('cut', editor.draft.parts) : layerForSlot(editor.draft, target.slot);

// 칸에 넣기: the selected pixels into a layer, at the same place.
export const cutSelection = (target: CutTarget) => {
  try {
    if (!mask) throw new Error('먼저 넣을 픽셀을 골라 주세요');
    const layer = targetLayer(target);
    if (!layer) throw new Error('넣을 칸을 골라 주세요');
    cutInto(layer, mask);
    mask = null;
    notice.text = '';
  } catch (error) {
    notice.text = error instanceof Error ? error.message : String(error);
  }
};
