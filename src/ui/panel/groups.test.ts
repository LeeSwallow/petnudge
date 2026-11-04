import { describe, expect, it, vi } from 'vitest';
import { groupOf, modulesIn, restoreModule, shownModules, visibleGroups } from './groups';
import { MODULES } from '../modules/registry';

// The registry imports the Svelte components; these tests need only where
// each module goes, so the components stand in as empty objects.
vi.mock('../modules/todo/Todo.svelte', () => ({ default: {} }));
vi.mock('../modules/pomodoro/Pomodoro.svelte', () => ({ default: {} }));
vi.mock('../modules/playlist/Playlist.svelte', () => ({ default: {} }));
vi.mock('../modules/notes/Notes.svelte', () => ({ default: {} }));
vi.mock('../modules/dashboard/Dashboard.svelte', () => ({ default: {} }));
vi.mock('../modules/chat/Chat.svelte', () => ({ default: {} }));
vi.mock('../modules/chat/view.svelte', () => ({ showActiveSession: () => {} }));
vi.mock('../modules/friends/Friends.svelte', () => ({ default: {} }));
vi.mock('../modules/settings/Settings.svelte', () => ({ default: {} }));

describe('panel groups', () => {
  it('puts every module in exactly one visible group', () => {
    const all = visibleGroups().flatMap((g) => modulesIn(MODULES, g.id).map((m) => m.id));
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual(['chat', 'dashboard', 'friends', 'notes', 'playlist', 'pomodoro', 'settings', 'todo']);
  });

  it('shows focus, record and settings until the home board and multiplayer exist', () => {
    expect(visibleGroups().map((g) => g.id)).toEqual(['focus', 'record', 'settings']);
  });

  it('opens the chat from the record group', () => {
    expect(groupOf(MODULES, 'chat')).toBe('record');
    expect(groupOf(MODULES, 'friends')).toBe('settings');
    expect(groupOf(MODULES, 'playlist')).toBe('focus');
  });

  it('restores a saved module or falls back to the pomodoro', () => {
    expect(restoreModule(MODULES, 'notes')).toBe('notes');
    expect(restoreModule(MODULES, null)).toBe('pomodoro');
    expect(restoreModule(MODULES, 'ghost')).toBe('pomodoro');
  });

  it('does not show a module whose group is hidden', () => {
    const modules = [
      { id: 'pomodoro', group: 'focus', order: 1 },
      { id: 'todo', group: 'home', order: 1 }
    ] as const;
    expect(shownModules(modules).map((m) => m.id)).toEqual(['pomodoro']);
    expect(modulesIn(modules, 'focus').map((m) => m.id)).toEqual(['pomodoro']);
    expect(restoreModule(modules, 'todo')).toBe('pomodoro');
  });

  it('throws for a module that is not registered', () => {
    expect(() => groupOf([], 'chat')).toThrow(/chat/);
  });
});
