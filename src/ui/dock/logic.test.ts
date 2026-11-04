import { describe, expect, it } from 'vitest';
import { addToDock, DEFAULT_DOCK, dockSide, MAX_DOCK, parseDock, placeWidget, placementOf, removeFromDock, serializeDock } from './logic';

const KNOWN = ['timer', 'todos', 'pinned', 'music'] as const;

// The pet window (main/layout.ts): 380px wide with 10px of body padding, the
// pet about 156px wide, so about 102px is left on each side when centred.
const at = (petDx: number, friendDx: number | null = null) => ({ petDx, friendDx, windowWidth: 380, petWidth: 156, dockWidth: 96 });

describe('dock side', () => {
  it('goes right when both sides have the same room and no friend is near', () => {
    expect(dockSide(at(0))).toBe('right');
  });

  it('goes to the side with more room when she is pushed to a screen edge', () => {
    // pushed right inside the window (the screen's right edge): room is on the left
    expect(dockSide(at(40))).toBe('left');
    expect(dockSide(at(-40))).toBe('right');
  });

  it('goes away from the nearest friend', () => {
    expect(dockSide(at(0, 180))).toBe('left');
    expect(dockSide(at(0, -180))).toBe('right');
    // 100px on the left: just enough for the dock and its gap
    expect(dockSide(at(-2, 120))).toBe('left');
  });

  it('stays on the only side it fits, even with a friend there', () => {
    // pushed far left: the left has no room for the dock
    expect(dockSide(at(-10, 120))).toBe('right');
    expect(dockSide(at(-60, 150))).toBe('right');
    expect(dockSide(at(60, -150))).toBe('left');
  });

  it('takes the roomier side when it fits on neither', () => {
    expect(dockSide({ ...at(10, -100), petWidth: 300 })).toBe('left');
  });

  it('a friend straight above or below does not decide', () => {
    expect(dockSide(at(20, 0))).toBe('left');
  });
});

describe('dock list', () => {
  it('holds the music widget by default', () => {
    expect(DEFAULT_DOCK).toEqual(['music']);
    expect(parseDock(null, KNOWN)).toEqual(['music']);
  });

  it('restores a saved list, dropping unknown and repeated ids and keeping at most three', () => {
    expect(MAX_DOCK).toBe(3);
    expect(parseDock('["timer","ghost","timer","todos"]', KNOWN)).toEqual(['timer', 'todos']);
    expect(parseDock(serializeDock(['pinned', 'music', 'timer', 'todos']), KNOWN)).toEqual(['pinned', 'music', 'timer']);
    expect(parseDock('[]', KNOWN)).toEqual([]);
    expect(parseDock('not json', KNOWN)).toEqual(['music']);
    expect(parseDock('{"music":1}', KNOWN)).toEqual(['music']);
  });

  it('adds a widget at the end, once, and not past three', () => {
    expect(addToDock(['music'], 'timer')).toEqual(['music', 'timer']);
    expect(addToDock(['music'], 'music')).toEqual(['music']);
    expect(addToDock(['music', 'timer', 'todos'], 'pinned')).toEqual(['music', 'timer', 'todos']);
  });

  it('removes a widget', () => {
    expect(removeFromDock(['music', 'timer'], 'music')).toEqual(['timer']);
    expect(removeFromDock(['timer'], 'music')).toEqual(['timer']);
  });
});

describe('where a widget goes (보드에 / 도크에 / 둘 다)', () => {
  it('tells where a widget is', () => {
    expect(placementOf('music', ['timer', 'music'], ['music'])).toBe('both');
    expect(placementOf('timer', ['timer', 'music'], ['music'])).toBe('board');
    expect(placementOf('todos', ['timer'], ['todos'])).toBe('dock');
    expect(placementOf('pinned', ['timer'], ['todos'])).toBeNull();
  });

  it('moves a widget to the board only, keeping the board order', () => {
    expect(placeWidget('music', 'board', ['timer', 'music'], ['music', 'timer'])).toEqual({ board: ['timer', 'music'], dock: ['timer'] });
  });

  it('moves a widget to the dock only, off the board', () => {
    expect(placeWidget('timer', 'dock', ['timer', 'music'], ['music'])).toEqual({ board: ['music'], dock: ['music', 'timer'] });
  });

  it('puts a widget in both places, at the end of either list it was missing from', () => {
    expect(placeWidget('timer', 'both', ['timer'], ['music'])).toEqual({ board: ['timer'], dock: ['music', 'timer'] });
    expect(placeWidget('todos', 'both', ['timer'], ['todos'])).toEqual({ board: ['timer', 'todos'], dock: ['todos'] });
  });

  it('changes nothing when the dock is full', () => {
    const dock = ['music', 'timer', 'todos'];
    expect(placeWidget('pinned', 'dock', ['pinned'], dock)).toEqual({ board: ['pinned'], dock });
    expect(placeWidget('pinned', 'both', ['pinned'], dock)).toEqual({ board: ['pinned'], dock });
  });
});
