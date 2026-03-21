import type { ImageData } from '../types/common.js';

/** Standard pixel art sizes (multiples of 8/16 that are industry standard) */
const STANDARD_SIZES = [16, 24, 32, 48, 64, 96, 128];

/**
 * Snap a size to the nearest standard pixel art size.
 * Standard sizes: 16, 24, 32, 48, 64, 96, 128.
 * Returns 0 unchanged (means "skip downscale").
 */
export function snapToPixelArtSize(size: number): number {
  if (size <= 0) return 0;
  let best = STANDARD_SIZES[0]!;
  let bestDist = Math.abs(size - best);
  for (const s of STANDARD_SIZES) {
    const dist = Math.abs(size - s);
    if (dist < bestDist) {
      best = s;
      bestDist = dist;
    }
  }
  return best;
}

/** Detected background — actual RGB color sampled from edges */
export interface BgColor {
  r: number;
  g: number;
  b: number;
}

// Legacy alias for backwards compat
type Bg = 'black' | 'white';

/**
 * Detect actual background color by sampling edge regions.
 * Returns the average RGB of the border pixels.
 */
export function detectBgColor(pixels: Buffer, width: number, height: number): BgColor {
  let totalR = 0,
    totalG = 0,
    totalB = 0,
    count = 0;
  const sampleSize = Math.max(4, Math.floor(Math.min(width, height) * 0.05));

  // Sample top, bottom, left, right edges
  for (let x = 0; x < width; x++) {
    for (let dy = 0; dy < sampleSize && dy < height; dy++) {
      // Top edge
      const ti = (dy * width + x) * 4;
      totalR += pixels[ti]!;
      totalG += pixels[ti + 1]!;
      totalB += pixels[ti + 2]!;
      count++;
      // Bottom edge
      const bi = ((height - 1 - dy) * width + x) * 4;
      totalR += pixels[bi]!;
      totalG += pixels[bi + 1]!;
      totalB += pixels[bi + 2]!;
      count++;
    }
  }
  for (let y = sampleSize; y < height - sampleSize; y++) {
    for (let dx = 0; dx < sampleSize && dx < width; dx++) {
      // Left edge
      const li = (y * width + dx) * 4;
      totalR += pixels[li]!;
      totalG += pixels[li + 1]!;
      totalB += pixels[li + 2]!;
      count++;
      // Right edge
      const ri = (y * width + (width - 1 - dx)) * 4;
      totalR += pixels[ri]!;
      totalG += pixels[ri + 1]!;
      totalB += pixels[ri + 2]!;
      count++;
    }
  }

  return {
    r: Math.round(totalR / count),
    g: Math.round(totalG / count),
    b: Math.round(totalB / count),
  };
}

function isBgPixelColor(r: number, g: number, b: number, bg: BgColor, thresh: number): boolean {
  return Math.abs(r - bg.r) < thresh && Math.abs(g - bg.g) < thresh && Math.abs(b - bg.b) < thresh;
}

// Legacy wrappers
function isBgPixel(r: number, g: number, b: number, bg: Bg, thresh: number): boolean {
  const bgc: BgColor = bg === 'white' ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };
  return isBgPixelColor(r, g, b, bgc, thresh);
}

function isContent(r: number, g: number, b: number, bg: Bg, thresh: number): boolean {
  return !isBgPixel(r, g, b, bg, thresh);
}

export function makeTransparentColor(
  pixels: Buffer,
  width: number,
  height: number,
  bg: BgColor,
  thresh: number = 40
): Buffer {
  const out = Buffer.from(pixels);
  for (let i = 0; i < width * height * 4; i += 4) {
    if (isBgPixelColor(out[i]!, out[i + 1]!, out[i + 2]!, bg, thresh)) {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 0;
    }
  }
  return out;
}

/**
 * Compositing-equation based soft alpha background removal.
 * Inspired by godogen's rembg_matting.py — produces smooth edges and
 * correct semi-transparent pixels instead of harsh binary threshold.
 */
