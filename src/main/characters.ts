import { localizedText, t } from '../i18n';
import { existsSync } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, readdir, rename, rm, mkdtemp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { exportCharacter, sourceIn } from '../../scripts/export-character.mjs';
import { validateImportedPack, type CharacterAsset, type CharacterChoice } from '../shared/characterImport';

const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-z][a-z0-9-]{0,47}$/.test(id);
const readLimited = async (file: string, limit: number) => {
  const info = await lstat(file);
  if (!info.isFile() || info.size > limit) throw new Error(t('error.character.fileKind'));
  return readFile(file);
};
const exists = async (file: string) => lstat(file).then((s) => s.isFile()).catch(() => false);

export const readCharacterAsset = async (dir: string): Promise<CharacterAsset> => {
  const [json, png] = await Promise.all([readLimited(path.join(dir, 'character.json'), 1024 * 1024), readLimited(path.join(dir, 'sheet.png'), 8 * 1024 * 1024)]);
  if (png.length < 33 || png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || png.toString('ascii', 12, 16) !== 'IHDR') throw new Error(t('error.character.notSheet'));
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  if (width < 1 || height < 1 || width > 2048 || height > 2048) throw new Error(t('error.character.pngTooBig'));
  return { pack: validateImportedPack(JSON.parse(json.toString('utf8')), width, height), sheetUrl: `data:image/png;base64,${png.toString('base64')}` };
};

