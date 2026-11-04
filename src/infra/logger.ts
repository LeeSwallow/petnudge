import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { atLeast, formatLine, rotationPlan, type Level } from '../domain/logging/log';

// The app log: one file under the profile (logs/petnudge.log), rotated by
// size, lines redacted by formatLine. Logging never throws: a log that cannot
// be written must not take the app down with it.

export type Logger = {
  log(level: Level, scope: string, message: string, detail?: string): void;
  // The latest warnings and errors, oldest first (for diagnostics).
  recent(n: number): string[];
  readonly file: string;
};

type Options = { maxBytes?: number; keep?: number; min?: Level; now?: () => Date };

export const createLogger = (dir: string, { maxBytes = 1024 * 1024, keep = 3, min = 'info', now = () => new Date() }: Options = {}): Logger => {
  const file = path.join(dir, 'petnudge.log');
  const lastSeen = new Map<string, number>();

  const rotate = () => {
    for (const [from, to] of rotationPlan(file, keep)) if (existsSync(from)) renameSync(from, to);
    rmSync(`${file}.${keep + 1}`, { force: true });
  };

  return {
    file,
    log(level, scope, message, detail) {
      if (!atLeast(level, min)) return;
      const at = now();
      // the same line again within a second is a loop, not news
      const key = `${level}|${scope}|${message}`;
      if (at.getTime() - (lastSeen.get(key) ?? -Infinity) < 1000) return;
      lastSeen.set(key, at.getTime());
      if (lastSeen.size > 500) lastSeen.clear();
      try {
        mkdirSync(dir, { recursive: true });
        if (existsSync(file) && statSync(file).size >= maxBytes) rotate();
        appendFileSync(file, `${formatLine({ at, level, scope, message, detail })}\n`);
      } catch (error) {
        process.stderr.write(`petnudge: could not write the log (${(error as Error).message})\n`);
      }
    },
    recent(n) {
      try {
        return readFileSync(file, 'utf8').split('\n').filter((line) => / (ERROR|WARN) \[/.test(line)).slice(-n);
      } catch {
        return []; // no log yet, or it cannot be read
      }
    }
  };
};
