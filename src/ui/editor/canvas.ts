// The editor canvas: the pet's 96×112 drawing area, shown at a whole-number
// zoom (spec: 4× by default; 2/4/6 later) over a checkerboard that marks
// transparent pixels.

export const CANVAS = { width: 96, height: 112 } as const;
export const DEFAULT_ZOOM = 4;
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
