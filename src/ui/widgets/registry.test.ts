import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_BOARD } from '../modules/home/logic';
import { WIDGETS } from './registry';

// The registry imports the Svelte components (and through them the app's
// state); the tests need only what each widget is, so these stand in.
vi.mock('./timer/TimerWidget.svelte', () => ({ default: {} }));
vi.mock('./todos/TodosWidget.svelte', () => ({ default: {} }));
vi.mock('./pinned/PinnedWidget.svelte', () => ({ default: {} }));
vi.mock('./music/MusicWidget.svelte', () => ({ default: {} }));

describe('widget registry', () => {
  it('registers each widget once, one or two columns wide', () => {
    const ids = WIDGETS.map((w) => w.id);
    expect(ids).toEqual(['timer', 'todos', 'pinned', 'music']);
    for (const w of WIDGETS) expect([1, 2]).toContain(w.size);
  });

  it('has every widget of the default board', () => {
    for (const id of DEFAULT_BOARD) expect(WIDGETS.map((w) => w.id)).toContain(id);
  });
});
