import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import { decodeImage, encodePNG } from '../pipeline/png.js';
import {
  detectBgColor,
  processSpriteColor,
  pixelateDownscale,
  snapToPixelArtSize,
} from '../pipeline/image-ops.js';
import { forgeResponse, errorResponse } from '../utils/response-helpers.js';
import { log } from '../utils/logger.js';
import type { McpToolResponse, ForgeResult } from '../types/common.js';

export const optimizeSpriteTool = {
  name: 'optimize_sprite',
  description:
    'Optimize an existing sprite PNG for pixel art games. Downscales large AI-generated sprites to proper pixel art resolution using area-averaging (not blurry bilinear). Also optionally removes background and crops. Use this to convert oversized "pixel art style" images into true pixel art at game-ready sizes.',
  inputSchema: {
    type: 'object',
    properties: {
      inputPath: {
        type: 'string',
        description: 'Path to the input PNG file',
      },
      outputPath: {
        type: 'string',
        description: 'Output path (default: overwrites input)',
      },
      size: {
        type: 'number',
        description:
          'Target size in pixels for the longest side. Snaps to nearest standard size (16, 24, 32, 48, 64, 96, 128). Recommended: 16-24 for icons/particles, 32 for tiles, 48 for sprites, 64 for characters, 96-128 for bosses.',
      },
      removeBackground: {
        type: 'boolean',
        description: 'Auto-detect and remove background color (default: true)',
      },
      square: {
        type: 'boolean',
        description: 'Pad output to square (default: false)',
      },
    },
    required: ['inputPath', 'size'],
  },
};

export async function handleOptimizeSprite(input: unknown): Promise<McpToolResponse> {
  try {
    const args = input as Record<string, unknown>;
    const inputPath = args.inputPath as string;
    const outputPath = (args.outputPath as string) ?? inputPath;
    const size = args.size as number;
    const removeBg = (args.removeBackground as boolean) ?? true;
    const square = (args.square as boolean) ?? false;

    const snappedSize = snapToPixelArtSize(size);
    log(`Optimizing: ${inputPath} → ${snappedSize}px (requested: ${size})`);

    const buf = await readFile(resolve(inputPath));
    const img = decodeImage(buf);
    log(`Input: ${img.width}x${img.height} (${buf.length} bytes)`);

    let { width, height, pixels } = img;

    if (removeBg) {
      const bgColor = detectBgColor(pixels, width, height);
      log(`Detected bg: rgb(${bgColor.r},${bgColor.g},${bgColor.b})`);
      const processed = processSpriteColor(img, bgColor, {
        threshold: 40,
        square,
        size: snappedSize,
      });
      width = processed.width;
      height = processed.height;
      pixels = processed.pixels;
    } else {
      // Just downscale, no bg removal
      if (snappedSize > 0 && (width > snappedSize || height > snappedSize)) {
        const scale = snappedSize / Math.max(width, height);
        const nw = Math.max(1, Math.round(width * scale));
        const nh = Math.max(1, Math.round(height * scale));
        const downscaled = pixelateDownscale(pixels, width, height, nw, nh);
        width = downscaled.width;
        height = downscaled.height;
        pixels = downscaled.pixels;
      }
    }

    const pngBuf = encodePNG(width, height, pixels);

    const absPath = resolve(outputPath);
    await mkdir(dirname(absPath), { recursive: true });
    await writeFile(absPath, pngBuf);

    const result: ForgeResult = {
      path: outputPath,
      width,
      height,
      size: pngBuf.length,
    };

    const savings = Math.round((1 - pngBuf.length / buf.length) * 100);
    log(`Saved: ${outputPath} (${width}x${height}, ${pngBuf.length} bytes, ${savings}% smaller)`);
    return forgeResponse([result], { originalSize: buf.length, savings: `${savings}%` });
  } catch (err) {
    return errorResponse(err instanceof Error ? err : new Error(String(err)));
  }
}