export function removeBackgroundColor(
  pixels: Buffer,
  width: number,
  height: number,
  bg: BgColor,
  opts?: { noiseFloor?: number; solidThreshold?: number }
): Buffer {
  const noiseFloor = opts?.noiseFloor ?? 0.08;
  const solidThreshold = opts?.solidThreshold ?? 0.55;
  const out = Buffer.from(pixels);

  for (let i = 0; i < width * height * 4; i += 4) {
    const pr = out[i]!;
    const pg = out[i + 1]!;
    const pb = out[i + 2]!;

    // Compute per-channel alpha using compositing equation lower bound.
    // Skip channels where bg is near 0 or 255 — division is numerically
    // unstable there (godogen approach). Use a minimum denominator of 32
    // to prevent tiny bg values from amplifying noise into high alpha.
    const MIN_DENOM = 32;
    const alphaR =
      pr > bg.r
        ? (pr - bg.r) / Math.max(255 - bg.r, MIN_DENOM)
        : pr < bg.r
          ? (bg.r - pr) / Math.max(bg.r, MIN_DENOM)
          : 0;
    const alphaG =
      pg > bg.g
        ? (pg - bg.g) / Math.max(255 - bg.g, MIN_DENOM)
        : pg < bg.g
          ? (bg.g - pg) / Math.max(bg.g, MIN_DENOM)
          : 0;
    const alphaB =
      pb > bg.b
        ? (pb - bg.b) / Math.max(255 - bg.b, MIN_DENOM)
        : pb < bg.b
          ? (bg.b - pb) / Math.max(bg.b, MIN_DENOM)
          : 0;

    let alpha = Math.max(alphaR, alphaG, alphaB);

    // Apply noise/solid thresholds with linear ramp in between
    if (alpha < noiseFloor) {
      alpha = 0;
    } else if (alpha > solidThreshold) {
      alpha = 1.0;
    } else {
      alpha = (alpha - noiseFloor) / (solidThreshold - noiseFloor);
    }

    if (alpha === 0) {
      // Fully transparent — zero out RGB
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 0;
    } else {
      // Recover foreground color: fg[c] = clamp((pixel[c] - (1-alpha)*bg[c]) / alpha, 0, 255)
      const inv = 1 - alpha;
      out[i] = Math.min(255, Math.max(0, Math.round((pr - inv * bg.r) / alpha)));
      out[i + 1] = Math.min(255, Math.max(0, Math.round((pg - inv * bg.g) / alpha)));
      out[i + 2] = Math.min(255, Math.max(0, Math.round((pb - inv * bg.b) / alpha)));
      out[i + 3] = Math.round(alpha * 255);
    }
  }

  return out;
}

interface Bounds {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function findBounds(
  pixels: Buffer,
  width: number,
  height: number,
  bg: Bg,
  thresh: number = 20
): Bounds {
  let x1 = width;
  let y1 = height;
  let x2 = 0;
  let y2 = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (isContent(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!, bg, thresh)) {
        x1 = Math.min(x1, x);
        y1 = Math.min(y1, y);
        x2 = Math.max(x2, x);
        y2 = Math.max(y2, y);
      }
    }
  }
  return { x1, y1, x2: x2 + 1, y2: y2 + 1 };
}

export function cropPixels(
  pixels: Buffer,
  srcW: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): ImageData {
  const w = x2 - x1;
  const h = y2 - y1;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const srcOff = ((y1 + y) * srcW + x1) * 4;
    const dstOff = y * w * 4;
    pixels.copy(out, dstOff, srcOff, srcOff + w * 4);
  }
  return { width: w, height: h, pixels: out };
}

export function makeSquare(pixels: Buffer, width: number, height: number): ImageData {
  const side = Math.max(width, height);
  if (width === side && height === side) return { width, height, pixels };
  const out = Buffer.alloc(side * side * 4);
  const ox = Math.floor((side - width) / 2);
  const oy = Math.floor((side - height) / 2);
  for (let y = 0; y < height; y++) {
    const srcOff = y * width * 4;
    const dstOff = ((oy + y) * side + ox) * 4;
    pixels.copy(out, dstOff, srcOff, srcOff + width * 4);
  }
  return { width: side, height: side, pixels: out };
}

/**
 * 2D blob detection using flood-fill connected-component analysis.
 * Finds distinct sprite regions regardless of layout (horizontal, vertical, grid).
 */
