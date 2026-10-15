// Window geometry around the pet. The pet's feet are the anchor (a screen
// point the user drags); the window is only as tall as the pet area while the
// panel is closed, and grows above or below the pet — whichever side has
// room — when it opens. Horizontally the window stays on screen and the pet
// is shifted inside it instead.

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

export const WINDOW_WIDTH = 380;
export const PANEL_HEIGHT = 500;
export const MIN_PANEL_HEIGHT = 220;
const PAD = 10; // body padding
const GAP = 6; // body gap between the pet area and the panel

export type LayoutInput = {
  anchor: Point;
  workArea: Rect;
  // Pet area (strip + bubble + canvas) height and canvas width, CSS px.
  petAreaHeight: number;
  petWidth: number;
  panelOpen: boolean;
};

export type Layout = {
  anchor: Point;
  bounds: Rect;
  // Panel below the pet instead of above.
  below: boolean;
  // Pet offset from the window's centre line.
  petDx: number;
  panelHeight: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

// Keeps the whole pet area on the work area.
export const clampAnchor = ({ x, y }: Point, wa: Rect, petWidth: number, petAreaHeight: number): Point => ({
  x: Math.round(clamp(x, wa.x + petWidth / 2, wa.x + wa.width - petWidth / 2)),
  y: Math.round(clamp(y, wa.y + petAreaHeight, wa.y + wa.height - PAD))
});

export const computeLayout = (input: LayoutInput): Layout => {
  const { workArea: wa, petAreaHeight, petWidth, panelOpen } = input;
  const anchor = clampAnchor(input.anchor, wa, petWidth, petAreaHeight);
  const x = Math.round(clamp(anchor.x - WINDOW_WIDTH / 2, wa.x, wa.x + wa.width - WINDOW_WIDTH));
  const petDx = anchor.x - (x + WINDOW_WIDTH / 2);
  const closedHeight = PAD * 2 + petAreaHeight;
  const top = anchor.y + PAD - closedHeight; // window top with the pet area on top

  if (!panelOpen) return { anchor, bounds: { x, y: top, width: WINDOW_WIDTH, height: closedHeight }, below: false, petDx, panelHeight: 0 };

  const spaceAbove = top - wa.y - GAP;
  const spaceBelow = wa.y + wa.height - (anchor.y + PAD) - GAP;
  const below = spaceAbove < PANEL_HEIGHT && spaceBelow > spaceAbove;
  const panelHeight = Math.max(MIN_PANEL_HEIGHT, Math.min(PANEL_HEIGHT, below ? spaceBelow : spaceAbove));
  const height = closedHeight + GAP + panelHeight;
  return { anchor, bounds: { x, y: below ? top : top - GAP - panelHeight, width: WINDOW_WIDTH, height }, below, petDx, panelHeight };
};
