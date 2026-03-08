import { writeFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import { generate } from '../engine/gemini.js';
import { buildAnimationPrompt } from '../pipeline/prompt-builder.js';
import { decodeImage, encodePNG, detectFormat } from '../pipeline/png.js';
import { splitAndProcess, snapToPixelArtSize } from '../pipeline/image-ops.js';
import { forgeResponse, errorResponse } from '../utils/response-helpers.js';
import { log } from '../utils/logger.js';
import { MODEL_ALIASES, DEFAULT_MODEL } from '../engine/models.js';
import { VALID_STYLES } from '../pipeline/prompt-builder.js';
import type { McpToolResponse, Style, ForgeResult } from '../types/common.js';

export const forgeAnimationTool = {
  name: 'forge_animation',
  description:
    'Generate pixel art animation frames. Produces a sprite sheet via Gemini, then automatically splits it into individual frame PNGs with background removal and cropping. Returns an array of ready-to-use frame files.',
  inputSchema: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description: 'What is being animated (e.g. "green slime enemy", "player knight")',
      },
      action: {
        type: 'string',
        description:
          'What the animation shows (e.g. "bouncing up and down", "walking cycle", "idle breathing")',
      },
      frames: {
        type: 'number',
        description: 'Number of animation frames (default: 3)',
      },
      frameDescriptions: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Optional per-frame descriptions (e.g. ["compressed flat", "stretching up", "at peak"])',
      },
      outputPrefix: {
        type: 'string',
        description:
          'Output path prefix — frames saved as {prefix}-{name}.png (e.g. "public/assets/games/rpg/slime")',
      },
      names: {
        type: 'array',
        items: { type: 'string' },
        description: 'Frame names (default: frame-0, frame-1, ...)',
      },
      style: {
        type: 'string',
        enum: VALID_STYLES,
        description: 'Visual style preset (default: clean)',
      },
      background: {
        type: 'string',
        enum: ['black', 'white'],
        description: 'Generation background color (default: black)',
      },
      size: {
        type: 'number',
        description:
          'Target frame size in pixels (default: 48). Snaps to nearest standard size. Recommended: 16-24 for particle effects/small FX, 32 for item animations, 48 for character animations (PixelLab default), 64 for detailed characters, 96-128 for bosses. Set to 0 to skip downscale.',
      },
      square: {
        type: 'boolean',
        description: 'Pad each frame to square (default: true)',
      },
      model: {
        type: 'string',
        description: `Model alias or full ID. Aliases: ${MODEL_ALIASES.join(', ')} (default: ${DEFAULT_MODEL})`,
      },
      references: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Paths to existing PNG/JPEG assets to match visual style. The animation frames will be generated in a similar art style, color palette, and detail level as the reference images.',
      },
    },
    required: ['description', 'action', 'outputPrefix'],
  },
};

export async function handleForgeAnimation(input: unknown): Promise<McpToolResponse> {
  try {
    const args = input as Record<string, unknown>;
    const description = args.description as string;
    const action = args.action as string;
    const frameCount = (args.frames as number) ?? 3;
    const frameDescriptions = args.frameDescriptions as string[] | undefined;
    const outputPrefix = args.outputPrefix as string;
    const names = args.names as string[] | undefined;
    const style = (args.style as Style) ?? 'clean';
    const bg = (args.background as 'black' | 'white') ?? 'black';
    const size = args.size as number | undefined;
    const square = (args.square as boolean) ?? true;
    const model = args.model as string | undefined;
    const references = args.references as string[] | undefined;

    const prompt = buildAnimationPrompt(
      description,
      frameCount,
      action,
      frameDescriptions,
      style,
      bg
    );
    log(`Prompt: ${prompt}`);

    const images = await generate({ prompt, model, aspect: '4:3', references });
    const imgBuf = Buffer.from(images[0]!.b64, 'base64');
    const format = detectFormat(imgBuf);
    const decoded = decodeImage(imgBuf);
    const threshold = format === 'jpeg' ? 60 : 25;

    log(`Raw sheet: ${decoded.width}x${decoded.height} (${format}, threshold: ${threshold})`);

    const targetSize = snapToPixelArtSize(size ?? 48);
    const frameDatas = splitAndProcess(decoded, {
      square,
      expectedFrames: frameCount,
      threshold,
      maxSize: targetSize,
    });

    log(`Split into ${frameDatas.length} frames`);

    const results: ForgeResult[] = [];
    for (let i = 0; i < frameDatas.length; i++) {
      const frame = frameDatas[i]!;
      const name = names?.[i] ?? `frame-${i}`;
      const framePath = `${outputPrefix}-${name}.png`;
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

      log(`Frame: ${framePath} (${frame.width}x${frame.height})`);
    }

    return forgeResponse(results, {
      prompt,
      model: model ?? DEFAULT_MODEL,
      frameCount: frameDatas.length,
    });
  } catch (err) {
    return errorResponse(err instanceof Error ? err : new Error(String(err)));
  }
}
