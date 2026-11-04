// Swaps exact colours in named layers of a Pixelorama source (.pxo), the way
// scripts/aseprite/recolor.lua does for .aseprite. For bringing a drawing's
// colours in line with the rest of the character (#66): the export warns about
// pose drawings in colours the standing character never uses.
//
// usage: node scripts/character/recolor.mjs <file.pxo> <rules.json>
//   rules.json: [{ "layers": ["pose.walk1", …] | "^pose\\.walk\\d$", "map": { "#fbf2f5": "#fddfdf", … },
//                  "boxes": [[x0, y0, x1, y1], …] }]   (boxes optional, end-exclusive)
// Rules apply in order, each to the layer pixels as the previous rules left them.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { readPxo, writePxo } from './pxo.mjs';

const rgbOf = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
};

const matches = (rule, name) => (Array.isArray(rule.layers) ? rule.layers.includes(name) : new RegExp(rule.layers).test(name));

// layers: [{ name, width?, rgba }] (RGBA bytes); returns how many pixels changed per layer.
export const recolorLayers = (layers, rules, width) => {
  const changed = {};
  for (const rule of rules) {
    const map = new Map(Object.entries(rule.map).map(([from, to]) => [rgbOf(from).join(','), rgbOf(to)]));
    for (const layer of layers) {
      if (!matches(rule, layer.name)) continue;
      const { rgba } = layer;
      const inside = (i) => {
        if (!rule.boxes) return true;
        const x = i % width, y = Math.floor(i / width);
        return rule.boxes.some(([x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1);
      };
      const next = new Uint8Array(rgba);
      let n = 0;
      for (let i = 0; i < rgba.length / 4; i++) {
        const p = i * 4;
        if (!rgba[p + 3]) continue;
        const to = map.get(`${rgba[p]},${rgba[p + 1]},${rgba[p + 2]}`);
        if (!to || !inside(i)) continue;
        [next[p], next[p + 1], next[p + 2]] = to;
        n++;
      }
      layer.rgba.set(next);
      if (n) changed[layer.name] = (changed[layer.name] ?? 0) + n;
    }
  }
  return changed;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [file, rulesFile] = process.argv.slice(2);
  if (!file?.endsWith('.pxo') || !rulesFile) throw new Error('usage: node scripts/character/recolor.mjs <file.pxo> <rules.json>');
  const pxo = await readPxo(file);
  const changed = recolorLayers(pxo.layers, JSON.parse(await readFile(rulesFile, 'utf8')), pxo.width);
  await writePxo(file, pxo);
  const total = Object.values(changed).reduce((a, b) => a + b, 0);
  console.log(`${path.basename(file)}: ${Object.keys(changed).length} layers, ${total} pixels recoloured`);
}
