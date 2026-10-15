// Pixelorama .pxo (format 1.0+, pxo_version 8): a ZIP with data.json and one
// raw RGBA8 buffer per cel at image_data/frames/<frame>/layer_<layer> (both
// 1-based). Layers are listed bottom to top; a group comes after its children
// and children name it by index in `parent`. Read and written without
// Pixelorama installed. Only frame 1 is used.
import { readFile, writeFile } from 'node:fs/promises';
import { readZip, writeZip } from './zip.mjs';
import { encodePng } from './png.mjs';

const PIXEL = 0, GROUP = 1;
// color_mode is a Godot Image.Format: 5 = RGBA8; -1 = indexed (pixels still stored as RGBA8)
const RGBA8 = 5, INDEXED = -1;
// "Vector2i(96, 112)" or "(0, 0)" → [96, 112] (numbers inside the brackets only)
const vec = (s) => (String(s).replace(/^[^(]*/, '').match(/-?\d+/g) ?? [0, 0]).map(Number);

// → { width, height, frames, layers: [{ name, group, visible, empty, rgba }] }, bottom to top
export const readPxo = async (file) => {
  const zip = readZip(await readFile(file));
  const data = JSON.parse(zip.get('data.json').toString('utf8'));
  const width = data.size_x, height = data.size_y;
  if (![RGBA8, INDEXED, undefined].includes(data.color_mode)) throw new Error('Pixelorama 파일을 RGBA 색 모드로 저장해주세요');
  const path = (i) => {
    const names = [];
    for (let p = data.layers[i].parent ?? -1; p !== -1; p = data.layers[p].parent ?? -1) names.unshift(data.layers[p].name);
    return names.join('/');
  };
  const visible = (i) => {
    for (let p = i; p !== -1; p = data.layers[p].parent ?? -1) if (data.layers[p].visible === false) return false;
    return true;
  };
  const cels = data.frames?.[0]?.cels ?? [];
  const layers = [];
  data.layers.forEach((layer, i) => {
    if ((layer.type ?? PIXEL) !== PIXEL) return;
    const canvas = new Uint8Array(width * height * 4);
    const raw = zip.get(`image_data/frames/1/layer_${i + 1}`);
    if (raw) {
      const [w, h] = cels[i]?.image_size ? vec(cels[i].image_size) : [width, height];
      const [ox, oy] = vec(cels[i]?.offset ?? '(0, 0)');
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const tx = x + ox, ty = y + oy;
        if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
        for (let k = 0; k < 4; k++) canvas[(ty * width + tx) * 4 + k] = raw[(y * w + x) * 4 + k];
      }
    }
    let empty = true;
    for (let k = 3; k < canvas.length; k += 4) if (canvas[k]) { empty = false; break; }
    layers.push({ name: layer.name, group: path(i), visible: visible(i) && layer.visible !== false, empty, rgba: canvas });
  });
  return { width, height, frames: data.frames?.length ?? 1, layers };
};

// layers: [{ name, group ('' or 'a/b'), visible, rgba }], bottom to top; layers
// of one group must be adjacent. Groups are created from the paths.
export const writePxo = async (file, { width, height, layers }) => {
  const out = [], images = [];
  const emit = (entry, rgba) => { out.push(entry); images.push(rgba); return out.length - 1; };
  const build = (items, depth) => {
    const indices = [];
    for (let i = 0; i < items.length;) {
      const segment = items[i].group.split('/').filter(Boolean)[depth];
      if (!segment) {
        const l = items[i++];
        indices.push(emit({ name: l.name, visible: l.visible !== false, type: PIXEL, new_cels_linked: false }, l.rgba));
        continue;
      }
      let j = i;
      while (j < items.length && items[j].group.split('/').filter(Boolean)[depth] === segment) j++;
      const children = build(items.slice(i, j), depth + 1);
      const group = emit({ name: segment, visible: true, type: GROUP, expanded: false }, null);
      for (const c of children) out[c].parent ??= group;
      indices.push(group);
      i = j;
    }
    return indices;
  };
  build(layers, 0);
  const data = {
    pixelorama_version: 'v1.2.3', pxo_version: 8, size_x: width, size_y: height, color_mode: RGBA8,
    layers: out.map((l) => ({ locked: false, blend_mode: 0, clipping_mask: false, opacity: 1, effects: [], parent: -1, ...l })),
    frames: [{ cels: out.map(() => ({ opacity: 1, z_index: 0, offset: '(0, 0)', image_size: `Vector2i(${width}, ${height})` })), duration: 1 }],
    tags: [], guides: [], brushes: [], reference_images: [], current_frame: 0, current_layer: 0, fps: 6, next_keyframe_id: 0
  };
  const preview = new Uint8Array(width * height * 4);
  for (let i = 0; i < out.length; i++) {
    if (!images[i] || out[i].visible === false || (out[i].parent !== -1 && out[out[i].parent]?.visible === false)) continue;
    for (let p = 0; p < preview.length; p += 4) if (images[i][p + 3]) preview.set(images[i].subarray(p, p + 4), p);
  }
  const entries = [['data.json', Buffer.from(JSON.stringify(data))], ['mimetype', Buffer.from('application/x-pixelorama')], ['preview.png', encodePng(width, height, preview)]];
  images.forEach((rgba, i) => { if (rgba) entries.push([`image_data/frames/1/layer_${i + 1}`, Buffer.from(rgba.buffer, rgba.byteOffset, rgba.length)]); });
  await writeFile(file, writeZip(entries));
};
