import { localizedLines, localizedText, packLanguage, t } from '../i18n';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as aseprite from '../../scripts/character/aseprite.mjs';
import { decodePng } from '../../scripts/character/png.mjs';
import { readPxo } from '../../scripts/character/pxo.mjs';
import { convertPack, type Converted, type Dropped } from '../domain/character/convert';
import type { CharacterPack } from '../domain/character/pack';
import type { Pixels } from '../domain/character/pixels';
import { framePicture } from '../domain/character/placement';
import { FRAME, standardPart, type CharacterDraft } from '../domain/character/standard';

// Reading pictures for the character editor (#57), in main: one PNG (the
// cut-out flow), a layered file (.pxo read directly, .aseprite through its
// CLI when it is installed), and another character's parts (an @2 pack
// converted to the standard slots). Every picture leaves here as 8-bit RGBA
// in a Pixels; nothing bigger than the 96×112 canvas leaves at all.

export type NamedPicture = { name: string; pixels: Pixels };
export type ImportedImage = { name: string; pixels: Pixels };
export type ImportedLayers = { name: string; layers: NamedPicture[] };

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_LAYERED_BYTES = 32 * 1024 * 1024;

const rgbaPixels = (w: number, h: number, rgba: Uint8Array): Pixels => {
  const copy = rgba.slice(); // its own aligned buffer
  return { w, h, data: new Uint32Array(copy.buffer, 0, w * h) };
};

const tooBig = (w: number, h: number) => new Error(t('error.editor.tooBig', { w, h, maxW: FRAME.w, maxH: FRAME.h }));

// One PNG as a full-canvas picture (smaller ones in the middle).
export const imageFromPng = (name: string, bytes: Uint8Array): ImportedImage => {
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error(t('error.editor.imageFile'));
  const { width, height, rgba } = decodePng(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.length));
  if (width > FRAME.w || height > FRAME.h) throw tooBig(width, height);
  return { name, pixels: framePicture(width, height, rgbaPixels(width, height, rgba).data) };
};

const layeredKind = (file: string) => {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.pxo') return 'pxo' as const;
  if (ext === '.aseprite' || ext === '.ase') return 'aseprite' as const;
  throw new Error(t('error.editor.layerKind', { name: path.basename(file) }));
};

const findAseprite = () => {
  try {
    return aseprite.findAseprite();
  } catch {
    throw new Error(t('error.editor.needAseprite'));
  }
};

// Every pixel layer of a layered file at the file's size, bottom to top.
export const layersFromFile = async (file: string): Promise<NamedPicture[]> => {
  const info = await stat(file);
  if (!info.isFile() || info.size > MAX_LAYERED_BYTES) throw new Error(t('error.editor.layerFile'));
  if (layeredKind(file) === 'pxo') {
    const { width, height, layers } = await readPxo(file);
    if (width > FRAME.w || height > FRAME.h) throw tooBig(width, height);
    return layers.map((l) => ({ name: l.name, pixels: rgbaPixels(width, height, l.rgba) }));
  }
  findAseprite();
  const { width, height, layers } = await aseprite.inspect(file);
  if (width > FRAME.w || height > FRAME.h) throw tooBig(width, height);
  const dir = await mkdtemp(path.join(os.tmpdir(), 'petnudge-editor-import-'));
  try {
    const { sheet, frames } = await aseprite.exportSheet(file, dir);
    const png = decodePng(await readFile(sheet));
    return layers.map(({ name }) => {
      const rgba = new Uint8Array(width * height * 4);
      const f = frames[name];
      if (f) for (let y = 0; y < height; y++) rgba.set(png.rgba.subarray(((f.y + y) * png.width + f.x) * 4, ((f.y + y) * png.width + f.x + width) * 4), y * width * 4);
      return { name, pixels: rgbaPixels(width, height, rgba) };
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

// A layered file given as bytes (the editor check's test door): written to a
// temporary file of the same kind and read like one.
export const layersFromBytes = async (name: string, bytes: Uint8Array): Promise<NamedPicture[]> => {
  if (bytes.length > MAX_LAYERED_BYTES) throw new Error(t('error.editor.layerTooBig'));
  const kind = layeredKind(name);
  const dir = await mkdtemp(path.join(os.tmpdir(), 'petnudge-editor-import-'));
  try {
    const file = path.join(dir, `import.${kind}`);
    await writeFile(file, bytes);
    return await layersFromFile(file);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

// Another character as a standard draft. An editor-made pack (@3) already
// uses the standard names; an older pack (@2) is converted (convert.ts), and
// what has no slot comes back in `dropped`.
// A reaction's lines in the pack's own language (what the editor edits).
const linesOf = (pack: CharacterPack, id: string) => [...(localizedLines(pack.actions?.[id]?.lines, packLanguage(pack), packLanguage(pack)) ?? [])];

export const characterDraft = async (files: { source: string; manifest: string }): Promise<Converted> => {
  const pack = JSON.parse(await readFile(files.manifest, 'utf8')) as CharacterPack;
  const layers = await layersFromFile(files.source);
  if (!String(pack.format ?? '').endsWith('@3')) return convertPack(pack, layers);
  const parts: Record<string, Pixels> = {};
  const dropped: Dropped[] = [];
  for (const { name, pixels } of layers) {
    if (!standardPart(name) || parts[name]) dropped.push({ name, reason: t('error.editor.notStandard') });
    else if (pixels.w !== FRAME.w || pixels.h !== FRAME.h) dropped.push({ name, reason: t('error.editor.wrongSize', { w: FRAME.w, h: FRAME.h }) });
    else parts[name] = pixels;
  }
  const draft: CharacterDraft = {
    id: pack.id,
    name: pack.name,
    persona: localizedText(pack.persona, packLanguage(pack), packLanguage(pack)) ?? '',
    lines: { pat: linesOf(pack, 'pat'), pokeChest: linesOf(pack, 'pokeChest'), pokeBelly: linesOf(pack, 'pokeBelly') },
    parts,
    order: Object.keys(parts)
  };
  return { draft, dropped };
};
