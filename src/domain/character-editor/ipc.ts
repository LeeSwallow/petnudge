// What the character editor window (src/ui/editor) and main
// (src/main/editorIpc.ts) say to each other: the channel names and the shape
// of every answer. Only `editor:*` channels; the pet window's petApi is not
// in the editor window at all.

export const EDITOR_CHANNEL = {
  listCharacters: 'editor:list-characters',
  close: 'editor:close',
  // Filled by later issues (#26 D, F); they answer not_implemented for now.
  importImage: 'editor:import-image',
  importLayered: 'editor:import-layered',
  save: 'editor:save',
  apply: 'editor:apply'
} as const;
export type EditorChannel = (typeof EDITOR_CHANNEL)[keyof typeof EDITOR_CHANNEL];

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

export type EditorCharacter = { readonly id: string; readonly name: string; readonly builtin: boolean };
