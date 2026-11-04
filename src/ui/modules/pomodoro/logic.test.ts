import { describe, expect, it } from 'vitest';
import { intentText, phaseOf, reflectionStarts, untilLongBreak } from './logic';

const minutes = (m: number) => ({ startedAt: 0, endsAt: m * 60_000 });
const lengths = { breakMinutes: 5, longBreakMinutes: 15 };

describe('pomodoro logic', () => {
  it('tells a long break from a short one by its length', () => {
    expect(phaseOf({ mode: 'idle', startedAt: null, endsAt: null }, lengths)).toBe('idle');
    expect(phaseOf({ mode: 'focus', ...minutes(25) }, lengths)).toBe('focus');
    expect(phaseOf({ mode: 'break', ...minutes(5) }, lengths)).toBe('break');
    expect(phaseOf({ mode: 'break', ...minutes(15) }, lengths)).toBe('long');
    // equal lengths: every break is a short one
    expect(phaseOf({ mode: 'break', ...minutes(5) }, { breakMinutes: 5, longBreakMinutes: 5 })).toBe('break');
  });

  it('says what the session is for', () => {
    expect(intentText('break', 'long', undefined)).toBe('긴 휴식 · 스트레칭 어때?');
    expect(intentText('break', 'break', '수학')).toBe('짧은 휴식 · 물 한 잔');
    expect(intentText('focus', 'focus', '수학')).toBe('지금 할 일: 수학');
    expect(intentText('idle', 'idle', undefined)).toBe('할 일 탭에서 지금 할 일 지정');
  });

  it('counts the sessions left before the long break', () => {
    expect(untilLongBreak(0, 4)).toBe(4);
    expect(untilLongBreak(3, 4)).toBe(1);
    expect(untilLongBreak(4, 4)).toBe(4);
  });

  it('clears the reflection only when a new one opens, not on every change while it is open', () => {
    expect(reflectionStarts(false, true)).toBe(true);
    expect(reflectionStarts(true, true)).toBe(false);
    expect(reflectionStarts(true, false)).toBe(false);
    expect(reflectionStarts(false, false)).toBe(false);
  });
});
