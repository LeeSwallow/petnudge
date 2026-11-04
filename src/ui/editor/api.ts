import type { EditorApi } from '../../preload/editor';
import { toUserMessage } from '../../domain/errors/userMessage';
import type { Level } from '../../domain/logging/log';

declare global {
  interface Window {
    editorApi: EditorApi;
  }
}

// The editor window has editorApi only (src/preload/editor.ts), not petApi.
export const editorApi = window.editorApi;

export const logEditorError = (scope: string, error: unknown, level: Level = 'error') => {
  const { text, detail } = toUserMessage(error);
  editorApi.log(level, scope, text, detail || undefined);
};

export const installEditorErrorLogging = (target: Window = window) => {
  target.addEventListener('error', (event) => logEditorError('editor', event.error ?? event.message));
  target.addEventListener('unhandledrejection', (event) => logEditorError('editor', event.reason));
};
