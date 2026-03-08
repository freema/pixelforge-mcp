import { describe, it, expect } from 'vitest';
import { encodePNG, decodePNG, detectFormat } from '../../src/pipeline/png.js';

describe('PNG encode/decode roundtrip', () => {
  it('encodes and decodes a small image', () => {
    const w = 4;
    const h = 4;
    const pixels = Buffer.alloc(w * h * 4);

    // Red pixel at (0,0)
    pixels[0] = 255;
    pixels[3] = 255;
    // Green pixel at (1,0)
    pixels[5] = 255;
    pixels[7] = 255;
    // Blue pixel at (0,1)
    pixels[w * 4 + 2] = 255;
    pixels[w * 4 + 3] = 255;

    const encoded = encodePNG(w, h, pixels);
    expect(encoded).toBeInstanceOf(Buffer);
    expect(encoded.length).toBeGreaterThan(0);

    const decoded = decodePNG(encoded);
    expect(decoded.width).toBe(w);
    expect(decoded.height).toBe(h);
    expect(decoded.pixels.length).toBe(w * h * 4);

    // Verify red pixel
    expect(decoded.pixels[0]).toBe(255);
    expect(decoded.pixels[1]).toBe(0);
    expect(decoded.pixels[2]).toBe(0);
    expect(decoded.pixels[3]).toBe(255);
  });

  it('preserves transparency', () => {
    const w = 2;
    const h = 2;
    const pixels = Buffer.alloc(w * h * 4);
    // Transparent pixel
    pixels[0] = 0;
    pixels[1] = 0;
    pixels[2] = 0;
    pixels[3] = 0;
    // Opaque white pixel
    pixels[4] = 255;
    pixels[5] = 255;
    pixels[6] = 255;
    pixels[7] = 255;

    const encoded = encodePNG(w, h, pixels);
    const decoded = decodePNG(encoded);
    expect(decoded.pixels[3]).toBe(0);
    expect(decoded.pixels[7]).toBe(255);
  });
});

describe('detectFormat', () => {
  it('detects PNG', () => {
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]);
    expect(detectFormat(png)).toBe('png');
  });

  it('detects JPEG', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    expect(detectFormat(jpeg)).toBe('jpeg');
  });

  it('detects WebP', () => {
    const webp = Buffer.from('RIFF____WEBP', 'ascii');
    expect(detectFormat(webp)).toBe('webp');
  });

  it('returns unknown for random data', () => {
    const random = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(detectFormat(random)).toBe('unknown');
  });
});
