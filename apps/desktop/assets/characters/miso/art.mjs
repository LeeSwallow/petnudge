// "Miso" — original cyberpunk chibi girl, full-body front view: long wavy
// lilac hair, violet hoodie-dress, LED headset, thigh socks, neon sneakers.
// Authored as palette-indexed pixel spans; scripts/bake-character.mjs composes
// the layers into sheet.png + character.json (replaceable by a hand-drawn
// sheet that uses the same state keys).
//
// Light comes from the top-left: shine on the upper-left of the head, shadow
// (k) on the right and underneath, strand gaps in the bangs.
// Spans are [y, x, pixels]; '.' leaves a pixel untouched.

export const FRAME = { w: 40, h: 56 };

// Rows above this belong to the head and move when she turns her head.
export const HEAD_ROWS = 22;

export const palette = {
  o: '#1a1028', // outline
  k: '#4b3790', // hair shadow
  h: '#7d68d6', // hair
  l: '#a594f0', // hair light
  L: '#e4dcff', // hair shine
  s: '#ffe4dc', // skin
  S: '#f0bfb4', // skin shade
  b: '#ff8fc8', // blush
  e: '#1a1028', // lash
  i: '#c43cff', // iris (neon violet)
  I: '#ff9cf5', // iris light
  w: '#ffffff', // eye shine
  m: '#b0406e', // mouth
  c: '#3c2a6e', // hoodie
  C: '#2a1d52', // hoodie shade
  t: '#4fe8f7', // cyan drawstring
  T: '#ff5ad0', // magenta trim
  d: '#231a40', // thigh socks
  D: '#4fe8f6', // sock stripe
  f: '#f4f0ff', // sneaker
  F: '#b8b0d8', // sneaker shade
  x: '#241a3a', // headset shell
  X: '#5a4a86', // headset shell light / dim LED
  g: '#4ff0ff', // LED glow (cyan)
  G: '#ff4fd8' // mic tip / accent glow (magenta)
};

// ---------- span canvas ----------
const W = FRAME.w;

const paint = (spans) => {
  const grid = Array.from({ length: FRAME.h }, () => Array(W).fill('.'));
  for (const [y, x, pixels] of spans) {
    [...pixels].forEach((ch, i) => {
      if (ch !== '.' && y >= 0 && y < FRAME.h && x + i >= 0 && x + i < W) grid[y][x + i] = ch;
    });
  }
  return grid.map((row) => row.join(''));
};

// Mirror spans across the vertical centre (x → W-1-x), reversing pixel order.
const mirror = ([y, x, pixels]) => [y, W - x - pixels.length, [...pixels].reverse().join('')];
const both = (spans) => [...spans, ...spans.map(mirror)];
// Right-side copy recolours light keys to shadow keys (light from the left).
const shadeRight = (spans) => spans.map(mirror).map(([y, x, p]) => [y, x, p.replace(/[lL]/g, 'h')]);

// ---------- long back hair: wavy locks from y10 to y40 ----------
const backHairLeft = [];
for (let y = 10; y <= 40; y += 1) {
  const wave = Math.round(Math.sin((y - 10) / 5) * 1);
  const outer = Math.max(1, 6 - Math.floor((y - 10) / 8) + wave);
  const inner = y < 23 ? 9 : 10; // tucks behind the arm below the shoulder
  if (y > 36) {
    // tapering, uneven tips
    const tips = { 37: [outer, 'okhk'], 38: [outer, 'okk'], 39: [outer + 1, 'ok'], 40: [outer + 1, 'o'] };
    backHairLeft.push([y, tips[y][0], tips[y][1]]);
    continue;
  }
  const width = inner - outer;
  let lock = 'o';
  for (let i = 1; i < width; i += 1) {
    if (i === 1) lock += y > 26 ? 'k' : 'h';
    else if (i === 2 && y >= 12 && y <= 28 && (y + 1) % 6 !== 0) lock += 'l';
    else if (i === width - 1) lock += 'k';
    else lock += 'h';
  }
  backHairLeft.push([y, outer, lock]);
}
const hairBack = [...backHairLeft, ...shadeRight(backHairLeft)];

