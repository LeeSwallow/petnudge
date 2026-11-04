import { describe, expect, it } from 'vitest';
import { atLeast, formatLine, redact, rotationPlan } from './log';

describe('log rules', () => {
  it('orders levels from error down to debug', () => {
    expect(atLeast('error', 'warn')).toBe(true);
    expect(atLeast('info', 'warn')).toBe(false);
    expect(atLeast('debug', 'debug')).toBe(true);
  });

  it('hides keys and tokens', () => {
    expect(redact('key sk-ant-api03-abcdefghijklmnop1234 used')).toBe('key [가림] used');
    expect(redact('Authorization: Bearer 9f8e7d6c5b4a39281706f5e4d3c2b1a0')).toBe('Authorization: Bearer [가림]');
    expect(redact('token=0123456789abcdef0123456789abcdef01')).toBe('token=[가림]');
    expect(redact('평범한 문장 그대로')).toBe('평범한 문장 그대로');
  });

  it('writes one line per entry, redacted', () => {
    const at = new Date('2026-11-04T09:00:00.000Z');
    expect(formatLine({ at, level: 'error', scope: 'mcp', message: 'failed\nto start', detail: 'Bearer abcdefghijklmnopqrstuvwxyz012345' }))
      .toBe('2026-11-04T09:00:00.000Z ERROR [mcp] failed⏎to start | Bearer [가림]');
    expect(formatLine({ at, level: 'info', scope: 'app', message: 'ready' })).toBe('2026-11-04T09:00:00.000Z INFO [app] ready');
  });

  it('shifts older files first when rotating', () => {
    expect(rotationPlan('p.log', 3)).toEqual([['p.log.2', 'p.log.3'], ['p.log.1', 'p.log.2'], ['p.log', 'p.log.1']]);
  });
});
