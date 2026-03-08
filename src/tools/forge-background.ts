import { writeFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import { generate } from '../engine/gemini.js';
import { buildBackgroundPrompt } from '../pipeline/prompt-builder.js';
import { forgeResponse, errorResponse } from '../utils/response-helpers.js';
import { log } from '../utils/logger.js';
import { MODEL_ALIASES, DEFAULT_MODEL } from '../engine/models.js';
import { VALID_STYLES } from '../pipeline/prompt-builder.js';
import type { McpToolResponse, Style, ForgeResult } from '../types/common.js';

export const forgeBackgroundTool = {
  name: 'forge_background',
  description:
    'Generate a pixel art game background. No post-processing — outputs the full image as-is, ready for use as a game scene background. Use appropriate aspect ratio for your game resolution.',
  inputSchema: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description:
          'Background scene description (e.g. "deep space with stars and nebula", "forest clearing at night")',
      },
      outputPath: {
        type: 'string',
        description: 'Output file path (e.g. "public/assets/games/invaders/bg.png")',
      },
      aspect: {
        type: 'string',
        enum: ['1:1', '16:9', '9:16', '4:3', '3:4'],
        description:
          'Aspect ratio matching your game resolution (e.g. 3:4 for 480x640 portrait game)',
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
    required: ['description', 'outputPath', 'aspect'],
  },
};

export async function handleForgeBackground(input: unknown): Promise<McpToolResponse> {
  try {
    const args = input as Record<string, unknown>;
    const description = args.description as string;
    const outputPath = args.outputPath as string;
    const aspect = args.aspect as string;
    const style = (args.style as Style) ?? 'clean';
    const model = args.model as string | undefined;

    const prompt = buildBackgroundPrompt(description, style, aspect);
    log(`Prompt: ${prompt}`);

    const images = await generate({ prompt, model, aspect });
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
      const { decodeImage } = await import('../pipeline/png.js');
      const decoded = decodeImage(imgBuf);
      result.width = decoded.width;
      result.height = decoded.height;
    } catch {
      // dimensions unknown, not critical
    }

    log(`Saved: ${outputPath} (${result.width}x${result.height})`);
    return forgeResponse([result], { prompt, model: model ?? DEFAULT_MODEL });
  } catch (err) {
    return errorResponse(err instanceof Error ? err : new Error(String(err)));
  }
}
