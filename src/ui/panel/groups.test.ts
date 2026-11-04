import { describe, expect, it } from 'vitest';
import { groupOf, restoreModule, visibleGroups } from './groups';

describe('panel groups', () => {
  it('puts every module in exactly one visible group', () => {
    const all = visibleGroups().flatMap((g) => g.modules);
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual(['chat', 'dashboard', 'friends', 'notes', 'playlist', 'pomodoro', 'settings', 'todo']);
  });

  it('shows focus, record and settings until the home board and multiplayer exist', () => {
    expect(visibleGroups().map((g) => g.id)).toEqual(['focus', 'record', 'settings']);
  });

  it('opens the chat from the record group', () => {
    expect(groupOf('chat')).toBe('record');
    expect(groupOf('friends')).toBe('settings');
    expect(groupOf('playlist')).toBe('focus');
  });

  it('restores a saved module or falls back to the pomodoro', () => {
    expect(restoreModule('notes')).toBe('notes');
    expect(restoreModule(null)).toBe('pomodoro');
    expect(restoreModule('ghost')).toBe('pomodoro');
  });
});
