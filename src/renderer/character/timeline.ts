import { faceTurns, hasFace, hasHead, type CharacterPack, type FrameDef, type Move, type StateDef } from './pack';

// `head`: a turned-head cell variant ("turnL"/"turnR"), when the cursor is far off.
export type Pose = { face: string; dx: number; dy: number; moves: Record<string, Move>; head?: string; pose?: string };

// Faces a blink may interrupt (a smile or sleep already has its own eyes).
const BLINKABLE = new Set(['open', 'focused']);

export const resolveState = (pack: CharacterPack, state: string) => (pack.states[state] ? state : pack.fallback);

// Frame showing `elapsed` ms into a state: the start frames once, then the loop.
export const frameAt = (def: StateDef, elapsed: number): FrameDef => {
  let t = Math.max(0, elapsed);
  for (const frame of def.start ?? []) {
    if (t < frame.ms) return frame;
    t -= frame.ms;
  }
  const total = def.loop.reduce((sum, f) => sum + f.ms, 0);
  t %= total;
  for (const frame of def.loop) {
    if (t < frame.ms) return frame;
    t -= frame.ms;
  }
  return def.loop[0];
};

// One play-through of a state (start frames + one loop), for fidgets.
export const stateLength = (def: StateDef) => [...(def.start ?? []), ...def.loop].reduce((sum, f) => sum + f.ms, 0);

// Deterministic 0..1 from an integer (so a blink window is stable across frames).
const hash = (n: number) => {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// Cursor level: ±1 glances (eyes move), ±2 turns the head when the pack
// has turned cells, otherwise it glances too.
export type Look = -2 | -1 | 0 | 1 | 2;

// One blink per `everyMs` window, at a pseudo-random point inside it.
export const isBlinking = (now: number, blink: { everyMs: number; ms: number }) => {
  const window = Math.floor(now / blink.everyMs);
  const at = window * blink.everyMs + hash(window) * (blink.everyMs - blink.ms);
  return now >= at && now < at + blink.ms;
};

// Mouth shapes cycled while talking (only over an open or blinking face).
const TALK = ['talkA', 'talkB', 'talkA', 'open'];
const TALK_MS = 110;
export const talkFace = (pack: CharacterPack, face: string, now: number) => {
  if ((face !== 'open' && face !== 'closed') || !hasFace(pack, 'talkA')) return face;
  const shape = TALK[Math.floor(now / TALK_MS) % TALK.length];
  return hasFace(pack, shape) ? shape : face;
};

// `look` / `tilt`: cursor level sideways / up-down (-2..2). Far sideways
// turns the head (`turnL`/`turnR` cells); far up or down uses `up`/`down`
// head cells when the pack has them, else the `lookUp`/`lookDown` expression
// (over any open-eyed face), and nods the head a pixel either way (turned too).
// Nearer, the eyes glance that way.
export const poseAt = (pack: CharacterPack, state: string, elapsed: number, now: number, look: number, tilt = 0): Pose => {
  const def = pack.states[resolveState(pack, state)];
  const frame = frameAt(def, elapsed);
  let face = frame.face ?? def.face ?? 'open';
  if (def.blink && BLINKABLE.has(face) && isBlinking(now, def.blink)) face = 'closed';
  const moves = { ...frame.move };
  const pose: Pose = { face, dx: frame.dx ?? 0, dy: frame.dy ?? 0, moves, head: frame.head, pose: frame.pose };
  if (!def.look || (look === 0 && tilt === 0) || pose.head || pose.pose) return pose;
  // Turn only when this face exists for the turned head (else glance).
  const canTurn = (head: string) => hasHead(pack, head) && faceTurns(pack, face, head);
  const side = look < 0 ? 'turnL' : 'turnR';
  const vertical = tilt < 0 ? 'up' : 'down';
  const far = Math.abs(tilt) >= 2;
  // A face with no art for the turned head turns with its open eyes instead,
  // so following the cursor never stalls on an expression (focused, smile…).
  const turnTo = (head: string) => {
    if (canTurn(head)) return true;
    if (face === 'closed' || !hasHead(pack, head) || !faceTurns(pack, 'open', head)) return false;
    pose.face = 'open';
    return true;
  };
  if (Math.abs(look) >= 2 && turnTo(side)) pose.head = side;
  else if (far && turnTo(vertical)) return { ...pose, head: vertical };
  if (far) {
    const [hx, hy] = moves.head ?? [0, 0];
    moves.head = [hx, hy + Math.sign(tilt)];
  }
  if (pose.head) return pose;
  const gaze = tilt < 0 ? 'lookUp' : 'lookDown';
  // Looking far up or down wins over the state's expression (not over closed eyes).
  if (far && face !== 'closed' && pack.expressions?.[gaze]) {
    pose.face = gaze;
    return pose;
  }
  if (face !== 'closed') {
    const [dx, dy] = moves.eyes ?? [0, 0];
    moves.eyes = [dx + Math.sign(look), dy + Math.sign(tilt)];
  }
  return pose;
};