// ---------- body: hoodie-dress, legs, sneakers ----------
const torsoLeft = [
  [23, 12, 'oocccCoS'],
  [24, 11, 'occcccCoS'],
  [25, 11, 'occcccccc'],
  [26, 11, 'ocCcccctc'],
  [27, 11, 'ocCcccctc'],
  [28, 11, 'ocCccccTc'],
  [29, 11, 'ocCcccccc'],
  [30, 11, 'oCCcccccc'],
  [31, 11, 'oCCccTTTT'],
  [32, 11, 'oCCccTccc'],
  [33, 11, 'oCCccTccc'],
  [34, 11, 'oCCcccccc'],
  [35, 11, 'oCCCccccc'],
  [36, 11, 'oCCCCcccc'],
  [37, 11, 'oTTTTTTTT'],
  [38, 11, 'ooooooooo'],
  [39, 14, 'ossSo'],
  [40, 14, 'ossSo'],
  [41, 14, 'ossSo'],
  [42, 14, 'ossSo'],
  [43, 14, 'oDDDo'],
  [44, 14, 'odddo'],
  [45, 14, 'odddo'],
  [46, 14, 'odddo'],
  [47, 14, 'odddo'],
  [48, 14, 'odddo'],
  [49, 13, 'oodddo'],
  [50, 12, 'offfffo'],
  [51, 12, 'ofTfffo'],
  [52, 12, 'oFFFFFo'],
  [53, 12, 'ooooooo']
];
const body = [[22, 17, 'oSSSSo'], ...both(torsoLeft)];

// ---------- head ----------
const head = [
  [1, 14, 'oooooooooooo'],
  [2, 12, 'oolllLLhhhhhhhoo'],
  [3, 10, 'oollLLLhhhhhhhhhkkoo'],
  [4, 9, 'olllLhhhhhhhhhhhhhhhko'],
  [5, 8, 'ollhhhhhhhhhhhhhhhhhhkko'],
  [6, 8, 'olhhhhhhhhhhhhhhhhhhhkko'],
  [7, 7, 'olhhhhhhhhhhhhhhhhhhhhhkko'],
  [8, 7, 'ohhhhhhhhhhhhhhhhhhhhhhkko'],
  [9, 6, 'okhhhhhhhhhhhhhhhhhhhhhhhkko'],
  // bangs: three clumps with strand gaps (k)
  [10, 10, 'hhhkhhhkhhhhkhhhkhhh'],
  [11, 10, 'hhksssssskhhkssssskhh'.slice(0, 20)],
  [12, 10, 'hssssssssskksssssssssh'.slice(0, 20)],
  // face
  [13, 10, 'ssssssssssssssssssss'],
  [14, 10, 'ssssssssssssssssssss'],
  [15, 10, 'ssssssssssssssssssss'],
  [16, 10, 'ssssssssssssssssssss'],
  [17, 10, 'ssssssssssssssssssss'],
  [18, 10, 'ssssssssssssssssssss'],
  [19, 10, 'Sssssssssssssssssss'.padEnd(19, 's') + 'S'],
  [20, 10, 'oSssssssssssssssssSo'],
  [21, 12, 'oooooooooooooooo'],
  // locks framing the cheeks (in front of the back hair)
  ...[10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].flatMap((y) => {
    const left = [y, 7, y < 14 ? 'lhk' : y < 18 ? 'hhk' : 'hk'];
    const right = mirror(left);
    return [left, [right[0], right[1], right[2].replace(/l/g, 'k')]];
  })
];

export const base = paint([...hairBack, ...body, ...head]);

// ---------- overlays ----------
// { x, y, rows, mirror?, shift?, face?, head? } — face pieces move 2px and
// head pieces 1px when she turns her head.

const sleeveRest = ['oo.', 'occo', 'occo', 'oCco', 'oCco', 'oCco', 'oCco', 'oCco', 'oCco', 'occo', 'occo', 'oTTo', 'osso', 'osso', '.oo.'];
const sleeveUp = ['.oso', '.oso', '.oco', 'occo', 'occo', 'occo', 'occo', '.occo', '.occo', '..occo', '...oco'];
// Hands clasped in front (happy / heart).
const sleeveClasp = ['oo...', 'occo.', 'occo.', 'oCco.', 'oCco.', '.oCco', '.oCcco', '..occco', '...ossso', '....oso'];

