import { t } from '../i18n';
import { ipcMain, shell } from 'electron';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { LEVELS, redact, type Level } from '../domain/logging/log';
import type { Logger } from '../infra/logger';

// The renderer's way into the app log, plus "로그 폴더 열기" and "진단 정보
// 복사" (설정 › 문제 해결). Input from the renderer is untrusted: unknown
// levels are dropped and every field is cut to size.

export type LogEntry = { level: Level; scope: string; message: string; detail?: string };

export const sanitizeLogInput = (level: unknown, scope: unknown, message: unknown, detail?: unknown): LogEntry | null => {
  if (typeof level !== 'string' || !LEVELS.includes(level as Level) || typeof message !== 'string') return null;
  return {
    level: level as Level,
    scope: typeof scope === 'string' && scope ? scope.slice(0, 40) : 'renderer',
    // hidden before cutting, so a secret on the edge leaves no prefix behind
    message: redact(message).slice(0, 2000),
    ...(typeof detail === 'string' && detail ? { detail: redact(detail).slice(0, 2000) } : {})
  };
};

// Diagnostics are pasted into public bug reports: the home folder (it holds
// the user name) is written as ~.
// What to log for any thrown value (Error or not).
export const describeThrown = (thrown: unknown): { message: string; detail: string | undefined } =>
  thrown instanceof Error ? { message: thrown.message || thrown.name, detail: thrown.stack } : { message: String(thrown), detail: undefined };

export const diagnosticsText = ({ app, electron, os, recent, home }: { app: string; electron: string; os: string; recent: string[]; home?: string }) => {
  const text = [`petnudge ${app} · Electron ${electron} · ${os}`, recent.length ? t('dialog.diagnostics.recent', { count: recent.length }) : t('dialog.diagnostics.none'), ...recent].join('\n');
  return home ? text.split(home).join('~') : text;
};

export const installLogIpc = (logger: Logger, info: { app: string; electron: string; os: string }) => {
  ipcMain.on('log', (_event, level: unknown, scope: unknown, message: unknown, detail: unknown) => {
    const entry = sanitizeLogInput(level, scope, message, detail);
    if (entry) logger.log(entry.level, entry.scope, entry.message, entry.detail);
  });
  // the folder opens even before anything was logged
  ipcMain.handle('logs:open', async () => {
    mkdirSync(path.dirname(logger.file), { recursive: true });
    await shell.openPath(path.dirname(logger.file));
  });
  ipcMain.handle('logs:diagnostics', () => diagnosticsText({ ...info, recent: logger.recent(20), home: homedir() }));
};
