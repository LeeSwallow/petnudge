import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_BOARD } from '../modules/home/logic';
import { WIDGETS } from './registry';

// The registry imports the Svelte components (and through them the app's
// state); the tests need only what each widget is, so these stand in.
vi.mock('./clock/ClockWidget.svelte', () => ({ default: {} }));
vi.mock('./timer/TimerWidget.svelte', () => ({ default: {} }));
vi.mock('./todos/TodosWidget.svelte', () => ({ default: {} }));
vi.mock('./pinned/PinnedWidget.svelte', () => ({ default: {} }));
vi.mock('./music/MusicWidget.svelte', () => ({ default: {} }));
const playing = vi.hoisted(() => ({ track: null as null | { title: string } }));
vi.mock('./music/feed', () => ({ myMusic: { read: () => ({ track: playing.track, listName: null }) } }));

describe('widget registry', () => {
  it('registers each widget once, one or two columns wide', () => {
    const ids = WIDGETS.map((w) => w.id);
    expect(ids).toEqual(['clock', 'timer', 'todos', 'pinned', 'music']);
    for (const w of WIDGETS) expect([1, 2]).toContain(w.size);
  });

  it('keeps the clock off the default board (it is added from the menu)', () => {
    expect(DEFAULT_BOARD).not.toContain('clock');
    expect(WIDGETS.find((w) => w.id === 'clock')?.size).toBe(2);
  });

  it('keeps the music widget out of the dock while nothing plays', () => {
    const music = WIDGETS.find((w) => w.id === 'music')!;
    expect(music.quiet?.()).toBe(true);
    playing.track = { title: '비' };
    expect(music.quiet?.()).toBe(false);
    expect(WIDGETS.filter((w) => w.quiet).map((w) => w.id)).toEqual(['music']);
  });

  it('has every widget of the default board', () => {
    for (const id of DEFAULT_BOARD) expect(WIDGETS.map((w) => w.id)).toContain(id);
  });
});
