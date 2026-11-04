// Contact sheet: every expression (and turned head), every frame of every
// state, composed the way the renderer does for one outfit, in one PNG grid
// at 3×. Cells are numbered (top-left digits); the numbers are listed in a
// sidecar .txt next to the PNG. For looking at a character's art all at once
// (colours that differ between poses, a misplaced eye highlight) without
// running the app.
//
// usage: node scripts/character/contact-sheet.mjs <id> [out.png] [--at <git-ref>] [--wear outer=none,headwear=none]
//   --at    renders the pack and the .pxo of that commit (with today's renderer code)
//   --wear  slot variants to wear (default: each slot's first variant, as the app)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { readPxo } from './pxo.mjs';
import { encodePng } from './png.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// The renderer's own composition code (TypeScript), bundled for Node.
const renderer = async () => {
  const contents = `
    export { layerCells, recolorsFor } from './src/shared/characterPack';
    export { drawView, frameAt } from './src/renderer/character/timeline';
    export { applyMoves, blank, clipTo, hexToPixel, over, recolor, rimUnder, shift } from './src/domain/character/pixels';`;
  const out = await build({ stdin: { contents, resolveDir: repo, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
};

// pack + .pxo of the working tree, or of a commit
export const loadCharacter = async (id, at) => {
  const rel = `assets/characters/${id}`;
  const read = (file) => (at ? execFileSync('git', ['show', `${at}:${rel}/${file}`], { cwd: repo, maxBuffer: 1 << 28 }) : readFileSync(path.join(repo, rel, file)));
  const pack = JSON.parse(read(`${id}.pack.json`).toString('utf8'));
  const source = pack.source ?? `${id}.pxo`;
  if (!source.endsWith('.pxo')) throw new Error(`.pxo 원본만 그릴 수 있어요: ${source}`);
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'contact-sheet-'));
  const file = path.join(tmp, source);
  writeFileSync(file, read(source));
  const pxo = await readPxo(file);
  const pictures = new Map(pxo.layers.map((l) => [l.name, { w: pxo.width, h: pxo.height, data: new Uint32Array(l.rgba.buffer.slice(l.rgba.byteOffset, l.rgba.byteOffset + l.rgba.length)) }]));
  pack.cells = Object.fromEntries(pxo.layers.map((l) => [l.name, [0, 0]]));
  return { pack, pictures, width: pxo.width, height: pxo.height };
};

const sum = (moves, names) => names.reduce(([x, y], n) => [x + (moves[n]?.[0] ?? 0), y + (moves[n]?.[1] ?? 0)], [0, 0]);

// frameFor in src/renderer/character.ts, minus caching, hit areas and the outline.
const composer = (r, { pack, pictures, width: W, height: H }, avatar) => {
  const cellPixels = (layer, cell) => {
    const px = { w: W, h: H, data: pictures.get(cell).data.slice() };
    const outfit = layer === 'outfit';
    for (const rc of r.recolorsFor(pack, avatar)) {
      if (!outfit && rc.layers && !rc.layers.includes(layer)) continue;
      r.recolor(px, new Map(Object.entries(rc.map).map(([a, b]) => [r.hexToPixel(a), r.hexToPixel(b)])), !outfit && rc.region ? pack.regions[rc.region] : undefined);
    }
    return px;
  };
  return (face, moves = {}, head, bodyPose) => {
    const out = r.blank(W, H);
    for (const { layer, cell, def, clip } of r.layerCells(pack, avatar, face, head, bodyPose)) {
      let px = cellPixels(layer, cell);
      const own = def.ignore ? Object.fromEntries(Object.entries(moves).filter(([k]) => !def.ignore.includes(k))) : moves;
      px = def.follow ? r.shift(px, sum(moves, def.follow)) : r.applyMoves(px, pack.regions, own);
      if (clip) px = r.clipTo(px, r.shift(cellPixels(layer, clip), sum(moves, def.clipFollow ?? def.follow ?? [])));
      if (def.edge) r.rimUnder(out, px, r.hexToPixel(def.edge.color), def.edge.opacity, def.edge.light ? r.hexToPixel(def.edge.light) : undefined);
      r.over(out, px);
    }
    return out;
  };
};

const mirror = ({ w, h, data }) => {
  const out = new Uint32Array(data.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = data[y * w + w - 1 - x];
  return { w, h, data: out };
};

// → [{ label, pixels }]: expressions (front, then each turned head), then every state frame
export const contactFrames = async (character, avatar = {}) => {
  const r = await renderer();
  const { pack } = character;
  const compose = composer(r, character, avatar);
  const frames = [];
  const view = (pose) => {
    const { head, moves, flip } = r.drawView(pack, pose);
    const px = compose(pose.face, moves, head, pose.pose);
    return flip ? mirror(px) : px;
  };
  const faces = pack.expressions ? Object.keys(pack.expressions) : ['open', ...Object.keys(pack.cells).filter((c) => c.startsWith('face.')).map((c) => c.slice(5))];
  for (const name of faces) {
    const [face, head] = name.split('@');
    frames.push({ label: `face ${name}`, pixels: view({ face, moves: {}, head }) });
  }
  // Glances (cursor near): the irises move a pixel inside their sockets.
  const withIris = (name) => !name.includes('@') && Object.entries(pack.expressions?.[name] ?? {}).some(([layer, v]) => v !== 'none' && pack.layers.find((l) => l.id === layer)?.clip);
  for (const name of faces.filter(withIris)) {
    for (const [dx, dy, dir] of [[-1, 0, 'left'], [1, 0, 'right'], [0, -1, 'up'], [0, 1, 'down']]) {
      frames.push({ label: `face ${name} glance ${dir}`, pixels: view({ face: name, moves: { eyes: [dx, dy] } }) });
    }
  }
  for (const [state, def] of Object.entries(pack.states)) {
    [...(def.start ?? []), ...def.loop].forEach((f, i) => {
      const face = f.face ?? def.face ?? 'open';
      const tags = [f.pose && `pose ${f.pose}`, f.head && `head ${f.head}`, f.flip && 'flip'].filter(Boolean).join(' ');
      frames.push({ label: `${state}[${i}] ${face}${tags ? ` ${tags}` : ''}`, pixels: view({ face, moves: { ...f.move }, head: f.head, pose: f.pose, flip: f.flip }) });
    });
  }
  return frames;
};

// 3×5 digits for the cell numbers
const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];

export const contactSheet = (frames, { w, h, scale = 3, cols = 8, background = 0xffd0c8c8 }) => {
  const pad = 4, cw = (w + pad) * scale, ch = (h + pad) * scale;
  const rows = Math.ceil(frames.length / cols), W = cols * cw, H = rows * ch;
  const data = new Uint32Array(W * H).fill(0xff3a3a3a);
  const dot = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) data[y * W + x] = c; };
  frames.forEach(({ pixels }, n) => {
    const ox = (n % cols) * cw + pad * scale / 2, oy = Math.floor(n / cols) * ch + pad * scale / 2;
    for (let y = 0; y < h * scale; y++) for (let x = 0; x < w * scale; x++) {
      const p = pixels.data[Math.floor(y / scale) * w + Math.floor(x / scale)];
      dot(ox + x, oy + y, p >>> 24 ? p : background);
    }
    String(n).split('').forEach((d, k) => {
      const bits = DIGITS[Number(d)];
      for (let i = 0; i < 15; i++) if (bits[i] === '1') for (let s = 0; s < 9; s++) dot(ox + 2 + k * 12 + (i % 3) * 3 + (s % 3), oy + 2 + Math.floor(i / 3) * 3 + Math.floor(s / 3), 0xff000000);
    });
  });
  const rgba = new Uint8Array(data.buffer);
  return encodePng(W, H, rgba);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
  const at = flag('--at');
  const wear = flag('--wear');
  const [id, outArg] = args;
  if (!id) throw new Error('usage: node scripts/character/contact-sheet.mjs <id> [out.png] [--at <git-ref>] [--wear slot=id,...]');
  const avatar = Object.fromEntries((wear ?? '').split(',').filter(Boolean).map((p) => p.split('=')));
  const character = await loadCharacter(id, at);
  const frames = await contactFrames(character, avatar);
  const out = path.resolve(outArg ?? `${id}${at ? `-${at}` : ''}-contact.png`);
  writeFileSync(out, contactSheet(frames, { w: character.width, h: character.height }));
  writeFileSync(out.replace(/\.png$/, '.txt'), `${frames.map((f, i) => `${i}\t${f.label}`).join('\n')}\n`);
  console.log(`${out} (${frames.length} frames)`);
}
