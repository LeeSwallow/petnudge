// The widget board's layout rules, apart from the screen (tested in
// logic.test.ts). A layout is the ids of the widgets on the board, in order;
// it is saved in kv 'widgets.board' as a JSON array.

export const BOARD_KEY = 'widgets.board';

export const DEFAULT_BOARD: readonly string[] = ['timer', 'todos', 'pinned', 'music'];

// A saved layout, keeping only widgets that still exist (once each). Nothing
// saved, or something that is not a list, gives the default; an empty list
// stays empty (the user took every widget off).
export const parseBoard = (saved: string | null, known: readonly string[]): string[] => {
  if (saved === null) return [...DEFAULT_BOARD];
  let value: unknown;
  try {
    value = JSON.parse(saved);
  } catch {
    return [...DEFAULT_BOARD];
  }
  if (!Array.isArray(value)) return [...DEFAULT_BOARD];
  const ids = value.filter((id): id is string => typeof id === 'string' && known.includes(id));
  return [...new Set(ids)];
};

export const serializeBoard = (board: readonly string[]) => JSON.stringify(board);

export const addWidget = (board: readonly string[], id: string): string[] => (board.includes(id) ? [...board] : [...board, id]);

export const removeWidget = (board: readonly string[], id: string): string[] => board.filter((x) => x !== id);

// Swaps the widget with its neighbour; at either end it stays put.
export const moveWidget = (board: readonly string[], id: string, by: -1 | 1): string[] => {
  const next = [...board];
  const from = next.indexOf(id);
  const to = from + by;
  if (from < 0 || to < 0 || to >= next.length) return next;
  [next[from], next[to]] = [next[to], next[from]];
  return next;
};

// The widgets the "+ 위젯 추가" menu offers: those not on the board.
export const addable = (board: readonly string[], known: readonly string[]): string[] => known.filter((id) => !board.includes(id));
