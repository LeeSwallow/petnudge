import { bounds } from '../../domain/character/pixels';
import { drawOrder, fullOrder } from '../../domain/character/placement';
import { FRAME } from '../../domain/character/standard';
import { editorApi } from './api';
import { cutout, loadUnderlay } from './cutout.svelte';
import { editor, reset, setPart } from './draft.svelte';
import { openLayered } from './imports.svelte';
import type { ImportedImage, ImportedLayers, TestImportKind } from '../../domain/character-editor/ipc';

// A dev-only door for scripts/editor-check.mjs (#58): puts parts in without
// the import UI and reads the draft back. #57 adds `importBytes`: a picture or
// a layered file sent to main as bytes (editor:test-import, the dialog-free
// twin of 그림 불러오기 / 레이어 파일) and handed to the same UI as a picked file. Installed only when main
// opened the page with ?test=1, which it does only under PETNUDGE_EDITOR_TEST=1
// (src/main/main.ts); a normal run never has it.

export type EditorTestHooks = {
  // `rgba`: 96×112×4 bytes, row by row.
  setPart(layer: string, rgba: ArrayLike<number>): void;
  reset(): void;
  importBytes(kind: TestImportKind, name: string, bytes: ArrayLike<number>): Promise<string>;
  // One pixel of a part, or of the underlay's uncut rest, as 0xAABBGGRR (0 when none).
  pixel(layer: string, x: number, y: number): number;
  underlayPixel(x: number, y: number): number;
  state(): {
    selected: string | null;
    drawn: string[];
    order: string[];
    boxes: Record<string, number[] | null>;
    canUndo: boolean;
    canRedo: boolean;
    hidden: string[];
    locked: string[];
    hovered: string | null;
    underlay: { name: string; rest: number[] | null; restCount: number; shown: boolean } | null;
    tool: string;
    picked: number;
    pickedBox: number[] | null;
  };
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
    importBytes: async (kind, name, bytes) => {
      const result = await editorApi.testImport!(kind, name, Uint8Array.from(bytes));
      if (!result.ok) return result.error.message;
      if (kind === 'image') {
        const { name: file, pixels } = result.value as ImportedImage;
        loadUnderlay(file, pixels);
      } else openLayered(result.value as ImportedLayers);
      return 'ok';
    },
    pixel: (layer, x, y) => editor.draft.parts[layer]?.data[y * FRAME.w + x] ?? 0,
    underlayPixel: (x, y) => editor.underlay?.rest.data[y * FRAME.w + x] ?? 0,
    state: () => {
      const draft = editor.draft;
      return {
        selected: editor.selected,
        drawn: drawOrder(draft),
        order: fullOrder(draft),
        boxes: Object.fromEntries(Object.entries(draft.parts).map(([name, px]) => [name, bounds(px) ?? null])),
        canUndo: editor.canUndo,
        canRedo: editor.canRedo,
        hidden: [...editor.hidden],
        locked: [...editor.locked],
        hovered: editor.hovered,
        underlay: editor.underlay && {
          name: editor.underlay.name,
          rest: bounds(editor.underlay.rest) ?? null,
          restCount: editor.underlay.rest.data.reduce((n, p) => n + (p >>> 24 ? 1 : 0), 0),
          shown: editor.underlayShown
        },
        tool: cutout.tool,
        picked: cutout.count,
        pickedBox: cutout.box ?? null
      };
    }
  };
};
