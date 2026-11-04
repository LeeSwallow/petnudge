import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createLogger } from './logger';

const dirs: string[] = [];
const temp = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'petnudge-log-'));
  dirs.push(dir);
  return dir;
};
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

let clock = Date.parse('2026-11-04T09:00:00.000Z');
const now = () => new Date(clock);

describe('file logger', () => {
  it('writes lines at or above its level', () => {
    const dir = temp();
    const log = createLogger(dir, { min: 'warn', now });
    log.log('error', 'mcp', 'failed to start');
    log.log('info', 'app', 'ready');
    expect(readFileSync(log.file, 'utf8')).toBe('2026-11-04T09:00:00.000Z ERROR [mcp] failed to start\n');
  });

  it('rotates past the size limit and keeps three old files', () => {
    const dir = temp();
    const log = createLogger(dir, { maxBytes: 60, keep: 3, now });
    for (let i = 0; i < 12; i++) {
      clock += 2000;
      log.log('error', 'x', `line ${i} padding padding`);
    }
    expect(readdirSync(dir).sort()).toEqual(['petnudge.log', 'petnudge.log.1', 'petnudge.log.2', 'petnudge.log.3']);
  });

  it('writes the same line at most once a second', () => {
    const log = createLogger(temp(), { now });
    log.log('warn', 'chat', 'no provider');
    log.log('warn', 'chat', 'no provider');
    clock += 1500;
    log.log('warn', 'chat', 'no provider');
    expect(readFileSync(log.file, 'utf8').trim().split('\n')).toHaveLength(2);
  });

  it('never throws when the folder cannot be written', () => {
    const dir = temp();
    const blocker = path.join(dir, 'file');
    writeFileSync(blocker, '');
    const log = createLogger(path.join(blocker, 'logs'), { now });
    expect(() => log.log('error', 'x', 'lost')).not.toThrow();
    expect(log.recent(5)).toEqual([]);
  });

  it('reads back the latest warnings and errors', () => {
    const log = createLogger(temp(), { min: 'debug', now });
    log.log('info', 'a', 'one');
    clock += 2000;
    log.log('error', 'b', 'two');
    clock += 2000;
    log.log('warn', 'c', 'three');
    expect(log.recent(5).map((l) => l.slice(25))).toEqual(['ERROR [b] two', 'WARN [c] three']);
  });
});
