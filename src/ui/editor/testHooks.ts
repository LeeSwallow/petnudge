import { bounds } from '../../domain/character/pixels';
import { drawOrder, fullOrder } from '../../domain/character/placement';
import { FRAME } from '../../domain/character/standard';
import { editor, reset, setPart } from './draft.svelte';

// A dev-only door for scripts/editor-check.mjs (#58): puts parts in without
// the import UI (#57) and reads the draft back. Installed only when main
// opened the page with ?test=1, which it does only under PETNUDGE_EDITOR_TEST=1
// (src/main/main.ts); a normal run never has it.

export type EditorTestHooks = {
  // `rgba`: 96×112×4 bytes, row by row.
  setPart(layer: string, rgba: ArrayLike<number>): void;
  reset(): void;
  state(): { selected: string | null; drawn: string[]; order: string[]; boxes: Record<string, number[] | null>; canUndo: boolean; canRedo: boolean };
};

declare global {
  interface Window {
    __editorTest?: EditorTestHooks;
  }
}

export const testHooksWanted = (search: string) => new URLSearchParams(search).get('test') === '1';

export const installTestHooks = (target: Window = window) => {
  if (!testHooksWanted(target.location.search)) return;
  target.__editorTest = {
    setPart: (layer, rgba) => {
      if (rgba.length !== FRAME.w * FRAME.h * 4) throw new Error(`expected ${FRAME.w}×${FRAME.h}×4 bytes, got ${rgba.length}`);
      const bytes = Uint8Array.from(rgba);
      setPart(layer, { w: FRAME.w, h: FRAME.h, data: new Uint32Array(bytes.buffer) });
    },
    reset: () => reset(),
    state: () => {
      const draft = editor.draft;
      return {
        selected: editor.selected,
        drawn: drawOrder(draft),
        order: fullOrder(draft),
        boxes: Object.fromEntries(Object.entries(draft.parts).map(([name, px]) => [name, bounds(px) ?? null])),
        canUndo: editor.canUndo,
        canRedo: editor.canRedo
      };
    }
  };
};
