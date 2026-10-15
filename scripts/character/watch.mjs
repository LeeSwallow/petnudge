// Re-exports whenever the editor file (.aseprite / .pxo) or the pack is saved. The running app
// (npm start) watches the built character.json and reloads the pet.
import { watch } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const watchCharacter = (dir, id, sourceFile, build) => {
  const sources = new Set([sourceFile, `${id}.pack.json`]);
  let timer = null, running = false, again = false, lastPack = '';
  const rebuild = async () => {
    if (running) { again = true; return; }
    running = true;
    try {
      await build();
    } catch (error) {
      console.error(`✗ ${error.message}`);
    } finally {
      // the exporter may write new entries into the pack; don't rebuild for that
      lastPack = await readFile(path.join(dir, `${id}.pack.json`), 'utf8').catch(() => '');
      running = false;
      if (again) { again = false; rebuild(); }
    }
  };
  watch(dir, async (_event, file) => {
    if (!file || !sources.has(String(file))) return;
    if (String(file).endsWith('.pack.json') && await readFile(path.join(dir, String(file)), 'utf8').catch(() => '') === lastPack) return;
    clearTimeout(timer);
    timer = setTimeout(rebuild, 300); // Aseprite saves through a temp file
  });
  console.log(`… ${id}: ${sourceFile}을 저장하면 자동으로 내보내요 (Ctrl+C로 종료)`);
  return rebuild();
};
