import { en } from './en';
import { ja } from './ja';
import { ko, type MessageKey } from './ko';
import { pseudoCatalog } from './pseudo';
import type { Catalog, Message } from './types';

// The app's wording in Korean (the source), English and Japanese (#77), and
// a tiny runtime: t(key, params), plurals through Intl.PluralRules, the
// current locale and listeners for when it changes. Everything here is plain
// TypeScript with no packages, so every layer may use it. The main process
// and the renderer each hold their own current locale, set from settings.

export type { Catalog, Message, MessageKey };

// The languages a user can choose. `xx` is a pseudo-locale (accented and
// about 40% longer) that only the UI checks use, to catch text overflow.
export const LOCALES = ['ko', 'en', 'ja'] as const;
export type Locale = (typeof LOCALES)[number];
export type AnyLocale = Locale | 'xx';

// Each language's name in itself, for the language picker.
export const LOCALE_NAMES: Record<Locale, string> = { ko: '한국어', en: 'English', ja: '日本語' };

let pseudo: Catalog | null = null;
const catalogOf = (locale: AnyLocale): Catalog =>
  locale === 'xx' ? (pseudo ??= pseudoCatalog(en)) : locale === 'en' ? en : locale === 'ja' ? ja : ko;

export const isLocale = (value: unknown): value is AnyLocale => value === 'ko' || value === 'en' || value === 'ja' || value === 'xx';

// An OS or browser language tag (app.getLocale(), navigator.language) as one
// of ours: ko-KR → ko, ja → ja, everything else → en.
export const localeFromTag = (tag: string | undefined | null): Locale => {
  const base = String(tag ?? '').toLowerCase().split(/[-_]/)[0];
  return base === 'ko' ? 'ko' : base === 'ja' ? 'ja' : 'en';
};

let current: AnyLocale = 'ko';
const listeners = new Set<(locale: AnyLocale) => void>();

export const getLocale = (): AnyLocale => current;

// The BCP 47 tag Intl formats with (the pseudo-locale formats as English).
export const intlLocale = (locale: AnyLocale = current): string => (locale === 'xx' ? 'en' : locale);

export const setLocale = (next: AnyLocale) => {
  if (!isLocale(next) || next === current) return;
  current = next;
  plurals = null;
  for (const listener of listeners) listener(next);
};

// Called after every change of locale; returns a function that stops it.
export const onLocaleChange = (listener: (locale: AnyLocale) => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

export type Params = Record<string, string | number>;

let plurals: Intl.PluralRules | null = null;
const pluralOf = (count: number) => (plurals ??= new Intl.PluralRules(intlLocale())).select(count);

const fill = (text: string, params: Params | undefined) =>
  params ? text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole)) : text;

// A message with a `count` param picks its plural form; Korean and Japanese
// have one form, English two.
export const pick = (message: Message, params?: Params): string => {
  if (typeof message === 'string') return message;
  const count = Number(params?.count ?? 0);
  return message[pluralOf(count)] ?? message.other;
};

export const t = (key: MessageKey, params?: Params): string => {
  const message = catalogOf(current)[key] ?? ko[key];
  return message === undefined ? key : fill(pick(message, params), params);
};

// The same in a given locale, whatever the current one is.
export const tIn = (locale: AnyLocale, key: MessageKey, params?: Params): string => {
  const message = catalogOf(locale)[key] ?? ko[key];
  if (message === undefined) return key;
  if (typeof message === 'string') return fill(message, params);
  const form = new Intl.PluralRules(intlLocale(locale)).select(Number(params?.count ?? 0));
  return fill(message[form] ?? message.other, params);
};

// ---------- dates, times, numbers ----------

export const formatNumber = (value: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat(intlLocale(), options).format(value);

export const formatDate = (date: Date | number, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(intlLocale(), options).format(date);

// "15:05" in Korean and Japanese (as the app always showed), "3:05 PM" in English.
export const formatTime = (date: Date | number) =>
  formatDate(date, current === 'ko' || current === 'ja' ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } : { hour: 'numeric', minute: '2-digit' });

// "5분 전", "5 minutes ago", "5分前"
export const formatRelative = (value: number, unit: Intl.RelativeTimeFormatUnit) =>
  new Intl.RelativeTimeFormat(intlLocale(), { numeric: 'auto' }).format(value, unit);

// Minutes as "1시간 5분" / "1 hr 5 min" / "1時間5分".
export const formatMinutes = (minutes: number) => {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return t('time.minutes', { count: rest });
  return rest === 0 ? t('time.hours', { count: hours }) : t('time.hoursMinutes', { hours, minutes: rest, count: rest });
};

// Per-language data in character packs and mods: a plain value is in the
// pack's own language; a record gives one per locale. The current locale
// wins, then the pack's language, then whatever comes first.
export type Localized<T> = T | Partial<Record<string, T>>;

export const localized = <T>(value: Localized<T> | undefined, packLang: string | undefined, isPlain: (v: unknown) => v is T, locale: string = current): T | undefined => {
  if (value === undefined || isPlain(value)) return value as T | undefined;
  const byLocale = value as Partial<Record<string, T>>;
  const want = locale === 'xx' ? 'en' : locale;
  return byLocale[want] ?? (packLang ? byLocale[packLang] : undefined) ?? byLocale.ko ?? Object.values(byLocale).find((v) => v !== undefined);
};

const isText = (v: unknown): v is string => typeof v === 'string';
const isList = (v: unknown): v is string[] => Array.isArray(v);

export const localizedText = (value: Localized<string> | undefined, packLang?: string, locale?: string) => localized(value, packLang, isText, locale);
export const localizedLines = (value: Localized<string[]> | undefined, packLang?: string, locale?: string) => localized(value, packLang, isList, locale);

// The pack's own language: what the character editor edits.
export const packLanguage = (pack: { lang?: string }) => pack.lang ?? 'ko';
