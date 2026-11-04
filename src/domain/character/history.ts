// Undo and redo over immutable values (#58: the editor's drafts). Each step
// keeps the whole value, so a draft must never be changed in place.
//
// A step can carry a merge key: a step with the same key as the one before,
// within `window` ms of it (default MERGE_MS), replaces that step instead of
// adding one. Arrow-key nudges of one part merge this way; a drag merges with
// window Infinity, so the whole drag is one step.

export const HISTORY_DEPTH = 100;
export const MERGE_MS = 500;

export type History<T> = {
  readonly past: readonly T[];
  readonly present: T;
  readonly future: readonly T[];
  // The last step's merge key and time, while it can still be merged into.
  readonly merge?: { key: string; at: number; window: number };
};

export type RecordOptions = { merge?: string; at?: number; window?: number };

export const createHistory = <T>(present: T): History<T> => ({ past: [], present, future: [] });

export const canUndo = <T>(h: History<T>) => h.past.length > 0;
export const canRedo = <T>(h: History<T>) => h.future.length > 0;

export const record = <T>(h: History<T>, next: T, { merge, at = Date.now(), window = MERGE_MS }: RecordOptions = {}): History<T> => {
  if (next === h.present) return h;
  const mark = merge ? { key: merge, at, window } : undefined;
  const last = h.merge;
  if (merge && last && last.key === merge && at - last.at <= Math.max(window, last.window) && h.past.length) {
    return { past: h.past, present: next, future: [], merge: mark };
  }
  return { past: [...h.past, h.present].slice(-HISTORY_DEPTH), present: next, future: [], merge: mark };
};

export const undo = <T>(h: History<T>): History<T> =>
  canUndo(h) ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h;

export const redo = <T>(h: History<T>): History<T> =>
  canRedo(h) ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h;
