import lilaPack from '../../assets/characters/lila/character.json';
import lilaSheet from '../../assets/characters/lila/sheet.png';
import { hasFace, layerCells, recolorsFor, resolveHead, validatePack, type Avatar, type Move } from './character/pack';
import { withModStates } from './character/mods';
import type { Mod } from '../shared/mods';
import { applyMoves, blank, clipTo, crop, hexToPixel, over, recolor, rimUnder, shift, type Pixels } from './character/pixels';
import { poseAt, resolveState, stateLength, talkFace, type Look } from './character/timeline';
import type { CharacterAsset } from '../shared/characterImport';

// Layered character (pack format @2): each layer is cut from the sheet,
// recoloured for the avatar, moved for the pose (whole, or by region boxes)
// and drawn back to front. Composed frames are cached as canvases, so steady
// states cost one drawImage.

export type { Avatar, Slot } from './character/pack';
export type { Look as Turn } from './character/timeline';

// The active character's pack, with the enabled mods' states merged in.
let basePack = validatePack(lilaPack);
let modStates: Mod[] = [];
export let pack = basePack;
const changeListeners = new Set<() => void>();
export const onCharacterChange = (listener: () => void) => changeListeners.add(listener);
const resetCaches = () => {
  cellCache.clear();
  frameCache.clear();
  shown = null;
  current = { state: '', since: 0 };
  fidget.next = 0;
  fidget.playing = '';
};
// Mod states are added on top of the pack (a mod may override a pack state).
export const setModStates = (mods: Mod[]) => {
  modStates = mods;
  pack = withModStates(basePack, mods);
  resetCaches();
};

let sheet: Pixels | null = null;
const readImage = (url: string) => new Promise<Pixels>((resolve, reject) => {
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(image, 0, 0);
    const { data } = ctx.getImageData(0, 0, image.width, image.height);
    resolve({ w: image.width, h: image.height, data: new Uint32Array(data.buffer) });
  };
  image.onerror = () => reject(new Error('캐릭터 PNG를 읽지 못했어요'));
  image.src = url;
});
const ready = readImage(lilaSheet).then((pixels) => { sheet = pixels; });

let { w: W, h: H } = pack.frame;

export const setCharacter = async (asset: CharacterAsset) => {
  const next = validatePack(asset.pack);
  const pixels = await readImage(asset.sheetUrl);
  basePack = next;
  pack = withModStates(basePack, modStates);
  sheet = pixels;
  W = pack.frame.w;
  H = pack.frame.h;
  resetCaches();
  changeListeners.forEach((listener) => listener());
};

// avatar + cell → cut and recoloured pixels
const cellCache = new Map<string, Pixels>();
const cellPixels = (avatar: Avatar, layer: string, cell: string) => {
  const key = `${JSON.stringify(avatar)}|${layer}|${cell}`;
  const hit = cellCache.get(key);
  if (hit) return hit;
  const [x, y] = pack.cells[cell];
  const px = crop(sheet!, x, y, W, H);
  // An outfit cell (a whole pose drawn with the clothes on) holds hair, glow
  // and all, so every recolor applies to it; regions are front-view boxes.
  const outfit = layer === 'outfit';
  for (const r of recolorsFor(pack, avatar)) {
    if (!outfit && r.layers && !r.layers.includes(layer)) continue;
    const map = new Map(Object.entries(r.map).map(([from, to]) => [hexToPixel(from), hexToPixel(to)]));
    recolor(px, map, !outfit && r.region ? pack.regions[r.region] : undefined);
  }
  if (cellCache.size > 512) cellCache.clear();
  cellCache.set(key, px);
  return px;
};

const sum = (moves: Record<string, Move>, names: string[]): Move =>
  names.reduce<Move>(([x, y], n) => [x + (moves[n]?.[0] ?? 0), y + (moves[n]?.[1] ?? 0)], [0, 0]);

// Layers a hit area can name: the frame records which of them is on top per pixel.
const hitLayers = () => {
  const ids = new Set<string>();
  for (const area of Object.values(pack.hitAreas ?? {})) if (!Array.isArray(area)) area.layers.forEach((l) => ids.add(l));
  return ids;
};

type Frame = { canvas: HTMLCanvasElement; owner: Uint8Array; ids: string[] };

// avatar + face + pose + moves → frame, kept small (frames repeat every loop)
const frameCache = new Map<string, Frame>();
const frameFor = (avatar: Avatar, face: string, moves: Record<string, Move>, head?: string, bodyPose?: string): Frame => {
  const key = `${JSON.stringify(avatar)}|${face}|${head ?? ''}|${bodyPose ?? ''}|${JSON.stringify(moves)}`;
  const hit = frameCache.get(key);
  if (hit) return hit;
  const out = blank(W, H);
  const owner = new Uint8Array(W * H);
  const ids: string[] = [];
  const hits = hitLayers();
  for (const { layer, cell, def, clip } of layerCells(pack, avatar, face, head, bodyPose)) {
    let px = cellPixels(avatar, layer, cell);
    const own = def.ignore ? Object.fromEntries(Object.entries(moves).filter(([r]) => !def.ignore!.includes(r))) : moves;
    px = def.follow ? shift(px, sum(moves, def.follow)) : applyMoves(px, pack.regions, own);
    if (clip) px = clipTo(px, shift(cellPixels(avatar, layer, clip), sum(moves, def.clipFollow ?? def.follow ?? [])));
    if (def.edge) rimUnder(out, px, hexToPixel(def.edge.color), def.edge.opacity, def.edge.light ? hexToPixel(def.edge.light) : undefined);
    over(out, px);
    if (hits.has(layer)) {
      ids.push(layer);
      for (let i = 0; i < px.data.length; i++) if (px.data[i] >>> 24) owner[i] = ids.length;
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(out.data.buffer as ArrayBuffer), W, H), 0, 0);
  const frame = { canvas, owner, ids };
  if (frameCache.size > 96) frameCache.clear();
  frameCache.set(key, frame);
  return frame;
};

