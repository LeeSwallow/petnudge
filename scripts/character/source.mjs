// The editor file behind a character: Aseprite (.aseprite, via its CLI) or
// Pixelorama (.pxo, read directly). Both give the same two operations:
//   inspect(file)          → { width, height, frames, layers: [{ name, group, visible, empty }] }
//   exportSheet(file, dir) → { sheet: <png path>, frames: { [layer]: { x, y, w, h } } }
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as aseprite from './aseprite.mjs';
import { readPxo } from './pxo.mjs';
import { encodePng } from './png.mjs';

const pixelorama = {
  inspect: async (file) => {
    const { layers, ...info } = await readPxo(file);
    return { ...info, layers: layers.map(({ rgba, ...l }) => l) };
  },
  // every layer side by side in a grid, one frame-sized cell each
  exportSheet: async (file, dir) => {
    const { width, height, layers } = await readPxo(file);
    const cols = Math.ceil(Math.sqrt(layers.length)), rows = Math.ceil(layers.length / cols);
    const sheetW = cols * width, sheet = new Uint8Array(sheetW * rows * height * 4), frames = {};
    layers.forEach(({ name, rgba }, i) => {
      const x = (i % cols) * width, y = Math.floor(i / cols) * height;
      for (let row = 0; row < height; row++) sheet.set(rgba.subarray(row * width * 4, (row + 1) * width * 4), ((y + row) * sheetW + x) * 4);
      frames[name] = { x, y, w: width, h: height };
    });
    const out = path.join(dir, 'sheet.png');
    await writeFile(out, encodePng(sheetW, rows * height, sheet));
    return { sheet: out, frames };
  }
};

export const editorFor = (file) => {
  if (file.endsWith('.pxo')) return pixelorama;
  if (file.endsWith('.aseprite') || file.endsWith('.ase')) return aseprite;
  throw new Error(`지원하지 않는 원본 형식이에요: ${path.basename(file)} (.aseprite 또는 .pxo)`);
};

// The character's editor file: the pack's `source` if set, else <id>.aseprite, else <id>.pxo.
export const sourceIn = (dir, id, pack) => {
  const candidates = pack?.source ? [pack.source] : [`${id}.aseprite`, `${id}.pxo`];
  const found = candidates.map((f) => path.join(dir, f)).find((f) => existsSync(f));
  if (!found) throw new Error(`원본 파일이 없어요: ${candidates.join(' 또는 ')}`);
  return found;
};
