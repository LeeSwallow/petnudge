// Random wandering: while she's free (walking on, panel closed, not dragged or
// reacting, not in a focus session), every so often she picks a random
// direction (any angle, a little flatter than a circle, turned away from
// edges she's up against), a random distance and a random duration, walks
// that line at the matching pace, then rests for a random while. Edges stop
// her early. Pure: time, room and randomness come in, so it's testable.

export type Room = { left: number; right: number; up: number; down: number };
export type WalkStep = { dx: number; dy: number; dir: -1 | 1; walking: boolean };

export const WALK = {
  rest: [3_000, 9_000] as [number, number], // pause between walks, ms
  distance: [80, 320] as [number, number], // px per walk
  duration: [2_000, 7_000] as [number, number], // ms per walk
  speed: [20, 70] as [number, number], // px per second, the pace is clamped to this
  vertical: 0.5, // vertical share of a random direction (screens are wide)
  minRoom: 24 // don't head toward an edge closer than this
};

const between = ([lo, hi]: [number, number], random: () => number) => lo + random() * (hi - lo);
const clamp = (v: number, [lo, hi]: [number, number]) => Math.min(hi, Math.max(lo, v));

export const createWalker = (random: () => number = Math.random) => {
  let walking = false;
  let dir: -1 | 1 = 1;
  let vx = 0, vy = 0; // unit direction
  let speed = 0;
  let remaining = 0;
  let nextAt = 0;

  const idle = (): WalkStep => ({ dx: 0, dy: 0, dir, walking: false });
  const rest = (now: number): WalkStep => {
    walking = false;
    nextAt = now + between(WALK.rest, random);
    return idle();
  };

  const start = (room: Room) => {
    const angle = random() * Math.PI * 2;
    let x = Math.cos(angle), y = Math.sin(angle) * WALK.vertical;
    // Turn away from edges she's up against.
    if ((x < 0 && room.left < WALK.minRoom) || (x > 0 && room.right < WALK.minRoom)) x = -x;
    if ((y < 0 && room.up < WALK.minRoom) || (y > 0 && room.down < WALK.minRoom)) y = -y;
    const len = Math.hypot(x, y) || 1;
    vx = x / len; vy = y / len;
    remaining = between(WALK.distance, random);
    speed = clamp((remaining / between(WALK.duration, random)) * 1000, WALK.speed);
    if (Math.abs(vx) > 0.15) dir = vx < 0 ? -1 : 1;
    walking = true;
  };

  // `free`: allowed to walk right now. `room`: px left to each screen edge.
  const tick = (now: number, dt: number, free: boolean, room: Room): WalkStep => {
    if (!free) return walking || nextAt === 0 ? rest(now) : idle();
    if (!walking) {
      if (nextAt === 0) return rest(now);
      if (now < nextAt) return idle();
      start(room);
    }
    let step = Math.min((speed * dt) / 1000, remaining);
    // Never past an edge: shorten the step to the nearer limit along the line.
    const ax = vx < 0 ? room.left : room.right, ay = vy < 0 ? room.up : room.down;
    if (Math.abs(vx) > 1e-6) step = Math.min(step, ax / Math.abs(vx));
    if (Math.abs(vy) > 1e-6) step = Math.min(step, ay / Math.abs(vy));
    remaining -= step;
    const moved = { dx: vx * step, dy: vy * step };
    if (step <= 0.01 || remaining <= 0) return { ...rest(now), ...moved };
    return { ...moved, dir, walking: true };
  };

  return { tick, isWalking: () => walking };
};
