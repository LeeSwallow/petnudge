import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// #77: what the user reads comes from the message catalogs (src/i18n), so
// no Korean is written straight into user-facing code. Comments, tests and
// the catalogs themselves may hold Korean; so may character data (packs and
// mods are data, outside these folders). The character editor (src/ui/editor)
// is translated on its own.

const SRC = path.resolve(__dirname);
const SCOPE = ['ui', 'renderer', 'main'];
const SKIP = [/^ui\/editor\//, /\.test\.ts$/];

// Korean that is not wording: [file, the text on the line that allows it].
const ALLOWED: [string, string][] = [
  // the sentence splitter knows Korean endings (a regular expression, not text)
  ['ui/bubble/text.ts', 'const KOREAN_END = /[요다죠까네]/;']
];

const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힣]/;

// Comments out: /* … */, <!-- … -->, and // to the end of a line (not inside
// a URL such as http://).
export const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/<!--[\s\S]*?-->/g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1');

export const hangulLines = (file: string, source: string) =>
  stripComments(source)
    .split('\n')
    .map((line, i) => ({ line: i + 1, text: line.trim() }))
    .filter(({ text }) => HANGUL.test(text) && !ALLOWED.some(([f, allowed]) => f === file && text.includes(allowed)))
    .map(({ line, text }) => `${file}:${line}: ${text.slice(0, 80)}`);

const files = (dir: string): string[] =>
  readdirSync(path.join(SRC, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return files(rel);
    return /\.(ts|svelte|html)$/.test(entry.name) && !SKIP.some((re) => re.test(rel)) ? [rel] : [];
  });

describe('Korean in user-facing code', () => {
  it('finds Korean outside comments', () => {
    expect(hangulLines('ui/x.ts', "// 주석\nconst a = '할 일';\n/* 블록\n 주석 */ const url = 'http://x'; // 끝")).toEqual(["ui/x.ts:2: const a = '할 일';"]);
    expect(hangulLines('ui/x.svelte', '<!-- 주석 -->\n<p>안녕</p>')).toEqual(['ui/x.svelte:2: <p>안녕</p>']);
    expect(hangulLines('ui/bubble/text.ts', 'const KOREAN_END = /[요다죠까네]/;')).toEqual([]);
  });

  it('has none in src/ui (but the editor), src/renderer and src/main', () => {
    const found = SCOPE.flatMap((dir) => files(dir)).flatMap((file) => hangulLines(file, readFileSync(path.join(SRC, file), 'utf8')));
    expect(found).toEqual([]);
  });
});