const feature = (rows) => [{ x: 10, y: 12, rows, face: true }];
const blush = '..bb............bb..';
const mouth = '.........mm.........';
const smile = '........m..m........';
const blank = '....................';

const headsetHalf = [
  '..........xxxxx',
  '........xxXXXXX',
  '......xxXX.....',
  '.....xXX.......',
  '....xXX........',
  '...xXX.........',
  '...xX..........',
  '..xXx..........',
  '..xX...........',
  '.xxxxx.........',
  'xXXXXx.........',
  'xXxxXx.........',
  'xXxxXx.........',
  'xXxxXx.........',
  'xXXXXx.........',
  '.xxxx..........',
  '..x............',
  '...x...........',
  '....xx.........',
  '......xG.......'
];

const glowHalf = headsetHalf.map((row, y) =>
  [...row]
    .map((ch, x) => {
      if (y >= 10 && y <= 14 && (x === 1 || x === 4) && ch === 'X') return 'g';
      if (y === 1 && ch === 'X') return 'g';
      if (ch === 'G') return 'G';
      return '.';
    })
    .join('')
);

const catEar = ['..xx.......', '.xGGx......', 'xGGGGx.....', 'xGGGXx..xxx', 'xxxxxxxxXXX'];

export const overlays = {
  armsRest: [
    { x: 8, y: 23, rows: sleeveRest },
    { x: 8, y: 23, rows: sleeveRest, mirror: true }
  ],
  armsClasp: [
    { x: 8, y: 23, rows: sleeveClasp },
    { x: 8, y: 23, rows: sleeveClasp, mirror: true }
  ],
  armsUp: [
    { x: 6, y: 13, rows: sleeveUp },
    { x: 6, y: 13, rows: sleeveUp, mirror: true }
  ],
  // Feet kicking while carried.
  legsDangle: [
    { x: 12, y: 49, rows: ['.......', 'offfffo', 'ofTfffo', 'oFFFFFo', 'ooooooo'] },
    { x: 21, y: 48, rows: ['offfffo', 'ofTfffo', 'oFFFFFo', 'ooooooo', '.......'] }
  ],

  faceOpen: feature(['..eeeee......eeeee..', '...iwii......iwii...', '...iiIi......iiIi...', '....II........II....', blush, mouth, blank]),
  faceOpenO: feature(['..eeeee......eeeee..', '...iwii......iwii...', '...iiIi......iiIi...', '....II........II....', blush, mouth, mouth]),
  faceUp: feature(['..eeeee......eeeee..', '...wiii......wiii...', '...iiii......iiii...', blank, blush, mouth, mouth]),
  faceFocus: feature([blank, '..eeeee......eeeee..', '...iwIi......iwIi...', blank, blush, mouth, blank]),
  faceClosed: feature([blank, blank, '...eeee......eeee...', blank, blush, mouth, blank]),
  faceClosedO: feature([blank, blank, '...eeee......eeee...', blank, blush, mouth, mouth]),
  faceHappy: feature([blank, '....e..........e....', '...e.e........e.e...', blank, blush, smile, mouth]),

  blink: feature(['..sssss......sssss..', '...ssss......ssss...', '...eeee......eeee...', '....ss........ss....', blank, blank, blank]),

  headset: [
    { x: 5, y: 0, rows: headsetHalf, head: true },
    { x: 5, y: 0, rows: headsetHalf.slice(0, 16), mirror: true, head: true }
  ],
  catband: [
    { x: 9, y: -2, rows: catEar, head: true },
    { x: 9, y: -2, rows: catEar, mirror: true, head: true }
  ],
  glow: [
    { x: 5, y: 0, rows: glowHalf, head: true },
    { x: 5, y: 0, rows: glowHalf.slice(0, 16), mirror: true, head: true }
  ]
};

// ---------- states (all front-facing) ----------
const f = (layers, ms, dy = 0) => ({ layers, ms, dy });

