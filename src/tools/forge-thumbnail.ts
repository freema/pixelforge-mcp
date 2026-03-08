import { writeFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import { generate } from '../engine/gemini.js';
import { buildThumbnailPrompt } from '../pipeline/prompt-builder.js';
import { decodeImage } from '../pipeline/png.js';
import { forgeResponse, errorResponse } from '../utils/response-helpers.js';
import { log } from '../utils/logger.js';
import { MODEL_ALIASES, DEFAULT_MODEL } from '../engine/models.js';
import { VALID_STYLES } from '../pipeline/prompt-builder.js';
import type { McpToolResponse, Style, ForgeResult } from '../types/common.js';

export const forgeThumbnailTool = {
  name: 'forge_thumbnail',
  description:
    'Generate a pixel art game thumbnail/screenshot. Use reference images to match the visual style of actual in-game sprites. Best for store listings, game cards, and preview images.',
  inputSchema: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description:
          'Scene description (e.g. "space shooter, cyan spaceship vs rows of colorful aliens, dark space")',
      },
      outputPath: {
        type: 'string',
        description: 'Output file path (e.g. "public/assets/games/invaders/thumbnail.png")',
      },
      references: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Paths to actual game sprite PNGs — STRONGLY RECOMMENDED. The thumbnail will visually match these assets so the preview looks like the real game. Pass the main character, enemies, and key objects.',
      },
      aspect: {
        type: 'string',
        enum: ['1:1', '16:9', '9:16', '4:3', '3:4'],
        description: 'Aspect ratio (default: 4:3)',
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

export async function handleForgeThumbnail(input: unknown): Promise<McpToolResponse> {
  try {
    const args = input as Record<string, unknown>;
    const description = args.description as string;
    const outputPath = args.outputPath as string;
    const references = args.references as string[] | undefined;
    const aspect = (args.aspect as string) ?? '4:3';
    const style = (args.style as Style) ?? 'clean';
    const model = args.model as string | undefined;

    const prompt = buildThumbnailPrompt(description, style);
    log(`Prompt: ${prompt}`);

    const images = await generate({ prompt, model, aspect, references });
    const imgBuf = Buffer.from(images[0]!.b64, 'base64');

    const absPath = resolve(outputPath);
    await mkdir(dirname(absPath), { recursive: true });
    await writeFile(absPath, imgBuf);

    const result: ForgeResult = {
      path: outputPath,
      width: 0,
      height: 0,
      size: imgBuf.length,
    };

    try {
      const decoded = decodeImage(imgBuf);
      result.width = decoded.width;
      result.height = decoded.height;
    } catch {
      // dimensions unknown
    }

    log(`Saved: ${outputPath} (${result.width}x${result.height})`);
    return forgeResponse([result], { prompt, model: model ?? DEFAULT_MODEL });
  } catch (err) {
    return errorResponse(err instanceof Error ? err : new Error(String(err)));
  }
}
