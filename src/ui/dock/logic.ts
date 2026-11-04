// The dock beside the pet, apart from the screen (tested in logic.test.ts):
// which side of her it goes on, and which widgets it holds. The list is the
// ids of the widgets in the dock, in order; it is saved in kv 'widgets.dock'
// as a JSON array. The board keeps its own list ('widgets.board').

export const DOCK_KEY = 'widgets.dock';
export const DEFAULT_DOCK: readonly string[] = ['music'];
export const MAX_DOCK = 3;

const BODY_PAD = 10; // the pet window's body padding (styles.css, main/layout.ts)
export const DOCK_GAP = 4; // between her and the dock

export type DockSide = 'left' | 'right';

export type SideInput = {
  // Her offset from the window's centre line (main/layout.ts petDx).
  petDx: number;
  windowWidth: number;
  petWidth: number;
  dockWidth: number;
  // The nearest friend's offset (positive: to her right), or null.
  friendDx: number | null;
};

// Away from the nearest friend when the dock fits there; otherwise the side
// with more room (the right when even).
export const dockSide = ({ petDx, windowWidth, petWidth, dockWidth, friendDx }: SideInput): DockSide => {
  const centre = windowWidth / 2 + petDx;
  const room = { left: centre - petWidth / 2 - BODY_PAD, right: windowWidth - BODY_PAD - (centre + petWidth / 2) };
  const fits = (side: DockSide) => room[side] >= dockWidth + DOCK_GAP;
  if (friendDx) {
    const away: DockSide = friendDx > 0 ? 'left' : 'right';
    if (fits(away)) return away;
  }
  return room.right >= room.left ? 'right' : 'left';
};

// A saved list, keeping only widgets that still exist (once each, at most
// three). Nothing saved, or something that is not a list, gives the default;
// an empty list stays empty.
export const parseDock = (saved: string | null, known: readonly string[]): string[] => {
  if (saved === null) return [...DEFAULT_DOCK];
  let value: unknown;
  try {
    value = JSON.parse(saved);
  } catch {
    return [...DEFAULT_DOCK];
  }
  if (!Array.isArray(value)) return [...DEFAULT_DOCK];
  const ids = value.filter((id): id is string => typeof id === 'string' && known.includes(id));
  return [...new Set(ids)].slice(0, MAX_DOCK);
};

export const serializeDock = (dock: readonly string[]) => JSON.stringify(dock);

export const addToDock = (dock: readonly string[], id: string): string[] => (dock.includes(id) || dock.length >= MAX_DOCK ? [...dock] : [...dock, id]);

export const removeFromDock = (dock: readonly string[], id: string): string[] => dock.filter((x) => x !== id);

export type Placement = 'board' | 'dock' | 'both';

export const placementOf = (id: string, board: readonly string[], dock: readonly string[]): Placement | null => {
  const onBoard = board.includes(id), inDock = dock.includes(id);
  return onBoard && inDock ? 'both' : onBoard ? 'board' : inDock ? 'dock' : null;
};

// Puts a widget on the board, in the dock or in both. Nothing changes when it
// should go into a full dock.
export const placeWidget = (id: string, where: Placement, board: readonly string[], dock: readonly string[]) => {
  const wantsDock = where !== 'board';
  if (wantsDock && !dock.includes(id) && dock.length >= MAX_DOCK) return { board: [...board], dock: [...dock] };
  return {
    board: where === 'dock' ? board.filter((x) => x !== id) : board.includes(id) ? [...board] : [...board, id],
    dock: wantsDock ? addToDock(dock, id) : removeFromDock(dock, id)
  };
};
