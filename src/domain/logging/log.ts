// What goes into the app log and how: levels, hiding secrets, one line per
// entry, and the order files move in when the log is rotated. Pure; the file
// writing is src/infra/logger.ts.

export type Level = 'error' | 'warn' | 'info' | 'debug';
const RANK: Record<Level, number> = { error: 0, warn: 1, info: 2, debug: 3 };
export const LEVELS = Object.keys(RANK) as Level[];

export const atLeast = (level: Level, min: Level) => RANK[level] <= RANK[min];

const HIDDEN = '[가림]';

// Each rule keeps what names the secret (the scheme, the parameter, the
// header) and hides the value. Ids and paths stay readable: a UUID or a long
// kebab-case file name is not a secret, so the catch-all for long tokens asks
// for what random tokens have and words do not (mixed case and digits).
const RULES: [RegExp, (...m: string[]) => string][] = [
  [/(\/\/)[^/\s:@]+:[^/\s@]+@/g, (_m, slashes) => `${slashes}${HIDDEN}@`],
  [/\bsk-[A-Za-z0-9_-]{8,}/g, () => HIDDEN],
  [/\b(bearer|basic)(\s+)[A-Za-z0-9._~+/=-]{6,}/gi, (_m, scheme, space) => `${scheme}${space}${HIDDEN}`],
  [/([?&](?:api_?key|key|token|access_token|secret|password)=)[^&\s]+/gi, (_m, name) => `${name}${HIDDEN}`],
  [/\b((?:x-)?api-key)(:\s*)\S+/gi, (_m, name, colon) => `${name}${colon}${HIDDEN}`],
  [/\b[0-9a-fA-F]{32,}\b/g, () => HIDDEN],
  [/[A-Za-z0-9+/_=-]{32,}/g, (m) => (/[a-z]/.test(m) && /[A-Z]/.test(m) && /[0-9]/.test(m) ? HIDDEN : m)]
];

export const redact = (text: string) => RULES.reduce((out, [pattern, replace]) => out.replace(pattern, replace as never), text);

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
