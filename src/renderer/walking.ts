import { api } from './api';
import { createWalker, type Room } from './character/walker';

// Moves the window while she wanders (see character/walker.ts for when and
// where). The main process moves her by whole screen pixels and reports the
// room left to each edge; fractions are carried over to the next tick.

const TICK_MS = 40;

export const startWalking = (isFree: () => boolean) => {
  const walker = createWalker();
  let room: Room = { left: 0, right: 0, up: 0, down: 0 };
  let carryX = 0, carryY = 0;
  let last = performance.now();
  let facing: -1 | 0 | 1 = 0;
  let busy = false;

  void api.walkStep(0).then((r) => (room = r));
  setInterval(async () => {
    const now = performance.now();
    const dt = now - last;
    last = now;
    if (scripted) return; // a script is walking her
    const step = walker.tick(Date.now(), dt, isFree(), room);
    facing = step.walking ? step.dir : 0;
    carryX += step.dx;
    carryY += step.dy;
    const px = Math.trunc(carryX), py = Math.trunc(carryY);
    if ((px === 0 && py === 0) || busy) return;
    carryX -= px;
    carryY -= py;
    busy = true;
    try {
      room = await api.walkStep(px, py);
    } finally {
      busy = false;
    }
  }, TICK_MS);

  // A scripted walk (mod `walk` block): moves by (dx, dy) at a steady pace,
  // facing the way it goes; resolves when there or blocked.
  let scripted: { x: number; y: number; resolve: () => void } | null = null;
  const SCRIPT_SPEED = 45; // px per second
  setInterval(async () => {
    if (!scripted || busy) return;
    const len = Math.hypot(scripted.x, scripted.y);
    if (len < 1) { const done = scripted; scripted = null; facing = 0; done.resolve(); return; }
    const step = Math.min(len, (SCRIPT_SPEED * TICK_MS) / 1000);
    const px = Math.round((scripted.x / len) * step), py = Math.round((scripted.y / len) * step);
    if (Math.abs(scripted.x) > 0.5) facing = scripted.x < 0 ? -1 : 1;
    busy = true;
    try {
      const before = room;
      room = await api.walkStep(px, py);
      const blocked = (px < 0 && before.left <= 0) || (px > 0 && before.right <= 0) || (py < 0 && before.up <= 0) || (py > 0 && before.down <= 0);
      scripted.x -= px; scripted.y -= py;
      if (blocked || (px === 0 && py === 0)) { const done = scripted; scripted = null; facing = 0; done.resolve(); }
    } finally {
      busy = false;
    }
  }, TICK_MS);

  return {
    // -1 walking left, 1 walking right, 0 standing.
    facing: () => facing,
    walkBy: (x: number, y: number) => new Promise<void>((resolve) => { scripted?.resolve(); scripted = { x, y, resolve }; }),
    scripting: () => scripted !== null
  };
};
