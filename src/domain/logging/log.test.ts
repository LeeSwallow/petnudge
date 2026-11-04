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

  it('keeps ids and paths that only look long', () => {
    const uuid = '3f2c1a9e-7b4d-4e8a-9c1f-2a6b8d0e4f13';
    expect(redact(`id ${uuid}`)).toBe(`id ${uuid}`);
    expect(redact(`/characters/.import-${uuid}/sheet.png`)).toBe(`/characters/.import-${uuid}/sheet.png`);
    expect(redact('assets/characters/lila/lila-pack-very-long-file-name.json')).toBe('assets/characters/lila/lila-pack-very-long-file-name.json');
  });

  it('hides secrets in other shapes', () => {
    expect(redact('authorization: bearer abc123xyz789qwe')).toBe('authorization: bearer [가림]');
    expect(redact('Authorization: Basic dXNlcjpwYXNzd29yZA==')).toBe('Authorization: Basic [가림]');
    expect(redact('fetch http://me:hunter2@llm.local/v1 failed')).toBe('fetch http://[가림]@llm.local/v1 failed');
    expect(redact('GET /v1?api_key=abcd1234&x=1')).toBe('GET /v1?api_key=[가림]&x=1');
    expect(redact('x-api-key: abcd1234efgh')).toBe('x-api-key: [가림]');
    expect(redact('token aGVsbG8+d29ybGQ/Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MA==')).toBe('token [가림]');
    expect(redact('key 0123456789abcdef0123456789abcdef')).toBe('key [가림]');
  });
});