export function findSpriteBlobs(
  pixels: Buffer,
  width: number,
  height: number,
  bg: Bg,
  thresh: number = 20,
  minBlobArea: number = 100
): Bounds[] {
  // Downscale for performance — work at 1/4 resolution
  const scale = 4;
  const sw = Math.ceil(width / scale);
  const sh = Math.ceil(height / scale);
  const visited = new Uint8Array(sw * sh);

  function isFg(sx: number, sy: number): boolean {
    const ox = Math.min(sx * scale, width - 1);
    const oy = Math.min(sy * scale, height - 1);
    const i = (oy * width + ox) * 4;
    return isContent(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!, bg, thresh);
  }

  const blobs: Bounds[] = [];

  for (let sy = 0; sy < sh; sy++) {
    for (let sx = 0; sx < sw; sx++) {
      const idx = sy * sw + sx;
      if (visited[idx] || !isFg(sx, sy)) continue;

      // BFS flood-fill
      let bx1 = sx,
        by1 = sy,
        bx2 = sx,
        by2 = sy;
      let area = 0;
      const queue: number[] = [sx, sy];
      visited[idx] = 1;

      while (queue.length > 0) {
        const cy = queue.pop()!;
        const cx = queue.pop()!;
        area++;
        bx1 = Math.min(bx1, cx);
        by1 = Math.min(by1, cy);
        bx2 = Math.max(bx2, cx);
        by2 = Math.max(by2, cy);

        // 4-connected neighbors
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = cx + dx!;
          const ny = cy + dy!;
          if (nx < 0 || nx >= sw || ny < 0 || ny >= sh) continue;
          const ni = ny * sw + nx;
          if (visited[ni] || !isFg(nx, ny)) continue;
          visited[ni] = 1;
          queue.push(nx, ny);
        }
      }

      // Filter tiny noise blobs
      const scaledArea = area * scale * scale;
      if (scaledArea >= minBlobArea) {
        blobs.push({
          x1: bx1 * scale,
          y1: by1 * scale,
          x2: Math.min((bx2 + 1) * scale, width),
          y2: Math.min((by2 + 1) * scale, height),
        });
      }
    }
  }

  // Sort blobs left-to-right, then top-to-bottom
  blobs.sort((a, b) => {
    const ax = (a.x1 + a.x2) / 2;
    const bx = (b.x1 + b.x2) / 2;
    const ay = (a.y1 + a.y2) / 2;
    const by = (b.y1 + b.y2) / 2;
    // If centers are within 20% of image height, consider same row
    const rowThresh = height * 0.2;
    if (Math.abs(ay - by) < rowThresh) return ax - bx;
    return ay - by;
  });

  return blobs;
}

/**
 * Merge overlapping or very close blobs into single bounds.
 */
function mergeCloseBlobs(blobs: Bounds[], gapThresh: number): Bounds[] {
  if (blobs.length <= 1) return blobs;

  const merged: Bounds[] = [{ ...blobs[0]! }];

  for (let i = 1; i < blobs.length; i++) {
    const b = blobs[i]!;
    const last = merged[merged.length - 1]!;

    // Check if blobs overlap or are very close
    const xOverlap = b.x1 <= last.x2 + gapThresh && b.x2 >= last.x1 - gapThresh;
    const yOverlap = b.y1 <= last.y2 + gapThresh && b.y2 >= last.y1 - gapThresh;

    if (xOverlap && yOverlap) {
      last.x1 = Math.min(last.x1, b.x1);
      last.y1 = Math.min(last.y1, b.y1);
      last.x2 = Math.max(last.x2, b.x2);
      last.y2 = Math.max(last.y2, b.y2);
    } else {
      merged.push({ ...b });
    }
  }

  return merged;
}

/**
 * Equidistant split fallback — divide full content area into N equal slices.
 * Uses content bounds to avoid splitting empty margins.
 */
