import { existsSync, watch } from 'node:fs';
import { cp, mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parseMod, type ModInfo, type ModProblem } from '../shared/mods';

// Mod folders: built-in (shipped) and the user's, each `<id>/mod.json`.
// Validation happens here so the renderer only ever sees valid blocks.

const MAX_BYTES = 512 * 1024;

export const createModLibrary = (builtinRoot: string, userRoot: string, disabled: () => string[]) => {
  const readFolder = async (root: string, builtin: boolean, out: ModInfo[], problems: ModProblem[]) => {
    for (const id of await readdir(root).catch(() => [] as string[])) {
      if (id.startsWith('_') || id.startsWith('.')) continue; // _template, hidden
      const file = path.join(root, id, 'mod.json');
      if (!existsSync(file)) continue;
      try {
        const text = await readFile(file, 'utf8');
        if (text.length > MAX_BYTES) throw new Error('mod.json이 너무 커요');
        const mod = parseMod(JSON.parse(text));
        if (mod.id !== id) throw new Error(`폴더 이름(${id})과 모드 ID(${mod.id})가 달라요`);
        if (out.some((m) => m.mod.id === mod.id)) throw new Error(`같은 ID의 모드가 이미 있어요: ${mod.id}`);
        out.push({ mod, builtin, enabled: !disabled().includes(mod.id), path: file });
      } catch (error) {
        problems.push({ path: file, error: error instanceof Error ? error.message : String(error) });
      }
    }
  };

  const list = async () => {
    const mods: ModInfo[] = [];
    const problems: ModProblem[] = [];
    await readFolder(builtinRoot, true, mods, problems);
    await readFolder(userRoot, false, mods, problems);
    return { mods, problems };
  };

  // A new user mod from the template, under a free id.
  const create = async () => {
    await mkdir(userRoot, { recursive: true });
    const taken = new Set([...(await readdir(userRoot).catch(() => [])), ...(await readdir(builtinRoot).catch(() => []))]);
    let n = 1;
    while (taken.has(`my-mod-${n}`)) n++;
    const id = `my-mod-${n}`;
    const target = path.join(userRoot, id);
    await cp(path.join(builtinRoot, '_template'), target, { recursive: true });
    const file = path.join(target, 'mod.json');
    const mod = JSON.parse(await readFile(file, 'utf8'));
    mod.id = id;
    mod.name = `내 모드 ${n}`;
    const { writeFile } = await import('node:fs/promises');
    await writeFile(file, `${JSON.stringify(mod, null, 2)}\n`);
    return file;
  };

  // Calls back (debounced) when any user mod file changes.
  const watchUser = (onChange: () => void) => {
    let timer: NodeJS.Timeout | undefined;
    const start = () => {
      try {
        watch(userRoot, { recursive: true }, () => {
          clearTimeout(timer);
          timer = setTimeout(onChange, 250);
        });
      } catch { /* the folder appears on the first create */ }
    };
    void mkdir(userRoot, { recursive: true }).then(start);
  };

  return { list, create, watchUser };
};
