import { ipcMain, shell } from 'electron';
import { LEVELS, type Level } from '../domain/logging/log';
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
    message: message.slice(0, 2000),
    ...(typeof detail === 'string' && detail ? { detail: detail.slice(0, 2000) } : {})
  };
};

export const diagnosticsText = ({ app, electron, os, recent }: { app: string; electron: string; os: string; recent: string[] }) =>
  [`petnudge ${app} · Electron ${electron} · ${os}`, recent.length ? `최근 경고·오류 ${recent.length}줄:` : '최근 경고·오류 없음', ...recent].join('\n');

export const installLogIpc = (logger: Logger, info: { app: string; electron: string; os: string }) => {
  ipcMain.on('log', (_event, level: unknown, scope: unknown, message: unknown, detail: unknown) => {
    const entry = sanitizeLogInput(level, scope, message, detail);
    if (entry) logger.log(entry.level, entry.scope, entry.message, entry.detail);
  });
  ipcMain.handle('logs:open', () => shell.showItemInFolder(logger.file));
  ipcMain.handle('logs:diagnostics', () => diagnosticsText({ ...info, recent: logger.recent(20) }));
};
