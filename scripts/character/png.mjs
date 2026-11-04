// Minimal PNG encode (8-bit RGBA) and decode (any colour type, 8 bits or
// less, no interlace) for the .pxo path and the editor's picture import.
import { crc32, deflateSync, inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const chunk = (type, data) => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
};

// rgba: Uint8Array of width*height*4
export const encodePng = (width, height, rgba) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(rows, y * (width * 4 + 1) + 1);
  return Buffer.concat([SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
};

// → { width, height, rgba }: any non-interlaced PNG of 8 bits or less per
// channel (RGBA, RGB, grey, grey+alpha, palette of 1–8 bits with tRNS),
// always answered as 8-bit RGBA. All five filter types.
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
export const decodePng = (buf) => {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('PNG가 아니에요');
  let p = 8, width = 0, height = 0, depth = 8, type = 6, palette = null, alpha = null;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), kind = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (kind === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4); depth = data[8]; type = data[9];
      if (!(type in CHANNELS) || depth > 8 || ((type === 2 || type === 4 || type === 6) && depth !== 8)) throw new Error('8비트 이하 PNG만 읽을 수 있어요 (16비트는 8비트로 저장해 주세요)');
      if (data[12] !== 0) throw new Error('인터레이스 PNG는 읽지 못해요. 인터레이스 없이 저장해 주세요');
    } else if (kind === 'PLTE') palette = data;
    else if (kind === 'tRNS') alpha = data;
    else if (kind === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  if (type === 3 && !palette) throw new Error('팔레트가 없는 PNG예요');
  const channels = CHANNELS[type], bpp = Math.max(1, (channels * depth) >> 3), stride = Math.ceil((width * channels * depth) / 8);
  const raw = inflateSync(Buffer.concat(idat)), packed = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? packed[y * stride + x - bpp] : 0, b = y > 0 ? packed[(y - 1) * stride + x] : 0, c = x >= bpp && y > 0 ? packed[(y - 1) * stride + x - bpp] : 0;
      const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter];
      packed[y * stride + x] = (row[x] + pred) & 0xff;
    }
  }
  if (type === 6) return { width, height, rgba: packed };
  // Unpack to RGBA. `sample(y, i)`: the i-th sample of row y, scaled to 8 bits unless it is a palette index.
  const max = (1 << depth) - 1;
  const sample = (y, i) => {
    if (depth === 8) return packed[y * stride + i];
    const bit = i * depth, v = (packed[y * stride + (bit >> 3)] >> (8 - depth - (bit & 7))) & max;
    return type === 3 ? v : Math.round((v * 255) / max);
  };
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const o = (y * width + x) * 4, s = x * channels;
    if (type === 3) {
      const i = sample(y, s);
      rgba.set([palette[i * 3], palette[i * 3 + 1], palette[i * 3 + 2], alpha && i < alpha.length ? alpha[i] : 255], o);
    } else if (type === 2) rgba.set([sample(y, s), sample(y, s + 1), sample(y, s + 2), 255], o);
    else {
      const g = sample(y, s);
      rgba.set([g, g, g, type === 4 ? sample(y, s + 1) : 255], o);
    }
  }
  return { width, height, rgba };
};
