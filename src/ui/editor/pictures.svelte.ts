import type { Pixels } from '../../domain/character/pixels';
import { framePicture } from '../../domain/character/placement';
import { addPart, editor, setPart } from './draft.svelte';

// Pictures dropped on the editor (#58, #71): a PNG file onto a part row or
// the canvas fills that part. Decoded here in the renderer: 8-bit RGBA, at
// most the canvas size, a smaller picture goes in the middle.
// `notice.text` is the last message for the user ('' when there is none).

export const notice = $state({ text: '' });

export const readPicture = async (file: File): Promise<Pixels> => {
  const canvas = editor.draft.canvas;
  if (file.type && file.type !== 'image/png') throw new Error('PNG 그림만 넣을 수 있어요');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  } catch {
    throw new Error(`그림을 읽지 못했어요: ${file.name}`);
  }
  const { width: w, height: h } = bitmap;
  if (w > canvas.w || h > canvas.h) {
    bitmap.close();
    return framePicture(w, h, new Uint32Array(0), canvas); // throws the size message
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const bytes = ctx.getImageData(0, 0, w, h).data;
  return framePicture(w, h, new Uint32Array(bytes.buffer, bytes.byteOffset, w * h), canvas);
};

// The first file a drop carries, if it carries files at all.
export const droppedFile = (e: DragEvent): File | undefined => e.dataTransfer?.files?.[0];
export const carriesFiles = (e: DragEvent) => Boolean(e.dataTransfer?.types.includes('Files'));

// Fills `target` (a part, or a new part named after the file) with the dropped file.
export const dropPicture = async (file: File, target: { part: string } | { newPart: true }) => {
  try {
    const pixels = await readPicture(file);
    const id = 'part' in target ? target.part : addPart({ label: file.name.replace(/\.png$/i, '') });
    setPart(id, pixels);
    notice.text = '';
  } catch (error) {
    notice.text = error instanceof Error ? error.message : String(error);
  }
};
