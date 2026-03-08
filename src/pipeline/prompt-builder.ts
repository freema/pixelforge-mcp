import type { Style } from '../types/common.js';

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
function detailHintForSize(size: number): string {
  if (size <= 0) return '';
  if (size <= 24)
    return 'Very simple iconic shape, minimal detail, 3-5 colors maximum, bold readable silhouette, chunky features.';
  if (size <= 32) return 'Simple clean design, limited detail, 5-8 colors, clear silhouette.';
  if (size <= 48) return 'Medium detail, clean readable shapes, 8-12 colors.';
  if (size <= 64) return 'Moderate detail with clear features, up to 16 colors.';
  return 'Detailed pixel art, fine features allowed, rich color palette.';
}

export function buildSpritePrompt(
  description: string,
  style: Style = 'clean',
  bg: string = 'black',
  size: number = 48
): string {
  const parts = [
    `Pixel art sprite: ${description}.`,
    STYLE_PRESETS[style] + '.',
    PIXEL_ART_CORE.join(', ') + '.',
    SPRITE_RULES.join(', ') + '.',
  ];
  const hint = detailHintForSize(size);
  if (hint) parts.push(hint);
  parts.push(`Pure ${bg} background, completely flat solid ${bg} with no variation.`);
  parts.push(NEGATIVE_ALWAYS);
  return parts.join(' ');
}

export function buildAnimationPrompt(
  description: string,
  frames: number,
  action: string,
  frameDescriptions: string[] | undefined,
  style: Style = 'clean',
  bg: string = 'black'
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

  return [
    `Pixel art sprite sheet: exactly ${frameWord} frames of ${description} arranged in a single horizontal row, evenly spaced.`,
    frameInstructions,
    STYLE_PRESETS[style] + '.',
    PIXEL_ART_CORE.join(', ') + '.',
    ANIMATION_RULES.join(', ') + '.',
    `Pure ${bg} background, completely flat solid ${bg} with no variation between and around sprites.`,
    `Each frame must be the same size and clearly separated by ${bg} space.`,
    NEGATIVE_ALWAYS,
  ].join(' ');
}

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