function equidistantSplit(img: ImageData, count: number, bg: Bg, thresh: number = 20): Bounds[] {
  // Find overall content bounds first
  const bounds = findBounds(img.pixels, img.width, img.height, bg, thresh);
  const contentW = bounds.x2 - bounds.x1;
  const contentH = bounds.y2 - bounds.y1;

  // Decide split direction based on content shape
  const isHorizontal = contentW > contentH;

  const results: Bounds[] = [];
  if (isHorizontal) {
    const sliceW = Math.floor(contentW / count);
    for (let i = 0; i < count; i++) {
      const x1 = bounds.x1 + i * sliceW;
      const x2 = i === count - 1 ? bounds.x2 : x1 + sliceW;
      results.push({ x1, y1: bounds.y1, x2, y2: bounds.y2 });
    }
  } else {
    const sliceH = Math.floor(contentH / count);
    for (let i = 0; i < count; i++) {
      const y1 = bounds.y1 + i * sliceH;
      const y2 = i === count - 1 ? bounds.y2 : y1 + sliceH;
      results.push({ x1: bounds.x1, y1, x2: bounds.x2, y2 });
    }
  }
  return results;
}

/**
 * Area-averaging downscale — produces clean pixel art from high-res "pixel art style" images.
 * Each output pixel is the average of all source pixels that map to it.
 * This turns fake pixel art (where each visible "pixel" is 10-20 real pixels) into real pixel art.
 */
export function pixelateDownscale(
  pixels: Buffer,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): ImageData {
  const out = Buffer.alloc(dstW * dstH * 4);
  const scaleX = srcW / dstW;
  const scaleY = srcH / dstH;

  for (let dy = 0; dy < dstH; dy++) {
    for (let dx = 0; dx < dstW; dx++) {
      const sx1 = Math.floor(dx * scaleX);
      const sy1 = Math.floor(dy * scaleY);
      const sx2 = Math.min(Math.floor((dx + 1) * scaleX), srcW);
      const sy2 = Math.min(Math.floor((dy + 1) * scaleY), srcH);

      let r = 0,
        g = 0,
        b = 0,
        a = 0,
        count = 0;
      for (let sy = sy1; sy < sy2; sy++) {
        for (let sx = sx1; sx < sx2; sx++) {
          const si = (sy * srcW + sx) * 4;
          const alpha = pixels[si + 3]!;
          if (alpha > 0) {
            r += pixels[si]!;
            g += pixels[si + 1]!;
            b += pixels[si + 2]!;
            a += alpha;
            count++;
          }
        }
      }

      const di = (dy * dstW + dx) * 4;
      const totalPixels = (sx2 - sx1) * (sy2 - sy1);
      if (count > 0 && count >= totalPixels * 0.3) {
        // Enough opaque pixels — this is content
        out[di] = Math.round(r / count);
        out[di + 1] = Math.round(g / count);
        out[di + 2] = Math.round(b / count);
        out[di + 3] = Math.round(a / count);
      }
      // else: stays transparent (0,0,0,0)
    }
  }
  return { width: dstW, height: dstH, pixels: out };
}

export function processSpriteColor(
  img: ImageData,
  bgColor: BgColor,
  opts: {
    threshold?: number;
    padding?: number;
    square?: boolean;
    skipCrop?: boolean;
    skipTransparent?: boolean;
    size?: number;
  }
): ImageData {
  const pad = opts.padding ?? 2;
  let { width, height, pixels } = img;

  if (!opts.skipTransparent) {
    pixels = removeBackgroundColor(pixels, width, height, bgColor);
  }

  if (!opts.skipCrop) {
    // Find non-transparent bounds
    let x1 = width,
      y1 = height,
      x2 = 0,
      y2 = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (pixels[i + 3]! > 0) {
          x1 = Math.min(x1, x);
          y1 = Math.min(y1, y);
          x2 = Math.max(x2, x);
          y2 = Math.max(y2, y);
        }
      }
    }
    if (x2 >= x1 && y2 >= y1) {
      const cx1 = Math.max(0, x1 - pad);
      const cy1 = Math.max(0, y1 - pad);
      const cx2 = Math.min(width, x2 + 1 + pad);
      const cy2 = Math.min(height, y2 + 1 + pad);
      const cropped = cropPixels(pixels, width, cx1, cy1, cx2, cy2);
      width = cropped.width;
      height = cropped.height;
      pixels = cropped.pixels;
    }
  }

  if (opts.square) {
    const sq = makeSquare(pixels, width, height);
    width = sq.width;
    height = sq.height;
    pixels = sq.pixels;
  }

  // Pixelate downscale to target size — turns fake pixel art into real pixel art
  const targetSize = opts.size ?? 64;
  if (targetSize > 0 && (width > targetSize || height > targetSize)) {
    const scale = targetSize / Math.max(width, height);
    const nw = Math.max(1, Math.round(width * scale));
    const nh = Math.max(1, Math.round(height * scale));
    const downscaled = pixelateDownscale(pixels, width, height, nw, nh);
    width = downscaled.width;
    height = downscaled.height;
    pixels = downscaled.pixels;
  }

  return { width, height, pixels };
}

