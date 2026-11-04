import { externalUrl } from '../../../domain/links/link';

// The small part of Markdown the chat tab shows in a pet's reply: **bold**,
// *italic*, `code`, bullet and numbered lists, line breaks, ``` code blocks
// and links. Everything else (headings, tables, images, HTML, quotes) stays
// text. The result is a tree of plain strings that Chat renders as Svelte
// text nodes, so nothing the model writes is ever read as HTML.
//
// Replies are parsed again on every streamed frame, so an unclosed ** or ```
// is left as text until it closes, and the work is linear in the length:
// every "where does this close" search is cached and only moves forward.

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'br' }
  | { t: 'code'; v: string }
  | { t: 'strong'; c: Inline[] }
  | { t: 'em'; c: Inline[] }
  | { t: 'link'; href: string; c: Inline[] };

export type Block =
  | { t: 'p'; c: Inline[] }
  | { t: 'ul'; items: Inline[][] }
  | { t: 'ol'; start: number; items: Inline[][] }
  | { t: 'code'; lang: string; v: string };

// bold, italic and links nest at most this deep; deeper markers are text
const MAX_DEPTH = 3;
const MAX_LABEL = 500;
const MAX_URL = 2048;

const isSpace = (c: string | undefined) => c === undefined || c === ' ' || c === '\t' || c === '\n';
const PUNCTUATION = '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~';

// The first position at or after `pos` where `ok` holds, or -1. Remembers its
// last answer: nothing matched between where it searched from and what it found.
const finder = (s: string, needle: string, ok: (k: number) => boolean = () => true) => {
  let from = Infinity;
  let found = -1;
  return (pos: number) => {
    if (pos >= from && (found === -1 || pos <= found)) return found;
    from = pos;
    let k = s.indexOf(needle, pos);
    while (k !== -1 && !ok(k)) k = s.indexOf(needle, k + 1);
    found = k;
    return found;
  };
};

const pushText = (out: Inline[], v: string) => {
  if (!v) return;
  const last = out.at(-1);
  if (last?.t === 'text') last.v += v;
  else out.push({ t: 'text', v });
};

const BARE_URL = /https?:\/\/[^\s<>()[\]`*"']+/y;

const parseInline = (s: string): Inline[] => {
  // closers: ** after a non-space; a single * after a non-space; a single `
  const strongClose = finder(s, '**', (k) => !isSpace(s[k - 1]));
  const emClose = finder(s, '*', (k) => s[k + 1] !== '*' && s[k - 1] !== '*' && !isSpace(s[k - 1]));
  const tickClose = finder(s, '`', (k) => s[k + 1] !== '`' && s[k - 1] !== '`');
  const bracketClose = finder(s, ']');
  const parenClose = finder(s, ')');
  const newline = finder(s, '\n');

  // [label](url) starting at i, or null
  const linkAt = (i: number, end: number) => {
    const close = bracketClose(i + 1);
    if (close === -1 || close >= end || close === i + 1 || close - i - 1 > MAX_LABEL || s[close + 1] !== '(') return null;
    const nl = newline(i);
    if (nl !== -1 && nl < close) return null;
    const paren = parenClose(close + 2);
    if (paren === -1 || paren >= end || paren === close + 2 || paren - close - 2 > MAX_URL) return null;
    const url = s.slice(close + 2, paren);
    if (/\s/.test(url)) return null;
    return { label: s.slice(i + 1, close), url, next: paren + 1 };
  };

  const walk = (start: number, end: number, depth: number): Inline[] => {
    const out: Inline[] = [];
    let i = start;
    let plain = start; // text from here to i is not yet pushed
    const flush = () => {
      pushText(out, s.slice(plain, i));
    };
    while (i < end) {
      const c = s[i];
      if (c === '\n') {
        flush();
        out.push({ t: 'br' });
        plain = ++i;
        continue;
      }
      if (c === '\\' && i + 1 < end && PUNCTUATION.includes(s[i + 1])) {
        flush();
        pushText(out, s[i + 1]);
        plain = i += 2;
        continue;
      }
      if (c === '`') {
        let run = 1;
        while (i + run < end && s[i + run] === '`') run++;
        if (run === 1) {
          const close = tickClose(i + 2);
          const nl = newline(i);
          if (close !== -1 && close < end && (nl === -1 || close < nl)) {
            flush();
            out.push({ t: 'code', v: s.slice(i + 1, close) });
            plain = i = close + 1;
            continue;
          }
        }
        i += run; // a run of backticks, or an unclosed one, is text
        continue;
      }
      if (c === '*') {
        if (s[i + 1] === '*') {
          const close = depth < MAX_DEPTH && !isSpace(s[i + 2]) ? strongClose(i + 3) : -1;
          if (close !== -1 && close + 1 < end) {
            flush();
            out.push({ t: 'strong', c: walk(i + 2, close, depth + 1) });
            plain = i = close + 2;
            continue;
          }
          i += 2;
          continue;
        }
        const close = depth < MAX_DEPTH && !isSpace(s[i + 1]) ? emClose(i + 2) : -1;
        if (close !== -1 && close < end) {
          flush();
          out.push({ t: 'em', c: walk(i + 1, close, depth + 1) });
          plain = i = close + 1;
          continue;
        }
        i += 1;
        continue;
      }
      if (c === '!' && s[i + 1] === '[') {
        // an image is never loaded: all of it stays text
        const image = linkAt(i + 1, end);
        i = image ? image.next : i + 2;
        continue;
      }
      if (c === '[') {
        const link = depth < MAX_DEPTH ? linkAt(i, end) : null;
        if (link) {
          flush();
          const href = externalUrl(link.url);
          if (href) out.push({ t: 'link', href, c: [{ t: 'text', v: link.label }] });
          else pushText(out, link.label); // javascript:, data: and the rest: the label only
          plain = i = link.next;
          continue;
        }
        i += 1;
        continue;
      }
      if (c === 'h' && depth < MAX_DEPTH && !/[A-Za-z0-9/]/.test(s[i - 1] ?? '') && s.startsWith('http', i)) {
        BARE_URL.lastIndex = i;
        const m = BARE_URL.exec(s);
        if (m) {
          const chunk = s.slice(i, Math.min(end, i + m[0].length));
          const url = chunk.replace(/[.,;:!?]+$/, '');
          const href = externalUrl(url);
          if (href && url.length > 'https://'.length) {
            flush();
            out.push({ t: 'link', href, c: [{ t: 'text', v: url }] });
            plain = i = i + url.length;
          } else i += chunk.length;
          continue;
        }
      }
      i += 1;
    }
    flush();
    return out;
  };

  return walk(0, s.length, 0);
};

