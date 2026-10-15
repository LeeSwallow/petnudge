// Bakes a character authored as pixel maps (assets/characters/<id>/art.mjs)
// into sheet.png + character.json — the same format a hand-drawn sprite sheet
// would use. Also writes preview.png (scaled, all states) for review.
//
// usage: node scripts/bake-character.mjs miso
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { deflateSync } from 'node:zlib';

const id = process.argv[2] ?? 'miso';
const dir = path.resolve('assets/characters', id);
const art = await import(pathToFileURL(path.join(dir, 'art.mjs')).href);
const { FRAME, HEAD_ROWS, palette, base, overlays, states, layerCells, slots, meta } = art;
const { w: W } = FRAME;
// Empty rows above the art so tall headwear (cat ears) has room.
const PAD = meta.padTop ?? 0;
const H = FRAME.h + PAD;

// ---------- validation ----------
const fail = (message) => {
  console.error(`✗ ${message}`);
  process.exit(1);
};
if (base.length !== FRAME.h) fail(`base has ${base.length} rows, expected ${FRAME.h}`);
base.forEach((row, y) => row.length !== W && fail(`base row ${y} has ${row.length} px: "${row}"`));
const checkKeys = (rows, where) =>
  rows.forEach((row) => [...row].forEach((ch) => ch !== '.' && !palette[ch] && fail(`unknown key "${ch}" in ${where}`)));
checkKeys(base, 'base');
for (const [name, pieces] of Object.entries(overlays)) pieces.forEach((p) => checkKeys(p.rows, name));

// ---------- composition (grid of palette keys, null = transparent) ----------
const blankGrid = () => Array.from({ length: H }, () => Array(W).fill(null));

const put = (grid, x, y, key) => {
  const py = y + PAD;
  if (key === '.' || x < 0 || py < 0 || x >= W || py >= H) return;
  grid[py][x] = key;
};

const drawPiece = (grid, piece, turn) => {
  const dx = piece.face ? turn * 2 : piece.head ? turn : 0;
  piece.rows.forEach((row, ry) =>
    [...row].forEach((key, rx) => {
      const x = piece.mirror ? W - 1 - (piece.x + rx) + (piece.shift ?? 0) : piece.x + rx;
      put(grid, x + dx, piece.y + ry, key);
    })
  );
};

const composeFrame = (layers, turn) => {
  const grid = blankGrid();
  base.forEach((row, y) => [...row].forEach((key, x) => put(grid, x + (y < HEAD_ROWS ? turn : 0), y, key)));
  for (const name of layers) {
    if (!overlays[name]) fail(`unknown overlay "${name}"`);
    overlays[name].forEach((piece) => drawPiece(grid, piece, turn));
  }
  return grid;
};

const composeLayer = (layers, turn) => {
  const grid = blankGrid();
  for (const name of layers) overlays[name].forEach((piece) => drawPiece(grid, piece, turn));
  return grid;
};

// ---------- cells ----------
const cells = [];
const addCell = (grid) => cells.push(grid) - 1;
const TURNS = { '': 0, '@left': -1, '@right': 1 };

const outStates = {};
for (const [name, state] of Object.entries(states)) {
  const variants = state.turn ? Object.entries(TURNS) : [['', state.fixedTurn ?? 0]];
  for (const [suffix, turn] of variants) {
    const phases = {};
    for (const phase of ['start', 'loop', 'end']) {
      if (!state[phase]) continue;
      phases[phase] = state[phase].map((frame) => ({ cell: addCell(composeFrame(frame.layers, turn)), ms: frame.ms, dy: frame.dy }));
    }
    if (!state.turn && turn !== 0) phases.turn = turn;
    outStates[name + (suffix && turn !== 0 ? suffix : '')] = phases;
  }
}

const outLayers = {};
for (const [name, layers] of Object.entries(layerCells)) {
  outLayers[name] = Object.fromEntries(Object.entries(TURNS).map(([suffix, turn]) => [suffix.slice(1) || 'center', addCell(composeLayer(layers, turn))]));
}

// ---------- sheet ----------
const COLUMNS = 8;
const rowsCount = Math.ceil(cells.length / COLUMNS);
const sheetW = COLUMNS * W;
const sheetH = rowsCount * H;
const pixels = new Uint8Array(sheetW * sheetH * 4);
const hex = (value) => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));

cells.forEach((grid, index) => {
  const ox = (index % COLUMNS) * W;
  const oy = Math.floor(index / COLUMNS) * H;
  grid.forEach((row, y) =>
    row.forEach((key, x) => {
      if (!key) return;
      const [r, g, b] = hex(palette[key]);
      const at = ((oy + y) * sheetW + ox + x) * 4;
      pixels.set([r, g, b, 255], at);
    })
  );
});

// Minimal PNG encoder (RGBA8, no filtering).
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};
const encodePng = (width, height, rgba) => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
};

writeFileSync(path.join(dir, 'sheet.png'), encodePng(sheetW, sheetH, pixels));

const character = {
  format: 'study-pet-character@1',
  ...meta,
  frame: { w: W, h: H },
  sheet: 'sheet.png',
  columns: COLUMNS,
  states: outStates,
  layers: outLayers,
  slots,
  fallback: 'idle'
};
writeFileSync(path.join(dir, 'character.json'), JSON.stringify(character, null, 2));

// ---------- preview: every cell at 6x with labels-free grid ----------
const SCALE = 6;
const previewW = sheetW * SCALE;
const previewH = sheetH * SCALE;
const preview = new Uint8Array(previewW * previewH * 4);
for (let y = 0; y < previewH; y += 1) {
  for (let x = 0; x < previewW; x += 1) {
    const src = (Math.floor(y / SCALE) * sheetW + Math.floor(x / SCALE)) * 4;
    const dst = (y * previewW + x) * 4;
    const checker = (Math.floor(x / (W * SCALE)) + Math.floor(y / (H * SCALE))) % 2 ? 40 : 52;
    if (pixels[src + 3]) preview.set(pixels.subarray(src, src + 4), dst);
    else preview.set([checker, checker - 8, checker + 20, 255], dst);
  }
}
writeFileSync(path.join(dir, 'preview.png'), encodePng(previewW, previewH, preview));

console.log(`✓ ${id}: ${cells.length} cells, ${Object.keys(outStates).length} states → sheet.png ${sheetW}x${sheetH}`);