export function processSprite(
  img: ImageData,
  opts: {
    threshold?: number;
    padding?: number;
    square?: boolean;
    skipCrop?: boolean;
    skipTransparent?: boolean;
    maxSize?: number;
  }
): ImageData {
  const bgColor = detectBgColor(img.pixels, img.width, img.height);
  return processSpriteColor(img, bgColor, opts);
}

export function splitAndProcess(
  img: ImageData,
  opts: {
    threshold?: number;
    padding?: number;
    square?: boolean;
    expectedFrames?: number;
    maxSize?: number;
    bgColorHint?: BgColor;
  }
): ImageData[] {
  const pad = opts.padding ?? 4;
  const expected = opts.expectedFrames;
  const maxSize = opts.maxSize ?? 128;

  // Use hint if provided, otherwise detect from edges
  const bgColor = opts.bgColorHint ?? detectBgColor(img.pixels, img.width, img.height);
  const bg = (bgColor.r + bgColor.g + bgColor.b) / 3 > 128 ? ('white' as Bg) : ('black' as Bg);
  const thresh = opts.threshold ?? 40;

  // Step 1: 2D blob detection — finds distinct sprite regions
  const minBlobArea = Math.floor(img.width * img.height * 0.005);
  let blobs = findSpriteBlobs(img.pixels, img.width, img.height, bg, thresh, minBlobArea);

  // Step 2: Merge blobs that are very close (parts of same sprite)
  const mergeDist = Math.floor(Math.min(img.width, img.height) * 0.03);
  blobs = mergeCloseBlobs(blobs, mergeDist);

  let bounds: Bounds[];

  if (expected && blobs.length === expected) {
    bounds = blobs;
  } else if (expected && blobs.length > expected) {
    const bigMerge = Math.floor(Math.min(img.width, img.height) * 0.08);
    const merged = mergeCloseBlobs(blobs, bigMerge);
    bounds = merged.length === expected ? merged : equidistantSplit(img, expected, bg, thresh);
  } else if (expected) {
    bounds = equidistantSplit(img, expected, bg, thresh);
  } else {
    bounds = blobs.length > 0 ? blobs : [{ x1: 0, y1: 0, x2: img.width, y2: img.height }];
  }

  const results: ImageData[] = [];

  for (const b of bounds) {
    const cx1 = Math.max(0, b.x1 - pad);
    const cy1 = Math.max(0, b.y1 - pad);
    const cx2 = Math.min(img.width, b.x2 + pad);
    const cy2 = Math.min(img.height, b.y2 + pad);

    let sprite = cropPixels(img.pixels, img.width, cx1, cy1, cx2, cy2);
    // Use compositing-equation soft alpha for accurate bg removal
    sprite.pixels = removeBackgroundColor(sprite.pixels, sprite.width, sprite.height, bgColor);

    // Tight crop to non-transparent pixels
    let x1t = sprite.width,
      y1t = sprite.height,
      x2t = 0,
      y2t = 0;
    for (let y = 0; y < sprite.height; y++) {
      for (let x = 0; x < sprite.width; x++) {
        if (sprite.pixels[(y * sprite.width + x) * 4 + 3]! > 0) {
          x1t = Math.min(x1t, x);
          y1t = Math.min(y1t, y);
          x2t = Math.max(x2t, x);
          y2t = Math.max(y2t, y);
        }
      }
    }
    if (x2t >= x1t && y2t >= y1t) {
      sprite = cropPixels(
        sprite.pixels,
        sprite.width,
        Math.max(0, x1t - 2),
        Math.max(0, y1t - 2),
        Math.min(sprite.width, x2t + 3),
        Math.min(sprite.height, y2t + 3)
      );
    }

    if (opts.square) {
      sprite = makeSquare(sprite.pixels, sprite.width, sprite.height);
    }

    // Pixelate downscale to target game size
    if (maxSize > 0 && (sprite.width > maxSize || sprite.height > maxSize)) {
      const scale = maxSize / Math.max(sprite.width, sprite.height);
      const nw = Math.max(1, Math.round(sprite.width * scale));
      const nh = Math.max(1, Math.round(sprite.height * scale));
      sprite = pixelateDownscale(sprite.pixels, sprite.width, sprite.height, nw, nh);
    }

    results.push(sprite);
  }

  return results;
}

