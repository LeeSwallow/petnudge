import type { Box, Move } from './pack';

// RGBA pixels as one uint32 each, in ImageData byte order (little-endian ABGR).
export type Pixels = { w: number; h: number; data: Uint32Array };

export const blank = (w: number, h: number): Pixels => ({ w, h, data: new Uint32Array(w * h) });

const opaque = (p: number) => p >>> 24 !== 0;

export const hexToPixel = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return ((0xff << 24) | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0;
};

export const crop = (src: Pixels, x: number, y: number, w: number, h: number): Pixels => {
  const out = blank(w, h);
  for (let row = 0; row < h; row++) out.data.set(src.data.subarray((y + row) * src.w + x, (y + row) * src.w + x + w), row * w);
  return out;
};

// Swap exact colours, optionally only inside `boxes`.
export const recolor = (px: Pixels, map: Map<number, number>, boxes?: Box[]) => {
  const inside = (i: number) => {
    if (!boxes) return true;
    const x = i % px.w;
    const y = (i - x) / px.w;
    return boxes.some(([x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1);
  };
  for (let i = 0; i < px.data.length; i++) {
    const to = map.get(px.data[i]);
    if (to !== undefined && inside(i)) px.data[i] = to;
  }
};

// Draws `src` over `dst` (pixel art: any opaque pixel wins).
export const over = (dst: Pixels, src: Pixels) => {
  for (let i = 0; i < dst.data.length; i++) if (opaque(src.data[i])) dst.data[i] = src.data[i];
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Shifts everything inside `boxes` by a whole-pixel move. Inside a box, pixels
// the move uncovers repeat the box's edge (so a lifted torso stretches instead
// of tearing); pixels pushed past the box edge land on whatever is there.
export const moveRegion = (px: Pixels, boxes: Box[], [dx, dy]: Move): Pixels => {
  if (dx === 0 && dy === 0) return px;
  const { w, h } = px;
  const src = px.data;
  const out = src.slice();
  for (const [x0, y0, x1, y1] of boxes) {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) out[y * w + x] = src[clamp(y - dy, y0, y1 - 1) * w + clamp(x - dx, x0, x1 - 1)];
    }
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const tx = x + dx;
        const ty = y + dy;
        const inBox = tx >= x0 && tx < x1 && ty >= y0 && ty < y1;
        if (!inBox && tx >= 0 && tx < w && ty >= 0 && ty < h && opaque(src[y * w + x])) out[ty * w + tx] = src[y * w + x];
      }
    }
  }
  return { w, h, data: out };
};

// Applies moves in the pack's region order, so nested regions compose predictably.
export const applyMoves = (px: Pixels, regions: Record<string, Box[]>, moves: Record<string, Move>) =>
  Object.keys(regions).reduce((acc, name) => (moves[name] ? moveRegion(acc, regions[name], moves[name]) : acc), px);

// Shifts a whole layer by a whole-pixel move (what it uncovers is transparent).
export const shift = (px: Pixels, [dx, dy]: Move): Pixels => {
  if (dx === 0 && dy === 0) return px;
  const out = blank(px.w, px.h);
  for (let y = Math.max(0, dy); y < Math.min(px.h, px.h + dy); y++) {
    for (let x = Math.max(0, dx); x < Math.min(px.w, px.w + dx); x++) out.data[y * px.w + x] = px.data[(y - dy) * px.w + x - dx];
  }
  return out;
};

// A contact rim: blends `color` at `opacity` into the pixels of `dst` just
// outside `layer` (4-neighbourhood), where `dst` already has something drawn;
// over dark pixels it blends `light` instead (black jacket over black shorts).
// Drawn before the layer itself, it separates the layer from what is under it
// without touching the layer's own colours.
const luma = (p: number) => (0.299 * (p & 0xff) + 0.587 * ((p >> 8) & 0xff) + 0.114 * ((p >> 16) & 0xff)) / 255;
export const rimUnder = (dst: Pixels, layer: Pixels, color: number, opacity: number, light = color) => {
  const { w, h } = dst;
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && opaque(layer.data[y * w + x]);
  const mix = (a: number, b: number, at: number) => Math.round(((a >> at) & 0xff) * (1 - opacity) + ((b >> at) & 0xff) * opacity) << at;
  const out = dst.data.slice();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = dst.data[y * w + x];
      if (!opaque(p) || on(x, y) || !(on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) continue;
      const c = luma(p) < 0.3 ? light : color;
      out[y * w + x] = ((p & 0xff000000) | mix(p, c, 16) | mix(p, c, 8) | mix(p, c, 0)) >>> 0;
    }
  }
  dst.data.set(out);
};

// Keeps only the pixels where `mask` is opaque.
export const clipTo = (px: Pixels, mask: Pixels): Pixels => {
  const out = blank(px.w, px.h);
  for (let i = 0; i < px.data.length; i++) if (opaque(mask.data[i])) out.data[i] = px.data[i];
  return out;
};
