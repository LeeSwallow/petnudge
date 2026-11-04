import { describe, expect, it } from 'vitest';
import { setLocale } from '../../../i18n';
import { changedCards, clockFace, dateLabel } from './logic';

// Local times: the clock shows the computer's own time zone.
const at = (h: number, m: number, day = 4) => new Date(2026, 10, day, h, m, 30).getTime();

describe('clock widget', () => {
  it('shows 24-hour hours and minutes, two digits each', () => {
    expect(clockFace(at(14, 32))).toMatchObject({ hours: '14', minutes: '32' });
    expect(clockFace(at(9, 5))).toMatchObject({ hours: '09', minutes: '05' });
    expect(clockFace(at(0, 0))).toMatchObject({ hours: '00', minutes: '00' });
    expect(clockFace(at(23, 59))).toMatchObject({ hours: '23', minutes: '59' });
  });

  it('names the date as month, day and weekday', () => {
    expect(dateLabel(new Date(2026, 10, 4))).toBe('11월 4일 (수)');
    expect(dateLabel(new Date(2026, 0, 1))).toBe('1월 1일 (목)');
    expect(dateLabel(new Date(2026, 10, 8))).toBe('11월 8일 (일)');
    expect(clockFace(at(14, 32)).date).toBe('11월 4일 (수)');
  });

  it('names the date in the chosen language (Intl)', () => {
    setLocale('en');
    expect(dateLabel(new Date(2026, 10, 4))).toBe('Wed, November 4');
    setLocale('ja');
    expect(dateLabel(new Date(2026, 10, 4))).toBe('11月4日(水)');
    setLocale('ko');
  });

  it('flips only the cards whose digits changed', () => {
    expect(changedCards(clockFace(at(14, 32)), clockFace(at(14, 32)))).toEqual([]);
    expect(changedCards(clockFace(at(14, 32)), clockFace(at(14, 33)))).toEqual(['minutes']);
    expect(changedCards(clockFace(at(14, 59)), clockFace(at(15, 0)))).toEqual(['hours', 'minutes']);
    expect(changedCards(clockFace(at(23, 59)), clockFace(at(0, 0, 5)))).toEqual(['hours', 'minutes']);
  });

  it('flips nothing before there is a previous face', () => {
    expect(changedCards(null, clockFace(at(14, 32)))).toEqual([]);
  });
});
