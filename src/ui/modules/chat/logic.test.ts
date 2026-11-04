import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../../../shared/chat';
import { friendIds, isGroup, preview, when } from './logic';

const now = new Date(2026, 10, 4, 15, 0).getTime();
const session = (messages: ChatMessage[], members?: string[]) => ({ id: 's', characterId: 'lila', members, title: '', createdAt: 0, updatedAt: 0, messages });

describe('chat logic', () => {
  it('dates a conversation like a messenger', () => {
    expect(when(new Date(2026, 10, 4, 9, 5).getTime(), now)).toMatch(/9:05/);
    expect(when(new Date(2026, 9, 30, 9).getTime(), now)).toBe('10.30');
    expect(when(new Date(2025, 0, 2).getTime(), now)).toBe('2025.1.2');
  });

  it('previews the last spoken line, skipping tool lines', () => {
    expect(preview(session([{ role: 'user', text: '안녕' }, { role: 'tool', text: '🔧 할 일 ✓' }]))).toBe('나: 안녕');
    expect(preview(session([{ role: 'pet', text: '반가워' }]))).toBe('반가워');
    expect(preview(session([]))).toBe('아직 대화가 없어요');
  });

  it('lists the pet first, then friends, then anyone with a past conversation', () => {
    expect(friendIds('lila', ['moa', 'lila'], ['maru', 'moa'])).toEqual(['lila', 'moa', 'maru']);
  });

  it('is a group talk with two members or a guest line', () => {
    expect(isGroup(['lila'], [])).toBe(false);
    expect(isGroup(['lila', 'moa'], [])).toBe(true);
    expect(isGroup(['lila'], [{ role: 'pet', text: 'hi', speaker: 'guest:민' }])).toBe(true);
  });
});
