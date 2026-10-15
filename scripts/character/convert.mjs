// Converts a character's editor file to Pixelorama (.pxo), keeping layer
// names, groups and visibility, so either editor can be used.
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { decodePng } from './png.mjs';
import { writePxo } from './pxo.mjs';
import { editorFor } from './source.mjs';

export const toPxo = async (source, output) => {
  const editor = editorFor(source);
  const info = await editor.inspect(source);
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'study-convert-'));
  try {
    const { sheet, frames } = await editor.exportSheet(source, temporary);
    const png = decodePng(await readFile(sheet));
    const layers = info.layers.map(({ name, group, visible }) => {
      const rgba = new Uint8Array(info.width * info.height * 4);
      const f = frames[name];
      if (f) for (let y = 0; y < info.height; y++) {
        rgba.set(png.rgba.subarray(((f.y + y) * png.width + f.x) * 4, ((f.y + y) * png.width + f.x + info.width) * 4), y * info.width * 4);
      }
      return { name, group, visible, rgba };
    });
    await writePxo(output, { width: info.width, height: info.height, layers });
    return layers.length;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
};
