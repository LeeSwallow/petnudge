import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as aseprite from '../../scripts/character/aseprite.mjs';
import { decodePng } from '../../scripts/character/png.mjs';
import { readPxo } from '../../scripts/character/pxo.mjs';
import { convertPack, type Converted } from '../domain/character/convert';
import type { CharacterPack } from '../domain/character/pack';
import type { Pixels } from '../domain/character/pixels';
import { CANVAS_LIMITS } from '../domain/character/parts';
import { draftFromPack } from '../domain/character/reopen';

// Reading pictures for the character editor (#57), in main: one PNG (the
// cut-out flow), a layered file (.pxo read directly, .aseprite through its
// CLI when it is installed), and another character's parts (an @2 pack
// converted to parts). Every picture leaves here as 8-bit RGBA in a Pixels
// at its own size; nothing bigger than the largest canvas leaves at all (the
// editor fits a picture to its canvas, placement.framePicture).

export type NamedPicture = { name: string; pixels: Pixels };
export type ImportedImage = { name: string; pixels: Pixels };
export type ImportedLayers = { name: string; layers: NamedPicture[] };

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_LAYERED_BYTES = 32 * 1024 * 1024;

const rgbaPixels = (w: number, h: number, rgba: Uint8Array): Pixels => {
  const copy = rgba.slice(); // its own aligned buffer
  return { w, h, data: new Uint32Array(copy.buffer, 0, w * h) };
};

const MAX = { w: CANVAS_LIMITS.w[1], h: CANVAS_LIMITS.h[1] };
const tooBig = (w: number, h: number) => new Error(`그림이 ${w}×${h}예요. ${MAX.w}×${MAX.h} 이하로 줄여 주세요 (격자 정리)`);

// One PNG, at its own size.
export const imageFromPng = (name: string, bytes: Uint8Array): ImportedImage => {
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error('그림 파일이 너무 커요');
  const { width, height, rgba } = decodePng(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.length));
  if (width > MAX.w || height > MAX.h) throw tooBig(width, height);
  return { name, pixels: rgbaPixels(width, height, rgba) };
};

const layeredKind = (file: string) => {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.pxo') return 'pxo' as const;
  if (ext === '.aseprite' || ext === '.ase') return 'aseprite' as const;
  throw new Error(`레이어 파일은 .pxo나 .aseprite만 읽을 수 있어요: ${path.basename(file)}`);
};

const findAseprite = () => {
  try {
    return aseprite.findAseprite();
  } catch {
    throw new Error('.aseprite 파일은 Aseprite가 설치되어 있어야 읽을 수 있어요. Aseprite에서 PNG나 .pxo로 내보내거나, ASEPRITE 환경 변수에 실행 파일 경로를 지정해 주세요');
  }
};

// Every pixel layer of a layered file at the file's size, bottom to top.
export const layersFromFile = async (file: string): Promise<NamedPicture[]> => {
  const info = await stat(file);
  if (!info.isFile() || info.size > MAX_LAYERED_BYTES) throw new Error('레이어 파일의 종류나 크기를 확인해 주세요');
  if (layeredKind(file) === 'pxo') {
    const { width, height, layers } = await readPxo(file);
    if (width > MAX.w || height > MAX.h) throw tooBig(width, height);
    return layers.map((l) => ({ name: l.name, pixels: rgbaPixels(width, height, l.rgba) }));
  }
  findAseprite();
  const { width, height, layers } = await aseprite.inspect(file);
  if (width > MAX.w || height > MAX.h) throw tooBig(width, height);
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
  if (bytes.length > MAX_LAYERED_BYTES) throw new Error('레이어 파일이 너무 커요');
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

// Another character as a draft of parts. An editor-made pack (@3) is opened
// back into its parts (reopen.ts); an older pack (@2) is converted
// (convert.ts). What has no part comes back in `dropped`.
export const characterDraft = async (files: { source: string; manifest: string }): Promise<Converted> => {
  const pack = JSON.parse(await readFile(files.manifest, 'utf8')) as CharacterPack;
  const layers = await layersFromFile(files.source);
  return String(pack.format ?? '').endsWith('@3') ? draftFromPack(pack, layers) : convertPack(pack, layers);
};
