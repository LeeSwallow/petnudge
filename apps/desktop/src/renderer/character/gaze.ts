import type { Look } from './timeline';

// Thresholds follow the displayed sprite size, with hysteresis at each edge.
// `dx` is the cursor's offset from her along one axis, `width` her size on it.
export const lookToward = (dx: number, width: number, previous: Look): Look => {
  const distance = Math.abs(dx);
  const glance = Math.max(10, width * 0.1) * (Math.abs(previous) >= 1 ? 0.7 : 1);
  const turn = Math.max(30, width * 0.4) * (Math.abs(previous) === 2 ? 0.8 : 1);
  return ((distance > turn ? 2 : distance > glance ? 1 : 0) * Math.sign(dx)) as Look;
};
