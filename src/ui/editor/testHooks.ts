import { depthOf, partBox, pivotOf } from '../../domain/character/parts';
import { bounds } from '../../domain/character/pixels';
import { drawOrder, partIds } from '../../domain/character/placement';
import { editorApi } from './api';
import { cutout, loadUnderlay } from './cutout.svelte';
import { editor, reset, setPart } from './draft.svelte';
import { openLayered } from './imports.svelte';
import { notice } from './pictures.svelte';
import type { ImportedImage, ImportedLayers, TestImportKind } from '../../domain/character-editor/ipc';

// A dev-only door for scripts/editor-check.mjs (#58): puts pictures in parts
// without the import UI and reads the draft back. #57 adds `importBytes`: a
// picture or a layered file sent to main as bytes (editor:test-import, the
// dialog-free twin of 그림 불러오기 / 레이어 파일) and handed to the same UI as
// a picked file. Installed only when main opened the page with ?test=1, which
// it does only under PETNUDGE_EDITOR_TEST=1 (src/main/main.ts); a normal run
// never has it.

export type EditorTestHooks = {
  // `rgba`: canvas w×h×4 bytes, row by row; `variant` puts it in a variant of the part.
  setPart(id: string, rgba: ArrayLike<number>, variant?: string): void;
  reset(): void;
  importBytes(kind: TestImportKind, name: string, bytes: ArrayLike<number>): Promise<string>;
  // One pixel of a part (at rest), or of the underlay's uncut rest, as 0xAABBGGRR (0 when none).
  pixel(id: string, x: number, y: number): number;
  underlayPixel(x: number, y: number): number;
  state(): {
    canvas: { w: number; h: number };
    merged: boolean;
    selected: string | null;
    drawn: string[];
    order: string[];
    boxes: Record<string, number[] | null>;
    parts: Record<string, { parent: string; role: string | null; depth: number; pivot: number[]; label: string; variants: string[] }>;
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
    setPart: (id, rgba, variant) => {
      const { w, h } = editor.draft.canvas;
      if (rgba.length !== w * h * 4) throw new Error(`expected ${w}×${h}×4 bytes, got ${rgba.length}`);
      const bytes = Uint8Array.from(rgba);
      setPart(id, { w, h, data: new Uint32Array(bytes.buffer) }, variant);
    },
    reset: () => reset(),
    importBytes: async (kind, name, bytes) => {
      const result = await editorApi.testImport!(kind, name, Uint8Array.from(bytes));
      if (!result.ok) return result.error.message;
      if (kind === 'image') {
        const { name: file, pixels } = result.value as ImportedImage;
        try {
          loadUnderlay(file, pixels);
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      } else {
        openLayered(result.value as ImportedLayers);
        if (notice.text && !notice.text.includes('넣었어요')) return notice.text;
      }
      return 'ok';
    },
    pixel: (id, x, y) => editor.draft.parts.find((p) => p.id === id)?.pixels.data[y * editor.draft.canvas.w + x] ?? 0,
    underlayPixel: (x, y) => editor.underlay?.rest.data[y * editor.draft.canvas.w + x] ?? 0,
    state: () => {
      const draft = editor.draft;
      return {
        canvas: { ...draft.canvas },
        merged: draft.body.merged,
        selected: editor.selected,
        drawn: drawOrder(draft),
        order: partIds(draft),
        boxes: Object.fromEntries(draft.parts.map((p) => [p.id, partBox(p) ?? null])),
        parts: Object.fromEntries(draft.parts.map((p) => [p.id, { parent: p.parent, role: p.role ?? null, depth: depthOf(draft, p.id), pivot: pivotOf(p), label: p.label, variants: Object.keys(p.variants ?? {}) }])),
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
