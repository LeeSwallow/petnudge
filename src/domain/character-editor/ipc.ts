import type { Pixels } from '../character/pixels';
import type { CharacterDraft } from '../character/standard';

// What the character editor window (src/ui/editor) and main
// (src/main/editorIpc.ts) say to each other: the channel names and the shape
// of every answer. Only `editor:*` channels; the pet window's petApi is not
// in the editor window at all.

export const EDITOR_CHANNEL = {
  listCharacters: 'editor:list-characters',
  close: 'editor:close',
  // Picture import (#57): a file dialog in main, answered as RGBA pixels (null when cancelled).
  importImage: 'editor:import-image',
  importLayered: 'editor:import-layered',
  // Another character's parts as a standard draft (@2 packs converted).
  importCharacter: 'editor:import-character',
  // Filled by a later issue (#26 F); they answer not_implemented for now.
  save: 'editor:save',
  apply: 'editor:apply'
} as const;
export type EditorChannel = (typeof EDITOR_CHANNEL)[keyof typeof EDITOR_CHANNEL];

// The editor check's door (#57): the same imports from bytes instead of a
// file dialog. Main installs it only under PETNUDGE_EDITOR_TEST=1.
export const EDITOR_TEST_IMPORT_CHANNEL = 'editor:test-import';
export type TestImportKind = 'image' | 'layered';

// The pet window's way to open the editor (petApi.openEditor).
export const OPEN_EDITOR_CHANNEL = 'editor:open';

// Same shape as Wire in src/core/errors.ts (domain cannot import core):
// plain data, never an Error object.
export type EditorResult<A> =
  | { readonly ok: true; readonly value: A }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };

export const editorOk = <A>(value: A): EditorResult<A> => ({ ok: true, value });
export const editorFailure = (code: string, message: string): EditorResult<never> => ({ ok: false, error: { code, message } });
export const notImplemented = (what: string): EditorResult<never> => editorFailure('not_implemented', `${what} 기능은 아직 준비 중이에요`);

// What the imports answer. Pixels are full 96×112 canvases for an image;
// layers keep the file's size (at most 96×112).
export type ImportedImage = { readonly name: string; readonly pixels: Pixels };
export type ImportedLayers = { readonly name: string; readonly layers: readonly { readonly name: string; readonly pixels: Pixels }[] };
export type ImportedCharacter = { readonly draft: CharacterDraft; readonly dropped: readonly { readonly name: string; readonly reason: string }[] };

export type EditorCharacter = { readonly id: string; readonly name: string; readonly builtin: boolean };
