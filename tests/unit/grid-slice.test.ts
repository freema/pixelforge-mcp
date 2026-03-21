import { describe, it, expect } from 'vitest';
import { sliceGrid, generateGridTemplate } from '../../src/pipeline/image-ops.js';
import type { ImageData } from '../../src/types/common.js';

function makeImage(w: number, h: number, fillValue: number = 128): ImageData {
  const pixels = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    pixels[i * 4] = fillValue;
    pixels[i * 4 + 1] = fillValue;
    pixels[i * 4 + 2] = fillValue;
    pixels[i * 4 + 3] = 255;
  }
  return { width: w, height: h, pixels };
}

describe('sliceGrid', () => {
  it('slices a 2x2 grid into 4 cells of correct size', () => {
    const img = makeImage(100, 100);
    const cells = sliceGrid(img, 2, 2);
    expect(cells).toHaveLength(4);
    for (const cell of cells) {
      expect(cell.width).toBe(50);
      expect(cell.height).toBe(50);
    }
  });

  it('returns cells in row-major order', () => {
    // Create a 200x100 image with distinct regions
    const w = 200;
    const h = 100;
    const pixels = Buffer.alloc(w * h * 4);
    // Top-left quadrant: red, Top-right: green, Bottom-left: blue, Bottom-right: yellow
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const isTop = y < 50;
        const isLeft = x < 100;
        if (isTop && isLeft) {
          pixels[i] = 255;
          pixels[i + 1] = 0;
          pixels[i + 2] = 0;
        } else if (isTop && !isLeft) {
          pixels[i] = 0;
          pixels[i + 1] = 255;
          pixels[i + 2] = 0;
        } else if (!isTop && isLeft) {
          pixels[i] = 0;
          pixels[i + 1] = 0;
          pixels[i + 2] = 255;
        } else {
          pixels[i] = 255;
          pixels[i + 1] = 255;
          pixels[i + 2] = 0;
        }
        pixels[i + 3] = 255;
      }
    }
    const img: ImageData = { width: w, height: h, pixels };
    const cells = sliceGrid(img, 2, 2);

    // Cell 0: top-left (red)
    expect(cells[0]!.pixels[0]).toBe(255);
    expect(cells[0]!.pixels[1]).toBe(0);
    // Cell 1: top-right (green)
    expect(cells[1]!.pixels[0]).toBe(0);
    expect(cells[1]!.pixels[1]).toBe(255);
    // Cell 2: bottom-left (blue)
    expect(cells[2]!.pixels[2]).toBe(255);
    // Cell 3: bottom-right (yellow)
    expect(cells[3]!.pixels[0]).toBe(255);
    expect(cells[3]!.pixels[1]).toBe(255);
  });

  it('handles single-row layout', () => {
    const img = makeImage(300, 100);
    const cells = sliceGrid(img, 3, 1);
    expect(cells).toHaveLength(3);
    for (const cell of cells) {
      expect(cell.width).toBe(100);
      expect(cell.height).toBe(100);
    }
  });

  it('handles non-evenly divisible dimensions', () => {
    const img = makeImage(101, 51);
    const cells = sliceGrid(img, 2, 2);
    expect(cells).toHaveLength(4);
    // Floor division: 101/2 = 50, 51/2 = 25
    expect(cells[0]!.width).toBe(50);
    expect(cells[0]!.height).toBe(25);
  });
});

describe('generateGridTemplate', () => {
  it('produces image with correct dimensions', () => {
    const result = generateGridTemplate(3, 2, 64, { r: 0, g: 0, b: 0 });
    expect(result.width).toBe(192); // 3 * 64
    expect(result.height).toBe(128); // 2 * 64
  });

  it('produces image with correct dimensions for single row', () => {
    const result = generateGridTemplate(4, 1, 128, { r: 0, g: 0, b: 0 });
    expect(result.width).toBe(512); // 4 * 128
    expect(result.height).toBe(128); // 1 * 128
  });

  it('has RED grid lines at cell boundaries for dark background', () => {
    const result = generateGridTemplate(2, 2, 64, { r: 0, g: 0, b: 0 });
    // Check vertical line at x=64 (boundary between col 0 and col 1), 2px wide
    const x = 64;
    const y = 32; // middle of first row
    const i = (y * result.width + x) * 4;
    // Lines should be RED (255,0,0) on non-red bg
    expect(result.pixels[i]!).toBe(255);
    expect(result.pixels[i + 1]!).toBe(0);
    expect(result.pixels[i + 2]!).toBe(0);
  });

  it('has BLUE grid lines when background is close to red', () => {
    const result = generateGridTemplate(2, 2, 64, { r: 240, g: 20, b: 10 });
    // Check vertical line at x=0 (left edge)
    const i = (32 * result.width + 0) * 4;
    // Lines should be BLUE (0,0,255) when bg is close to red
    expect(result.pixels[i]!).toBe(0);
    expect(result.pixels[i + 1]!).toBe(0);
    expect(result.pixels[i + 2]!).toBe(255);
  });

  it('fills background correctly', () => {
    const result = generateGridTemplate(1, 1, 64, { r: 100, g: 50, b: 200 });
    // Check a pixel away from grid lines (which are 2px wide) and the center circle
    const x = 10;
    const y = 5;
    const i = (y * result.width + x) * 4;
    expect(result.pixels[i]!).toBe(100);
    expect(result.pixels[i + 1]!).toBe(50);
    expect(result.pixels[i + 2]!).toBe(200);
  });
});
