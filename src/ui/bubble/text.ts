import { parseMarkdown, type Inline } from '../modules/chat/markdown';
import { t } from '../i18n';

// What a chat reply looks like in the speech bubble above her: plain text
// (Markdown markers dropped), revealed a sentence at a time while it streams,
// and at most three lines, ending in "… 더 보기 ▸" when it is longer.
// Pure: bubble.ts measures the bubble and draws; this decides what to show.

// ---------- plain text ----------

const inlineText = (c: Inline[]): string =>
  c.map((i) => (i.t === 'text' || i.t === 'code' ? i.v : i.t === 'br' ? '\n' : inlineText(i.c))).join('');

// The reply as plain text: blocks, list items and code lines each on a line.
// What the parser leaves as text while it streams (an unclosed ** or ```, a
// quote's >) is dropped too; a single * may be arithmetic, so it stays.
export const plainText = (markdown: string): string =>
  parseMarkdown(markdown)
    .flatMap((b) => (b.t === 'p' ? [inlineText(b.c)] : b.t === 'code' ? [b.v] : b.items.map(inlineText)))
    .join('\n')
    .replace(/\*\*|`+/g, '')
    .replace(/^[ \t]*>[ \t]?/gm, '');

// ---------- sentences ----------

const MARKS = '.!?…~';
const CLOSERS = '"\')]」』”’';
// A phrase also ends at a Korean ending or a comma, once it is this long.
const PHRASE_MIN = 10;
const KOREAN_END = /[요다죠까네]/;

const isSpace = (c: string | undefined) => c === ' ' || c === '\n' || c === '\t';
const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();

// Splits text into the sentences that are finished and the rest still coming.
// A mark only ends a sentence once a space follows it (at the very end the
// reply may go on: "3.", "?!"), and each decision looks only at the text up to
// it, so a longer text never changes a sentence a shorter one already had.
export const splitSentences = (text: string): { sentences: string[]; rest: string } => {
  const sentences: string[] = [];
  let start = 0;
  const end = (at: number, next: number) => {
    const s = tidy(text.slice(start, at));
    if (s) sentences.push(s);
    start = next;
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\n') {
      end(i, i + 1);
      continue;
    }
    if (MARKS.includes(c)) {
      let j = i;
      while (j < text.length && MARKS.includes(text[j])) j++;
      while (j < text.length && CLOSERS.includes(text[j])) j++;
      const numbered = c === '.' && j === i + 1 && /\d/.test(text[i - 1] ?? ''); // "1. 사과"
      if (j < text.length && isSpace(text[j]) && !numbered) end(j, j);
      i = j - 1;
      continue;
    }
    const long = () => tidy(text.slice(start, i + 1)).length >= PHRASE_MIN;
    if (c === ' ' && KOREAN_END.test(text[i - 1] ?? '') && long()) end(i, i);
    else if (c === ',' && isSpace(text[i + 1]) && long()) end(i + 1, i + 1);
  }
  return { sentences, rest: tidy(text.slice(start)) };
};

// The sentences to show after `said`, for the reply so far (Markdown). What
// was said stays as it was; only finished sentences are added, and the rest
// too once the reply is over. The same list comes back when nothing is new.
export const speak = (said: string[], reply: string, final: boolean): string[] => {
  const { sentences, rest } = splitSentences(plainText(reply));
  if (final && rest) sentences.push(rest);
  return sentences.length > said.length ? [...said, ...sentences.slice(said.length)] : said;
};

// A whole reply as one plain line.
export const bubbleText = (reply: string) => speak([], reply, true).join(' ');

// ---------- three lines ----------

// Galmuri11 at 12px (measured in the app): Hangul and other wide letters 12px,
// emoji 15px, Latin letters and digits 4–10px, a space 5px. Estimated on the
// wide side (ASCII 8px, emoji 16px), so a line the estimate fits also fits on
// screen. A line is the bubble's widest less padding and border (2 × 12px):
// 356px in the 380px window, about 29 Hangul letters; three lines in all.
export const MAX_LINES = 3;
// "더 보기 ▸" in the current language
export const moreLabel = () => t('bubble.more');
const SPACE = 5;
const NARROW = new Set([...".,:;'!|il`"]);

const charWidth = (ch: string) => {
  if (ch === ' ' || ch === ' ') return SPACE;
  const code = ch.codePointAt(0) ?? 0;
  if (code < 0x80) return NARROW.has(ch) ? 4 : 8;
  return code > 0xffff ? 16 : 12;
};

export const textWidth = (text: string) => [...text].reduce((sum, ch) => sum + charWidth(ch), 0);
export const linePx = (bubbleWidth: number) => bubbleWidth - 24;

// Lines the text takes at `max` px, wrapping at spaces like the bubble's
// word-break: keep-all (a word wider than a line breaks anywhere). Phrases in
// `keep` do not break (the 더 보기 button is nowrap).
export const lineCount = (text: string, max: number, keep: string[] = []) => {
  for (const phrase of keep) text = text.split(phrase).join(phrase.replace(/ /g, ' '));
  let lines = 1;
  let x = 0;
  for (const word of text.split(/[ \n]+/).filter(Boolean)) {
    const w = textWidth(word);
    if (x > 0 && x + SPACE + w <= max) {
      x += SPACE + w;
      continue;
    }
    if (x > 0) {
      lines++;
      x = 0;
    }
    if (w <= max) {
      x = w;
      continue;
    }
    for (const ch of word) {
      const cw = charWidth(ch);
      if (x > 0 && x + cw > max) {
        lines++;
        x = 0;
      }
      x += cw;
    }
  }
  return lines;
};

// What the bubble shows of `text` at `max` px per line: all of it, or as much
// as fits before "… 더 보기 ▸". While the reply streams (not final) the room
// for "… 더 보기 ▸" is kept, so the text shown only ever grows; a finished
// reply that just fits is shown whole.
export const fitBubble = (text: string, max: number, { final = false } = {}): { text: string; more: boolean } => {
  const more = moreLabel();
  const fits = (text: string) => lineCount(`${text}… ${more}`, max, [more]) <= MAX_LINES;
  if (fits(text) || (final && lineCount(text, max) <= MAX_LINES)) return { text, more: false };
  const chars = [...text];
  // nothing past three full lines can fit
  let k = 0;
  for (let w = 0; k < chars.length && w <= max * MAX_LINES; k++) w += charWidth(chars[k]);
  for (; k > 0; k--) {
    if (isSpace(chars[k - 1])) continue;
    const cut = chars.slice(0, k).join('');
    if (fits(cut)) return { text: `${cut}…`, more: true };
  }
  return { text: '…', more: true };
};
