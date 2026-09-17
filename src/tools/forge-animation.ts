import { writeFile, mkdir, unlink } from 'fs/promises';
import { dirname, resolve } from 'path';
import { tmpdir } from 'os';
import { join } from 'path';
import { generate } from '../engine/gemini.js';
import {
  buildAnimationPrompt,
  buildAnimationFramePrompt,
  buildTemplateAnimationUserPrompt,
  buildTemplateSystemPrompt,
  computeGridLayout,
} from '../pipeline/prompt-builder.js';
import { decodeImage, encodePNG, detectFormat } from '../pipeline/png.js';
import {
  splitAndProcess,
  snapToPixelArtSize,
  sliceGridCropped,
  generateGridTemplate,
  processSpriteColor,
  detectBgColor,
} from '../pipeline/image-ops.js';
import {
  resolveBackground,
  bgToRgb,
  reconcileBgColor,
  BG_COLOR_MAP,
  VALID_BACKGROUNDS,
} from '../pipeline/background.js';
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
        enum: ['auto', ...VALID_BACKGROUNDS],
        description:
          'Background color for generation. Use "auto" to pick based on description. Use "chromakey" for best transparency (HSV-based green screen removal). Named colors: chromakey, forest, sky, dungeon, lava, ocean, sand, snow, night. (default: black)',
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
      useTemplate: {
        type: 'boolean',
        description:
          'Use grid template reference for precise frame placement (default: false). When true, generates a numbered grid template and sends it as a reference image for more consistent frame splitting.',
      },
      useReferenceChain: {
        type: 'boolean',
        description:
          'Generate each frame individually using the first frame as style reference (default: true). Produces much more consistent animations than sprite sheet splitting. Each frame is a separate API call with the idle/first frame as reference image.',
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
    const bgInput = args.background as string | undefined;
    const size = args.size as number | undefined;
    const square = (args.square as boolean) ?? true;
    const useTemplate = (args.useTemplate as boolean) ?? false;
    const useReferenceChain = (args.useReferenceChain as boolean) ?? true;
    const model = args.model as string | undefined;
    const references = args.references as string[] | undefined;

    const bgKey = resolveBackground(bgInput, description);
    const bgColor = bgToRgb(bgKey);
    const targetSize = snapToPixelArtSize(size ?? 48);

    // ── Reference Chain Mode ──────────────────────────────────────────
    // Generates each frame individually, using frame 0 as reference for consistency.
    // Much better results than sprite sheet splitting.
    if (useReferenceChain && !useTemplate) {
      log(`Using reference-chain mode: generating ${frameCount} frames individually`);

      const results: ForgeResult[] = [];
      let firstFramePath: string | undefined;

      for (let i = 0; i < frameCount; i++) {
        const name = names?.[i] ?? `frame-${i}`;
        const framePath = `${outputPrefix}-${name}.png`;
        const absPath = resolve(framePath);

        // Build per-frame description
        const frameDesc =
          frameDescriptions?.[i] ??
          (i === 0
            ? `idle ready position, ${action}`
            : `${action} frame ${i + 1} of ${frameCount}`);

        const framePrompt = buildAnimationFramePrompt(
          description,
          frameDesc,
          i === 0,
          style,
          bgKey,
          targetSize
        );

        // First frame: use user references only. Subsequent: add first frame as reference.
        const frameRefs = references ? [...references] : [];
        if (i > 0 && firstFramePath) {
          frameRefs.push(firstFramePath);
        }

        log(`Frame ${i} (${name}): ${frameDesc}`);

        const images = await generate({
          prompt: framePrompt,
          model,
          aspect: '1:1',
          references: frameRefs.length ? frameRefs : undefined,
        });

        const imgBuf = Buffer.from(images[0]!.b64, 'base64');
        const format = detectFormat(imgBuf);
        const decoded = decodeImage(imgBuf);
        const threshold = format === 'jpeg' ? 60 : 40;

        const detectedBg = detectBgColor(decoded.pixels, decoded.width, decoded.height);
        const useBg = reconcileBgColor(bgColor, detectedBg, bgKey);

        const processed = processSpriteColor(decoded, useBg, {
          square,
          threshold,
          size: targetSize,
          chromakey: bgKey === 'chromakey',
        });

        await mkdir(dirname(absPath), { recursive: true });
        const pngBuf = encodePNG(processed.width, processed.height, processed.pixels);
        await writeFile(absPath, pngBuf);

        // Save first frame path as reference for subsequent frames
        if (i === 0) {
          firstFramePath = absPath;
        }

        results.push({
          path: framePath,
          width: processed.width,
          height: processed.height,
          size: pngBuf.length,
        });

        log(`Frame: ${framePath} (${processed.width}x${processed.height})`);
      }

      return forgeResponse(results, {
        prompt: `reference-chain: ${frameCount} individual frames`,
        model: model ?? DEFAULT_MODEL,
        frameCount: results.length,
        useTemplate: false,
      });
    }

    // ── Legacy Sprite Sheet Mode ──────────────────────────────────────
    let prompt: string;
    let allRefs = references ? [...references] : [];
    let tempTemplatePath: string | undefined;

    let systemInstruction: string | undefined;

    // Grid layout for template mode (reused after generation for slicing)
    let templateCols = 0;
    let templateRows = 0;

    if (useTemplate) {
      // Template-guided generation — use square-ish grid like godogen
      const grid = computeGridLayout(frameCount);
      templateCols = grid.cols;
      templateRows = grid.rows;
      const cellSize = 256;
      const total = templateCols * templateRows;
      const bgHex = BG_COLOR_MAP[bgKey].hex;

      const template = generateGridTemplate(templateCols, templateRows, cellSize, bgColor);
      const templatePng = encodePNG(template.width, template.height, template.pixels);
      tempTemplatePath = join(tmpdir(), `pixelforge-template-${Date.now()}.png`);
      await writeFile(tempTemplatePath, templatePng);

      allRefs = [tempTemplatePath, ...allRefs];
      systemInstruction = buildTemplateSystemPrompt(templateCols, templateRows, total, bgHex);
      prompt = buildTemplateAnimationUserPrompt(description, action, frameDescriptions);
      log(`Using template-guided generation (${templateCols}x${templateRows} grid)`);
    } else {
      prompt = buildAnimationPrompt(
        description,
        frameCount,
        action,
        frameDescriptions,
        style,
        bgKey
      );
    }

    log(`Prompt: ${prompt}`);
    log(`Background: ${bgKey} (rgb: ${bgColor.r},${bgColor.g},${bgColor.b})`);

    const images = await generate({
      prompt,
      model,
      aspect: useTemplate ? computeGridLayout(frameCount).aspect : '4:3',
      references: allRefs.length ? allRefs : undefined,
      systemInstruction,
    });

    // Cleanup temp template
    if (tempTemplatePath) {
      await unlink(tempTemplatePath).catch(() => {});
    }

    const imgBuf = Buffer.from(images[0]!.b64, 'base64');
    const format = detectFormat(imgBuf);
    const decoded = decodeImage(imgBuf);
    const threshold = format === 'jpeg' ? 60 : 25;

    // Detect actual bg from edges, reconcile with hint
    const detectedBg = detectBgColor(decoded.pixels, decoded.width, decoded.height);
    const useBg = reconcileBgColor(bgColor, detectedBg, bgKey);

    log(
      `Raw sheet: ${decoded.width}x${decoded.height} (${format}, detected: rgb(${detectedBg.r},${detectedBg.g},${detectedBg.b}), using: rgb(${useBg.r},${useBg.g},${useBg.b}))`
    );

    let frameDatas;

    if (useTemplate) {
      // Deterministic grid slicing with edge crop (removes red lines + margin)
      const cells = sliceGridCropped(decoded, templateCols, templateRows);
      // Process each cell: remove bg, crop, square, downscale
      frameDatas = cells.slice(0, frameCount).map((cell) =>
        processSpriteColor(cell, useBg, {
          square,
          threshold,
          size: targetSize,
          chromakey: bgKey === 'chromakey',
        })
      );
    } else {
      // Blob-based splitting
      frameDatas = splitAndProcess(decoded, {
        square,
        expectedFrames: frameCount,
        threshold,
        maxSize: targetSize,
        bgColorHint: useBg,
        chromakey: bgKey === 'chromakey',
      });
    }

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
      useTemplate,
    });
  } catch (err) {
    return errorResponse(err instanceof Error ? err : new Error(String(err)));
  }
}
