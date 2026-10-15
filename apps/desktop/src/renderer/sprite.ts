import type { CharacterAnimationKey } from '../../../mobile/src/domain/scene';
import { drawCharacter, pack, type Avatar, type Turn } from './character';
import type { Fx } from './character/actions';

// The pet scene: the character standing front-on over a soft pixel shadow,
// plus effects. Everything is whole-pixel rects scaled up.
export const [ORIGIN_X, ORIGIN_Y] = [4, 4]; // headroom for jumps, side room for sway
export let GRID_WIDTH = pack.frame.w + ORIGIN_X * 2;
export let GRID_HEIGHT = pack.frame.h + ORIGIN_Y * 2;
let FEET_Y = ORIGIN_Y + pack.feetY;
let CENTER_X = GRID_WIDTH / 2;
export const syncSceneSize = () => {
  GRID_WIDTH = pack.frame.w + ORIGIN_X * 2;
  GRID_HEIGHT = pack.frame.h + ORIGIN_Y * 2;
  FEET_Y = ORIGIN_Y + pack.feetY;
  CENTER_X = GRID_WIDTH / 2;
};
// Effects are drawn in blocks of K grid pixels so they read at the
// character's detail level.
const K = 2;

// Device pixels per grid pixel. Counting device (not CSS) pixels keeps every
// art pixel a whole number of screen pixels on Retina too: size 2 is 1.5x CSS
// there (3 device px), each step adds one device pixel.
export const pixelSize = (petScale: number, dpr = window.devicePixelRatio || 1) =>
  Math.max(1, Math.round(((petScale + 1) * dpr) / 2));

const c = {
  shadow: 'rgba(26, 16, 40, 0.35)',
  neon: 'rgba(211, 66, 245, 0.4)',
  heart: '#ff5ad0',
  heartShine: '#ffd1e8',
  sparkle: '#f7f26b',
  zzz: '#9fd0ff',
  note: '#ffd1e8',
  sweat: '#9fd0ff',
  sweatShade: '#5b9be0',
  sweatShine: '#eaf6ff'
};

export type Reaction = 'none' | 'heart' | 'celebrate' | 'dragged' | 'sleepy' | 'action';

export type PetFrame = {
  animation: CharacterAnimationKey;
  frame: number;
  scale: number;
  turn: Turn;
  // Cursor above (<0) or below (>0) her: the same levels as `turn`.
  tilt?: Turn;
  avatar: Avatar;
  musicPlaying: boolean;
  reaction: Reaction;
  reactionFrame: number;
  now: number;
  talking: boolean;
  // A pack action (pat, poke, flick…) playing now.
  action?: { state: string; fx?: Fx };
  // Wandering: -1 left, 1 right.
  walk?: -1 | 0 | 1;
  // A script's expression and effect overlay.
  face?: string;
  fx?: { kind: Fx; t: number };
};

let P = 2;
let ctx: CanvasRenderingContext2D;

const px = (x: number, y: number, w: number, h: number, fill: string) => {
  ctx.fillStyle = fill;
  ctx.fillRect(x * P, y * P, w * P, h * P);
};
// Effect pixel: one K×K block at grid (x, y), sizes in blocks.
const fx = (x: number, y: number, w: number, h: number, fill: string) => px(x, y, w * K, h * K, fill);

// Stepped pixel ellipse under her feet; glows faintly neon with music.
const drawShadow = (lifted: boolean, glow: boolean) => {
  const half = lifted ? 14 : 20;
  const fill = glow ? c.neon : c.shadow;
  px(CENTER_X - half + 4, FEET_Y - 1, (half - 4) * 2, 1, fill);
  px(CENTER_X - half, FEET_Y, half * 2, 2, fill);
  px(CENTER_X - half + 4, FEET_Y + 2, (half - 4) * 2, 1, fill);
};

const heart = (x: number, y: number) => {
  fx(x, y, 2, 1, c.heart);
  fx(x + 3 * K, y, 2, 1, c.heart);
  fx(x - K, y + K, 7, 2, c.heart);
  fx(x, y + 3 * K, 5, 1, c.heart);
  fx(x + K, y + 4 * K, 3, 1, c.heart);
  fx(x + 2 * K, y + 5 * K, 1, 1, c.heart);
  fx(x, y + K, 1, 1, c.heartShine);
};

// Sweat drop, drawn like the heart: pointed top, round bottom, a shine and
// a shaded lower edge.
const drop = (x: number, y: number) => {
  fx(x + 2 * K, y, 1, 1, c.sweat);
  fx(x + K, y + K, 3, 1, c.sweat);
  fx(x, y + 2 * K, 5, 2, c.sweat);
  fx(x + K, y + 4 * K, 3, 1, c.sweatShade);
  fx(x + 4 * K, y + 3 * K, 1, 1, c.sweatShade);
  fx(x + K, y + 2 * K, 1, 1, c.sweatShine);
};

