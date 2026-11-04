// What goes into the app log and how: levels, hiding secrets, one line per
// entry, and the order files move in when the log is rotated. Pure; the file
// writing is src/infra/logger.ts.

export type Level = 'error' | 'warn' | 'info' | 'debug';
const RANK: Record<Level, number> = { error: 0, warn: 1, info: 2, debug: 3 };
export const LEVELS = Object.keys(RANK) as Level[];

export const atLeast = (level: Level, min: Level) => RANK[level] <= RANK[min];

const HIDDEN = '[가림]';
// API keys (sk-…, sk-ant-…), bearer tokens, and long hex/base64url runs
// (session tokens, hashes of secrets). Plain words never reach 32 characters.
const SECRETS: RegExp[] = [/\bsk-[A-Za-z0-9_-]{8,}/g, /(\bBearer\s+)[A-Za-z0-9._~+/=-]{8,}/g, /\b[A-Za-z0-9_-]{32,}\b/g];

export const redact = (text: string) =>
  SECRETS.reduce((out, pattern) => out.replace(pattern, (match, bearer?: string) => (typeof bearer === 'string' && match.startsWith(bearer) ? bearer + HIDDEN : HIDDEN)), text);

export type Entry = { at: Date; level: Level; scope: string; message: string; detail?: string };

export const formatLine = ({ at, level, scope, message, detail }: Entry) => {
  const flat = (s: string) => redact(s).replace(/\r?\n/g, '⏎');
  return `${at.toISOString()} ${level.toUpperCase()} [${flat(scope)}] ${flat(message)}${detail ? ` | ${flat(detail)}` : ''}`;
};

// Rotation renames oldest first, so nothing is overwritten before it moved.
export const rotationPlan = (base: string, keep: number): [string, string][] => {
  const plan: [string, string][] = [];
  for (let i = keep - 1; i >= 1; i--) plan.push([`${base}.${i}`, `${base}.${i + 1}`]);
  plan.push([base, `${base}.1`]);
  return plan;
};
