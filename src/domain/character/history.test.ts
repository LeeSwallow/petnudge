import { describe, expect, it } from 'vitest';
import { canRedo, canUndo, createHistory, HISTORY_DEPTH, MERGE_MS, record, redo, undo } from './history';

describe('history', () => {
  it('undoes and redoes in order', () => {
    let h = createHistory('a');
    h = record(h, 'b');
    h = record(h, 'c');
    expect([canUndo(h), canRedo(h)]).toEqual([true, false]);
    h = undo(h);
    expect(h.present).toBe('b');
    h = undo(h);
    expect(h.present).toBe('a');
    expect(canUndo(h)).toBe(false);
    expect(undo(h)).toBe(h);
    h = redo(redo(h));
    expect(h.present).toBe('c');
    expect(redo(h)).toBe(h);
  });

  it('a new action clears redo', () => {
    let h = undo(record(record(createHistory('a'), 'b'), 'c'));
    expect(canRedo(h)).toBe(true);
    h = record(h, 'd');
    expect(canRedo(h)).toBe(false);
    expect(undo(h).present).toBe('b');
  });

  it('ignores a step that changes nothing', () => {
    const h = record(createHistory('a'), 'b');
    expect(record(h, 'b')).toBe(h);
  });

  it(`keeps the last ${HISTORY_DEPTH} steps`, () => {
    let h = createHistory(0);
    for (let i = 1; i <= HISTORY_DEPTH + 20; i++) h = record(h, i);
    let undone = 0;
    while (canUndo(h)) {
      h = undo(h);
      undone++;
    }
    expect(undone).toBe(HISTORY_DEPTH);
    expect(h.present).toBe(20);
  });

  it(`merges steps with the same key within ${MERGE_MS}ms of the last one`, () => {
    let h = createHistory('a');
    h = record(h, 'b', { merge: 'nudge:head', at: 1000 });
    h = record(h, 'c', { merge: 'nudge:head', at: 1400 });
    h = record(h, 'd', { merge: 'nudge:head', at: 1800 }); // 400ms after the last: still one step
    expect(undo(h).present).toBe('a');
    h = record(h, 'e', { merge: 'nudge:head', at: 2400 }); // 600ms later: a new step
    expect(undo(h).present).toBe('d');
  });

  it('does not merge different keys, unkeyed steps, or across an undo', () => {
    let h = record(createHistory('a'), 'b', { merge: 'nudge:head', at: 0 });
    h = record(h, 'c', { merge: 'nudge:torso.chest', at: 10 });
    expect(undo(h).present).toBe('b');
    h = record(h, 'd', { at: 20 });
    h = record(h, 'e', { merge: 'nudge:head', at: 30 });
    h = record(h, 'f', { merge: 'nudge:head', at: 40 });
    expect(undo(h).present).toBe('d');
    h = undo(h);
    h = record(h, 'g', { merge: 'nudge:head', at: 50 });
    expect(undo(h).present).toBe('d');
  });

  it('merges a whole drag with no time limit', () => {
    let h = createHistory('a');
    h = record(h, 'b', { merge: 'drag:1', at: 0, window: Infinity });
    h = record(h, 'c', { merge: 'drag:1', at: 60_000, window: Infinity });
    expect(undo(h).present).toBe('a');
  });
});
