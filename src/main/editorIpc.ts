import { t } from '../i18n';
import { ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron';
import type { Wire } from '../core/errors';
import {
  EDITOR_CHANNEL,
  EDITOR_TEST_IMPORT_CHANNEL,
  editorFailure,
  editorOk,
  notImplemented,
  type EditorChannel,
  type EditorCharacter,
  type EditorResult,
  type ImportedCharacter,
  type ImportedImage,
  type ImportedLayers
} from '../domain/character-editor/ipc';
import type { CharacterChoice } from '../shared/characterImport';
import type { Logger } from '../infra/logger';
import { describeThrown } from './logIpc';

// The editor window's IPC (#26 C): every `editor:*` channel and what it
// answers. Each answer is a Wire, so nothing thrown crosses to the renderer;
// a failure is written to the app log and comes back as { ok: false }.
// Picture import is #57 (editorImport.ts); save and apply come in a later issue (F).

// EditorResult (domain) and Wire (core) must stay the same shape.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const sameShape: Same<EditorResult<string>, Wire<string>> = true;
void sameShape;

export type EditorDeps = {
  listCharacters: () => Promise<CharacterChoice[]>;
  closeEditor: () => void;
  // Each opens a file dialog; null when the user cancels it.
  importImage: () => Promise<ImportedImage | null>;
  importLayered: () => Promise<ImportedLayers | null>;
  importCharacter: (id: unknown) => Promise<ImportedCharacter>;
  // The editor check's door (PETNUDGE_EDITOR_TEST=1 only): an import from bytes.
  testImport?: (kind: unknown, name: unknown, bytes: unknown) => Promise<ImportedImage | ImportedLayers>;
};

type Handler = (...args: unknown[]) => Promise<EditorResult<unknown>> | EditorResult<unknown>;

export const editorHandlers = (deps: EditorDeps): Record<EditorChannel, Handler> => ({
  [EDITOR_CHANNEL.listCharacters]: async (): Promise<EditorResult<EditorCharacter[]>> =>
    editorOk((await deps.listCharacters()).map(({ id, name, builtin }) => ({ id, name, builtin }))),
  [EDITOR_CHANNEL.close]: (): EditorResult<null> => {
    deps.closeEditor();
    return editorOk(null);
  },
  [EDITOR_CHANNEL.importImage]: async () => editorOk(await deps.importImage()),
  [EDITOR_CHANNEL.importLayered]: async () => editorOk(await deps.importLayered()),
  [EDITOR_CHANNEL.importCharacter]: async (id: unknown) => editorOk(await deps.importCharacter(id)),
  [EDITOR_CHANNEL.save]: () => notImplemented(t('editor.save')),
  [EDITOR_CHANNEL.apply]: () => notImplemented(t('editor.apply'))
});

// Runs one handler: a throw becomes { ok: false, code: 'internal' } and a log line.
export const runEditorHandler = async (channel: string, handler: Handler, args: unknown[], logger: Pick<Logger, 'log'>): Promise<EditorResult<unknown>> => {
  try {
    const result = await handler(...args);
    if (!result.ok && result.error.code !== 'not_implemented') logger.log('warn', 'editor', `${channel}: ${result.error.message}`);
    return result;
  } catch (thrown) {
    const { message, detail } = describeThrown(thrown);
    logger.log('error', 'editor', `${channel} failed: ${message}`, detail);
    return editorFailure('internal', message);
  }
};

// Only the editor window may use these channels.
export const installEditorIpc = (deps: EditorDeps & { editorContents: () => WebContents | null; logger: Logger }) => {
  const { testImport } = deps;
  const handlers: Record<string, Handler> = { ...editorHandlers(deps) };
  if (testImport) handlers[EDITOR_TEST_IMPORT_CHANNEL] = async (kind, name, bytes) => editorOk(await testImport(kind, name, bytes));
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, (event: IpcMainInvokeEvent, ...args: unknown[]) => {
      if (event.sender !== deps.editorContents()) {
        deps.logger.log('warn', 'editor', `${channel} from a window that is not the editor`);
        return editorFailure('forbidden', t('error.editor.forbidden'));
      }
      return runEditorHandler(channel, handler, args, deps.logger);
    });
  }
};
