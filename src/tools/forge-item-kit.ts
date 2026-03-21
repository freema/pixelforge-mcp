import { writeFile, mkdir, unlink } from 'fs/promises';
import { dirname, resolve } from 'path';
import { tmpdir } from 'os';
import { join } from 'path';
import { generate } from '../engine/gemini.js';
import {
  buildItemKitUserPrompt,
  buildTemplateSystemPrompt,
  computeGridLayout,
} from '../pipeline/prompt-builder.js';
import { decodeImage, encodePNG, detectFormat } from '../pipeline/png.js';
import {
  sliceGridCropped,
  generateGridTemplate,
  processSpriteColor,
  snapToPixelArtSize,
  detectBgColor,
} from '../pipeline/image-ops.js';
import { resolveBackground, bgToRgb, reconcileBgColor, BG_COLOR_MAP, VALID_BACKGROUNDS } from '../pipeline/background.js';
import { forgeResponse, errorResponse } from '../utils/response-helpers.js';
import { log } from '../utils/logger.js';
import { MODEL_ALIASES, DEFAULT_MODEL } from '../engine/models.js';
import { VALID_STYLES } from '../pipeline/prompt-builder.js';
import type { McpToolResponse, ForgeResult } from '../types/common.js';

export const forgeItemKitTool = {
  name: 'forge_item_kit',
  description:
    'Generate multiple pixel art sprites in a single batch. Items are generated together on a grid for visual consistency, then split into individual PNGs. Ideal for item sets, inventory icons, collectibles, or any group of related sprites.',
  inputSchema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: { type: 'string' },
        description:
          'List of item descriptions (max 16). E.g. ["red apple", "banana", "cherry", "grapes"]',
      },
      outputPrefix: {
        type: 'string',
        description:
          'Output path prefix — items saved as {prefix}-{name}.png (e.g. "public/assets/items/fruit")',
      },
      names: {
        type: 'array',
        items: { type: 'string' },
        description: 'Custom file names for each item (default: item-0, item-1, ...)',
      },
      size: {
        type: 'number',
        description:
          'Target sprite size in pixels (default: 48). Snaps to nearest standard size.',
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
          'Background color for generation. Use "auto" to pick based on items. (default: black)',
      },
      square: {
        type: 'boolean',
        description: 'Pad each item to square (default: true)',
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
    required: ['items', 'outputPrefix'],
  },
};

export async function handleForgeItemKit(input: unknown): Promise<McpToolResponse> {
  try {
    const args = input as Record<string, unknown>;
    const items = args.items as string[];
    const outputPrefix = args.outputPrefix as string;
    const names = args.names as string[] | undefined;
    const size = args.size as number | undefined;
    const bgInput = args.background as string | undefined;
    const square = (args.square as boolean) ?? true;
    const model = args.model as string | undefined;
    const references = args.references as string[] | undefined;

    if (items.length === 0) {
      return errorResponse(new Error('items array must not be empty'));
    }
    if (items.length > 16) {
      return errorResponse(new Error('items array must have at most 16 items'));
    }

    const bgKey = resolveBackground(bgInput, items.join(' '));
    const bgColor = bgToRgb(bgKey);
    const targetSize = snapToPixelArtSize(size ?? 48);
    const grid = computeGridLayout(items.length);
    const total = grid.cols * grid.rows;
    const bgHex = BG_COLOR_MAP[bgKey].hex;

    // Generate template image for grid-guided generation
    const cellSize = 256;
    const template = generateGridTemplate(grid.cols, grid.rows, cellSize, bgColor);
    const templatePng = encodePNG(template.width, template.height, template.pixels);
    const tempTemplatePath = join(tmpdir(), `pixelforge-itemkit-template-${Date.now()}.png`);
    await writeFile(tempTemplatePath, templatePng);

    const allRefs = [tempTemplatePath, ...(references ?? [])];
    const systemInstruction = buildTemplateSystemPrompt(grid.cols, grid.rows, total, bgHex);
    const prompt = buildItemKitUserPrompt(items);

    log(`Prompt: ${prompt}`);
    log(`System: ${systemInstruction.slice(0, 80)}...`);
    log(`Grid: ${grid.cols}x${grid.rows}, aspect: ${grid.aspect}`);
    log(`Background: ${bgKey} (rgb: ${bgColor.r},${bgColor.g},${bgColor.b})`);

    const images = await generate({
      prompt,
      model,
      aspect: grid.aspect,
      references: allRefs,
      systemInstruction,
    });

    // Cleanup temp template
    await unlink(tempTemplatePath).catch(() => {});

    const imgBuf = Buffer.from(images[0]!.b64, 'base64');
    const format = detectFormat(imgBuf);
    const decoded = decodeImage(imgBuf);
    const threshold = format === 'jpeg' ? 60 : 40;

    // Detect actual bg from edges, reconcile with hint
    const detectedBg = detectBgColor(decoded.pixels, decoded.width, decoded.height);
    const useBg = reconcileBgColor(bgColor, detectedBg, bgKey);

    log(
      `Raw sheet: ${decoded.width}x${decoded.height} (${format}, detected: rgb(${detectedBg.r},${detectedBg.g},${detectedBg.b}), using: rgb(${useBg.r},${useBg.g},${useBg.b}))`
    );

    // Deterministic grid slicing with edge crop (removes red lines + margin)
    const cells = sliceGridCropped(decoded, grid.cols, grid.rows);

    // Take only the first N cells (grid may have more cells than items)
    const itemCells = cells.slice(0, items.length);

    const results: ForgeResult[] = [];
    for (let i = 0; i < itemCells.length; i++) {
      const cell = itemCells[i]!;
      const processed = processSpriteColor(cell, useBg, {
        square,
        threshold,
        size: targetSize,
      });

      const name = names?.[i] ?? `item-${i}`;
      const itemPath = `${outputPrefix}-${name}.png`;
      const absPath = resolve(itemPath);

      await mkdir(dirname(absPath), { recursive: true });
      const pngBuf = encodePNG(processed.width, processed.height, processed.pixels);
      await writeFile(absPath, pngBuf);

      results.push({
        path: itemPath,
        width: processed.width,
        height: processed.height,
        size: pngBuf.length,
      });

      log(`Item: ${itemPath} (${processed.width}x${processed.height})`);
    }

    return forgeResponse(results, {
      prompt,
      model: model ?? DEFAULT_MODEL,
      itemCount: itemCells.length,
      grid: `${grid.cols}x${grid.rows}`,
    });
  } catch (err) {
    return errorResponse(err instanceof Error ? err : new Error(String(err)));
  }
}
