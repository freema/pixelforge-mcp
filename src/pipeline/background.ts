import type { Background } from '../types/common.js';
import type { BgColor } from './image-ops.js';

interface BgEntry {
  rgb: BgColor;
  hex: string;
  name: string;
}

export const BG_COLOR_MAP: Record<Background, BgEntry> = {
  black: { rgb: { r: 0, g: 0, b: 0 }, hex: '#000000', name: 'black' },
  white: { rgb: { r: 255, g: 255, b: 255 }, hex: '#FFFFFF', name: 'white' },
  chromakey: { rgb: { r: 0, g: 255, b: 0 }, hex: '#00FF00', name: 'chroma key green' },
  forest: { rgb: { r: 74, g: 103, b: 65 }, hex: '#4A6741', name: 'forest green' },
  sky: { rgb: { r: 74, g: 107, b: 138 }, hex: '#4A6B8A', name: 'sky blue' },
  dungeon: { rgb: { r: 42, g: 42, b: 42 }, hex: '#2A2A2A', name: 'dungeon gray' },
  lava: { rgb: { r: 139, g: 37, b: 0 }, hex: '#8B2500', name: 'lava red' },
  ocean: { rgb: { r: 26, g: 58, b: 92 }, hex: '#1A3A5C', name: 'deep ocean blue' },
  sand: { rgb: { r: 194, g: 178, b: 128 }, hex: '#C2B280', name: 'sand beige' },
  snow: { rgb: { r: 216, g: 232, b: 240 }, hex: '#D8E8F0', name: 'snow white-blue' },
  night: { rgb: { r: 10, g: 10, b: 46 }, hex: '#0A0A2E', name: 'night dark blue' },
};

export const VALID_BACKGROUNDS = Object.keys(BG_COLOR_MAP) as Background[];

const AUTO_KEYWORDS: Record<Background, string[]> = {
  black: [],
  white: [],
  forest: ['forest', 'tree', 'woodland', 'jungle', 'bush', 'grass', 'meadow'],
  sky: ['sky', 'cloud', 'bird', 'flying', 'airplane', 'airship'],
  dungeon: ['dungeon', 'cave', 'underground', 'crypt', 'tomb', 'mine'],
  lava: ['lava', 'volcano', 'magma', 'fire', 'inferno', 'hell'],
  ocean: ['ocean', 'sea', 'underwater', 'fish', 'coral', 'submarine', 'water'],
  sand: ['sand', 'desert', 'beach', 'dune', 'pyramid', 'cactus'],
  snow: ['snow', 'ice', 'winter', 'frost', 'arctic', 'polar', 'frozen', 'blizzard'],
  night: ['night', 'dark', 'moon', 'star', 'midnight', 'vampire', 'bat'],
};

/**
 * Resolve a background value. For 'auto', keyword-match from description.
 * Falls back to 'black'.
 */
export function resolveBackground(bg: string | undefined, description: string): Background {
  if (!bg || bg === 'auto') {
    const lower = description.toLowerCase();
    for (const [key, keywords] of Object.entries(AUTO_KEYWORDS)) {
      if (keywords.length === 0) continue;
      if (keywords.some((kw) => lower.includes(kw))) {
        return key as Background;
      }
    }
    return 'black';
  }
  if (bg in BG_COLOR_MAP) return bg as Background;
  return 'black';
}

/**
 * Generate a prompt clause describing the background color,
 * including hex code for non-trivial colors.
 */
export function bgPromptFragment(bgKey: Background): string {
  const entry = BG_COLOR_MAP[bgKey]!;
  if (bgKey === 'black' || bgKey === 'white') {
    return `Pure ${bgKey} background, completely flat solid ${bgKey} with no variation.`;
  }
  if (bgKey === 'chromakey') {
    return `Solid flat chroma key green background, EXACT hex #00FF00 (RGB 0, 255, 0) with NO gradients, NO noise, NO texture. The sprite must have a bold dark pixel outline 2-3 pixels wide around the entire shape.`;
  }
  return `Solid ${entry.name} background (${entry.hex}), completely flat uniform color with no variation.`;
}

/**
 * Get the exact RGB for a named background — no edge-sampling needed.
 */
export function bgToRgb(bgKey: Background): BgColor {
  return { ...BG_COLOR_MAP[bgKey]!.rgb };
}

/**
 * Reconcile the known bg hint with the actual detected bg from edge sampling.
 *
 * Strategy:
 * - If detected is close to hint → model respected our request.
 *   For black/white: use hint (exact 0/255 works best with compositing eq).
 *   For colored bg: use detected (more JPEG-accurate).
 * - If detected is far from hint → model generated a DIFFERENT bg color.
 *   Use detected (it's what's actually in the image).
 */
export function reconcileBgColor(hint: BgColor, detected: BgColor, bgKey: Background): BgColor {
  const close =
    Math.abs(detected.r - hint.r) <= 50 &&
    Math.abs(detected.g - hint.g) <= 50 &&
    Math.abs(detected.b - hint.b) <= 50;

  if (!close) {
    // Model generated a completely different bg — trust what we see
    return detected;
  }

  // Model respected our request — use exact hint for black/white,
  // detected for colored (JPEG shifts hue, detected is more accurate)
  if (bgKey === 'black' || bgKey === 'white') {
    return { ...hint };
  }
  return detected;
}
