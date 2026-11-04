import { crc32, deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { decodePng, encodePng } from './png.mjs';

// The editor's "그림 불러오기" (#57) reads any 8-bit-or-less PNG a drawing tool
// saves: RGBA, RGB, grey, grey+alpha, and palettes of 1–8 bits with tRNS.

const chunk = (type, data) => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
};
// rows: each row's packed bytes, without the filter byte (filter 0 is added).
const png = ({ width, height, type, depth = 8, rows, plte, trns }) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = depth;
  ihdr[9] = type;
  const raw = Buffer.concat(rows.map((r) => Buffer.from([0, ...r])));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    ...(plte ? [chunk('PLTE', Buffer.from(plte))] : []),
    ...(trns ? [chunk('tRNS', Buffer.from(trns))] : []),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
};
const pixels = (rgba) => [...rgba];

describe('decodePng', () => {
  it('reads 8-bit RGBA, as it always has', () => {
    const rgba = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(decodePng(encodePng(2, 1, rgba))).toEqual({ width: 2, height: 1, rgba });
  });

  it('reads RGB as opaque', () => {
    expect(pixels(decodePng(png({ width: 2, height: 1, type: 2, rows: [[255, 0, 0, 0, 0, 255]] })).rgba)).toEqual([255, 0, 0, 255, 0, 0, 255, 255]);
  });

  it('reads grey and grey with alpha', () => {
    expect(pixels(decodePng(png({ width: 2, height: 1, type: 0, rows: [[0, 200]] })).rgba)).toEqual([0, 0, 0, 255, 200, 200, 200, 255]);
    expect(pixels(decodePng(png({ width: 1, height: 1, type: 4, rows: [[90, 0]] })).rgba)).toEqual([90, 90, 90, 0]);
  });

  it('reads a 4-bit palette with transparency, rows padded to whole bytes', () => {
    // 3 pixels per row: indexes 0, 1, 2 → 0x01, 0x20
    const decoded = decodePng(png({ width: 3, height: 2, type: 3, depth: 4, rows: [[0x01, 0x20], [0x22, 0x10]], plte: [0, 0, 0, 255, 0, 0, 0, 0, 255], trns: [0] }));
    expect(pixels(decoded.rgba)).toEqual([0, 0, 0, 0, 255, 0, 0, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 255, 0, 0, 255]);
  });

  it('reads a 1-bit palette', () => {
    const decoded = decodePng(png({ width: 9, height: 1, type: 3, depth: 1, rows: [[0b10000000, 0b10000000]], plte: [0, 0, 0, 255, 255, 255] }));
    expect(pixels(decoded.rgba.subarray(0, 8))).toEqual([255, 255, 255, 255, 0, 0, 0, 255]);
    expect(pixels(decoded.rgba.subarray(32, 36))).toEqual([255, 255, 255, 255]);
  });

  it('refuses 16-bit and interlaced pictures with a message', () => {
    expect(() => decodePng(png({ width: 1, height: 1, type: 6, depth: 16, rows: [[0, 0, 0, 0, 0, 0, 0, 0]] }))).toThrow('8비트');
    const interlaced = png({ width: 1, height: 1, type: 6, rows: [[0, 0, 0, 0]] });
    interlaced[8 + 8 + 12] = 1;
    expect(() => decodePng(interlaced)).toThrow('인터레이스');
  });
});
