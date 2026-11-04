import { describe, expect, it } from 'vitest';
import { backupCounts, cleanError, exportedOn, lockTip, stepperText } from './logic';

describe('settings logic', () => {
  it('writes each stepper value in its unit', () => {
    expect(stepperText('focusMinutes', 25)).toBe('25분');
    expect(stepperText('longBreakEvery', 4)).toBe('4회마다');
    expect(stepperText('petScale', 2)).toBe('2배');
  });

  it('strips the IPC wrapper from an error', () => {
    expect(cleanError(new Error("Error invoking remote method 'backup:import': Error: 파일이 비었어요"))).toBe('파일이 비었어요');
    expect(cleanError('그냥 문자열')).toBe('그냥 문자열');
  });

  it('summarizes what a backup holds', () => {
    expect(backupCounts({ todos: 3, notes: 1, sessions: 12, playlists: 0 })).toBe('할 일 3 · 메모 1 · 집중 기록 12 · 플레이리스트 0');
  });

  it('dates a backup, or says nothing for a bad date', () => {
    expect(exportedOn('2026-11-04T09:00:00.000Z')).toMatch(/^2026\. 11\. 4\. 백업$/);
    expect(exportedOn('어제')).toBe('');
  });

  it('explains a locked outfit', () => {
    expect(lockTip('리본', true, 10, 3)).toBe('잠김 · 10세션 완료 시 해금 (지금 3)');
    expect(lockTip('리본', false, 10, 3)).toBe('리본');
    expect(lockTip('리본', true, undefined, 3)).toBe('리본');
  });
});
