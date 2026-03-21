import type { Style, Background } from '../types/common.js';
import { bgPromptFragment, BG_COLOR_MAP } from './background.js';

const STYLE_PRESETS: Record<Style, string> = {
  neon: 'neon glowing, vibrant saturated colors, dark outline, subtle glow effect, emissive highlights',
  retro: '8-bit retro, limited color palette, chunky pixels, classic arcade feel, dithered shading',
  gameboy: '4-color green monochrome palette, Game Boy style, dithered shading, no anti-aliasing',
  snes: '16-bit SNES style, rich colors, detailed shading, clean outlines, smooth gradients',
  clean: 'clean pixel art, solid colors, dark outline, no anti-aliasing, cel-shaded',
};

export const VALID_STYLES = Object.keys(STYLE_PRESETS) as Style[];

// Core rules that dramatically improve pixel art generation quality.
// These are the lessons learned from hundreds of generations.
const PIXEL_ART_CORE = [
  'crisp sharp pixels',
  'no blur',
  'no gradients unless specified',
  'no anti-aliasing on edges',
  'visible individual pixels',
  'limited color palette',
];

const SPRITE_RULES = [
  'single isolated object centered in frame',
  'consistent lighting from top-left',
  'dark pixel outline around the entire shape',
  'no shadow on ground',
  'no perspective distortion',
];

const ANIMATION_RULES = [
  'consistent character size across all frames',
  'identical color palette across all frames',
  'identical outline thickness across all frames',
  'smooth motion transition between frames',
];

const NEGATIVE_ALWAYS =
  'No text, no labels, no watermark, no UI elements, no numbers, no letters, no words, no signature, no border, no frame.';

/**
 * Detail hints based on target pixel art size.
 * Smaller sprites need simpler designs; larger ones can have more detail.
 * Mirrors PixelLab's detail parameter approach.
 */
export function detailHintForSize(size: number): string {
  if (size <= 0) return '';
  if (size <= 24)
    return 'Very simple iconic shape, minimal detail, 3-5 colors maximum, bold readable silhouette, chunky features.';
  if (size <= 32) return 'Simple clean design, limited detail, 5-8 colors, clear silhouette.';
  if (size <= 48) return 'Medium detail, clean readable shapes, 8-12 colors.';
  if (size <= 64) return 'Moderate detail with clear features, up to 16 colors.';
  return 'Detailed pixel art, fine features allowed, rich color palette.';
}

// ── Sprite prompt (godogen-simplified) ────────────────────────────────────

export function buildSpritePrompt(
  description: string,
  style: Style = 'clean',
  bg: Background = 'black',
  size: number = 48
): string {
  const bgEntry = BG_COLOR_MAP[bg];
  const parts = [
    `${description}. ${STYLE_PRESETS[style]}.`,
    `Centered on a solid ${bgEntry.name} (${bgEntry.hex}) background.`,
    PIXEL_ART_CORE.join(', ') + '.',
    SPRITE_RULES.join(', ') + '.',
  ];
  const hint = detailHintForSize(size);
  if (hint) parts.push(hint);
  parts.push(NEGATIVE_ALWAYS);
  return parts.join(' ');
}

// ── Animation prompt (non-template, standard) ─────────────────────────────

export function buildAnimationPrompt(
  description: string,
  frames: number,
  action: string,
  frameDescriptions: string[] | undefined,
  style: Style = 'clean',
  bg: Background = 'black'
): string {
  const ORDINALS = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth'];
  const frameWord =
    frames === 2
      ? 'two'
      : frames === 3
        ? 'three'
        : frames === 4
          ? 'four'
          : frames === 5
            ? 'five'
            : frames === 6
              ? 'six'
              : frames === 7
                ? 'seven'
                : frames === 8
                  ? 'eight'
                  : String(frames);

  let frameInstructions: string;
  if (frameDescriptions?.length) {
    frameInstructions =
      frameDescriptions.map((d, i) => `${ORDINALS[i] ?? 'Next'} pose shows ${d}`).join('. ') + '.';
  } else {
    frameInstructions = `Animation shows: ${action}.`;
  }

  const bgFragment = bgPromptFragment(bg);

  return [
    `Pixel art sprite sheet: exactly ${frameWord} frames of ${description} in a single horizontal row.`,
    frameInstructions,
    STYLE_PRESETS[style] + '.',
    PIXEL_ART_CORE.join(', ') + '.',
    ANIMATION_RULES.join(', ') + '.',
    bgFragment,
    NEGATIVE_ALWAYS,
  ].join(' ');
}

// ── Template system prompt (godogen-style, shared by animation + item kit) ─

/**
 * System instruction for template-guided generation.
 * Tells the model how to interpret the grid template reference image.
 */
export function buildTemplateSystemPrompt(
  cols: number,
  rows: number,
  total: number,
  bgHex: string
): string {
  return [
    `Using the attached template image as an exact layout guide: generate a sprite sheet.`,
    `The image is a ${cols}x${rows} grid of ${total} equal cells separated by red lines.`,
    `Replace each numbered cell with the corresponding content, reading left-to-right, top-to-bottom (cell 1 = first, cell ${total} = last).`,
    ``,
    `Rules:`,
    `- KEEP the red grid lines exactly where they are in the template -- do not remove, shift, or paint over them`,
    `- Each cell's content must be CENTERED in its cell and must NOT cross into adjacent cells`,
    `- CRITICAL: fill ALL empty space in every cell with flat solid ${bgHex} -- no gradients, no scenery, no patterns, just the plain color`,
    `- Maintain consistent style, lighting direction, and proportions across all cells`,
    `- CRITICAL: do NOT draw the numbered circles from the template onto the output -- replace them entirely with the actual drawing content`,
  ].join('\n');
}

