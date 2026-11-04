import type { Pixels } from '../../domain/character/pixels';
import { customName, framePicture } from '../../domain/character/placement';
import type { SlotId } from '../../domain/character/standard';
import { editor, layerForSlot, setPart } from './draft.svelte';

// Pictures dropped on the editor (#58): a PNG file onto a layer row, an empty
// slot row or the canvas fills that layer. Decoded here in the renderer (the
// editor has no import IPC yet; #57 adds the one-picture cut-out flow):
// 8-bit RGBA, at most 96×112, a smaller picture goes in the middle.
// `notice.text` is the last message for the user ('' when there is none).

export const notice = $state({ text: '' });

export const readPicture = async (file: File): Promise<Pixels> => {
  if (file.type && file.type !== 'image/png') throw new Error('PNG 그림만 넣을 수 있어요');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  } catch {
    throw new Error(`그림을 읽지 못했어요: ${file.name}`);
  }
  const { width: w, height: h } = bitmap;
  if (w > 96 || h > 112) {
    bitmap.close();
    return framePicture(w, h, new Uint32Array(0)); // throws the size message
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const bytes = ctx.getImageData(0, 0, w, h).data;
  return framePicture(w, h, new Uint32Array(bytes.buffer, bytes.byteOffset, w * h));
};

// The first file a drop carries, if it carries files at all.
export const droppedFile = (e: DragEvent): File | undefined => e.dataTransfer?.files?.[0];
export const carriesFiles = (e: DragEvent) => Boolean(e.dataTransfer?.types.includes('Files'));

// Fills `target` (a layer name, or an empty slot) with the dropped file.
export const dropPicture = async (file: File, target: { layer: string } | { slot: SlotId }) => {
  try {
    const pixels = await readPicture(file);
    const layer = 'layer' in target ? target.layer : target.slot === 'custom' ? customName(file.name, editor.draft.parts) : layerForSlot(editor.draft, target.slot);
    if (!layer) throw new Error('넣을 칸을 먼저 골라 주세요');
    setPart(layer, pixels);
    notice.text = '';
  } catch (error) {
    notice.text = error instanceof Error ? error.message : String(error);
  }
};