export const states = {
  idle: { turn: true, loop: [f(['armsRest', 'faceOpen'], 700), f(['armsRest', 'faceOpen'], 600, 1)] },
  // Focus: calm, half-lidded concentration with a slow breath.
  focus: { turn: true, loop: [f(['armsRest', 'faceFocus'], 900), f(['armsRest', 'faceFocus'], 900, 1)] },
  penDown: { loop: [f(['armsClasp', 'faceHappy'], 420), f(['armsClasp', 'faceHappy'], 420, 1)] },
  sip: { loop: [f(['armsClasp', 'faceClosed'], 520), f(['armsClasp', 'faceClosed'], 520, 1)] },
  lookUp: { turn: true, loop: [f(['armsRest', 'faceUp'], 600), f(['armsRest', 'faceUp'], 600)] },
  windowGaze: { loop: [f(['armsRest', 'faceOpen'], 700), f(['armsRest', 'faceOpen'], 700, 1)], fixedTurn: 1 },
  sleep: { loop: [f(['armsRest', 'faceClosed'], 900, 1), f(['armsRest', 'faceClosedO'], 900, 2)] },
  dragged: { loop: [f(['armsUp', 'legsDangle', 'faceClosedO'], 180), f(['armsUp', 'faceClosedO'], 180, 1)] },
  celebrate: {
    loop: [f(['armsUp', 'faceHappy'], 120, -1), f(['armsUp', 'faceHappy'], 120, -3), f(['armsUp', 'faceHappy'], 160, 0)]
  },
  heart: { turn: true, loop: [f(['armsClasp', 'faceHappy'], 300), f(['armsClasp', 'faceHappy'], 300, 1)] }
};

export const layerCells = {
  blink: ['blink'],
  'headwear:headset': ['headset'],
  'headwear:catband': ['catband'],
  glow: ['glow']
};

// ---------- customisable slots ----------
const swap = (keys, colors) => Object.fromEntries(keys.map((key, i) => [palette[key], colors[i]]));
const HAIR = ['k', 'h', 'l', 'L'];
const OUTFIT = ['c', 'C', 't', 'T'];
const LED = ['g', 'G'];

export const slots = {
  hair: {
    label: '머리색',
    variants: {
      lilac: { label: '라일락', recolor: {} },
      pink: { label: '네온 핑크', recolor: swap(HAIR, ['#8a2e6b', '#d65ca8', '#f08cc8', '#ffd6ee']) },
      silver: { label: '실버', recolor: swap(HAIR, ['#5a5f7a', '#a8adc8', '#cfd3e8', '#ffffff']) },
      mint: { label: '민트', recolor: swap(HAIR, ['#2b6b6b', '#4fb8a8', '#8fe0d0', '#e0fff8']) },
      brown: { label: '브라운', recolor: swap(HAIR, ['#4a2418', '#7a3e2a', '#a85a3c', '#d9926a']) },
      ink: { label: '흑발', recolor: swap(HAIR, ['#15121f', '#2e2944', '#4a4270', '#8a80c0']) }
    }
  },
  outfit: {
    label: '후드',
    variants: {
      violet: { label: '바이올렛 후드', recolor: {} },
      black: { label: '블랙 테크웨어', recolor: swap(OUTFIT, ['#26222e', '#16141c', '#4fe8f7', '#ff5ad0']) },
      teal: { label: '시안 후드', recolor: swap(OUTFIT, ['#1f6b80', '#164d5c', '#ffe14f', '#ff5ad0']) },
      cardigan: {
        label: '니트 가디건',
        recolor: swap(OUTFIT, ['#f0e0c8', '#d8c2a0', '#c27a4a', '#e8486e']),
        unlock: 'outfit-knit-cardigan'
      }
    }
  },
  headwear: {
    label: '머리 장식',
    variants: {
      headset: { label: 'LED 헤드셋', layer: 'headwear:headset' },
      catband: { label: '고양이 머리띠', layer: 'headwear:catband' },
      none: { label: '없음', layer: null }
    }
  },
  led: {
    label: 'LED',
    variants: {
      cyan: { label: '시안', recolor: {} },
      magenta: { label: '마젠타', recolor: swap(LED, ['#ff5ad0', '#4fe8f7']) },
      gold: { label: '골드', recolor: swap(LED, ['#ffd34f', '#ff8a3d']) }
    }
  }
};

export const meta = {
  id: 'miso',
  name: '미소',
  license: 'Original artwork for Study Companion Pet',
  credit: { author: 'Study Companion Pet', url: '' },
  padTop: 4,
  // Where the 40x60 frame (with padding) sits in the scene; soles at y=57.
  origin: [4, 0]
};
