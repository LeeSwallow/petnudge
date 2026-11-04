import { api } from '../renderer/api';
import { toUserMessage } from '../domain/errors/userMessage';
import type { Level } from '../domain/logging/log';

// The renderer's side of the app log: one call for "this went wrong here",
// with the user text and the detail split by the shared rule.
export const logError = (scope: string, error: unknown, level: Level = 'error') => {
  const { text, detail } = toUserMessage(error);
  api.log(level, scope, text, detail || undefined);
};

// Anything thrown and not caught in the pet window goes to the log too.
export const installErrorLogging = (target: Window = window) => {
  target.addEventListener('error', (event) => logError('renderer', event.error ?? event.message));
  target.addEventListener('unhandledrejection', (event) => logError('renderer', event.reason));
};
