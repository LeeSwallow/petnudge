import { describe, expect, it } from 'vitest';
import { WALK, createWalker, type Room } from './walker';

// A deterministic random sequence.
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};
const open: Room = { left: 1000, right: 1000, up: 1000, down: 1000 };

describe('walker', () => {
  it('rests first, then walks a random direction at the pace distance / duration gives', () => {
    // rest=min, angle=0 (right), distance=min, duration=min → 80px over 2s = 40px/s
    const walker = createWalker(seq(0, 0, 0, 0));
    expect(walker.tick(0, 40, true, open).walking).toBe(false);
    expect(walker.tick(WALK.rest[0] - 1, 40, true, open).walking).toBe(false);
    const step = walker.tick(WALK.rest[0], 1000, true, open);
    expect(step.walking).toBe(true);
    expect(step.dx).toBeCloseTo(40);
    expect(step.dy).toBeCloseTo(0);
    expect(step.dir).toBe(1);
  });

  it('walks diagonally, faces the horizontal direction and stops at its distance', () => {
    // angle 3/8 turn = 135° → left and down
    const walker = createWalker(seq(0, 0.375, 0, 0));
    walker.tick(0, 40, true, open);
    let x = 0, y = 0, t = WALK.rest[0], step;
    do { step = walker.tick(t, 100, true, open); x += step.dx; y += step.dy; t += 100; } while (step.walking);
    expect(x).toBeLessThan(0);
    expect(y).toBeGreaterThan(0);
    expect(Math.hypot(x, y)).toBeCloseTo(WALK.distance[0]);
    expect(step.dir).toBe(-1);
  });

  it('turns away from an edge it is up against and never steps past one', () => {
    const walker = createWalker(seq(0, 0.5, 1, 0)); // angle 180° (left), long distance
    walker.tick(0, 40, true, open);
    const step = walker.tick(WALK.rest[0], 10_000, true, { left: 0, right: 30, up: 500, down: 500 });
    expect(step.dx).toBeGreaterThan(0); // flipped to the right
    expect(step.dx).toBeLessThanOrEqual(30 + 1e-6);
  });

  it('stops as soon as it is not free', () => {
    const walker = createWalker(seq(0, 0, 0.5, 0.5));
    walker.tick(0, 40, true, open);
    expect(walker.tick(WALK.rest[0], 100, true, open).walking).toBe(true);
    expect(walker.tick(WALK.rest[0] + 100, 100, false, open)).toEqual({ dx: 0, dy: 0, dir: 1, walking: false });
  });
});
