import { describe, expect, it } from 'vitest';
import { describeThrown, diagnosticsText, sanitizeLogInput } from './logIpc';

describe('log IPC', () => {
  it('accepts a well-formed entry from the renderer', () => {
    expect(sanitizeLogInput('error', 'panel:todo', 'boom', 'at Todo.svelte')).toEqual({ level: 'error', scope: 'panel:todo', message: 'boom', detail: 'at Todo.svelte' });
  });

  it('drops unknown levels and non-text messages', () => {
    expect(sanitizeLogInput('fatal', 'x', 'boom')).toBeNull();
    expect(sanitizeLogInput('error', 'x', { a: 1 })).toBeNull();
  });

  it('cuts long fields and fills a missing scope', () => {
    const entry = sanitizeLogInput('warn', 's'.repeat(100), 'm'.repeat(5000), 12)!;
    expect(entry.scope).toHaveLength(40);
    expect(entry.message).toHaveLength(2000);
    expect(entry.detail).toBeUndefined();
    expect(sanitizeLogInput('info', undefined, 'hi')!.scope).toBe('renderer');
  });

  it('writes diagnostics with versions and recent problems', () => {
    const text = diagnosticsText({ app: '0.1.0', electron: '44.0.0', os: 'darwin 25.6.0', recent: ['x ERROR [a] b'] });
    expect(text).toBe('petnudge 0.1.0 · Electron 44.0.0 · darwin 25.6.0\n최근 경고·오류 1줄:\nx ERROR [a] b');
    expect(diagnosticsText({ app: '0.1.0', electron: '44', os: 'linux', recent: [] })).toContain('최근 경고·오류 없음');
  });

  it('hides a secret before cutting, so no part of it is left at the edge', () => {
    const entry = sanitizeLogInput('error', 'x', 'm'.repeat(1990) + ' sk-ant-abcdefghijklmnopqrstuvwxyz')!;
    expect(entry.message).not.toMatch(/sk-ant/);
    expect(entry.message.endsWith('[가림]')).toBe(true);
  });

  it('writes the home folder as ~ in diagnostics', () => {
    const text = diagnosticsText({ app: '1', electron: '2', os: 'x', recent: ['ERROR [a] at /Users/min/petnudge/x.js'], home: '/Users/min' });
    expect(text).toContain('at ~/petnudge/x.js');
    expect(text).not.toContain('/Users/min');
  });

  it('describes anything thrown, Error or not', () => {
    expect(describeThrown(new Error('boom')).message).toBe('boom');
    expect(describeThrown('x')).toEqual({ message: 'x', detail: undefined });
    expect(describeThrown(undefined)).toEqual({ message: 'undefined', detail: undefined });
  });
});
