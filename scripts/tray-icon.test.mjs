import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { encodePng, iconPixels, trayIcons } from './tray-icon.mjs';

// Reads back the PNGs encodePng writes (8-bit RGBA, filter 0 on every row).
const decodePng = (png) => {
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const body = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      expect([body[8], body[9]]).toEqual([8, 6]); // 8-bit RGBA
    }
    if (type === 'IDAT') idat.push(body);
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    expect(raw[y * (width * 4 + 1)]).toBe(0);
    rgba.set(raw.subarray(y * (width * 4 + 1) + 1, (y + 1) * (width * 4 + 1)), y * width * 4);
  }
  return { width, height, rgba };
};

const pixel = (image, x, y) => [...image.rgba.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4)];

describe('tray icon', () => {
  const rows = ['o.', 'wv'];
  const palette = { o: '#473462', w: '#fff3df', v: '#b9a0e2' };

  it('scales each source pixel into a square block', () => {
    const image = iconPixels(rows, palette, { scale: 2, template: false });
    expect([image.width, image.height]).toEqual([4, 4]);
    expect(pixel(image, 0, 0)).toEqual([0x47, 0x34, 0x62, 255]);
    expect(pixel(image, 1, 1)).toEqual([0x47, 0x34, 0x62, 255]);
    expect(pixel(image, 2, 0)).toEqual([0, 0, 0, 0]);
    expect(pixel(image, 3, 3)).toEqual([0xb9, 0xa0, 0xe2, 255]);
  });

  // A macOS template image is black and alpha only; the light fill becomes a
  // hole so the outline reads on a light and a dark menu bar.
  it('draws a template in black, leaving the white fill out', () => {
    const image = iconPixels(rows, palette, { scale: 1, template: true });
    expect([pixel(image, 0, 0), pixel(image, 1, 0), pixel(image, 0, 1), pixel(image, 1, 1)]).toEqual([
      [0, 0, 0, 255], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 255]
    ]);
  });

  it('encodes a PNG that decodes to the same pixels', () => {
    const image = iconPixels(rows, palette, { scale: 3, template: false });
    expect(decodePng(encodePng(image))).toEqual(image);
  });

  it('makes 16px and @2x 32px icons, a template for macOS and a colour one elsewhere', () => {
    const icons = trayIcons();
    expect(Object.keys(icons).sort()).toEqual(['tray.png', 'tray@2x.png', 'trayTemplate.png', 'trayTemplate@2x.png']);
    expect([icons['trayTemplate.png'].width, icons['trayTemplate@2x.png'].width, icons['tray.png'].height, icons['tray@2x.png'].height]).toEqual([16, 32, 16, 32]);
  });

  it('matches the committed PNGs in assets/tray (run npm run build:tray-icon after changing the icon)', () => {
    for (const [name, image] of Object.entries(trayIcons())) {
      expect(decodePng(readFileSync(`assets/tray/${name}`)), name).toEqual(image);
    }
  });
});
