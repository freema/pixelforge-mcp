import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import { decodeImage, encodePNG } from '../pipeline/png.js';
import { processSprite, splitAndProcess } from '../pipeline/image-ops.js';
import { forgeResponse, errorResponse } from '../utils/response-helpers.js';
import { log } from '../utils/logger.js';
import type { McpToolResponse, ForgeResult } from '../types/common.js';

export const processSpriteTool = {
  name: 'process_sprite',
  description:
    'Post-process an existing PNG image into a clean sprite. Handles background removal, auto-crop, square padding, and sprite sheet splitting. Use this for images from external sources that need processing.',
  inputSchema: {
    type: 'object',
    properties: {
      inputPath: {
        type: 'string',
        description: 'Path to the input PNG file',
      },
      outputPath: {
        type: 'string',
        description:
          'Output path. For split mode: prefix for frame files (e.g. "assets/snake" → "assets/snake-head.png")',
      },
      threshold: {
        type: 'number',
        description: 'Color detection threshold 0-255 (default: 20)',
      },
      square: {
        type: 'boolean',
        description: 'Pad output to square (default: false)',
      },
      padding: {
        type: 'number',
        description: 'Padding around content in pixels (default: 2)',
      },
      split: {
        type: 'boolean',
        description: 'Split sprite sheet into individual sprites by detecting content boundaries',
      },
      names: {
        type: 'array',
        items: { type: 'string' },
        description: 'Names for split sprites (default: 0, 1, 2, ...)',
      },
      skipCrop: {
        type: 'boolean',
        description: 'Skip auto-crop step',
      },
      skipTransparent: {
        type: 'boolean',
        description: 'Skip background removal step',
      },
    },
    required: ['inputPath'],
  },
};

export async function handleProcessSprite(input: unknown): Promise<McpToolResponse> {
  try {
    const args = input as Record<string, unknown>;
    const inputPath = args.inputPath as string;
    const outputPath = args.outputPath as string | undefined;
    const threshold = args.threshold as number | undefined;
    const square = (args.square as boolean) ?? false;
    const padding = args.padding as number | undefined;
    const split = (args.split as boolean) ?? false;
    const names = args.names as string[] | undefined;
    const skipCrop = (args.skipCrop as boolean) ?? false;
    const skipTransparent = (args.skipTransparent as boolean) ?? false;

    log(`Processing: ${inputPath}`);

    const buf = await readFile(resolve(inputPath));
    const img = decodeImage(buf);
    log(`Input: ${img.width}x${img.height}`);

    if (split) {
      const frames = splitAndProcess(img, { threshold, padding, square });
      log(`Split into ${frames.length} sprites`);

      const outBase = outputPath ?? inputPath.replace(/\.png$/, '');
      const results: ForgeResult[] = [];

      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i]!;
        const name = names?.[i] ?? String(i);
        const framePath = `${outBase}-${name}.png`;
        const absPath = resolve(framePath);

        await mkdir(dirname(absPath), { recursive: true });
        const pngBuf = encodePNG(frame.width, frame.height, frame.pixels);
        await writeFile(absPath, pngBuf);

        results.push({
          path: framePath,
          width: frame.width,
          height: frame.height,
          size: pngBuf.length,
        });
      }

      return forgeResponse(results);
    } else {
      const processed = processSprite(img, {
        threshold,
        padding,
        square,
        skipCrop,
        skipTransparent,
      });

      const finalPath = outputPath ?? inputPath;
      const absPath = resolve(finalPath);
      await mkdir(dirname(absPath), { recursive: true });
      const pngBuf = encodePNG(processed.width, processed.height, processed.pixels);
      await writeFile(absPath, pngBuf);

      const result: ForgeResult = {
        path: finalPath,
        width: processed.width,
        height: processed.height,
        size: pngBuf.length,
      };

      log(`Saved: ${finalPath} (${processed.width}x${processed.height})`);
      return forgeResponse([result]);
    }
  } catch (err) {
    return errorResponse(err instanceof Error ? err : new Error(String(err)));
  }
}
