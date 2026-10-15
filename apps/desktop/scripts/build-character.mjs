import { findAseprite } from './character/aseprite.mjs';
import { toPxo } from './character/convert.mjs';
import { exportCharacter } from './character/export.mjs';
import { sourceIn } from './character/source.mjs';
import { watchCharacter } from './character/watch.mjs';
// Builds a layered character (pack format study-pet-character@2):
//   assets/characters/<id>/<id>.aseprite|.pxo  pixels, one layer per cell (source of truth)
//   assets/characters/<id>/<id>.pack.json      layers order, regions, states, slots
// into character.json + sheet.png, which the renderer imports.
// Editing guide: assets/characters/README.md
//
// usage: node scripts/build-character.mjs <id> [--watch] [--to-pxo] [--import <dir of layer pngs>]
//   --watch   re-export on every save (the running app reloads the pet)
//   --to-pxo  write <id>.pxo from the current source, for Pixelorama
//   --import  creates <id>.aseprite from <name>.png files first (one-time).
// The source is the pack's `source` file, else <id>.aseprite, else <id>.pxo.
// .aseprite needs the Aseprite CLI (ASEPRITE=/path/to/aseprite, or the usual
// macOS install locations); .pxo is read directly.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const id = process.argv[2];
if (!id) throw new Error('usage: node scripts/build-character.mjs <id> [--import <dir>]');
const dir = path.resolve('assets/characters', id);
let source = path.join(dir, `${id}.aseprite`);
const fail = (message) => {
  console.error(`✗ ${message}`);
  process.exit(1);
};

const run = (args) => execFileSync(findAseprite(), ['-b', ...args], { stdio: ['ignore', 'pipe', 'inherit'] });

const pack = JSON.parse(readFileSync(path.join(dir, `${id}.pack.json`), 'utf8'));

// ---------- optional one-time import from PNG layers ----------
const importAt = process.argv.indexOf('--import');
if (importAt > 0) {
  const pngDir = path.resolve(process.argv[importAt + 1] ?? fail('--import needs a directory'));
  const names = readdirSync(pngDir).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4));
  // Back-to-front by the pack's layer order, then by name inside a layer.
  // "<layer>[.<variant>][#<pose>|@<head>]", e.g. body#stretch, face.smile@turnR
  const rank = (name) => {
    const base = name.split(/[@#]/)[0];
    return pack.layers.findIndex((l) => base === l.id || base.startsWith(`${l.id}.`));
  };
  names.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  if (names.some((n) => rank(n) < 0)) fail(`layers not in ${id}.pack.json: ${names.filter((n) => rank(n) < 0).join(', ')}`);
  // Visible by default: the first variant of each slot (faces start hidden).
  const visible = pack.layers.flatMap((l) => {
    if (!l.from) return [l.id];
    if (l.from === 'face') return [];
    const first = Object.keys(pack.slots[l.id].variants).find((v) => names.includes(`${l.id}.${v}`));
    return first ? [`${l.id}.${first}`] : [];
  });
  run([
    '--script-param', `dir=${pngDir}`,
    '--script-param', `out=${source}`,
    '--script-param', `order=${names.join(',')}`,
    '--script-param', `visible=${visible.join(',')}`,
    '--script', path.resolve('scripts/aseprite/import-layers.lua')
  ]);
  console.log(`✓ imported ${names.length} layers into ${path.relative(process.cwd(), source)}`);
}
if (importAt < 0) {
  try { source = sourceIn(dir, id, pack); } catch (error) { fail(error.message); }
}
if (!existsSync(source)) fail(`${source} not found (create it with --import <dir>)`);
if (process.argv.includes('--to-pxo')) {
  const out = path.join(dir, `${id}.pxo`);
  const count = await toPxo(source, out).catch((error) => fail(error.message));
  console.log(`✓ ${path.relative(process.cwd(), out)}: 레이어 ${count}개 (Pixelorama로 편집하려면 팩에 "source": "${id}.pxo")`);
  process.exit(0);
}

const build = async () => {
  const result = await exportCharacter(source, path.join(dir, `${id}.pack.json`), dir);
  console.log(`✓ ${new Date().toLocaleTimeString()} ${id}: 레이어 ${Object.keys(result.cells).length}개 → character.json + sheet.png`);
};
if (process.argv.includes('--watch')) await watchCharacter(dir, id, path.basename(source), build);
else await build().catch((error) => fail(error.message));