const FENCE_OPEN = /^ {0,3}(`{3,})\s*([\w+#.-]*)\s*$/;
const FENCE_CLOSE = /^ {0,3}(`{3,})\s*$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*(\d{1,9})[.)]\s+(.*)$/;
const HEADING = /^ {0,3}#{1,6}\s+(.*?)(?:\s+#+)?\s*$/;

type ListItem = { kind: 'ul' | 'ol'; text: string; start: number };
const itemOf = (line: string): ListItem | null => {
  const b = BULLET.exec(line);
  if (b) return { kind: 'ul', text: b[1], start: 0 };
  const n = NUMBERED.exec(line);
  return n ? { kind: 'ol', text: n[2], start: Number(n[1]) } : null;
};

export const parseMarkdown = (source: string): Block[] => {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  const endPara = () => {
    if (para.length) blocks.push({ t: 'p', c: parseInline(para.join('\n')) });
    para = [];
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    const fence = FENCE_OPEN.exec(line);
    if (fence) {
      endPara();
      let close = i + 1;
      while (close < lines.length) {
        const m = FENCE_CLOSE.exec(lines[close]);
        if (m && m[1].length >= fence[1].length) break;
        close++;
      }
      if (close === lines.length) {
        // not closed yet (still streaming): the rest is plain text
        const c: Inline[] = [];
        lines.slice(i).forEach((l, n) => {
          if (n) c.push({ t: 'br' });
          pushText(c, l);
        });
        blocks.push({ t: 'p', c });
        break;
      }
      blocks.push({ t: 'code', lang: fence[2], v: lines.slice(i + 1, close).join('\n') });
      i = close + 1;
      continue;
    }

    if (!line.trim()) {
      endPara();
      i++;
      continue;
    }

    const first = itemOf(line);
    if (first) {
      endPara();
      const items = [first.text];
      i++;
      while (i < lines.length) {
        const l = lines[i];
        const item = itemOf(l);
        if (item && item.kind === first.kind) {
          items.push(item.text);
          i++;
        } else if (!item && /^\s{2,}\S/.test(l) && !FENCE_OPEN.test(l)) {
          items[items.length - 1] += `\n${l.trim()}`; // an indented line continues the item
          i++;
        } else if (!l.trim() && itemOf(lines[i + 1] ?? '')?.kind === first.kind) {
          i++; // a blank line between items keeps the list
        } else break;
      }
      const parsed = items.map(parseInline);
      blocks.push(first.kind === 'ul' ? { t: 'ul', items: parsed } : { t: 'ol', start: first.start, items: parsed });
      continue;
    }

    const heading = HEADING.exec(line);
    para.push(heading ? heading[1] : line);
    i++;
  }
  endPara();
  return blocks;
};
