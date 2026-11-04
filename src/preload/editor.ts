import { contextBridge, ipcRenderer } from 'electron';
import {
  EDITOR_CHANNEL,
  EDITOR_TEST_IMPORT_CHANNEL,
  type EditorCharacter,
  type EditorResult,
  type ImportedCharacter,
  type ImportedImage,
  type ImportedLayers,
  type TestImportKind
} from '../domain/character-editor/ipc';

// The character editor window's preload: editorApi and nothing else (no
// petApi). Every call answers an EditorResult; see src/main/editorIpc.ts.

const call = <A>(channel: string, ...args: unknown[]): Promise<EditorResult<A>> => ipcRenderer.invoke(channel, ...args);

const editorApi = {
  listCharacters: () => call<EditorCharacter[]>(EDITOR_CHANNEL.listCharacters),
  close: () => call<null>(EDITOR_CHANNEL.close),
  // Open a file dialog; the value is null when the user cancels.
  importImage: () => call<ImportedImage | null>(EDITOR_CHANNEL.importImage),
  importLayered: () => call<ImportedLayers | null>(EDITOR_CHANNEL.importLayered),
  importCharacter: (id: string) => call<ImportedCharacter>(EDITOR_CHANNEL.importCharacter, id),
  // Not implemented yet (a later issue): answer { ok: false, code: 'not_implemented' }.
  save: () => call<never>(EDITOR_CHANNEL.save),
  apply: () => call<never>(EDITOR_CHANNEL.apply),
  // The app log (main/logIpc.ts): level is error | warn | info | debug.
  log: (level: string, scope: string, message: string, detail?: string) => ipcRenderer.send('log', level, scope, message, detail)
};

// The editor check's door (#57): imports from bytes instead of a dialog. Only
// on the test page (?test=1, which main opens only under PETNUDGE_EDITOR_TEST=1),
// and main answers it only then too.
const testApi = {
  testImport: (kind: TestImportKind, name: string, bytes: Uint8Array) => call<ImportedImage | ImportedLayers>(EDITOR_TEST_IMPORT_CHANNEL, kind, name, bytes)
};

export type EditorApi = typeof editorApi & Partial<typeof testApi>;

const testPage = new URLSearchParams(globalThis.location?.search ?? '').get('test') === '1';
contextBridge.exposeInMainWorld('editorApi', testPage ? { ...editorApi, ...testApi } : editorApi);
