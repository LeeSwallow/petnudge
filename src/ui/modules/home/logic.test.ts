import { describe, expect, it } from 'vitest';
import { addable, addWidget, DEFAULT_BOARD, moveWidget, parseBoard, removeWidget, serializeBoard } from './logic';

const KNOWN = ['timer', 'todos', 'pinned', 'music', 'extra'] as const;

describe('widget board layout', () => {
  it('starts with the timer, the todo summary, the pinned note and the music', () => {
    expect(DEFAULT_BOARD).toEqual(['timer', 'todos', 'pinned', 'music']);
    expect(parseBoard(null, KNOWN)).toEqual(DEFAULT_BOARD);
  });

  it('restores a saved layout, dropping unknown and repeated ids', () => {
    expect(parseBoard('["music","ghost","timer","music"]', KNOWN)).toEqual(['music', 'timer']);
    expect(parseBoard(serializeBoard(['pinned', 'extra']), KNOWN)).toEqual(['pinned', 'extra']);
  });

  it('keeps a board the user emptied empty', () => {
    expect(parseBoard('[]', KNOWN)).toEqual([]);
  });

  it('falls back to the default for a layout it cannot read', () => {
    expect(parseBoard('not json', KNOWN)).toEqual(DEFAULT_BOARD);
    expect(parseBoard('{"timer":1}', KNOWN)).toEqual(DEFAULT_BOARD);
    expect(parseBoard('[1, null, "todos"]', KNOWN)).toEqual(['todos']);
  });

  it('adds a widget at the end, once', () => {
    expect(addWidget(['timer'], 'music')).toEqual(['timer', 'music']);
    expect(addWidget(['timer'], 'timer')).toEqual(['timer']);
  });

  it('removes a widget', () => {
    expect(removeWidget(['timer', 'todos', 'music'], 'todos')).toEqual(['timer', 'music']);
    expect(removeWidget(['timer'], 'music')).toEqual(['timer']);
  });

  it('moves a widget up or down, staying inside the board', () => {
    expect(moveWidget(['timer', 'todos', 'music'], 'music', -1)).toEqual(['timer', 'music', 'todos']);
    expect(moveWidget(['timer', 'todos', 'music'], 'timer', 1)).toEqual(['todos', 'timer', 'music']);
    expect(moveWidget(['timer', 'todos'], 'timer', -1)).toEqual(['timer', 'todos']);
    expect(moveWidget(['timer', 'todos'], 'todos', 1)).toEqual(['timer', 'todos']);
    expect(moveWidget(['timer'], 'ghost', 1)).toEqual(['timer']);
  });

  it('offers to add only the widgets not on the board, in registry order', () => {
    expect(addable(['music', 'timer'], KNOWN)).toEqual(['todos', 'pinned', 'extra']);
    expect(addable([...KNOWN], KNOWN)).toEqual([]);
  });
});