// The frame's outline at device resolution: an opaque silhouette stamped in
// 8 directions (so overlaps don't darken), drawn later at the pack's opacity.
const outlineCache = new WeakMap<HTMLCanvasElement, { scale: number; canvas: HTMLCanvasElement }>();
const AROUND = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
const outlineFor = (frame: HTMLCanvasElement, scale: number, outline: NonNullable<typeof pack.outline>) => {
  const hit = outlineCache.get(frame);
  if (hit && hit.scale === scale) return hit.canvas;
  const width = outline.width ?? 1;
  const shape = document.createElement('canvas');
  shape.width = W;
  shape.height = H;
  const s = shape.getContext('2d')!;
  s.drawImage(frame, 0, 0);
  s.globalCompositeOperation = 'source-in';
  s.fillStyle = outline.color;
  s.fillRect(0, 0, W, H);
  const canvas = document.createElement('canvas');
  canvas.width = W * scale + width * 2;
  canvas.height = H * scale + width * 2;
  const c = canvas.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  for (const [dx, dy] of AROUND) c.drawImage(shape, width + dx * width, width + dy * width, W * scale, H * scale);
  c.globalCompositeOperation = 'destination-out'; // keep only the ring outside the sprite
  c.drawImage(frame, width, width, W * scale, H * scale);
  outlineCache.set(frame, { scale, canvas });
  return canvas;
};

// When the shown state started (a state change restarts its timeline).
let current = { state: '', since: 0 };

// Idle fidgets: while idle, now and then play one fidget state once.
const fidget = { next: 0, playing: '', until: 0 };
const scheduleFidget = (now: number) => {
  const [min, max] = pack.fidgets!.everyMs;
  fidget.next = now + min + Math.random() * (max - min);
};
const withFidget = (state: string, now: number) => {
  if (!pack.fidgets || state !== 'idle') {
    fidget.next = 0;
    fidget.playing = '';
    return state;
  }
  if (fidget.playing && now < fidget.until) return fidget.playing;
  if (fidget.playing || fidget.next === 0) {
    fidget.playing = '';
    scheduleFidget(now);
  }
  if (now < fidget.next) return state;
  const choices = pack.fidgets.states;
  fidget.playing = choices[Math.floor(Math.random() * choices.length)];
  fidget.until = now + stateLength(pack.states[fidget.playing]);
  return fidget.playing;
};

export type CharacterDraw = {
  state: string;
  turn: Look;
  tilt?: Look;
  avatar: Avatar;
  // Extra vertical offset (music bob, jumps), in grid pixels.
  bob: number;
  // Mouth moves while the speech bubble is typing.
  talking?: boolean;
  // An expression a script asked for, over whatever the state shows.
  face?: string;
};

// Draws the character into `ctx` at grid position (x, y) with `scale`.
export const drawCharacter = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, opts: CharacterDraw, now: number) => {
  if (!sheet) return;
  const state = withFidget(resolveState(pack, opts.state), now);
  if (current.state !== state) current = { state, since: now };
  const pose = poseAt(pack, state, now - current.since, now, opts.turn, opts.tilt ?? 0);
  if (opts.face && hasFace(pack, opts.face) && pose.face !== 'closed') pose.face = opts.face;
  if (opts.talking && pose.face === 'open' && !pose.head) pose.face = talkFace(pack, pose.face, now);
  // A mirrored direction draws the other one flipped; its sideways moves are
  // composed reversed so they come out the intended way after the flip.
  const { head, flip } = resolveHead(pack, pose.head);
  const moves = flip ? Object.fromEntries(Object.entries(pose.moves).map(([r, [mx, my]]) => [r, [-mx, my] as Move])) : pose.moves;
  const { canvas: frame, owner, ids } = frameFor(opts.avatar, pose.face, moves, head, pose.pose);
  shown = { owner, ids, dx: pose.dx, dy: pose.dy + opts.bob, flip };
  const left = (x + pose.dx) * scale;
  const top = (y + pose.dy + opts.bob) * scale;
  ctx.save();
  if (flip) {
    ctx.translate(left * 2 + W * scale, 0);
    ctx.scale(-1, 1);
  }
  // Outline thinner than an art pixel (device pixels), so the edge reads soft.
  if (pack.outline) {
    const width = pack.outline.width ?? 1;
    ctx.save();
    ctx.globalAlpha = pack.outline.opacity ?? 1;
    ctx.drawImage(outlineFor(frame, scale, pack.outline), left - width, top - width);
    ctx.restore();
  }
  ctx.drawImage(frame, left, top, W * scale, H * scale);
  ctx.restore();
};

// The hit-area layer on top at frame pixel (x, y) of the last drawn frame.
let shown: { owner: Uint8Array; ids: string[]; dx: number; dy: number; flip: boolean } | null = null;
export const layerAt = (x: number, y: number) => {
  if (!shown) return undefined;
  const fx = shown.flip ? W - 1 - Math.floor(x - shown.dx) : Math.floor(x - shown.dx);
  const fy = Math.floor(y - shown.dy);
  if (fx < 0 || fy < 0 || fx >= W || fy >= H) return undefined;
  return shown.ids[shown.owner[fy * W + fx] - 1];
};

export const characterReady = ready;
