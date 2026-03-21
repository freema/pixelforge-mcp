import { writeFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import { generate } from '../engine/gemini.js';
import { buildTilesetPrompt } from '../pipeline/prompt-builder.js';
import { decodeImage, encodePNG, detectFormat } from '../pipeline/png.js';
import { pixelateDownscale, snapToPixelArtSize } from '../pipeline/image-ops.js';
import { forgeResponse, errorResponse } from '../utils/response-helpers.js';
import { log } from '../utils/logger.js';
import { MODEL_ALIASES, DEFAULT_MODEL } from '../engine/models.js';
import { VALID_STYLES } from '../pipeline/prompt-builder.js';
import type { McpToolResponse, Style, ForgeResult } from '../types/common.js';

export const forgeTilesetTool = {
  name: 'forge_tileset',
  description:
    'Generate a seamless tileable pixel art texture. Produces a square texture that tiles seamlessly in all directions — ideal for terrain, floors, walls, and backgrounds. No background removal is applied; the texture fills the entire canvas.',
  inputSchema: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description:
          'What the texture is (e.g. "grass terrain", "stone brick wall", "wooden floor planks", "water surface")',
      },
      outputPath: {
        type: 'string',
        description: 'Output file path (e.g. "public/assets/tiles/grass.png")',
      },
      size: {
        type: 'number',
        description:
          'Target texture size in pixels (default: 32). Snaps to nearest standard size. Common: 16 for retro, 32 for standard, 64 for detailed.',
      },
      style: {
        type: 'string',
        enum: VALID_STYLES,
        description: 'Visual style preset (default: clean)',
      },
      model: {
        type: 'string',
        description: `Model alias or full ID. Aliases: ${MODEL_ALIASES.join(', ')} (default: ${DEFAULT_MODEL})`,
      },
    },
    required: ['description', 'outputPath'],
  },
};

export async function handleForgeTileset(input: unknown): Promise<McpToolResponse> {
  try {
    const args = input as Record<string, unknown>;
    const description = args.description as string;
    const outputPath = args.outputPath as string;
    const size = args.size as number | undefined;
    const style = (args.style as Style) ?? 'clean';
    const model = args.model as string | undefined;

    const targetSize = snapToPixelArtSize(size ?? 32);
    const prompt = buildTilesetPrompt(description, style, targetSize);
    log(`Prompt: ${prompt}`);

    const images = await generate({ prompt, model, aspect: '1:1' });
    const imgBuf = Buffer.from(images[0]!.b64, 'base64');
    const format = detectFormat(imgBuf);
    const decoded = decodeImage(imgBuf);

    log(`Raw texture: ${decoded.width}x${decoded.height} (${format})`);

    // Just pixelate downscale — no bg removal for textures
    let result = decoded;
    if (targetSize > 0 && (decoded.width > targetSize || decoded.height > targetSize)) {
      result = pixelateDownscale(decoded.pixels, decoded.width, decoded.height, targetSize, targetSize);
    }

    const pngBuf = encodePNG(result.width, result.height, result.pixels);

    const absPath = resolve(outputPath);
    await mkdir(dirname(absPath), { recursive: true });
    await writeFile(absPath, pngBuf);

    const forgeResult: ForgeResult = {
      path: outputPath,
      width: result.width,
      height: result.height,
      size: pngBuf.length,
    };

    log(`Saved: ${outputPath} (${forgeResult.width}x${forgeResult.height}, target: ${targetSize}px)`);
    return forgeResponse([forgeResult], { prompt, model: model ?? DEFAULT_MODEL });
  } catch (err) {
    return errorResponse(err instanceof Error ? err : new Error(String(err)));
  }
}