/**
 * Deterministic grid slicing — splits an image into cols×rows equal cells.
 * Returns cells in row-major order (left-to-right, top-to-bottom).
 */
export function sliceGrid(img: ImageData, cols: number, rows: number): ImageData[] {
  const cellW = Math.floor(img.width / cols);
  const cellH = Math.floor(img.height / rows);
  const cells: ImageData[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x1 = col * cellW;
      const y1 = row * cellH;
      cells.push(cropPixels(img.pixels, img.width, x1, y1, x1 + cellW, y1 + cellH));
    }
  }

  return cells;
}

// ── 5×7 bitmap font for grid template numbers ────────────────────────────

const DIGIT_FONT: Record<string, number[]> = {
  '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  '2': [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
  '3': [0x0e, 0x11, 0x01, 0x06, 0x01, 0x11, 0x0e],
  '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  '6': [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
};

function drawDigitScaled(
  pixels: Buffer,
  imgW: number,
  digit: string,
  ox: number,
  oy: number,
  r: number,
  g: number,
  b: number,
  scale: number = 1
): void {
  const rows = DIGIT_FONT[digit];
  if (!rows) return;
  for (let dy = 0; dy < 7; dy++) {
    const row = rows[dy]!;
    for (let dx = 0; dx < 5; dx++) {
      if (row & (1 << (4 - dx))) {
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const px = ox + dx * scale + sx;
            const py = oy + dy * scale + sy;
            const i = (py * imgW + px) * 4;
            pixels[i] = r;
            pixels[i + 1] = g;
            pixels[i + 2] = b;
            pixels[i + 3] = 255;
          }
        }
      }
    }
  }
}

function drawNumberScaled(
  pixels: Buffer,
  imgW: number,
  num: number,
  cx: number,
  cy: number,
  r: number,
  g: number,
  b: number,
  scale: number = 1
): void {
  const digits = String(num);
  const charW = 5 * scale;
  const gapW = 1 * scale;
  const totalW = digits.length * (charW + gapW) - gapW;
  const charH = 7 * scale;
  const ox = cx - Math.floor(totalW / 2);
  const oy = cy - Math.floor(charH / 2);
  for (let i = 0; i < digits.length; i++) {
    drawDigitScaled(pixels, imgW, digits[i]!, ox + i * (charW + gapW), oy, r, g, b, scale);
  }
}

/** Draw a filled circle at (cx, cy) with given radius and color */
function drawFilledCircle(
  pixels: Buffer,
  imgW: number,
  imgH: number,
  cx: number,
  cy: number,
  radius: number,
  r: number,
  g: number,
  b: number
): void {
  const r2 = radius * radius;
  const x1 = Math.max(0, Math.floor(cx - radius));
  const x2 = Math.min(imgW - 1, Math.ceil(cx + radius));
  const y1 = Math.max(0, Math.floor(cy - radius));
  const y2 = Math.min(imgH - 1, Math.ceil(cy + radius));
  for (let py = y1; py <= y2; py++) {
    for (let px = x1; px <= x2; px++) {
      const dx = px - cx;
      const dy = py - cy;
      if (dx * dx + dy * dy <= r2) {
        const i = (py * imgW + px) * 4;
        pixels[i] = r;
        pixels[i + 1] = g;
        pixels[i + 2] = b;
        pixels[i + 3] = 255;
      }
    }
  }
}

