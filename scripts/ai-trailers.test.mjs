import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// .githooks/commit-msg drops AI tool co-author lines and keeps people's.
const run = (message) => {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'trailers-')), 'MSG');
  writeFileSync(file, message);
  execFileSync('sh', ['.githooks/commit-msg', file]);
  return readFileSync(file, 'utf8');
};

describe.skipIf(process.platform === 'win32')('commit-msg hook', () => {
  it('removes AI tool co-authors and generated-with lines', () => {
    const out = run([
      'feat: x', '',
      'Generated with Claude Code',
      'Co-Authored-By: Claude <noreply@anthropic.com>',
      'Co-Authored-By: Claude Opus 4.1 <noreply@anthropic.com>',
      'Co-authored-by: Copilot <175728472+Copilot@users.noreply.github.com>',
      'Co-authored-by: Cursor Agent <cursoragent@cursor.com>',
      'Co-authored-by: Codex <codex@openai.com>',
      'Co-authored-by: gemini-code-assist[bot] <176961590+gemini-code-assist[bot]@users.noreply.github.com>',
      ''
    ].join('\n'));
    expect(out).toBe('feat: x\n');
  });

  it('keeps human co-authors, whatever their names', () => {
    const humans = [
      'Co-Authored-By: Claude Martin <claude.martin@example.org>',
      'Co-Authored-By: Jules Tanaka <jules@example.org>',
      'Co-Authored-By: Devin Park <devin@example.com>'
    ];
    expect(run(['fix: y', '', ...humans, ''].join('\n'))).toBe(['fix: y', '', ...humans].join('\n') + '\n');
  });
});