// Source is editable; runtime is replaced only after a complete export validates.
// Built-in characters are the folders under `builtinRoot` (lila, moa, ...),
// each with character.json + sheet.png and its editor file (.aseprite or
// .pxo, the pack's `source`). `editBuiltinInPlace` (dev): a built-in is edited
// and rebuilt in its own folder, the one source of truth, instead of a copy
// under userData.
export const createCharacterLibrary = (root: string, builtinRoot: string, { editBuiltinInPlace = false } = {}) => {
  const builtinIds = async () => (await readdir(builtinRoot).catch(() => [] as string[]))
    .filter((id) => validId(id) && existsSync(path.join(builtinRoot, id, 'character.json')));
  const isBuiltin = async (id: unknown) => validId(id) && (await builtinIds()).includes(id);
  const builtinDir = (id: string) => path.join(builtinRoot, id);
  const builtinSource = async (id: string) => {
    const manifest = path.join(builtinDir(id), `${id}.pack.json`);
    const pack = JSON.parse((await readFile(manifest, 'utf8')));
    const names = pack.source ? [pack.source] : [`${id}.aseprite`, `${id}.pxo`];
    const source = names.map((n: string) => path.join(builtinDir(id), path.basename(n))).find((f: string) => existsSync(f));
    if (!source) throw new Error(t('error.character.noSource'));
    return { source, manifest };
  };
  const folder = (id: unknown) => {
    if (!validId(id)) throw new Error(t('error.character.badId'));
    return path.join(root, id);
  };
  const sourcePaths = (dir: string, id: string, ext = '.aseprite') => {
    const pxo = path.join(dir, 'source', `${id}.pxo`);
    return { source: ext === '.aseprite' && existsSync(pxo) ? pxo : path.join(dir, 'source', `${id}${ext}`), manifest: path.join(dir, 'source', 'pack.json') };
  };
  const load = async (id: unknown): Promise<CharacterAsset> => {
    const dir = folder(id);
    const runtime = path.join(dir, 'runtime');
    const builtin = await isBuiltin(id) && (editBuiltinInPlace || !await exists(path.join(runtime, 'character.json')));
    const asset = await readCharacterAsset(builtin ? builtinDir(String(id)) : runtime);
    if (asset.pack.id !== id) throw new Error(t('error.character.folderMismatch'));
    return asset;
  };
  const list = async (): Promise<CharacterChoice[]> => {
    const builtins = await builtinIds();
    const ids = [...builtins, ...(await readdir(root).catch(() => [])).filter((id) => !builtins.includes(id) && validId(id))];
    const choices: CharacterChoice[] = [];
    for (const id of ids) {
      try {
        const { pack } = await load(id);
        const files = sourcePaths(folder(id), id);
        const builtin = builtins.includes(id);
        choices.push({ id, name: pack.name, persona: localizedText(pack.persona, pack.lang), builtin, editable: builtin || await exists(files.source) && await exists(files.manifest) });
      } catch { /* A broken custom pack must not prevent the default from loading. */ }
    }
    return choices;
  };
  const prepareSource = async (id: unknown) => {
    const dir = folder(id);
    const builtin = await isBuiltin(id);
    if (builtin && editBuiltinInPlace) return builtinSource(String(id));
    let files = sourcePaths(dir, String(id));
    if (builtin && !await exists(files.source)) {
      const original = await builtinSource(String(id));
      files = sourcePaths(dir, String(id), path.extname(original.source));
      await mkdir(path.join(dir, 'source'), { recursive: true });
      await copyFile(original.source, files.source);
      await copyFile(original.manifest, files.manifest);
    }
    if (!await exists(files.source) || !await exists(files.manifest)) throw new Error(t('error.character.packNoSource'));
    return files;
  };
  // The editor files behind a character, read only (nothing is copied): the
  // user's own source if there is one, else a built-in's.
  const sourceOf = async (id: unknown) => {
    const files = sourcePaths(folder(id), String(id));
    if (await exists(files.source) && await exists(files.manifest)) return files;
    if (await isBuiltin(id)) return builtinSource(String(id));
    throw new Error(t('error.character.characterNoSource'));
  };
  const rebuild = async (id: unknown) => {
    const dir = folder(id);
    const files = await prepareSource(id);
    if (await isBuiltin(id) && editBuiltinInPlace) {
      await exportCharacter(files.source, files.manifest, builtinDir(String(id)));
      return readCharacterAsset(builtinDir(String(id)));
    }
    await readLimited(files.source, 32 * 1024 * 1024);
    await readLimited(files.manifest, 1024 * 1024);
    const stage = await mkdtemp(path.join(os.tmpdir(), 'study-pack-build-'));
    try {
      await exportCharacter(files.source, files.manifest, stage);
      const asset = await readCharacterAsset(stage);
      if (asset.pack.id !== id) throw new Error(t('error.character.idChanged'));
      // Stage and rename on the same volume; retain the previous runtime on failure.
      const pending = path.join(dir, `.runtime-${randomUUID()}`);
      const runtime = path.join(dir, 'runtime');
      const previous = path.join(dir, `.previous-${randomUUID()}`);
      await mkdir(pending);
      await copyFile(path.join(stage, 'character.json'), path.join(pending, 'character.json'));
      await copyFile(path.join(stage, 'sheet.png'), path.join(pending, 'sheet.png'));
      const hadRuntime = await exists(path.join(runtime, 'character.json'));
      if (hadRuntime) await rename(runtime, previous);
      try { await rename(pending, runtime); }
      catch (error) { if (hadRuntime) await rename(previous, runtime); throw error; }
      if (hadRuntime) await rm(previous, { recursive: true, force: true });
      return asset;
    } finally { await rm(stage, { recursive: true, force: true }); }
  };
  const importFolder = async (input: string) => {
    await mkdir(root, { recursive: true });
    const stage = path.join(root, `.import-${randomUUID()}`);
    await mkdir(path.join(stage, 'source'), { recursive: true });
    try {
      const entries = await readdir(input);
      const manifestName = entries.find((n) => /^[a-z][a-z0-9-]{0,47}\.pack\.json$/.test(n));
      let id: string;
      if (await exists(path.join(input, 'character.json'))) {
        const { pack } = await readCharacterAsset(input);
        id = pack.id;
        await mkdir(path.join(stage, 'runtime'));
        for (const n of ['character.json', 'sheet.png']) await copyFile(path.join(input, n), path.join(stage, 'runtime', n));
      } else {
        if (!manifestName) throw new Error(t('error.character.pickFolder'));
        const manifest = JSON.parse((await readLimited(path.join(input, manifestName), 1024 * 1024)).toString('utf8'));
        id = manifest.id;
        if (!validId(id)) throw new Error(t('error.character.badId'));
        const original = sourceIn(input, id, manifest);
        await readLimited(original, 32 * 1024 * 1024);
        await exportCharacter(original, path.join(input, manifestName), path.join(stage, 'runtime'));
        await readCharacterAsset(path.join(stage, 'runtime'));
      }
      if (await isBuiltin(id) || await lstat(folder(id)).then(() => true).catch(() => false)) throw new Error(t('error.character.exists'));
      const manifest = manifestName ? JSON.parse((await readLimited(path.join(input, manifestName), 1024 * 1024)).toString('utf8')) : undefined;
      const original = manifest ? (() => { try { return sourceIn(input, id, manifest); } catch { return undefined; } })() : undefined;
      if (manifest && original) {
        if (manifest.id !== id) throw new Error(t('error.character.manifestMismatch'));
        const files = sourcePaths(stage, id, path.extname(original));
        await readLimited(original, 32 * 1024 * 1024);
        await copyFile(original, files.source);
        await copyFile(path.join(input, manifestName!), files.manifest);
      }
      await rename(stage, folder(id));
      return id;
    } finally { await rm(stage, { recursive: true, force: true }); }
  };
  // A new user character from an existing one: same source and pack under a
  // new id and name, built right away.
  const clone = async (fromId: unknown, name: unknown) => {
    if (typeof name !== 'string' || !name.trim() || name.length > 80) throw new Error(t('error.character.needName'));
    const from = await prepareSource(fromId);
    await mkdir(root, { recursive: true });
    const taken = new Set([...(await readdir(root).catch(() => [] as string[])), ...(await builtinIds())]);
    const base = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
    const stem = /^[a-z]/.test(base) ? base : String(fromId);
    let id = stem;
    for (let n = 2; taken.has(id); n++) id = `${stem}-${n}`;
    const ext = path.extname(from.source);
    const files = sourcePaths(folder(id), id, ext);
    await mkdir(path.dirname(files.source), { recursive: true });
    await copyFile(from.source, files.source);
    const pack = JSON.parse(await readFile(from.manifest, 'utf8'));
    pack.id = id;
    pack.name = name.trim();
    if (pack.source) pack.source = path.basename(files.source);
    await writeFile(files.manifest, `${JSON.stringify(pack, null, 2)}\n`);
    await rebuild(id);
    return id;
  };

  return { load, list, importFolder, prepareSource, sourceOf, rebuild, clone };
};