const sparkle = (x: number, y: number, big: boolean) => {
  fx(x, y, 1, 1, c.sparkle);
  if (!big) return;
  fx(x - K, y, 3, 1, c.sparkle);
  fx(x, y - K, 1, 3, c.sparkle);
};

// Little pixel "💢" by the head.
const anger = (x: number, y: number) => {
  const red = '#ff4f6d';
  fx(x, y, 1, 2, red);
  fx(x + 3 * K, y, 1, 2, red);
  fx(x, y + 3 * K, 1, 2, red);
  fx(x + 3 * K, y + 3 * K, 1, 2, red);
  fx(x - K, y + K, 2, 1, red);
  fx(x + 3 * K, y + K, 2, 1, red);
  fx(x - K, y + 3 * K, 2, 1, red);
  fx(x + 3 * K, y + 3 * K, 2, 1, red);
};

// Effects of a pack action, `t` frames in.
const drawFx = (kind: Fx, t: number) => {
  if (kind === 'hearts') {
    heart(70, Math.max(0, 16 - t * 2));
    if (t > 3) heart(20, Math.max(0, 22 - (t - 3) * 2));
  } else if (kind === 'stars') {
    // stars circling the forehead
    for (let i = 0; i < 3; i++) {
      const a = t * 0.6 + (i * Math.PI * 2) / 3;
      sparkle(Math.round(CENTER_X + Math.cos(a) * 18), Math.round(14 + Math.sin(a) * 5), (t + i) % 2 === 0);
    }
  } else if (kind === 'anger') {
    if (t % 4 < 3) anger(72, 14);
  } else if (kind === 'sweat') {
    drop(72, 18 + Math.min(t, 6) * 2);
    if (t > 3) drop(16, 24 + Math.min(t - 3, 6) * 2);
  } else if (kind === 'sparkles') {
    [[12, 30], [86, 26], [8, 56], [90, 60]].forEach(([sx, sy], i) => sparkle(sx, sy - (t % 4), (t + i) % 2 === 0));
  }
};

const text = (glyph: string, x: number, y: number, fill: string, size: number) => {
  ctx.fillStyle = fill;
  ctx.font = `${size * P}px Galmuri11, monospace`;
  ctx.fillText(glyph, x * P, y * P);
};

// Scene animation → character pack state key.
const stateFor = (f: PetFrame): string => {
  if (f.reaction === 'dragged') return 'dragged';
  if (f.reaction === 'celebrate') return 'celebrate';
  if (f.reaction === 'heart') return 'heart';
  if (f.reaction === 'sleepy') return 'sleep';
  if (f.action) return f.action.state;
  if (f.walk) return f.walk < 0 ? 'walkL' : 'walkR';
  const map: Partial<Record<CharacterAnimationKey, string>> = {
    focus_writing: 'focus',
    pen_down: 'penDown',
    cup_sip: 'sip',
    look_up: 'lookUp',
    window_idle: 'windowGaze',
    sleep_idle: 'sleep'
  };
  return map[f.animation] ?? 'idle';
};

export const drawPet = (target: CanvasRenderingContext2D, f: PetFrame) => {
  ctx = target;
  P = f.scale;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, GRID_WIDTH * P, GRID_HEIGHT * P);

  const state = stateFor(f);
  const asleep = state === 'sleep';
  const bob = f.musicPlaying && !asleep && state !== 'dragged' && f.frame % 4 >= 2 ? 1 : 0;

  drawShadow(state === 'dragged' || state === 'celebrate', f.musicPlaying);
  drawCharacter(ctx, ORIGIN_X, ORIGIN_Y, P, { state, turn: f.turn, tilt: f.tilt, face: f.face, avatar: f.avatar, bob, talking: f.talking && !asleep }, f.now);

  if (state === 'dragged') drop(72, 20 + (f.frame % 4));
  if (asleep) {
    text('z', 72, 30 - (f.frame % 4) * 2, c.zzz, 10);
    text('Z', 80, 22 - (f.frame % 4) * 2, c.zzz, 12);
  }
  if (f.musicPlaying && !asleep && state !== 'dragged') {
    const rise = f.frame % 6;
    text('♪', 2, 54 - rise * 2, c.note, 12);
    text('♫', 88, 50 - ((rise + 3) % 6) * 2, c.note, 12);
  }
  if (f.reaction === 'heart') heart(72, Math.max(0, 16 - f.reactionFrame * 2));
  if (f.action?.fx) drawFx(f.action.fx, f.reactionFrame);
  if (f.fx) drawFx(f.fx.kind, f.fx.t);
  if (f.reaction === 'celebrate') {
    [
      [12, 20],
      [86, 16],
      [6, 42],
      [92, 46],
      [50, 2]
    ].forEach(([sx, sy], i) => sparkle(sx, sy, (f.reactionFrame + i) % 2 === 0));
    if (f.reactionFrame < 12) text('+1', 70, 22 - Math.floor(f.reactionFrame / 3) * 2, c.sparkle, 10);
  }
};
