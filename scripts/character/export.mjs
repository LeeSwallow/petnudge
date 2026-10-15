// <id>.aseprite or <id>.pxo + <id>.pack.json → character.json + sheet.png.
//
// 1. read the layer list (source.mjs: Aseprite or Pixelorama) and check names (check.mjs)
// 2. register new slot variants / expressions from layer names (discover.mjs),
//    saving them back into the pack so they show up there for editing
// 3. export every layer as a cell of one packed sheet
// 4. check the pack against the cells, then write the outputs
//
// Only pixels and JSON come out; imported packs never execute Lua or JS.
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { editorFor } from './source.mjs';
import { checkLayers, checkPack } from './check.mjs';
import { discover } from './discover.mjs';

const fail = (errors) => {
  throw new Error(`캐릭터를 내보내지 못했어요:\n- ${errors.join('\n- ')}`);
};

export const exportCharacter = async (source, manifest, outputDir, { log = console } = {}) => {
  const pack = JSON.parse(await readFile(manifest, 'utf8'));
  const editor = editorFor(source);
  const info = await editor.inspect(source);
  const layers = checkLayers(pack, info);
  if (layers.errors.length) fail(layers.errors);
  layers.warnings.forEach((w) => log.warn(`! ${w}`));

  const live = info.layers.map((l) => l.name);
  const added = discover(pack, live);
  if (added.length) {
    await writeFile(manifest, `${JSON.stringify(pack, null, 2)}\n`);
    added.forEach((a) => log.log(`+ 팩에 추가했어요: ${a}`));
  }

  const temporary = await mkdtemp(path.join(os.tmpdir(), 'study-character-'));
  try {
    const { sheet, frames } = await editor.exportSheet(source, temporary);
    const cells = {};
    for (const name of live) {
      const f = frames[name];
      if (!f) continue;
      if (f.w !== pack.frame.w || f.h !== pack.frame.h) fail([`레이어 ${name}: ${f.w}×${f.h}, 프레임 ${pack.frame.w}×${pack.frame.h}와 달라요`]);
      cells[name] = [f.x, f.y];
    }
    const checked = checkPack(pack, cells);
    if (checked.errors.length) fail(checked.errors);
    checked.warnings.forEach((w) => log.warn(`! ${w}`));

    const result = { ...pack, sheet: 'sheet.png', cells };
    await mkdir(outputDir, { recursive: true });
    await writeFile(path.join(outputDir, 'sheet.png'), await readFile(sheet));
    await writeFile(path.join(outputDir, 'character.json'), `${JSON.stringify(result, null, 2)}\n`);
    return result;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
};
