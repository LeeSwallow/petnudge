import type { Catalog, Message } from './types';

// The pseudo-locale `xx` for the UI checks: the English wording with accented
// letters and about 40% more length, so text that would not fit in another
// language overflows here first. Placeholders stay as they are.
const ACCENTS: Record<string, string> = {
  a: 'á', b: 'ƀ', c: 'ç', d: 'ð', e: 'é', f: 'ƒ', g: 'ĝ', h: 'ĥ', i: 'í', j: 'ĵ', k: 'ķ', l: 'ĺ', m: 'ɱ',
  n: 'ñ', o: 'ö', p: 'þ', q: 'ǫ', r: 'ŕ', s: 'š', t: 'ţ', u: 'ü', v: 'ṽ', w: 'ŵ', x: 'ẋ', y: 'ý', z: 'ž',
  A: 'Å', B: 'Ɓ', C: 'Ç', D: 'Ð', E: 'É', F: 'Ƒ', G: 'Ĝ', H: 'Ĥ', I: 'Í', J: 'Ĵ', K: 'Ķ', L: 'Ļ', M: 'Ṁ',
  N: 'Ñ', O: 'Ö', P: 'Þ', Q: 'Ǫ', R: 'Ŕ', S: 'Š', T: 'Ţ', U: 'Ü', V: 'Ṽ', W: 'Ŵ', X: 'Ẋ', Y: 'Ý', Z: 'Ž'
};

export const pseudoText = (text: string) => {
  if (!text.trim()) return text;
  const accented = text.split(/(\{\w+\})/).map((part, i) => (i % 2 ? part : [...part].map((c) => ACCENTS[c] ?? c).join(''))).join('');
  const letters = text.replace(/\{\w+\}/g, '').replace(/\s/g, '').length;
  // the padding in short words, so wrapped text can still wrap
  const pad = '~'.repeat(Math.max(1, Math.ceil(letters * 0.4))).match(/.{1,6}/g)!.join(' ');
  return `${accented} ${pad}`;
};

const pseudoMessage = (message: Message): Message =>
  typeof message === 'string' ? pseudoText(message) : Object.fromEntries(Object.entries(message).map(([form, text]) => [form, pseudoText(text!)])) as Message;

export const pseudoCatalog = (source: Catalog): Catalog =>
  Object.fromEntries(Object.entries(source).map(([key, message]) => [key, pseudoMessage(message)])) as Catalog;
