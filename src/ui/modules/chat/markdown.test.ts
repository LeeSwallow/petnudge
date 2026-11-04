import { describe, expect, it } from 'vitest';
import { parseMarkdown, type Block, type Inline } from './markdown';

const p = (...c: Inline[]): Block => ({ t: 'p', c });
const text = (v: string): Inline => ({ t: 'text', v });
const br: Inline = { t: 'br' };

// Every text the tree would show, in order, so a test can say nothing was lost.
const flat = (blocks: Block[]): string =>
  blocks
    .map((b) => {
      const inl = (c: Inline[]): string =>
        c.map((i) => (i.t === 'text' || i.t === 'code' ? i.v : i.t === 'br' ? '\n' : inl(i.c))).join('');
      if (b.t === 'p') return inl(b.c);
      if (b.t === 'code') return b.v;
      return b.items.map(inl).join('\n');
    })
    .join('\n');

describe('chat markdown', () => {
  it('reads plain text as one paragraph', () => {
    expect(parseMarkdown('안녕하세요')).toEqual([p(text('안녕하세요'))]);
  });

  it('keeps line breaks inside a paragraph and splits on a blank line', () => {
    expect(parseMarkdown('하나\n둘\n\n셋')).toEqual([p(text('하나'), br, text('둘')), p(text('셋'))]);
  });

  it('reads bold, italic and inline code', () => {
    expect(parseMarkdown('**굵게** *기울임* `코드`')).toEqual([
      p({ t: 'strong', c: [text('굵게')] }, text(' '), { t: 'em', c: [text('기울임')] }, text(' '), { t: 'code', v: '코드' })
    ]);
  });

  it('nests italic and code inside bold', () => {
    expect(parseMarkdown('**a *b* `c`**')).toEqual([p({ t: 'strong', c: [text('a '), { t: 'em', c: [text('b')] }, text(' '), { t: 'code', v: 'c' }] })]);
  });

  it('does not read markers inside inline code', () => {
    expect(parseMarkdown('`**x**`')).toEqual([p({ t: 'code', v: '**x**' })]);
  });

  it('stops nesting at a limit and keeps the rest as text', () => {
    const tree = parseMarkdown('**a *b **c *d* c** b* a**');
    const depth = (c: Inline[]): number => Math.max(0, ...c.map((i) => (i.t === 'strong' || i.t === 'em' || i.t === 'link' ? 1 + depth(i.c) : 0)));
    expect(depth((tree[0] as { c: Inline[] }).c)).toBeLessThanOrEqual(3);
    expect(flat(tree)).toContain('d');
  });

  it('reads a lone star or stars around spaces as text', () => {
    expect(parseMarkdown('2 * 3 = 6')).toEqual([p(text('2 * 3 = 6'))]);
    expect(parseMarkdown('a ** b')).toEqual([p(text('a ** b'))]);
  });

  it('reads bullet lists, joining their items', () => {
    expect(parseMarkdown('- 하나\n* **둘**\n+ 셋')).toEqual([
      { t: 'ul', items: [[text('하나')], [{ t: 'strong', c: [text('둘')] }], [text('셋')]] }
    ]);
  });

  it('reads numbered lists with their start', () => {
    expect(parseMarkdown('3. 셋\n4) 넷')).toEqual([{ t: 'ol', start: 3, items: [[text('셋')], [text('넷')]] }]);
  });

  it('keeps lists flat: an indented item joins the same list', () => {
    expect(parseMarkdown('- a\n  - b')).toEqual([{ t: 'ul', items: [[text('a')], [text('b')]] }]);
  });

  it('separates a list from the paragraph around it', () => {
    expect(parseMarkdown('목록:\n- a\n끝')).toEqual([p(text('목록:')), { t: 'ul', items: [[text('a')]] }, p(text('끝'))]);
  });

  it('reads a fenced code block verbatim, with its language', () => {
    expect(parseMarkdown('보세요\n```ts\nconst a = **1**;\n  <b>x</b>\n```\n끝')).toEqual([
      p(text('보세요')),
      { t: 'code', lang: 'ts', v: 'const a = **1**;\n  <b>x</b>' },
      p(text('끝'))
    ]);
  });

  it('leaves an unclosed ``` as plain text until it closes', () => {
    expect(parseMarkdown('```py\nprint(**1**)')).toEqual([p(text('```py'), br, text('print(**1**)'))]);
    expect(parseMarkdown('```py\nprint(1)\n```')).toEqual([{ t: 'code', lang: 'py', v: 'print(1)' }]);
  });

  it('leaves an unclosed ** or ` as plain text until it closes', () => {
    expect(parseMarkdown('이건 **굵')).toEqual([p(text('이건 **굵'))]);
    expect(parseMarkdown('이건 **굵게**')).toEqual([p(text('이건 '), { t: 'strong', c: [text('굵게')] })]);
    expect(parseMarkdown('`코')).toEqual([p(text('`코'))]);
  });

  it('shows headings, quotes, rules and tables as plain lines', () => {
    expect(parseMarkdown('# 제목\n> 인용\n---\n| a | b |')).toEqual([p(text('제목'), br, text('> 인용'), br, text('---'), br, text('| a | b |'))]);
  });

  it('keeps HTML as text', () => {
    const tree = parseMarkdown('<script>alert(1)</script> <img src=x onerror=alert(1)> **<b>굵</b>**');
    expect(tree).toEqual([
      p(text('<script>alert(1)</script> <img src=x onerror=alert(1)> '), { t: 'strong', c: [text('<b>굵</b>')] })
    ]);
  });

  it('reads links to http and https', () => {
    expect(parseMarkdown('[문서](https://example.com/a?b=1) 참고')).toEqual([
      p({ t: 'link', href: 'https://example.com/a?b=1', c: [text('문서')] }, text(' 참고'))
    ]);
  });

  it('reads a bare http(s) address as a link, leaving trailing punctuation out', () => {
    expect(parseMarkdown('여기 https://example.com/x. 보세요')).toEqual([
      p(text('여기 '), { t: 'link', href: 'https://example.com/x', c: [text('https://example.com/x')] }, text('. 보세요'))
    ]);
  });

  it('refuses links that are not http or https, keeping the label as text', () => {
    for (const url of ['javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'vbscript:x', '//evil.com']) {
      const tree = parseMarkdown(`[누르기](${url})`);
      expect(JSON.stringify(tree)).not.toContain('"link"');
      expect(flat(tree)).toContain('누르기');
    }
  });

  it('shows images as text, never loading them', () => {
    const tree = parseMarkdown('![고양이](https://example.com/cat.png)');
    expect(tree).toEqual([p(text('![고양이](https://example.com/cat.png)'))]);
  });

  it('loses no text', () => {
    const src = '하나 **둘** *셋* `넷`\n- 다섯\n1. 여섯\n```\n일곱\n```';
    expect(flat(parseMarkdown(src)).replace(/\s/g, '')).toBe('하나둘셋넷다섯여섯일곱');
  });

  it('parses a long reply quickly, even an adversarial one', () => {
    const inputs = [
      Array.from({ length: 500 }, (_, i) => `- **항목 ${i}** *설명* \`code\` [링크](https://e.com/${i})`).join('\n'),
      '**'.repeat(10000),
      '*a'.repeat(10000),
      '`'.repeat(20000),
      '[a]('.repeat(5000),
      'https://'.repeat(2500),
      '```\n'.repeat(5000)
    ];
    for (const input of inputs) {
      expect(input.length).toBeGreaterThanOrEqual(19000);
      parseMarkdown(input);
      const start = performance.now();
      parseMarkdown(input);
      expect(performance.now() - start).toBeLessThan(15);
    }
  });
});
