// The editor canvas: the pet's 96×112 drawing area, shown at a whole-number
// zoom (2, 4 or 6; 4 by default) over a checkerboard that marks
// transparent pixels.

export const CANVAS = { width: 96, height: 112 } as const;
export const ZOOMS = [2, 4, 6] as const;
export type Zoom = (typeof ZOOMS)[number];
export const DEFAULT_ZOOM: Zoom = 4;
// The guides the top bar toggles: canvas border, feet line, head area.
export type Guides = { border: boolean; feet: boolean; head: boolean };
export const GUIDES: readonly { id: keyof Guides; label: string }[] = [
  { id: 'border', label: '경계' },
  { id: 'feet', label: '발 위치' },
  { id: 'head', label: '머리 영역' }
];

// Shift+arrow moves this many pixels; an arrow alone moves one.
export const BIG_STEP = 8;

// The canvas pixel under a point on screen, at `zoom` (whole pixels, floor).
export const pixelAt = (clientX: number, clientY: number, rect: { left: number; top: number }, zoom: number): [number, number] => [
  Math.floor((clientX - rect.left) / zoom),
  Math.floor((clientY - rect.top) / zoom)
];

// A drag's offset in whole canvas pixels: rounded, so the part snaps to the grid.
export const dragOffset = (fromX: number, fromY: number, toX: number, toY: number, zoom: number): [number, number] => [
  Math.round((toX - fromX) / zoom) || 0,
  Math.round((toY - fromY) / zoom) || 0
];

// What an arrow key moves by, or undefined for any other key.
export const arrowStep = (key: string, shift: boolean): [number, number] | undefined => {
  const n = shift ? BIG_STEP : 1;
  return ({ ArrowLeft: [-n, 0], ArrowRight: [n, 0], ArrowUp: [0, -n], ArrowDown: [0, n] } as Record<string, [number, number]>)[key];
};
// One checker square, in canvas pixels.
export const CHECKER = 4;
export const CHECKER_COLORS = ['#3a2f4f', '#2f2642'] as const;

// The dark squares of the checkerboard, as [x, y, w, h] in canvas pixels; the
// light colour fills the rest.
export const checkerSquares = (width: number, height: number, size = CHECKER): [number, number, number, number][] => {
  const squares: [number, number, number, number][] = [];
  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      if ((x / size + y / size) % 2 === 1) squares.push([x, y, Math.min(size, width - x), Math.min(size, height - y)]);
    }
  }
  return squares;
};

export const drawChecker = (ctx: CanvasRenderingContext2D, width = CANVAS.width, height = CANVAS.height) => {
  ctx.fillStyle = CHECKER_COLORS[0];
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = CHECKER_COLORS[1];
  for (const [x, y, w, h] of checkerSquares(width, height)) ctx.fillRect(x, y, w, h);
};
