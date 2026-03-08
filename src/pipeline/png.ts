import { inflateSync, deflateSync } from 'zlib';
import jpeg from 'jpeg-js';
import type { ImageData } from '../types/common.js';

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const JPEG_SIG = Buffer.from([0xff, 0xd8, 0xff]);
const WEBP_SIG = Buffer.from('RIFF', 'ascii');

export type ImageFormat = 'png' | 'jpeg' | 'webp' | 'unknown';

export function detectFormat(buf: Buffer): ImageFormat {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIG)) return 'png';
  if (buf.length >= 3 && buf.subarray(0, 3).equals(JPEG_SIG)) return 'jpeg';
  if (buf.length >= 4 && buf.subarray(0, 4).equals(WEBP_SIG)) return 'webp';
  return 'unknown';
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

export function decodePNG(buf: Buffer): ImageData {
  if (!buf.subarray(0, 8).equals(PNG_SIG)) throw new Error('Not a PNG file');

  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks: Buffer[] = [];

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8]!;
      colorType = data[9]!;
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }

    pos += 12 + len;
  }

  if (bitDepth !== 8) throw new Error(`Unsupported bit depth: ${bitDepth}`);
  const srcChannels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!srcChannels) throw new Error(`Unsupported color type: ${colorType}`);

  const raw = inflateSync(Buffer.concat(idatChunks));
  const srcStride = width * srcChannels;
  const bpp = srcChannels;

  const pixels = Buffer.alloc(width * height * 4);
  let rawPos = 0;

  const curLine = Buffer.alloc(srcStride);
  const prevLine = Buffer.alloc(srcStride);

  for (let y = 0; y < height; y++) {
    const filterType = raw[rawPos++]!;

    for (let x = 0; x < srcStride; x++) {
      const rawByte = raw[rawPos + x]!;
      const a = x >= bpp ? curLine[x - bpp]! : 0;
      const b = prevLine[x]!;
      const c = x >= bpp ? prevLine[x - bpp]! : 0;

      let val = rawByte;
      switch (filterType) {
        case 0:
          break;
        case 1:
          val += a;
          break;
        case 2:
          val += b;
          break;
        case 3:
          val += Math.floor((a + b) / 2);
          break;
        case 4:
          val += paeth(a, b, c);
          break;
      }
      curLine[x] = val & 0xff;
    }
    rawPos += srcStride;

    for (let x = 0; x < width; x++) {
      const si = x * srcChannels;
      const di = (y * width + x) * 4;
      pixels[di] = curLine[si]!;
      pixels[di + 1] = curLine[si + 1]!;
      pixels[di + 2] = curLine[si + 2]!;
      pixels[di + 3] = srcChannels === 4 ? curLine[si + 3]! : 255;
    }

    curLine.copy(prevLine);
    curLine.fill(0);
  }

  return { width, height, pixels };
}

export function decodeJPEG(buf: Buffer): ImageData {
  const decoded = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true });
  return { width: decoded.width, height: decoded.height, pixels: Buffer.from(decoded.data) };
}

export function decodeImage(buf: Buffer): ImageData {
  const format = detectFormat(buf);
  if (format === 'png') return decodePNG(buf);
  if (format === 'jpeg') return decodeJPEG(buf);
  throw new Error(`Unsupported image format: ${format}`);
}

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function encodePNG(width: number, height: number, pixels: Buffer): Buffer {
  const chunks: Buffer[] = [];

  function addChunk(type: string, data: Buffer): void {
    const typeBuf = Buffer.from(type, 'ascii');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
    chunks.push(lenBuf, typeBuf, data, crcBuf);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  addChunk('IHDR', ihdr);

  const stride = width * 4;
  const rawBuf = Buffer.alloc(height * (1 + stride));
  for (let y = 0; y < height; y++) {
    rawBuf[y * (1 + stride)] = 0;
    pixels.copy(rawBuf, y * (1 + stride) + 1, y * stride, y * stride + stride);
  }
  addChunk('IDAT', deflateSync(rawBuf));

  addChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([PNG_SIG, ...chunks]);
}
