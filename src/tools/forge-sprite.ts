import { writeFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import { generate } from '../engine/gemini.js';
import { buildSpritePrompt } from '../pipeline/prompt-builder.js';
import { decodeImage, encodePNG, detectFormat } from '../pipeline/png.js';
import { detectBgColor, processSpriteColor, snapToPixelArtSize } from '../pipeline/image-ops.js';
import { forgeResponse, errorResponse } from '../utils/response-helpers.js';
import { log } from '../utils/logger.js';
import { MODEL_ALIASES, DEFAULT_MODEL } from '../engine/models.js';
import { VALID_STYLES } from '../pipeline/prompt-builder.js';
import type { McpToolResponse, Style, ForgeResult } from '../types/common.js';

export const forgeSpriteTool = {
  name: 'forge_sprite',
  description:
    'Generate a single pixel art sprite. Handles prompt engineering, generation via Gemini, and post-processing (crop, background removal, pixelation downscale, square padding) automatically. Returns a clean, transparent PNG at proper pixel art resolution. Output size snaps to standard pixel art sizes (16, 24, 32, 48, 64, 96, 128).',
  inputSchema: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description:
          'What the sprite is (e.g. "green slime enemy with horns", "cyan spaceship", "golden coin")',
      },
      outputPath: {
        type: 'string',
        description: 'Output file path (e.g. "public/assets/games/rpg/slime.png")',
      },
      size: {
        type: 'number',
        description:
          'Target sprite size in pixels (default: 48). Snaps to nearest standard size. Recommended: 16-24 for icons/projectiles/powerups, 32 for tiles/small sprites, 48 for game sprites/characters (PixelLab default), 64 for detailed characters, 96-128 for bosses/large objects. Set to 0 to skip downscale.',
      },
      style: {
        type: 'string',
        enum: VALID_STYLES,
        description: 'Visual style preset (default: clean)',
      },
      background: {
        type: 'string',
        enum: ['black', 'white'],
        description: 'Generation background color for extraction (default: black)',
      },
      aspect: {
        type: 'string',
        enum: ['1:1', '16:9', '9:16', '4:3', '3:4'],
        description: 'Aspect ratio (default: 1:1)',
      },
      square: {
        type: 'boolean',
        description: 'Pad output to square (default: true)',
      },
      model: {
        type: 'string',
        description: `Model alias or full ID. Aliases: ${MODEL_ALIASES.join(', ')} (default: ${DEFAULT_MODEL})`,
      },
      references: {
        type: 'array',
        items: { type: 'string' },
        description: 'Paths to existing PNG/JPEG assets to match visual style.',
      },
    },
    required: ['description', 'outputPath'],
  },
};

export async function handleForgeSprite(input: unknown): Promise<McpToolResponse> {
  try {
    const args = input as Record<string, unknown>;
    const description = args.description as string;
    const outputPath = args.outputPath as string;
    const size = args.size as number | undefined;
    const style = (args.style as Style) ?? 'clean';
    const bg = (args.background as 'black' | 'white') ?? 'black';
    const aspect = (args.aspect as string) ?? '1:1';
    const square = (args.square as boolean) ?? true;
    const model = args.model as string | undefined;
    const references = args.references as string[] | undefined;

    const targetSize = snapToPixelArtSize(size ?? 48);
    const prompt = buildSpritePrompt(description, style, bg, targetSize);
    log(`Prompt: ${prompt}`);

    const images = await generate({ prompt, model, aspect, references });
    const imgBuf = Buffer.from(images[0]!.b64, 'base64');
    const format = detectFormat(imgBuf);
    const decoded = decodeImage(imgBuf);
    const threshold = format === 'jpeg' ? 60 : 40;

    const bgColor = detectBgColor(decoded.pixels, decoded.width, decoded.height);
    log(
      `Raw image: ${decoded.width}x${decoded.height} (${format}, bg: rgb(${bgColor.r},${bgColor.g},${bgColor.b}), threshold: ${threshold})`
    );
    const processed = processSpriteColor(decoded, bgColor, { square, threshold, size: targetSize });
    const pngBuf = encodePNG(processed.width, processed.height, processed.pixels);

    const absPath = resolve(outputPath);
    await mkdir(dirname(absPath), { recursive: true });
    await writeFile(absPath, pngBuf);

    const result: ForgeResult = {
      path: outputPath,
      width: processed.width,
      height: processed.height,
      size: pngBuf.length,
    };

    log(`Saved: ${outputPath} (${result.width}x${result.height}, target: ${targetSize}px)`);
    return forgeResponse([result], { prompt, model: model ?? DEFAULT_MODEL });
  } catch (err) {
    return errorResponse(err instanceof Error ? err : new Error(String(err)));
  }
}
