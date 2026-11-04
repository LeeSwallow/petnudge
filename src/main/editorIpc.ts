import { ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron';
import type { Wire } from '../core/errors';
import { EDITOR_CHANNEL, editorFailure, editorOk, notImplemented, type EditorChannel, type EditorCharacter, type EditorResult } from '../domain/character-editor/ipc';
import type { CharacterChoice } from '../shared/characterImport';
import type { Logger } from '../infra/logger';
import { describeThrown } from './logIpc';

// The editor window's IPC (#26 C): every `editor:*` channel and what it
// answers. Each answer is a Wire, so nothing thrown crosses to the renderer;
// a failure is written to the app log and comes back as { ok: false }.
// Import, save and apply are filled by later issues (D, F).

// EditorResult (domain) and Wire (core) must stay the same shape.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const sameShape: Same<EditorResult<string>, Wire<string>> = true;
void sameShape;

export type EditorDeps = {
  listCharacters: () => Promise<CharacterChoice[]>;
  closeEditor: () => void;
};

type Handler = (...args: unknown[]) => Promise<EditorResult<unknown>> | EditorResult<unknown>;

export const editorHandlers = (deps: EditorDeps): Record<EditorChannel, Handler> => ({
  [EDITOR_CHANNEL.listCharacters]: async (): Promise<EditorResult<EditorCharacter[]>> =>
    editorOk((await deps.listCharacters()).map(({ id, name, builtin }) => ({ id, name, builtin }))),
  [EDITOR_CHANNEL.close]: (): EditorResult<null> => {
    deps.closeEditor();
    return editorOk(null);
  },
  [EDITOR_CHANNEL.importImage]: () => notImplemented('그림 불러오기'),
  [EDITOR_CHANNEL.importLayered]: () => notImplemented('레이어 파일 불러오기'),
  [EDITOR_CHANNEL.save]: () => notImplemented('저장'),
  [EDITOR_CHANNEL.apply]: () => notImplemented('펫에 적용')
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
  for (const [channel, handler] of Object.entries(editorHandlers(deps))) {
    ipcMain.handle(channel, (event: IpcMainInvokeEvent, ...args: unknown[]) => {
      if (event.sender !== deps.editorContents()) {
        deps.logger.log('warn', 'editor', `${channel} from a window that is not the editor`);
        return editorFailure('forbidden', '에디터 창에서만 쓸 수 있어요');
      }
      return runEditorHandler(channel, handler, args, deps.logger);
    });
  }
};
