// The tray (menu bar) icon, drawn from the 'talk' pixel icon the pet's chat
// button uses. npm run build:tray-icon writes assets/tray/*.png; build.mjs
// copies them into dist/tray/. tray-icon.test.mjs checks the committed files
// still match, so change the icon here and re-run the script.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';
import { pixelIcons, pixelPalette } from '../src/domain/icons/pixelIcons.ts';

const ICON = 'talk';
// The light fill: left out of a template so only the outline and dots show.
const FILL = 'w';

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// rows: equal-length strings, '.' transparent, any other character a palette key.
export const iconPixels = (rows, palette, { scale, template }) => {
  const width = rows[0].length * scale;
  const height = rows.length * scale;
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const key = rows[Math.floor(y / scale)][Math.floor(x / scale)];
      if (key === '.' || (template && key === FILL)) continue;
      const color = template ? [0, 0, 0] : rgb(palette[key]);
      rgba.set([...color, 255], (y * width + x) * 4);
    }
  }
  return { width, height, rgba };
};

const chunk = (type, body) => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, crc]);
};

// 8-bit RGBA, no filtering: tiny images, so size does not matter.
export const encodePng = ({ width, height, rgba }) => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
};

// macOS reads a name ending in "Template" as a template image, and the @2x
// file as the same icon for Retina screens.
export const trayIcons = () => {
  const rows = pixelIcons[ICON];
  return {
    'trayTemplate.png': iconPixels(rows, pixelPalette, { scale: 2, template: true }),
    'trayTemplate@2x.png': iconPixels(rows, pixelPalette, { scale: 4, template: true }),
    'tray.png': iconPixels(rows, pixelPalette, { scale: 2, template: false }),
    'tray@2x.png': iconPixels(rows, pixelPalette, { scale: 4, template: false })
  };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'tray');
  mkdirSync(dir, { recursive: true });
  for (const [name, image] of Object.entries(trayIcons())) writeFileSync(path.join(dir, name), encodePng(image));
  console.log(`wrote ${Object.keys(trayIcons()).length} tray icons to assets/tray/`);
}
