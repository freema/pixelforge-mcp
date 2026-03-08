import { describe, it, expect } from 'vitest';
import {
  snapToPixelArtSize,
  detectBgColor,
  findSpriteBlobs,
} from '../../src/pipeline/image-ops.js';

describe('snapToPixelArtSize', () => {
  it('snaps to nearest standard size', () => {
    expect(snapToPixelArtSize(30)).toBe(32);
    expect(snapToPixelArtSize(50)).toBe(48);
    expect(snapToPixelArtSize(60)).toBe(64);
    expect(snapToPixelArtSize(100)).toBe(96);
    expect(snapToPixelArtSize(120)).toBe(128);
  });

  it('returns exact match for standard sizes', () => {
    for (const size of [16, 24, 32, 48, 64, 96, 128]) {
      expect(snapToPixelArtSize(size)).toBe(size);
    }
  });

  it('returns 0 for zero or negative', () => {
    expect(snapToPixelArtSize(0)).toBe(0);
    expect(snapToPixelArtSize(-10)).toBe(0);
  });

  it('snaps small values to 16', () => {
    expect(snapToPixelArtSize(1)).toBe(16);
    expect(snapToPixelArtSize(10)).toBe(16);
  });
});

describe('detectBgColor', () => {
  function makeImage(w: number, h: number, r: number, g: number, b: number): Buffer {
    const buf = Buffer.alloc(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      buf[i * 4] = r;
      buf[i * 4 + 1] = g;
      buf[i * 4 + 2] = b;
      buf[i * 4 + 3] = 255;
    }
    return buf;
  }

  it('detects black background', () => {
    const bg = detectBgColor(makeImage(32, 32, 0, 0, 0), 32, 32);
    expect(bg.r).toBe(0);
    expect(bg.g).toBe(0);
    expect(bg.b).toBe(0);
  });

  it('detects white background', () => {
    const bg = detectBgColor(makeImage(32, 32, 255, 255, 255), 32, 32);
    expect(bg.r).toBe(255);
    expect(bg.g).toBe(255);
    expect(bg.b).toBe(255);
  });

  it('detects colored background', () => {
    const bg = detectBgColor(makeImage(32, 32, 100, 50, 200), 32, 32);
    expect(bg.r).toBe(100);
    expect(bg.g).toBe(50);
    expect(bg.b).toBe(200);
  });
});

describe('findSpriteBlobs', () => {
  it('finds a single blob on black bg', () => {
    const w = 32;
    const h = 32;
    const pixels = Buffer.alloc(w * h * 4, 0); // all black

    // Draw a white 8x8 square in the center
    for (let y = 12; y < 20; y++) {
      for (let x = 12; x < 20; x++) {
        const i = (y * w + x) * 4;
        pixels[i] = 255;
        pixels[i + 1] = 255;
        pixels[i + 2] = 255;
        pixels[i + 3] = 255;
      }
    }

    const blobs = findSpriteBlobs(pixels, w, h, 'black', 20, 4);
    expect(blobs.length).toBe(1);
    expect(blobs[0]!.x1).toBeGreaterThanOrEqual(12);
    expect(blobs[0]!.x2).toBeLessThanOrEqual(20);
  });

  it('returns empty for uniform image', () => {
    const w = 16;
    const h = 16;
    const pixels = Buffer.alloc(w * h * 4, 0);
    const blobs = findSpriteBlobs(pixels, w, h, 'black', 20, 4);
    expect(blobs.length).toBe(0);
  });
});