/**
 * Generate a grid template PNG with RED grid lines and white-circle numbered cells.
 * Godogen-style: red 2px lines, white filled circles with black numbers.
 * If the background color is close to red, switch lines to blue.
 */
export function generateGridTemplate(
  cols: number,
  rows: number,
  cellSize: number,
  bgColor: BgColor
): ImageData {
  const lineWidth = 2;
  const width = cols * cellSize;
  const height = rows * cellSize;
  const pixels = Buffer.alloc(width * height * 4);

  // Fill background
  for (let i = 0; i < width * height; i++) {
    pixels[i * 4] = bgColor.r;
    pixels[i * 4 + 1] = bgColor.g;
    pixels[i * 4 + 2] = bgColor.b;
    pixels[i * 4 + 3] = 255;
  }

  // Grid line color — RED by default, BLUE if bg is close to red
  const closeToRed =
    Math.abs(bgColor.r - 255) < 60 && Math.abs(bgColor.g - 0) < 60 && Math.abs(bgColor.b - 0) < 60;
  const lineR = closeToRed ? 0 : 255;
  const lineG = 0;
  const lineB = closeToRed ? 255 : 0;

  // Draw vertical grid lines (2px wide)
  for (let col = 0; col <= cols; col++) {
    const xBase = col * cellSize;
    for (let lx = 0; lx < lineWidth; lx++) {
      const x = Math.min(xBase + lx, width - 1);
      for (let y = 0; y < height; y++) {
        const i = (y * width + x) * 4;
        pixels[i] = lineR;
        pixels[i + 1] = lineG;
        pixels[i + 2] = lineB;
        pixels[i + 3] = 255;
      }
    }
  }

  // Draw horizontal grid lines (2px wide)
  for (let row = 0; row <= rows; row++) {
    const yBase = row * cellSize;
    for (let ly = 0; ly < lineWidth; ly++) {
      const y = Math.min(yBase + ly, height - 1);
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        pixels[i] = lineR;
        pixels[i + 1] = lineG;
        pixels[i + 2] = lineB;
        pixels[i + 3] = 255;
      }
    }
  }

  // Number each cell with a white circle background and black digit
  const circleRadius = Math.max(15, Math.floor(cellSize * 0.2));
  // Pick font scale: 2x for cells >= 128, 3x for cells >= 200, else 1x
  const fontScale = cellSize >= 200 ? 3 : cellSize >= 100 ? 2 : 1;

  let cellNum = 1;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = col * cellSize + Math.floor(cellSize / 2);
      const cy = row * cellSize + Math.floor(cellSize / 2);

      // White filled circle
      drawFilledCircle(pixels, width, height, cx, cy, circleRadius, 255, 255, 255);

      // Black number on top
      drawNumberScaled(pixels, width, cellNum, cx, cy, 0, 0, 0, fontScale);
      cellNum++;
    }
  }

  return { width, height, pixels };
}

/**
 * Grid slicing with edge cropping — removes grid lines from each cell.
 * Crops `lineWidth + 2` pixels (default 4px) from each edge of each cell,
 * matching godogen's approach of removing the red lines + margin.
 */
export function sliceGridCropped(
  img: ImageData,
  cols: number,
  rows: number,
  cropMargin?: number
): ImageData[] {
  const cellW = Math.floor(img.width / cols);
  const cellH = Math.floor(img.height / rows);
  // Crop ~3% of cell size (handles upscaled grid lines + JPEG artifacts)
  const margin = cropMargin ?? Math.max(4, Math.round(Math.min(cellW, cellH) * 0.03));
  const cells: ImageData[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x1 = col * cellW + margin;
      const y1 = row * cellH + margin;
      const x2 = Math.min((col + 1) * cellW - margin, img.width);
      const y2 = Math.min((row + 1) * cellH - margin, img.height);
      if (x2 > x1 && y2 > y1) {
        cells.push(cropPixels(img.pixels, img.width, x1, y1, x2, y2));
      }
    }
  }

  return cells;
}
