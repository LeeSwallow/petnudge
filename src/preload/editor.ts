import { contextBridge, ipcRenderer } from 'electron';
import { EDITOR_CHANNEL, type EditorCharacter, type EditorResult } from '../domain/character-editor/ipc';

// The character editor window's preload: editorApi and nothing else (no
// petApi). Every call answers an EditorResult; see src/main/editorIpc.ts.

const call = <A>(channel: string, ...args: unknown[]): Promise<EditorResult<A>> => ipcRenderer.invoke(channel, ...args);

const editorApi = {
  listCharacters: () => call<EditorCharacter[]>(EDITOR_CHANNEL.listCharacters),
  close: () => call<null>(EDITOR_CHANNEL.close),
  // Not implemented yet (later issues): answer { ok: false, code: 'not_implemented' }.
  importImage: () => call<never>(EDITOR_CHANNEL.importImage),
  importLayered: () => call<never>(EDITOR_CHANNEL.importLayered),
  save: () => call<never>(EDITOR_CHANNEL.save),
  apply: () => call<never>(EDITOR_CHANNEL.apply),
  // The app log (main/logIpc.ts): level is error | warn | info | debug.
  log: (level: string, scope: string, message: string, detail?: string) => ipcRenderer.send('log', level, scope, message, detail)
};

export type EditorApi = typeof editorApi;

contextBridge.exposeInMainWorld('editorApi', editorApi);
