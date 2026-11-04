import { afterEach, describe, expect, it } from 'vitest';
import { en } from './en';
import { ja } from './ja';
import { ko } from './ko';
import { pseudoText } from './pseudo';
import type { Catalog, Message } from './types';
import {
  formatMinutes, getLocale, localeFromTag, localizedLines, localizedText, onLocaleChange, setLocale, t, tIn
} from './index';

const CATALOGS: Record<string, Catalog> = { ko, en, ja };

const forms = (message: Message): string[] => (typeof message === 'string' ? [message] : Object.values(message) as string[]);
const placeholders = (message: Message) => [...new Set(forms(message).flatMap((text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1])))].sort();

afterEach(() => setLocale('ko'));

describe('catalogs', () => {
  it('have the same keys in every language', () => {
    const keys = Object.keys(ko).sort();
    for (const [name, catalog] of Object.entries(CATALOGS)) expect(Object.keys(catalog).sort(), name).toEqual(keys);
  });

  it('have the same placeholders per key in every language', () => {
    const mismatched: string[] = [];
    for (const key of Object.keys(ko) as (keyof typeof ko)[]) {
      const want = placeholders(ko[key]);
      for (const [name, catalog] of Object.entries(CATALOGS)) {
        if (JSON.stringify(placeholders(catalog[key])) !== JSON.stringify(want)) mismatched.push(`${name} ${key}`);
      }
    }
    expect(mismatched).toEqual([]);
  });

  it('give every plural an `other` form, with only the forms the language has', () => {
    for (const [name, catalog] of Object.entries(CATALOGS)) {
      const known = new Intl.PluralRules(name).resolvedOptions().pluralCategories;
      for (const [key, message] of Object.entries(catalog)) {
        if (typeof message === 'string') continue;
        expect(message.other, `${name} ${key}`).toBeTypeOf('string');
        for (const form of Object.keys(message)) expect(known, `${name} ${key} ${form}`).toContain(form);
      }
    }
  });

  it('leave no Korean in the English and Japanese catalogs', () => {
    const hangul = /[ᄀ-ᇿ㄰-㆏가-힣]/;
    for (const name of ['en', 'ja']) {
      const leaks = Object.entries(CATALOGS[name]).filter(([, m]) => forms(m).some((text) => hangul.test(text))).map(([k]) => k);
      expect(leaks, name).toEqual([]);
    }
  });
});

describe('runtime', () => {
  it('fills placeholders and picks plural forms by count', () => {
    setLocale('en');
    expect(t('chat.toOne', { name: 'Lila' })).toBe('Message Lila');
    expect(t('music.addedFiles', { count: 1 })).toBe('Added 1 song');
    expect(t('music.addedFiles', { count: 3 })).toBe('Added 3 songs');
    setLocale('ko');
    expect(t('music.addedFiles', { count: 3 })).toBe('3곡 추가했어요');
    expect(tIn('ja', 'music.addedFiles', { count: 1 })).toBe('1曲を追加しました');
  });

  it('tells listeners when the locale changes, once per change', () => {
    const seen: string[] = [];
    const stop = onLocaleChange((locale) => seen.push(locale));
    setLocale('ja');
    setLocale('ja');
    setLocale('en');
    stop();
    setLocale('ko');
    expect(seen).toEqual(['ja', 'en']);
    expect(getLocale()).toBe('ko');
  });

  it('maps OS language tags to ko, ja, else en', () => {
    expect(localeFromTag('ko-KR')).toBe('ko');
    expect(localeFromTag('ja')).toBe('ja');
    expect(localeFromTag('ja_JP')).toBe('ja');
    expect(localeFromTag('en-GB')).toBe('en');
    expect(localeFromTag('fr-FR')).toBe('en');
    expect(localeFromTag(undefined)).toBe('en');
  });

  it('formats durations in each language', () => {
    expect(formatMinutes(65)).toBe('1시간 5분');
    setLocale('en');
    expect(formatMinutes(65)).toBe('1 hr 5 min');
    expect(formatMinutes(120)).toBe('2 hr');
    setLocale('ja');
    expect(formatMinutes(45)).toBe('45分');
  });

  it('makes the pseudo-locale accented and about 40% longer, placeholders intact', () => {
    const text = pseudoText('Start focus {name}');
    expect(text).toContain('{name}');
    expect(text.startsWith('Šţáŕţ ƒöçüš')).toBe(true);
    expect(text.length).toBeGreaterThanOrEqual(Math.round('Start focus {name}'.length * 1.3));
    setLocale('xx');
    expect(t('chat.toOne', { name: 'Lila' })).toContain('Lila');
    expect(t('pomodoro.start')).not.toBe(en['pomodoro.start']);
  });
});

describe('per-language character data', () => {
  it('picks the current language, then the pack language, then the first', () => {
    const lines = { ko: ['헤헤'], en: ['Hehe'] };
    expect(localizedLines(lines, 'ko', 'en')).toEqual(['Hehe']);
    expect(localizedLines(lines, 'ko', 'ja')).toEqual(['헤헤']);
    expect(localizedLines({ en: ['Hehe'] }, undefined, 'ja')).toEqual(['Hehe']);
    expect(localizedLines(['그대로'], 'ko', 'en')).toEqual(['그대로']);
    expect(localizedText({ ja: 'のんびり屋', ko: '느긋한' }, 'ja', 'en')).toBe('のんびり屋');
    expect(localizedText(undefined, 'ko', 'en')).toBeUndefined();
  });
});
