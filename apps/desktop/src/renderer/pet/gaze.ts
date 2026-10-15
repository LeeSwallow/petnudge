import { api } from '../api';
import type { Turn } from '../character';
import { lookToward } from '../character/gaze';
import { data } from '../data';

// She follows the cursor: a glance (eyes) when it's a little to the side,
// above or below, a head turn or nod when it's far off. Measured from her
// face; hysteresis keeps her from flickering at the edges.

export const gaze = { turn: 0 as Turn, tilt: 0 as Turn };

// Looking at someone (a friend she's talking to) wins over the cursor.
let facing = { dx: 0, until: 0 };
export const faceToward = (dx: number, ms: number) => {
  facing = { dx, until: Date.now() + ms };
};

export const updateGaze = async (canvas: HTMLCanvasElement) => {
  if (Date.now() < facing.until && facing.dx) {
    gaze.turn = (facing.dx > 0 ? 2 : -2) as Turn;
    gaze.tilt = 0;
    return;
  }
  if (!data.settings.eyesFollowCursor) {
    gaze.turn = 0;
    gaze.tilt = 0;
    return;
  }
  const cursor = await api.getCursor();
  if (!cursor) return;
  const rect = canvas.getBoundingClientRect();
  gaze.turn = lookToward(cursor.x - (rect.left + rect.width / 2), rect.width, gaze.turn);
  gaze.tilt = lookToward(cursor.y - (rect.top + rect.height * 0.3), rect.height * 0.6, gaze.tilt);
};
