import { describe, expect, it, vi } from 'vitest';
import { groupOf, modulesIn, restoreModule, shownModules, visibleGroups } from '../panel/groups';
import { MODULES } from './registry';

// The registry imports the Svelte components; the tests need only where each
// module goes, so the components stand in as empty objects.
vi.mock('./todo/Todo.svelte', () => ({ default: {} }));
vi.mock('./pomodoro/Pomodoro.svelte', () => ({ default: {} }));
vi.mock('./playlist/Playlist.svelte', () => ({ default: {} }));
vi.mock('./notes/Notes.svelte', () => ({ default: {} }));
vi.mock('./dashboard/Dashboard.svelte', () => ({ default: {} }));
vi.mock('./chat/Chat.svelte', () => ({ default: {} }));
vi.mock('./chat/view.svelte', () => ({ showActiveSession: () => {} }));
vi.mock('./friends/Friends.svelte', () => ({ default: {} }));
vi.mock('./settings/Settings.svelte', () => ({ default: {} }));

const ids = (modules: readonly { id: string }[]) => modules.map((m) => m.id);

describe('module registry', () => {
  it('registers each module once, in a group that is shown', () => {
    const all = ids(MODULES);
    expect(new Set(all).size).toBe(all.length);
    const shown = visibleGroups().map((g) => g.id);
    for (const m of MODULES) expect(shown).toContain(m.group);
    expect(ids(shownModules(MODULES))).toHaveLength(MODULES.length);
  });

  it('orders the small tabs of each group by their order', () => {
    expect(ids(modulesIn(MODULES, 'focus'))).toEqual(['todo', 'pomodoro', 'playlist']);
    expect(ids(modulesIn(MODULES, 'record'))).toEqual(['notes', 'dashboard', 'chat']);
    expect(ids(modulesIn(MODULES, 'settings'))).toEqual(['settings', 'friends']);
    expect(modulesIn(MODULES, 'home')).toEqual([]);
    expect(modulesIn(MODULES, 'together')).toEqual([]);
  });

  it('finds the group of a registered module', () => {
    expect(groupOf(MODULES, 'todo')).toBe('focus');
    expect(groupOf(MODULES, 'settings')).toBe('settings');
  });

  it('restores a registered module and falls back to the pomodoro for any other id', () => {
    expect(restoreModule(MODULES, 'chat')).toBe('chat');
    expect(restoreModule(MODULES, 'home')).toBe('pomodoro');
    expect(restoreModule(MODULES, '')).toBe('pomodoro');
  });
});
