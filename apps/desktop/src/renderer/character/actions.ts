import type { Box, CharacterPack } from './pack';

// Interactions ("actions") are data in the pack: where they trigger (a hit
// area on the sprite, and/or the right-click menu), which state plays, for how
// long, with what effect and what she says. Adding one is a pack change only.

export type Fx = 'hearts' | 'stars' | 'anger' | 'sweat' | 'sparkles';

export type ActionDef = {
  label: string;
  // Hit area that triggers it on right-click (left-click too for `tap`).
  area?: string;
  tap?: boolean;
  // Listed in the right-click menu.
  menu?: boolean;
  state: string;
  ms: number;
  fx?: Fx;
  lines?: string[];
};

const inside = (boxes: Box[], x: number, y: number) =>
  boxes.some(([x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1);

// Hit area under a point in frame pixels (first match in pack order). Areas
// given as layers match the body part on top there (`layerAt`).
export const areaAt = (pack: CharacterPack, x: number, y: number, layerAt?: (x: number, y: number) => string | undefined) => {
  const layer = layerAt?.(x, y);
  return Object.entries(pack.hitAreas ?? {}).find(([, area]) => (Array.isArray(area) ? inside(area, x, y) : layer !== undefined && area.layers.includes(layer)))?.[0];
};

// The action an area triggers; `tapOnly` limits it to left-click actions.
export const actionForArea = (pack: CharacterPack, area: string | undefined, tapOnly = false) =>
  area ? Object.entries(pack.actions ?? {}).find(([, a]) => a.area === area && (!tapOnly || a.tap))?.[0] : undefined;

export const menuActions = (pack: CharacterPack) =>
  Object.entries(pack.actions ?? {})
    .filter(([, a]) => a.menu)
    .map(([id, a]) => ({ id, label: a.label }));

// A line to say, never the same one twice in a row.
export const pickLine = (lines: string[] | undefined, last: string | undefined, random = Math.random) => {
  if (!lines?.length) return undefined;
  const pool = lines.length > 1 ? lines.filter((l) => l !== last) : lines;
  return pool[Math.floor(random() * pool.length)];
};