// ── Template animation user prompt (simplified) ───────────────────────────

/**
 * User prompt for template-guided animation.
 * The system prompt handles layout instructions; this just describes content.
 */
export function buildTemplateAnimationUserPrompt(
  description: string,
  action: string,
  frameDescriptions?: string[]
): string {
  const parts = [`Animation: ${description} ${action}.`];
  if (frameDescriptions?.length) {
    const ORDINALS = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth'];
    const descs = frameDescriptions
      .map((d, i) => `Cell ${i + 1} (${ORDINALS[i] ?? 'next'}): ${d}`)
      .join('. ');
    parts.push(descs + '.');
  }
  parts.push(NEGATIVE_ALWAYS);
  return parts.join(' ');
}

// ── Item kit user prompt (simplified) ─────────────────────────────────────

/**
 * User prompt for template-guided item kit generation.
 * The system prompt handles layout; this just lists items.
 */
export function buildItemKitUserPrompt(items: string[]): string {
  const numbered = items.map((item, i) => `${i + 1}: ${item}`).join(' ');
  return `Items: ${numbered}. ${NEGATIVE_ALWAYS}`;
}

// ── Background prompt ─────────────────────────────────────────────────────

export function buildBackgroundPrompt(
  description: string,
  style: Style = 'clean',
  aspect?: string
): string {
  const parts = [
    `Pixel art game background: ${description}.`,
    STYLE_PRESETS[style] + '.',
    'Visible individual pixels, retro game aesthetic, tileable-friendly composition.',
    'Fill the entire canvas edge to edge, no borders, no empty space.',
  ];
  if (aspect) {
    const orientations: Record<string, string> = {
      '3:4': 'portrait orientation (taller than wide)',
      '4:3': 'landscape orientation (wider than tall)',
      '9:16': 'tall portrait orientation',
      '16:9': 'wide landscape orientation',
      '1:1': 'square format',
    };
    parts.push(`Image should be ${orientations[aspect] ?? aspect}.`);
  }
  parts.push('No text, no watermark, no UI elements, no characters.');
  return parts.join(' ');
}

export function buildThumbnailPrompt(description: string, style: Style = 'clean'): string {
  return [
    `Pixel art game screenshot: ${description}.`,
    STYLE_PRESETS[style] + '.',
    'Dynamic action composition, vibrant colors, game-in-action feel.',
    'Visible individual pixels, retro arcade aesthetic.',
    NEGATIVE_ALWAYS,
  ].join(' ');
}

// ── Tileset prompt (godogen-simplified) ───────────────────────────────────

export function buildTilesetPrompt(
  description: string,
  style: Style = 'clean',
  size: number = 32
): string {
  const parts = [
    `${description}. Top-down view, uniform lighting, no shadows, seamless tileable texture, suitable for game engine tiling, clean edges.`,
    STYLE_PRESETS[style] + '.',
  ];
  const hint = detailHintForSize(size);
  if (hint) parts.push(hint);
  parts.push(NEGATIVE_ALWAYS);
  return parts.join(' ');
}

// ── Item kit prompt (legacy, for non-template path) ───────────────────────

export interface GridLayout {
  cols: number;
  rows: number;
  aspect: string;
}

export function computeGridLayout(count: number): GridLayout {
  // Aspect must match grid shape: cols > rows → landscape, cols < rows → portrait
  if (count <= 1) return { cols: 1, rows: 1, aspect: '1:1' };
  if (count <= 2) return { cols: 2, rows: 1, aspect: '16:9' };
  if (count <= 4) return { cols: 2, rows: 2, aspect: '1:1' };
  if (count <= 6) return { cols: 3, rows: 2, aspect: '4:3' };
  if (count <= 8) return { cols: 4, rows: 2, aspect: '16:9' };
  if (count <= 9) return { cols: 3, rows: 3, aspect: '1:1' };
  if (count <= 12) return { cols: 4, rows: 3, aspect: '4:3' };
  return { cols: 4, rows: 4, aspect: '1:1' };
}

export function buildItemKitPrompt(
  items: string[],
  style: Style = 'clean',
  bg: Background = 'black',
  size: number = 48
): string {
  const grid = computeGridLayout(items.length);
  const numbered = items.map((item, i) => `${i + 1}: ${item}`).join(', ');

  const parts = [
    `Pixel art sprite sheet in a ${grid.cols}x${grid.rows} grid.`,
    `Items: ${numbered}.`,
    'Each item in its own grid cell, evenly spaced, same size.',
    'Consistent art style across all items.',
    STYLE_PRESETS[style] + '.',
    PIXEL_ART_CORE.join(', ') + '.',
    SPRITE_RULES.join(', ') + '.',
  ];
  const hint = detailHintForSize(size);
  if (hint) parts.push(hint);
  parts.push(bgPromptFragment(bg));
  parts.push(NEGATIVE_ALWAYS);
  return parts.join(' ');
}
